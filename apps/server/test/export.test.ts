import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import type { StickerPack } from "@stickers/shared";
import sharp from "sharp";
import { loadConfig } from "../src/config";
import { openDb } from "../src/db/db";
import { createRepo } from "../src/db/repo";
import { APNG_MAX_BYTES, hasFfmpeg, toTelegramWebm, TG } from "../src/export/formats";
import { zip } from "../src/export/zip";
import { createApp } from "../src/http/app";
import { MockImageProvider } from "../src/providers/mock";
import { LocalStorage } from "../src/storage/storage";
import { TelegramBot } from "../src/telegram/bot";
import { processJob } from "../src/worker";

const DEVICE = "device-export-1";

async function makePack(kind: "animated" | "static", telegram?: (storage: LocalStorage, repo: ReturnType<typeof createRepo>) => TelegramBot) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-export-"));
  const cfg = loadConfig({ publicBaseUrl: "http://test.local", telegram: {} });
  const db = await openDb({ dataDir: "memory://" });
  const repo = createRepo(db);
  const storage = new LocalStorage(dir, cfg.publicBaseUrl);
  const bot = telegram?.(storage, repo);
  const app = createApp({ cfg, repo, storage, telegram: bot });
  const call = (p: string, init?: RequestInit) => app.request(p, { ...init, headers: { "content-type": "application/json", "x-device-id": DEVICE } });
  await call("/v1/packs", { method: "POST", body: JSON.stringify({ prompt: "a corgi", style: "cartoon", kind, actions: ["wave", "laugh", "cool"] }) });
  await processJob({ repo, storage, provider: new MockImageProvider(), publisherName: "Test", stickerConcurrency: 3 }, (await repo.claimNextJob())!);
  const packs = ((await (await call("/v1/packs")).json()) as { packs: StickerPack[] }).packs;
  return { db, repo, storage, call, pack: packs[0]!, bot };
}

