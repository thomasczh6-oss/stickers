import { actionName, DEFAULT_LOCALE, findAction, findStyle, getMessages, toPackIdentifier, validatePackMeta, WA, type Sticker, type StickerPack } from "@stickers/shared";
import type { StoredRequest } from "../db/repo";
import { type ImageProvider, ProviderError } from "../providers";
import type { Storage } from "../storage/storage";
import { encodeAnimated, encodeStatic, encodeTrayIcon, inspectSticker, pingPong } from "./encode";
import { captionFontCovers, composeFrames, fitCaption, removeBackground, sliceGrid } from "./image";
import { characterPrompt, posePrompt, SHEET, spriteSheetPrompt } from "./prompts";

export interface GenerateDeps {
  provider: ImageProvider;
  storage: Storage;
  publisherName: string;
  stickerConcurrency: number;
}

export interface GenerateInput {
  packId: string;
  request: StoredRequest;
  photo?: { data: Buffer; mimeType: string };
  onProgress?: (done: number, step: string) => Promise<void> | void;
}

/** Delay between frames of a sprite-sheet animation. 4 frames ping-ponged = 6 frames, about 0.7s per loop. */
/** Frame timing: the key pose holds a moment (it is also the still WhatsApp shows), the in-betweens move quickly. */
const KEY_FRAME_MS = 420;
const FRAME_MS = 100;
const GEN_SIZE = "1024x1024";

/**
 * Builds one WhatsApp sticker pack: a character sheet first, then one sticker per action
 * (sprite sheet for animated, single pose for static), then the tray icon.
 */
export async function generatePack(deps: GenerateDeps, input: GenerateInput): Promise<StickerPack> {
  const { request, packId } = input;
  const style = findStyle(request.style);
  if (!style) throw new Error(`unknown style ${request.style}`);
  const animated = request.kind === "animated";
  const prefix = `packs/${packId}`;
  let done = 0;
  const progress = async (step: string) => {
    done += 1;
    await input.onProgress?.(done, step);
  };

  // 1. Character reference, so every sticker shows the same character.
  const character = await withRetry(() =>
    deps.provider.image({
      prompt: characterPrompt({ style, description: request.prompt, fromPhoto: Boolean(input.photo) }),
      images: input.photo ? [input.photo] : [],
      size: GEN_SIZE,
      intent: { kind: "character" },
    }),
  );
  await deps.storage.put(`${prefix}/source/character.png`, character, "image/png");
  await progress("character");

  // 2. One sticker per action (preset or the user's own).
  const specs = stickerSpecs(request);
  const results = await mapLimit(specs, deps.stickerConcurrency, async (action, index) => {
    const reference = [{ data: character, mimeType: "image/png" }];
    const caption = action.caption ? fitCaption(action.caption) : undefined;
    try {
      let file: Buffer;
      let firstFrame: Buffer;
      if (animated) {
        const sheet = await withRetry(() =>
          deps.provider.image({
            prompt: spriteSheetPrompt({ style, action }),
            images: reference,
            size: SHEET.size,
            intent: { kind: "spritesheet", label: action.label, columns: SHEET.columns, rows: SHEET.rows },
          }),
        );
        await deps.storage.put(`${prefix}/source/${action.id}-sheet.png`, sheet, "image/png");
        const cells = await sliceGrid(sheet, SHEET.columns, SHEET.rows);
        const keyed = await Promise.all(cells.map((c) => removeBackground(c)));
        const frames = await composeFrames(keyed, { outline: true, caption, align: action.wholeBody ? "horizontal" : "feet" });
        firstFrame = frames[0]!;
        const seq = pingPong(frames);
        file = await encodeAnimated(seq, seq.map((_, i) => (i === 0 ? KEY_FRAME_MS : FRAME_MS)));
      } else {
        const img = await withRetry(() =>
          deps.provider.image({ prompt: posePrompt({ style, action }), images: reference, size: GEN_SIZE, intent: { kind: "pose", label: action.label } }),
        );
        await deps.storage.put(`${prefix}/source/${action.id}.png`, img, "image/png");
        const [frame] = await composeFrames([await removeBackground(img)], { outline: true, caption });
        firstFrame = frame!;
        file = await encodeStatic(firstFrame);
      }
      const problems = await inspectSticker(file, animated);
      if (problems.length) throw new Error(`sticker ${action.id} breaks WhatsApp rules: ${problems.join("; ")}`);
      const fileName = `${String(index + 1).padStart(2, "0")}.webp`;
      await deps.storage.put(`${prefix}/${fileName}`, file, "image/webp");
      await progress(action.id);
      const sticker: Omit<Sticker, "index"> = {
        id: `${packId}-${action.id}`,
        fileName,
        url: deps.storage.url(`${prefix}/${fileName}`),
        bytes: file.length,
        emojis: action.emojis.slice(0, WA.EMOJI_MAX),
        accessibilityText: `${action.label ? `${action.label}: ` : ""}a character ${action.pose}`.slice(0, animated ? WA.ACCESSIBILITY_ANIMATED_MAX : WA.ACCESSIBILITY_STATIC_MAX),
      };
      return { sticker, firstFrame };
    } catch (e) {
      // One failed sticker should not sink the pack; the pack still needs at least 3.
      console.warn(`[generate] ${packId} sticker ${action.id} failed: ${(e as Error).message}`);
      await progress(`${action.id} (skipped)`);
      return undefined;
    }
  });

  const ok = results.filter((r): r is NonNullable<typeof r> => r !== undefined);
  if (ok.length < WA.PACK_MIN_STICKERS) {
    throw new ProviderError(`only ${ok.length} of ${specs.length} stickers could be made; a WhatsApp pack needs at least ${WA.PACK_MIN_STICKERS}`);
  }

  // 3. Tray icon from the first sticker.
  const tray = await encodeTrayIcon(ok[0]!.firstFrame);
  await deps.storage.put(`${prefix}/tray.png`, tray, "image/png");

  const name = (request.packName || defaultPackName(request)).slice(0, WA.NAME_MAX);
  const pack: StickerPack = {
    id: packId,
    identifier: toPackIdentifier(packId),
    name,
    publisher: deps.publisherName.slice(0, WA.PUBLISHER_MAX),
    animated,
    trayIconFileName: "tray.png",
    trayIconUrl: deps.storage.url(`${prefix}/tray.png`),
    stickers: ok.map((r, index) => ({ ...r.sticker, index })),
    imageDataVersion: 1,
    createdAt: new Date().toISOString(),
  };
  const issues = validatePackMeta(pack);
  if (issues.length) throw new Error(`pack breaks WhatsApp rules: ${issues.join("; ")}`);
  await progress("packaging");
  return pack;
}

