import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";
import { WA } from "@stickers/shared";

/** Raw RGBA pixels. */
export interface Rgba {
  data: Buffer;
  width: number;
  height: number;
}

/** Border-connected background: below this colour distance a pixel is fully transparent. */
const KEY_LOW = 48;
/** Border-connected background: above this distance a pixel is fully opaque. Between the two, alpha ramps. */
const KEY_HIGH = 110;
/**
 * Enclosed areas (the gap between an arm and the body, the inside of a letter) are keyed
 * too, but only when they are very close to the background colour, so a different green
 * on the character survives.
 */
const HOLE_LOW = 30;
const HOLE_HIGH = 70;

/**
 * Removes a flat background (the prompts ask for pure green, but any flat colour works).
 * The background colour is the median of the image border. Pixels connected to the border
 * are keyed generously; enclosed pixels only when they nearly match the background.
 * Semi-transparent edge pixels are un-mixed from the background to avoid a green fringe.
 *
 * Some models (gpt-image-2.6) ignore the green screen and return a cut-out with real
 * transparency. Keying that by colour would erase the dark outlines, so it is only tidied.
 */
export async function removeBackground(input: Buffer | Rgba): Promise<Rgba> {
  const img = Buffer.isBuffer(input) ? await toRgba(input) : { ...input, data: Buffer.from(input.data) };
  if (hasTransparentBorder(img)) return tidyAlpha(img);
  const { data, width: w, height: h } = img;
  const bg = borderMedian(img);

  const dist = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const dr = data[i]! - bg[0];
    const dg = data[i + 1]! - bg[1];
    const db = data[i + 2]! - bg[2];
    dist[p] = Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // Flood fill from the border through background-like pixels.
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (!seen[p] && dist[p]! < KEY_HIGH) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }

  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const [low, high] = seen[p] ? [KEY_LOW, KEY_HIGH] : [HOLE_LOW, HOLE_HIGH];
    const d = dist[p]!;
    if (d >= high) continue;
    if (d <= low) {
      data[i + 3] = 0;
      continue;
    }
    const a = (d - low) / (high - low);
    // observed = a * colour + (1 - a) * bg  =>  colour = (observed - (1 - a) * bg) / a
    for (let c = 0; c < 3; c++) {
      const v = (data[i + c]! - (1 - a) * bg[c]!) / a;
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
    data[i + 3] = Math.round(a * data[i + 3]!);
  }
  despillEdges(img, bg);
  return img;
}

/** How far (px) from the keyed area green spill is removed. Fluffy fur and hair need a few pixels. */
const SPILL_RADIUS = 4;

/**
 * Light bounces off a green screen onto the character's edges (fur, hair), leaving a green
 * fringe that survives keying. For pixels near the cut-out edge, cap the background's
 * dominant channel at the stronger of the other two. Only runs when the background is
 * clearly one primary colour, as the prompts ask.
 */
export function despillEdges({ data, width: w, height: h }: Rgba, bg: [number, number, number]): void {
  const order = [0, 1, 2].sort((a, b) => bg[b]! - bg[a]!);
  const c = order[0]!;
  if (bg[c]! - bg[order[1]!]! < 80) return;
  const [o1, o2] = [0, 1, 2].filter((k) => k !== c) as [number, number];

  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! >= 128) continue;
      // Only transparent pixels touching the character seed the band.
      const touches =
        (x > 0 && data[(y * w + x - 1) * 4 + 3]! >= 128) ||
        (x < w - 1 && data[(y * w + x + 1) * 4 + 3]! >= 128) ||
        (y > 0 && data[((y - 1) * w + x) * 4 + 3]! >= 128) ||
        (y < h - 1 && data[((y + 1) * w + x) * 4 + 3]! >= 128);
      if (!touches) continue;
      for (let yy = Math.max(0, y - SPILL_RADIUS); yy <= Math.min(h - 1, y + SPILL_RADIUS); yy++) {
        for (let xx = Math.max(0, x - SPILL_RADIUS); xx <= Math.min(w - 1, x + SPILL_RADIUS); xx++) near[yy * w + xx] = 1;
      }
    }
  }
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (!near[p] || data[i + 3] === 0) continue;
    const cap = Math.max(data[i + o1]!, data[i + o2]!);
    if (data[i + c]! > cap) data[i + c] = cap;
  }
}