/** Lists entries of a ZIP and inflates each one, checking its CRC. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(zlib.crc32(data), crc, `crc of ${name}`);
    out.set(name, data);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

test("zip writer round-trips", () => {
  const files = unzip(zip([{ name: "a.txt", data: Buffer.from("hello hello hello hello") }, { name: "b/c.bin", data: Buffer.from([1, 2, 3]) }]));
  assert.equal(files.get("a.txt")!.toString(), "hello hello hello hello");
  assert.deepEqual([...files.get("b/c.bin")!], [1, 2, 3]);
});

test("animated pack: share GIFs and a ZIP for other apps", async () => {
  const { db, call, pack } = await makePack("animated");
  const ex = pack.exports!;
  assert.equal(ex.share.length, 3);
  assert.equal(ex.telegramUrl, undefined, "no bot configured");
  assert.equal(ex.share[0]!.url, `http://test.local/v1/packs/${pack.id}/share/1.gif`);

  const gif = await call(new URL(ex.share[0]!.url).pathname);
  assert.equal(gif.status, 200);
  assert.equal(gif.headers.get("content-type"), "image/gif");
  const meta = await sharp(Buffer.from(await gif.arrayBuffer()), { animated: true }).metadata();
  assert.equal(meta.format, "gif");
  assert.ok((meta.pages ?? 1) > 1, "GIF is animated");
  assert.equal(meta.width, 512);

  assert.equal((await call(`/v1/packs/${pack.id}/share/4.gif`)).status, 404);
  assert.equal((await call(`/v1/packs/${pack.id}/share/1.png`)).status, 404, "animated packs share GIFs");

  const z = await call(new URL(ex.zipUrl).pathname);
  assert.equal(z.status, 200);
  assert.match(z.headers.get("content-disposition") ?? "", /attachment; filename="A corgi\.zip"/);
  const files = unzip(Buffer.from(await z.arrayBuffer()));
  for (const n of ["webp/01.webp", "png/01.png", "gif/01.gif", "tray.png", "HOW-TO.txt"]) assert.ok(files.has(n), n);
  if (await hasFfmpeg()) {
    assert.ok(files.has("apng/01.png"));
    assert.ok(files.get("apng/01.png")!.length <= APNG_MAX_BYTES, "APNG fits Signal's 300KB");
  }
  await db.close();
});

test("static pack shares PNGs", async () => {
  const { db, call, pack } = await makePack("static");
  assert.equal(pack.exports!.share[0]!.mimeType, "image/png");
  const res = await call(new URL(pack.exports!.share[1]!.url).pathname);
  assert.equal(res.status, 200);
  assert.equal((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).format, "png");
  await db.close();
});

test("Telegram video sticker fits Telegram's limits", { skip: !(await hasFfmpeg()) && "no ffmpeg" }, async () => {
  const frames = await Promise.all(
    ["#f00", "#0a0", "#00f"].map((c) => sharp({ create: { width: 512, height: 512, channels: 4, background: c } }).png().toBuffer()),
  );
  const webp = await sharp(frames, { join: { animated: true } }).webp({ delay: [400, 100, 100], loop: 0 }).toBuffer();
  const webm = await toTelegramWebm(webp);
  assert.equal(webm.subarray(0, 4).toString("hex"), "1a45dfa3", "EBML/WebM header");
  assert.ok(webm.length <= TG.MAX_VIDEO_BYTES);
});

test("Telegram bot builds a sticker set for /start <packId>", async () => {
  const calls: { method: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const method = String(url).split("/").pop()!;
    const body = init?.body instanceof FormData ? Object.fromEntries([...(init.body as unknown as Iterable<[string, string | Blob]>)].map(([k, v]) => [k, typeof v === "string" ? v : `file:${v.type}`])) : JSON.parse(String(init?.body ?? "{}"));
    calls.push({ method, body });
    const reply = (result: unknown) => new Response(JSON.stringify({ ok: true, result }));
    if (method === "getMe") return reply({ username: "StickersAIBot" });
    if (method === "getStickerSet") return new Response(JSON.stringify({ ok: false, description: "Bad Request: STICKERSET_INVALID" }), { status: 400 });
    return reply(true);
  }) as typeof fetch;

  let bot!: TelegramBot;
  const { db, pack } = await makePack("animated", (storage, repo) => (bot = new TelegramBot({ token: "t", repo, storage, fetch: fakeFetch })));
  await bot.init();
  assert.equal(bot.startUrl(pack.id), `https://t.me/StickersAIBot?start=${pack.id}`);

  await bot.handleUpdate({ update_id: 1, message: { chat: { id: 42 }, from: { id: 7 }, text: `/start ${pack.id}` } });
  const create = calls.find((c) => c.method === "createNewStickerSet")!.body as Record<string, string | undefined>;
  const name = bot.setName(pack.id, 7);
  assert.match(name, /^s[0-9a-f]{20}_by_StickersAIBot$/);
  assert.equal(create.user_id, "7");
  assert.equal(create.name, name);
  const stickers = JSON.parse(create.stickers!) as { sticker: string; format: string; emoji_list: string[] }[];
  assert.equal(stickers.length, 3);
  const video = await hasFfmpeg();
  assert.equal(stickers[0]!.format, video ? "video" : "static");
  assert.equal(create.f0, video ? "file:video/webm" : "file:image/png");
  const last = calls.at(-1)!;
  assert.equal(last.method, "sendMessage");
  assert.deepEqual((last.body as { reply_markup: unknown }).reply_markup, { inline_keyboard: [[{ text: "Add stickers", url: `https://t.me/addstickers/${name}` }]] });

  // Unknown start parameter gets the help text, not an error.
  await bot.handleUpdate({ update_id: 2, message: { chat: { id: 42 }, from: { id: 7 }, text: "/start" } });
  assert.match((calls.at(-1)!.body as { text: string }).text, /Add to Telegram/);
  await db.close();
});
