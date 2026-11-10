import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { decodeAnimation } from "../pipeline/encode";

const run = promisify(execFile);

/**
 * Animated GIF for apps without sticker import (iMessage, Messenger, Instagram, Signal, Discord...).
 * GIF only has on/off transparency; the white outline every sticker has hides the hard edge.
 */
export async function toGif(webp: Buffer): Promise<Buffer> {
  const meta = await sharp(webp, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;
  return sharp(webp, { animated })
    .gif({ effort: 7, dither: 0.6, loop: 0, interFrameMaxError: 4, ...(animated && meta.delay ? { delay: meta.delay } : {}) })
    .toBuffer();
}

/** First frame as a 512x512 PNG with full transparency (static packs share this, it looks better than GIF). */
export async function toPng(webp: Buffer): Promise<Buffer> {
  return sharp(webp, { page: 0, pages: 1 }).png({ compressionLevel: 9 }).toBuffer();
}

/** Telegram video sticker limits: https://core.telegram.org/stickers#video-requirements */
export const TG = { SIZE: 512, MAX_VIDEO_BYTES: 256 * 1024, MAX_VIDEO_MS: 3000, FPS: 30 } as const;

let ffmpegChecked: Promise<boolean> | undefined;
/** True when an ffmpeg with VP9 is on PATH (or FFMPEG_PATH). Needed for Telegram's animated stickers. */
export function hasFfmpeg(): Promise<boolean> {
  ffmpegChecked ??= run(ffmpegBin(), ["-hide_banner", "-encoders"])
    .then(({ stdout }) => stdout.includes("libvpx-vp9"))
    .catch(() => false);
  return ffmpegChecked;
}

function ffmpegBin() {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

/**
 * Animated WebP -> Telegram video sticker: WEBM, VP9 with alpha, 512x512, no audio, at most 3s
 * and 256KB. Frames are repeated to a fixed 30fps so each keeps its own duration.
 */
export async function toTelegramWebm(webp: Buffer): Promise<Buffer> {
  const { frames, delaysMs } = await decodeAnimation(webp);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-webm-"));
  try {
    const frameMs = 1000 / TG.FPS;
    let n = 0;
    let elapsed = 0;
    for (let i = 0; i < frames.length && elapsed < TG.MAX_VIDEO_MS; i++) {
      const repeat = Math.max(1, Math.round((delaysMs[i] ?? 100) / frameMs));
      for (let r = 0; r < repeat && elapsed < TG.MAX_VIDEO_MS; r++, elapsed += frameMs) {
        await fs.writeFile(path.join(dir, `f${String(n++).padStart(4, "0")}.png`), frames[i]!);
      }
    }
    const out = path.join(dir, "out.webm");
    for (const crf of [34, 40, 46, 52, 58]) {
      await run(ffmpegBin(), [
        "-y", "-loglevel", "error",
        "-framerate", String(TG.FPS),
        "-i", path.join(dir, "f%04d.png"),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", String(crf),
        "-deadline", "good", "-row-mt", "1", "-an",
        "-vf", `scale=${TG.SIZE}:${TG.SIZE}:force_original_aspect_ratio=decrease`,
        out,
      ]);
      const file = await fs.readFile(out);
      if (file.length <= TG.MAX_VIDEO_BYTES) return file;
    }
    throw new Error("could not fit the Telegram video sticker under 256KB");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Signal's per-sticker limit, the strictest of the apps that take APNG. */
export const APNG_MAX_BYTES = 300 * 1024;

/**
 * Animated WebP -> APNG at 512x512, for Signal (animated stickers must be APNG) and Discord.
 * Each frame keeps its own duration. Returns undefined when there is no ffmpeg.
 */
export async function toApng(webp: Buffer): Promise<Buffer | undefined> {
  if (!(await hasFfmpeg())) return undefined;
  const { frames, delaysMs } = await decodeAnimation(webp);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "apng-"));
  try {
    const lines: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const f = `f${String(i).padStart(4, "0")}.png`;
      await fs.writeFile(path.join(dir, f), frames[i]!);
      lines.push(`file '${f}'`, `duration ${((delaysMs[i] ?? 100) / 1000).toFixed(3)}`);
    }
    // The concat demuxer ignores the last duration unless the last file is listed again.
    lines.push(lines[lines.length - 2]!);
    await fs.writeFile(path.join(dir, "list.txt"), lines.join("\n"));
    const out = path.join(dir, "out.png");
    // A shared palette keeps it small: Signal allows 300KB per sticker, Discord 512KB.
    let file: Buffer | undefined;
    for (const colors of [256, 128, 64]) {
      await run(ffmpegBin(), [
        "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-fps_mode", "vfr",
        "-vf", `split[a][b];[a]palettegen=max_colors=${colors}:reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=alpha_threshold=128:dither=sierra2_4a`,
        "-plays", "0", "-f", "apng", "-pred", "mixed", out,
      ]);
      file = await fs.readFile(out);
      if (file.length <= APNG_MAX_BYTES) break;
    }
    return file;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