export async function toRgba(input: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** True when most of the image border is already transparent, i.e. the model returned a cut-out. */
function hasTransparentBorder({ data, width: w, height: h }: Rgba): boolean {
  let clear = 0;
  let total = 0;
  const take = (x: number, y: number) => {
    total++;
    if (data[(y * w + x) * 4 + 3]! < 16) clear++;
  };
  for (let x = 0; x < w; x += 2) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    take(0, y);
    take(w - 1, y);
  }
  // A green-screen image has no transparent pixels at all, so half the border is a safe bar
  // even when a waving arm crosses the edge of a cell.
  return clear / total > 0.5;
}

/** Below this alpha a pixel of a cut-out is dropped; above ALPHA_SOLID it is made fully opaque. */
const ALPHA_CLEAR = 8;
/** gpt-image-2.6 draws its characters at alpha 252–254, which would let chat backgrounds show through. */
const ALPHA_SOLID = 240;

/** Snaps a model-made cut-out to clean alpha: no faint haze around it, no see-through body. */
function tidyAlpha(img: Rgba): Rgba {
  const { data } = img;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]!;
    if (a <= ALPHA_CLEAR) {
      data[i - 3] = data[i - 2] = data[i - 1] = data[i] = 0;
    } else if (a >= ALPHA_SOLID) {
      data[i] = 255;
    } else {
      data[i] = Math.round(((a - ALPHA_CLEAR) / (ALPHA_SOLID - ALPHA_CLEAR)) * 255);
    }
  }
  return img;
}

function borderMedian({ data, width: w, height: h }: Rgba): [number, number, number] {
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  };
  for (let k = 0; k < ring; k++) {
    for (let x = 0; x < w; x += 2) {
      take(x, k);
      take(x, h - 1 - k);
    }
    for (let y = 0; y < h; y += 2) {
      take(k, y);
      take(w - 1 - k, y);
    }
  }
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1]!;
  return [med(rs), med(gs), med(bs)];
}

/** Cuts a sprite sheet into cells, left to right, top to bottom. A small inset drops bleed from neighbours. */
export async function sliceGrid(sheet: Buffer, columns: number, rows: number, insetRatio = 0.015): Promise<Buffer[]> {
  const meta = await sharp(sheet).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const cw = Math.floor(w / columns);
  const ch = Math.floor(h / rows);
  const ix = Math.round(cw * insetRatio);
  const iy = Math.round(ch * insetRatio);
  const cells: Buffer[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      cells.push(
        await sharp(sheet)
          .extract({ left: c * cw + ix, top: r * ch + iy, width: cw - 2 * ix, height: ch - 2 * iy })
          .png()
          .toBuffer(),
      );
    }
  }
  return cells;
}

/** Bounding box of pixels with alpha above the threshold, or undefined when empty. */
export function alphaBounds({ data, width: w, height: h }: Rgba, threshold = 24) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? undefined : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface ComposeOptions {
  /** White die-cut border around the character, like a printed sticker. */
  outline?: boolean;
  /** Short text printed along the bottom (for example "LOL"). */
  caption?: string;
  /**
   * How frames are lined up before cropping. The model draws each sprite-sheet cell at a
   * slightly different spot, which reads as jitter. "feet" pins the lower body in place
   * (default); "horizontal" only fixes sideways drift, for motions that leave the ground.
   */
  align?: "feet" | "horizontal" | "none";
}

/**
 * Anchor point of a keyed frame: the horizontal centre of the bottom band of the
 * character (feet/base, which barely moves in most motions) and its lowest row.
 */
export function frameAnchor(f: Rgba, threshold = 24): { x: number; y: number } | undefined {
  const b = alphaBounds(f, threshold);
  if (!b) return undefined;
  const bandTop = b.top + Math.floor(b.height * 0.8);
  let sum = 0;
  let n = 0;
  for (let y = bandTop; y < b.top + b.height; y++) {
    for (let x = b.left; x < b.left + b.width; x++) {
      if (f.data[(y * f.width + x) * 4 + 3]! > threshold) {
        sum += x;
        n++;
      }
    }
  }
  return { x: n ? sum / n : b.left + b.width / 2, y: b.top + b.height };
}

