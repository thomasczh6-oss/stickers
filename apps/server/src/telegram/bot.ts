import crypto from "node:crypto";
import type { StickerPack } from "@stickers/shared";
import type { Repo } from "../db/repo";
import { hasFfmpeg, toPng, toTelegramWebm } from "../export/formats";
import type { Storage } from "../storage/storage";

/**
 * Telegram is the one big app besides WhatsApp that lets another app create sticker sets:
 * a bot makes the set for the user (Bot API createNewStickerSet), then the user taps
 * t.me/addstickers/<name> to add it. Our apps open t.me/<bot>?start=<packId>, Telegram
 * sends the bot "/start <packId>", and the bot builds the set and replies with the link.
 */
export interface TelegramDeps {
  token: string;
  repo: Pick<Repo, "getPack">;
  storage: Storage;
  /** Only for tests. */
  apiBase?: string;
  fetch?: typeof fetch;
}

interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number; is_bot?: boolean; first_name?: string }; text?: string };
}

const PACK_ID = /^pk_[A-Za-z0-9_-]{6,40}$/;

export class TelegramBot {
  username = "";
  private readonly api: string;
  private readonly fetch: typeof fetch;
  private readonly busy = new Set<string>();
  private stopped = false;

  constructor(private readonly deps: TelegramDeps) {
    this.api = `${deps.apiBase ?? "https://api.telegram.org"}/bot${deps.token}`;
    this.fetch = deps.fetch ?? fetch;
  }

  /** Link our apps open. */
  startUrl(packId: string) {
    return `https://t.me/${this.username}?start=${packId}`;
  }

  async init() {
    const me = await this.call<{ username: string }>("getMe", {});
    this.username = me.username;
    return this;
  }

  /** Telegram set names: letters, digits, single underscores, ending in _by_<bot>. One set per pack and user. */
  setName(packId: string, userId: number) {
    const hash = crypto.createHash("sha256").update(`${packId}:${userId}`).digest("hex").slice(0, 20);
    return `s${hash}_by_${this.username}`;
  }

  async handleUpdate(update: TgUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text || !msg.from || msg.from.is_bot) return;
    const chatId = msg.chat.id;
    const [cmd, arg] = msg.text.trim().split(/\s+/, 2);
    if (cmd !== "/start" || !arg || !PACK_ID.test(arg)) {
      await this.send(chatId, "Hi! Make a sticker pack in the Stickers AI app, then tap “Add to Telegram” on it. I’ll turn it into a Telegram sticker set for you.");
      return;
    }
    const pack = await this.deps.repo.getPack(arg);
    if (!pack) {
      await this.send(chatId, "I couldn’t find that sticker pack. It may have been deleted.");
      return;
    }
    const userId = msg.from.id;
    const name = this.setName(pack.id, userId);
    if (this.busy.has(name)) return;
    this.busy.add(name);
    try {
      if (!(await this.setExists(name))) {
        await this.send(chatId, `Making “${pack.name}” into a Telegram sticker set. This takes a few seconds…`);
        await this.createSet(pack, userId, name);
      }
      await this.send(chatId, `“${pack.name}” is ready. Tap below to add it to Telegram.`, {
        inline_keyboard: [[{ text: "Add stickers", url: `https://t.me/addstickers/${name}` }]],
      });
    } catch (e) {
      console.error(`[telegram] pack ${pack.id} for user ${userId}:`, e);
      await this.send(chatId, "Sorry, something went wrong making your Telegram stickers. Please try again in a minute.").catch(() => undefined);
    } finally {
      this.busy.delete(name);
    }
  }

  private async setExists(name: string) {
    try {
      await this.call("getStickerSet", { name });
      return true;
    } catch (e) {
      if (e instanceof TelegramError && /STICKERSET_INVALID|not found/i.test(e.message)) return false;
      throw e;
    }
  }

  private async createSet(pack: StickerPack, userId: number, name: string) {
    // Animated stickers become WEBM video stickers; without ffmpeg we fall back to stills.
    const video = pack.animated && (await hasFfmpeg());
    const form = new FormData();
    const stickers = [];
    // A new set takes at most 50 stickers; our packs hold at most 30.
    for (const [i, s] of pack.stickers.slice(0, 50).entries()) {
      const webp = await this.deps.storage.get(`packs/${pack.id}/${s.fileName}`);
      const file = video ? await toTelegramWebm(webp) : pack.animated ? await toPng(webp) : webp;
      const ext = video ? "webm" : pack.animated ? "png" : "webp";
      const type = video ? "video/webm" : pack.animated ? "image/png" : "image/webp";
      form.append(`f${i}`, new Blob([new Uint8Array(file)], { type }), `${i}.${ext}`);
      stickers.push({ sticker: `attach://f${i}`, format: video ? "video" : "static", emoji_list: s.emojis.slice(0, 20) });
    }
    form.append("user_id", String(userId));
    form.append("name", name);
    form.append("title", pack.name.slice(0, 64));
    form.append("sticker_type", "regular");
    form.append("stickers", JSON.stringify(stickers));
    await this.call("createNewStickerSet", form);
  }

  private send(chatId: number, text: string, replyMarkup?: unknown) {
    return this.call("sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
  }

  async call<T = unknown>(method: string, body: Record<string, unknown> | FormData): Promise<T> {
    const res = await this.fetch(`${this.api}/${method}`, {
      method: "POST",
      ...(body instanceof FormData ? { body } : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!json.ok) throw new TelegramError(`${method}: ${json.description ?? `HTTP ${res.status}`}`);
    return json.result as T;
  }

  /** Long polling, for servers without a public HTTPS address (a dev laptop). */
  async poll() {
    await this.call("deleteWebhook", {});
    let offset = 0;
    while (!this.stopped) {
      try {
        const updates = await this.call<TgUpdate[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
        for (const u of updates) {
          offset = u.update_id + 1;
          this.handleUpdate(u).catch((e) => console.error("[telegram]", e));
        }
      } catch (e) {
        if (this.stopped) break;
        console.error("[telegram] poll:", (e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  async setWebhook(url: string, secret: string) {
    await this.call("setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });
  }

  stop() {
    this.stopped = true;
  }
}

export class TelegramError extends Error {}
