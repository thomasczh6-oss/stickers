// Worker thread that draws in-between frames with optical flow (OpenCV compiled to WebAssembly).
// Plain JavaScript so it runs the same with or without tsx. The main thread talks to it
// through ./interpolate.ts.
//
// Message in:  { id, width, height, frames: ArrayBuffer[] (RGBA), ts: number[] }
// Message out: { id, pairs: ArrayBuffer[][] }  one RGBA frame per pair of frames and per t
//              { id, error: string }
import { createRequire } from "node:module";
import { parentPort } from "node:worker_threads";

const require = createRequire(import.meta.url);

/** Farneback settings tuned on sticker frames: big window and 5 levels, for large cartoon motions. */
const FB = { pyrScale: 0.5, levels: 5, winSize: 25, iterations: 5, polyN: 7, polySigma: 1.5 };

let cvPromise;
function loadCv() {
  cvPromise ??= new Promise((resolve, reject) => {
    try {
      const mod = require("@techstark/opencv-js");
      if (typeof mod?.then === "function") mod.then(resolve, reject);
      else if (mod.Mat) resolve(mod);
      else mod.onRuntimeInitialized = () => resolve(mod);
    } catch (e) {
      reject(e);
    }
  });
  return cvPromise;
}

/** Grey image of the frame laid on mid grey, so the outline of the character also carries signal. */
function greyOf(cv, rgba, w, h) {
  const n = w * h;
  const g = new cv.Mat(h, w, cv.CV_8UC1);
  const out = g.data;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = rgba[i + 3] / 255;
    const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    out[p] = Math.round(lum * a + 128 * (1 - a));
  }
  return g;
}

/** Premultiplied float RGBA, so transparent pixels do not bleed colour when warped. */
function premultiplied(cv, rgba, w, h) {
  const n = w * h;
  const m = new cv.Mat(h, w, cv.CV_32FC4);
  const f = m.data32F;
  for (let i = 0; i < n * 4; i += 4) {
    const a = rgba[i + 3] / 255;
    f[i] = rgba[i] * a;
    f[i + 1] = rgba[i + 1] * a;
    f[i + 2] = rgba[i + 2] * a;
    f[i + 3] = rgba[i + 3];
  }
  return m;
}

function flow(cv, a, b) {
  const f = new cv.Mat();
  cv.calcOpticalFlowFarneback(a, b, f, FB.pyrScale, FB.levels, FB.winSize, FB.iterations, FB.polyN, FB.polySigma, 0);
  return f;
}

/**
 * Frame at time t between A (t=0) and B (t=1). Flows from t back to each end are approximated
 * from the two-way flows (as in Super SloMo), each end is warped there, and the two are blended.
 */
function inbetween(cv, A, B, f01, f10, t, w, h) {
  const n = w * h;
  const a01 = f01.data32F;
  const a10 = f10.data32F;
  const map0 = new cv.Mat(h, w, cv.CV_32FC2);
  const map1 = new cv.Mat(h, w, cv.CV_32FC2);
  const m0 = map0.data32F;
  const m1 = map1.data32F;
  const c00 = -(1 - t) * t, c01 = t * t;
  const c10 = (1 - t) * (1 - t), c11 = -t * (1 - t);
  for (let p = 0, i = 0; p < n; p++, i += 2) {
    const x = p % w, y = (p / w) | 0;
    m0[i] = x + c00 * a01[i] + c01 * a10[i];
    m0[i + 1] = y + c00 * a01[i + 1] + c01 * a10[i + 1];
    m1[i] = x + c10 * a01[i] + c11 * a10[i];
    m1[i + 1] = y + c10 * a01[i + 1] + c11 * a10[i + 1];
  }
  const wa = new cv.Mat();
  const wb = new cv.Mat();
  const none = new cv.Mat();
  const zero = new cv.Scalar(0, 0, 0, 0);
  cv.remap(A, wa, map0, none, cv.INTER_LINEAR, cv.BORDER_CONSTANT, zero);
  cv.remap(B, wb, map1, none, cv.INTER_LINEAR, cv.BORDER_CONSTANT, zero);
  const pa = wa.data32F;
  const pb = wb.data32F;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n * 4; i += 4) {
    const alpha = (1 - t) * pa[i + 3] + t * pb[i + 3];
    if (alpha < 1) continue;
    const k = 255 / alpha;
    out[i] = clamp(((1 - t) * pa[i] + t * pb[i]) * k);
    out[i + 1] = clamp(((1 - t) * pa[i + 1] + t * pb[i + 1]) * k);
    out[i + 2] = clamp(((1 - t) * pa[i + 2] + t * pb[i + 2]) * k);
    out[i + 3] = clamp(alpha);
  }
  for (const m of [map0, map1, wa, wb, none]) m.delete();
  return out.buffer;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

async function run({ width: w, height: h, frames, ts }) {
  const cv = await loadCv();
  const px = frames.map((b) => new Uint8Array(b));
  const greys = px.map((p) => greyOf(cv, p, w, h));
  const pms = px.map((p) => premultiplied(cv, p, w, h));
  const pairs = [];
  try {
    for (let i = 0; i + 1 < px.length; i++) {
      const f01 = flow(cv, greys[i], greys[i + 1]);
      const f10 = flow(cv, greys[i + 1], greys[i]);
      pairs.push(ts.map((t) => inbetween(cv, pms[i], pms[i + 1], f01, f10, t, w, h)));
      f01.delete();
      f10.delete();
    }
  } finally {
    for (const m of [...greys, ...pms]) m.delete();
  }
  return pairs;
}

// Jobs run one at a time; OpenCV's heap is shared.
let queue = Promise.resolve();
parentPort.on("message", (msg) => {
  queue = queue.then(async () => {
    try {
      const pairs = await run(msg);
      parentPort.postMessage({ id: msg.id, pairs }, pairs.flat());
    } catch (e) {
      parentPort.postMessage({ id: msg.id, error: String(e?.message ?? e) });
    }
  });
});