/** Moves a frame's pixels by (dx, dy) on a canvas of the same size; uncovered pixels are transparent. */
function shiftFrame(f: Rgba, dx: number, dy: number): Rgba {
  if (dx === 0 && dy === 0) return f;
  const { width: w, height: h } = f;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    const x0 = Math.max(0, dx);
    const x1 = Math.min(w, w + dx);
    if (x1 <= x0) continue;
    f.data.copy(data, (y * w + x0) * 4, (sy * w + x0 - dx) * 4, (sy * w + x1 - dx) * 4);
  }
  return { data, width: w, height: h };
}

/** Shifts frames so their anchors line up with the first frame's. */
export function alignFrames(frames: Rgba[], mode: "feet" | "horizontal"): Rgba[] {
  const anchors = frames.map((f) => frameAnchor(f));
  const ref = anchors.find(Boolean);
  if (!ref) return frames;
  return frames.map((f, i) => {
    const a = anchors[i];
    if (!a) return f;
    const dx = Math.round(ref.x - a.x);
    const dy = mode === "feet" ? Math.round(ref.y - a.y) : 0;
    return shiftFrame(f, dx, dy);
  });
}

const S = WA.STICKER_SIZE;

/**
 * Places keyed frames on 512x512 transparent canvases. All frames share one crop box and
 * one scale so an animation does not jitter. Returns PNG buffers.
 */
function cropRgba(f: Rgba, w: number, h: number): Rgba {
  if (f.width === w && f.height === h) return f;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) f.data.copy(data, y * w * 4, y * f.width * 4, (y * f.width + w) * 4);
  return { data, width: w, height: h };
}