/**
 * The caption in the maker's language, e.g. "¡Hola!" instead of "Hi!". Falls back to the
 * English label when the caption font can't draw the translation.
 */
function captionText(actionId: string, english: string, locale = DEFAULT_LOCALE): string {
  const text = actionName(getMessages(locale), actionId);
  return captionFontCovers(text) ? text : english;
}

function defaultPackName(req: StoredRequest) {
  const base = req.prompt?.trim() || getMessages(req.locale ?? DEFAULT_LOCALE).pack.defaultName;
  const short = base.length > 30 ? `${base.slice(0, 29).trimEnd()}…` : base;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** Motions where the whole body moves up or down, so pinning the feet would erase it. */
const LEAVES_GROUND = new Set<string>(["party", "shock"]);

interface StickerSpec {
  /** Used in file names of the source images. */
  id: string;
  label: string;
  pose: string;
  motion: string;
  caption?: string;
  emojis: string[];
  wholeBody: boolean;
}

/** Fallback motion for a custom sticker that only describes a pose. */
const defaultMotion = (pose: string) => `acting out "${pose}" with big, lively cartoon movement, then coming back to the start`;
const DEFAULT_EMOJIS = ["😀"];

/** Presets and custom stickers become the same list of things to draw. */
export function stickerSpecs(req: StoredRequest): StickerSpec[] {
  if (req.stickers?.length) {
    return req.stickers.map((s, i) => ({
      id: `custom${String(i + 1).padStart(2, "0")}`,
      label: s.caption ?? "",
      pose: s.pose,
      motion: s.motion || defaultMotion(s.pose),
      caption: s.caption || undefined,
      emojis: s.emojis?.length ? s.emojis : DEFAULT_EMOJIS,
      wholeBody: s.wholeBody === true,
    }));
  }
  return req.actions.map((actionId) => {
    const a = findAction(actionId);
    if (!a) throw new Error(`unknown action ${actionId}`);
    return {
      id: a.id,
      label: a.label,
      pose: a.pose,
      motion: a.motion,
      caption: req.captions ? captionText(a.id, a.label, req.locale) : undefined,
      emojis: [...a.emojis],
      wholeBody: LEAVES_GROUND.has(a.id),
    };
  });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable = e instanceof ProviderError ? e.retryable : false;
      if (!retryable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}
