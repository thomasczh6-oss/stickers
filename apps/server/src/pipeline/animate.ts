import { encodeAnimated, pingPong } from "./encode";
import { type ComposeOptions, finishFrame, type Rgba } from "./image";
import type { Interpolator } from "./interpolate";

/** The key pose holds a moment (it is also the still WhatsApp shows). */
export const KEY_FRAME_MS = 420;
/** Time from one drawn frame to the next. In-between frames split it. */
export const STEP_MS = 100;

/** In-between times drawn once per pair of frames; each plan below uses some of them. */
const TS = [1 / 3, 1 / 2, 2 / 3];
/**
 * Smoothest first. With 6 drawn frames played forward and back: two in-betweens per step
 * give 30 frames (about 30 fps), one gives 20. A plan is used only if it fits WhatsApp's
 * 500KB at or above its quality floor; otherwise the next one is tried.
 */
const PLANS = [
  { pick: [0, 2], minQuality: 70 },
  { pick: [1], minQuality: 60 },
];

export interface Clip {
  file: Buffer;
  /** The key pose, finished; used for the tray icon. */
  firstFrame: Buffer;
  /** Frames in one loop of the encoded clip. */
  frames: number;
}

/**
 * Encodes placed sticker frames (see `placeFrames`) as a looping animated WebP. With an
 * interpolator, adds optical-flow in-betweens so the motion is smooth instead of choppy;
 * if that fails or the file would be too big, falls back to fewer or only the drawn frames.
 */
export async function encodeClip(placed: Rgba[], look: Pick<ComposeOptions, "outline" | "caption">, interpolator?: Interpolator): Promise<Clip> {
  const drawn = await Promise.all(placed.map((f) => finishFrame(f, look)));
  const firstFrame = drawn[0]!;
  const mids = interpolator && placed.length > 1 ? await inbetweens(interpolator, placed, look) : undefined;
  if (mids) {
    for (const plan of PLANS) {
      const forward = drawn.flatMap((d, i) => (i < mids.length ? [d, ...plan.pick.map((k) => mids[i]![k]!)] : [d]));
      const seq = pingPong(forward);
      try {
        const file = await encodeAnimated(seq, delays(seq.length, STEP_MS / (plan.pick.length + 1)), { minQuality: plan.minQuality, dropFrames: false });
        return { file, firstFrame, frames: seq.length };
      } catch {
        // Too big at this quality floor: try fewer frames.
      }
    }
  }
  const seq = pingPong(drawn);
  return { file: await encodeAnimated(seq, delays(seq.length, STEP_MS)), firstFrame, frames: seq.length };
}

async function inbetweens(interpolator: Interpolator, placed: Rgba[], look: Pick<ComposeOptions, "outline" | "caption">) {
  try {
    const pairs = await interpolator.inbetweens(placed, TS);
    return await Promise.all(pairs.map((pair) => Promise.all(pair.map((f) => finishFrame(f, look)))));
  } catch (e) {
    console.warn(`[animate] in-between frames failed, using the drawn frames only: ${(e as Error).message}`);
    return undefined;
  }
}

function delays(count: number, stepMs: number): number[] {
  return Array.from({ length: count }, (_, i) => (i === 0 ? KEY_FRAME_MS : Math.round(stepMs)));
}