export async function composeFrames(frames: Rgba[], opts: ComposeOptions = {}): Promise<Buffer[]> {
  if (frames.length === 0) throw new Error("no frames to compose");
  const align = opts.align ?? "feet";
  if (frames.length > 1 && align !== "none") {
    // Frames from one sheet cell may differ in size by a pixel; crop to a common size first.
    const cw = Math.min(...frames.map((f) => f.width));
    const ch = Math.min(...frames.map((f) => f.height));
    frames = alignFrames(frames.map((f) => cropRgba(f, cw, ch)), align);
  }
  const w = Math.min(...frames.map((f) => f.width));
  const h = Math.min(...frames.map((f) => f.height));
  let box: { left: number; top: number; width: number; height: number } | undefined;
  for (const f of frames) {
    const b = alphaBounds(f);
    if (!b) continue;
    if (!box) box = { ...b };
    else {
      const right = Math.max(box.left + box.width, b.left + b.width);
      const bottom = Math.max(box.top + box.height, b.top + b.height);
      box.left = Math.min(box.left, b.left);
      box.top = Math.min(box.top, b.top);
      box.width = right - box.left;
      box.height = bottom - box.top;
    }
  }
  if (!box) throw new Error("the generated image had nothing left after removing the background");
  box.width = Math.min(box.width, w - box.left);
  box.height = Math.min(box.height, h - box.top);

  const pad = opts.outline ? 28 : 16;
  const captionSpace = opts.caption ? 96 : 0;
  const scale = Math.min((S - 2 * pad) / box.width, (S - 2 * pad - captionSpace) / box.height);
  const nw = Math.max(1, Math.round(box.width * scale));
  const nh = Math.max(1, Math.round(box.height * scale));
  const left = Math.round((S - nw) / 2);
  const top = Math.round((S - captionSpace - nh) / 2);

  const out: Buffer[] = [];
  for (const f of frames) {
    const placed = await sharp(f.data, { raw: { width: f.width, height: f.height, channels: 4 } })
      .extract(box)
      .resize(nw, nh, { kernel: "lanczos3" })
      .extend({ top, left, bottom: S - nh - top, right: S - nw - left, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    let frame = opts.outline ? await addOutline(placed) : placed;
    if (opts.caption) frame = await addCaption(frame, opts.caption);
    out.push(frame);
  }
  return out;
}

/**
 * Adds a white die-cut border: every transparent pixel within `radius` of the character
 * turns white, with a one-pixel soft edge. Done on raw pixels so the result does not
 * depend on how sharp orders its operations.
 */
export async function addOutline(png: Buffer, radius = 8): Promise<Buffer> {
  const { data, width: w, height: h } = await toRgba(png);
  const n = w * h;
  // Squared distance to the nearest solid pixel, via a two-pass chamfer transform.
  const INF = 1e9;
  const dx = new Int32Array(n);
  const dy = new Int32Array(n);
  const d2 = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3]! >= 128) d2[p] = 0;
    else {
      d2[p] = INF;
      dx[p] = INF >> 12;
      dy[p] = INF >> 12;
    }
  }
  const relax = (p: number, q: number, ox: number, oy: number) => {
    if (d2[q]! >= INF) return;
    const nx = dx[q]! + ox;
    const ny = dy[q]! + oy;
    const nd = nx * nx + ny * ny;
    if (nd < d2[p]!) {
      d2[p] = nd;
      dx[p] = nx;
      dy[p] = ny;
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x > 0) relax(p, p - 1, 1, 0);
      if (y > 0) {
        relax(p, p - w, 0, 1);
        if (x > 0) relax(p, p - w - 1, 1, 1);
        if (x < w - 1) relax(p, p - w + 1, 1, 1);
      }
    }
    for (let x = w - 2; x >= 0; x--) relax(y * w + x, y * w + x + 1, 1, 0);
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (x < w - 1) relax(p, p + 1, 1, 0);
      if (y < h - 1) {
        relax(p, p + w, 0, 1);
        if (x < w - 1) relax(p, p + w + 1, 1, 1);
        if (x > 0) relax(p, p + w - 1, 1, 1);
      }
    }
    for (let x = 1; x < w; x++) relax(y * w + x, y * w + x - 1, 1, 0);
  }

  // Composite the character over the white border.
  const out = Buffer.alloc(n * 4);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const d = Math.sqrt(d2[p]!);
    const border = d <= radius - 0.5 ? 1 : d >= radius + 0.5 ? 0 : radius + 0.5 - d;
    const fa = data[i + 3]! / 255;
    const oa = fa + border * (1 - fa);
    if (oa <= 0) continue;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round((data[i + c]! * fa + 255 * border * (1 - fa)) / oa);
    out[i + 3] = Math.round(oa * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

let captionFont: opentype.Font | undefined;
function loadCaptionFont(): opentype.Font {
  // Lilita One (SIL Open Font License): chunky, rounded and readable at sticker size.
  captionFont ??= opentype.loadSync(fileURLToPath(new URL("../../assets/fonts/LilitaOne-Regular.ttf", import.meta.url)));
  return captionFont;
}

/** True when the caption font has a glyph for every character of the text. */
export function captionFontCovers(text: string): boolean {
  const font = loadCaptionFont();
  return [...text].every((ch) => /\s/.test(ch) || font.charToGlyphIndex(ch) > 0);
}

/**
 * Prints a caption along the bottom: white letters with a thick dark outline, the classic
 * sticker look. Text is turned into vector paths with the bundled font, so it renders the
 * same on every server whatever fonts are installed.
 */
async function addCaption(png: Buffer, text: string): Promise<Buffer> {
  const font = loadCaptionFont();
  const maxWidth = S - 60;
  let size = 84;
  const width = (sz: number) => font.getAdvanceWidth(text, sz);
  while (size > 40 && width(size) > maxWidth) size -= 2;
  const x = (S - width(size)) / 2;
  const baseline = S - 30;
  const d = font.getPath(text, x, baseline, size).toPathData(2);
  const stroke = Math.round(size * 0.2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <path d="${d}" transform="translate(0 5)" fill="#1a1325" fill-opacity="0.35" stroke="#1a1325" stroke-opacity="0.35" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${d}" fill="#1a1325" stroke="#1a1325" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${d}" fill="#ffffff"/></svg>`;
  return sharp(png).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}
