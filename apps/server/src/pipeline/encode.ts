import sharp from "sharp";
import { validateStickerFile, WA } from "@stickers/shared";

const ANIMATED_QUALITIES = [80, 70, 60, 50, 40, 30, 22];
const STATIC_QUALITIES = [90, 80, 70, 60, 50, 40, 30];

/** Frame order for a short clip: play forward then back so the loop ends on frame 1 (WhatsApp stops on the first frame). */
export function pingPong<T>(frames: T[]): T[] {
  if (frames.length < 3) return frames;
  return [...frames, ...frames.slice(1, -1).reverse()];
}

export interface AnimatedOptions {
  /** Lowest quality to try before giving up (or dropping frames). Default: the whole ladder. */
  minQuality?: number;
  /** Drop every other frame when nothing fits. Default true; false throws instead. */
  dropFrames?: boolean;
}

/**
 * Encodes 512x512 PNG frames as an animated WebP within WhatsApp's 500KB / 10s limits.
 * `delays` is one duration for every frame, or one per frame. Lowers quality first, then
 * drops every other frame (keeping the first, and folding the dropped time into the kept
 * frame so the pace stays the same) if still too big.
 */
export async function encodeAnimated(frames: Buffer[], delays: number | number[], opts: AnimatedOptions = {}): Promise<Buffer> {
  const qualities = ANIMATED_QUALITIES.filter((q) => q >= (opts.minQuality ?? 0));
  let seq = frames;
  let ds = (Array.isArray(delays) ? delays : frames.map(() => delays)).map((d) => Math.max(WA.MIN_FRAME_MS, d));
  if (ds.length !== seq.length) throw new Error("one delay per frame is required");
  const halve = () => {
    const keep = seq.map((_, i) => i).filter((i) => i % 2 === 0);
    ds = keep.map((i) => ds[i]! + (ds[i + 1] ?? 0));
    seq = keep.map((i) => seq[i]!);
  };
  const total = () => ds.reduce((a, b) => a + b, 0);
  if (total() > WA.MAX_ANIMATION_MS) {
    const k = WA.MAX_ANIMATION_MS / total();
    ds = ds.map((d) => Math.max(WA.MIN_FRAME_MS, Math.floor(d * k)));
  }
  for (;;) {
    for (const quality of qualities) {
      const out = await sharp(seq, { join: { animated: true } })
        .webp({ quality, alphaQuality: Math.max(50, quality), effort: 5, smartSubsample: true, loop: 0, delay: ds })
        .toBuffer();
      if (out.length <= WA.ANIMATED_MAX_BYTES) return out;
    }
    if (seq.length <= 2 || opts.dropFrames === false) break;
    halve();
  }
  throw new Error("could not fit the animation under 500KB");
}

/** Encodes one 512x512 PNG as a static WebP under 100KB. */
export async function encodeStatic(frame: Buffer): Promise<Buffer> {
  for (const quality of STATIC_QUALITIES) {
    const out = await sharp(frame).webp({ quality, alphaQuality: Math.max(60, quality), effort: 6, smartSubsample: true }).toBuffer();
    if (out.length <= WA.STATIC_MAX_BYTES) return out;
  }
  throw new Error("could not fit the sticker under 100KB");
}

/** 96x96 PNG tray icon under 50KB. */
export async function encodeTrayIcon(frame: Buffer): Promise<Buffer> {
  for (const quality of [100, 80, 60]) {
    const out = await sharp(frame)
      .resize(WA.TRAY_SIZE, WA.TRAY_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, quality, compressionLevel: 9, effort: 10 })
      .toBuffer();
    if (out.length <= WA.TRAY_MAX_BYTES) return out;
  }
  throw new Error("could not fit the tray icon under 50KB");
}

/** Reads back an encoded sticker and checks it against WhatsApp rules. Returns problems, empty when valid. */
export async function inspectSticker(file: Buffer, animated: boolean): Promise<string[]> {
  const meta = await sharp(file, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  const height = meta.pageHeight ?? meta.height ?? 0;
  const delays = pages > 1 ? (meta.delay ?? []) : [];
  if (meta.format !== "webp") return [`must be WebP, is ${meta.format}`];
  return validateStickerFile({ width: meta.width ?? 0, height, bytes: file.length, frameDelaysMs: delays }, animated);
}

/** Decodes an animated GIF/WebP (for models that return animation directly) into PNG frames + delays. */
export async function decodeAnimation(file: Buffer): Promise<{ frames: Buffer[]; delaysMs: number[] }> {
  const meta = await sharp(file, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  const frames: Buffer[] = [];
  for (let page = 0; page < pages; page++) {
    frames.push(await sharp(file, { page, pages: 1 }).png().toBuffer());
  }
  const delaysMs = frames.map((_, i) => meta.delay?.[i] ?? 100);
  return { frames, delaysMs };
}
