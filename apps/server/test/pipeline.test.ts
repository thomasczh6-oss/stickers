import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { ACTIONS, STYLES, WA } from "@stickers/shared";
import { inspectSticker } from "../src/pipeline/encode";
import { generatePack } from "../src/pipeline/generatePack";
import { addOutline, alignFrames, alphaBounds, frameAnchor, removeBackground, toRgba } from "../src/pipeline/image";
import { FlowInterpolator, type Interpolator } from "../src/pipeline/interpolate";
import { characterPrompt, spriteSheetPrompt } from "../src/pipeline/prompts";
import { MockImageProvider } from "../src/providers/mock";
import { LocalStorage } from "../src/storage/storage";

test("background removal keys the border colour and enclosed holes, but keeps other greens", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="#05f803"/>
    <circle cx="100" cy="100" r="70" fill="#d03030"/>
    <circle cx="80" cy="100" r="12" fill="#05f803"/>
    <circle cx="125" cy="100" r="12" fill="#3cb043"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = await removeBackground(png);
  const alphaAt = (x: number, y: number) => out.data[(y * out.width + x) * 4 + 3];
  assert.equal(alphaAt(5, 5), 0, "corner is transparent");
  assert.equal(alphaAt(100, 50), 255, "character body stays opaque");
  assert.equal(alphaAt(80, 100), 0, "an enclosed hole of the background colour is removed");
  assert.equal(alphaAt(125, 100), 255, "a different green inside the character stays");
});

test("background removal leaves a model-made cut-out alone, keeping dark outlines", async () => {
  // What gpt-image-2.6 returns: transparent background, a dark-outlined body at alpha ~253.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <circle cx="100" cy="100" r="70" fill="#f0a030" fill-opacity="0.99" stroke="#1a1010" stroke-width="8" stroke-opacity="0.99"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = await removeBackground(png);
  const px = (x: number, y: number) => Array.from(out.data.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4));
  assert.equal(px(5, 5)[3], 0, "corner stays transparent");
  assert.equal(px(100, 100)[3], 255, "nearly opaque body becomes fully opaque");
  const outline = px(100, 30);
  assert.equal(outline[3], 255, "dark outline is kept");
  assert.ok(outline[0]! < 60, "outline keeps its dark colour");
});

test("realistic styles keep the real likeness instead of a cute cartoon", () => {
  const photo = STYLES.find((s) => s.id === "photo")!;
  const cartoon = STYLES.find((s) => s.id === "cartoon")!;
  const fromPhoto = characterPrompt({ style: photo, fromPhoto: true });
  assert.match(fromPhoto, /real face and likeness/);
  assert.match(fromPhoto, /waist up/);
  assert.doesNotMatch(fromPhoto, /cute sticker character/);
  // A planner or user may still write "chibi"; the realistic style must override it.
  assert.match(characterPrompt({ style: photo, description: "a chibi nurse", fromPhoto: false }), /do not turn the subject into a cartoon, anime or chibi/);
  assert.match(spriteSheetPrompt({ style: photo, action: ACTIONS[0] }), /short video clip/);
  assert.match(characterPrompt({ style: cartoon, fromPhoto: true }), /cute sticker character/);
});

test("outline adds a white border around the character", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="150" fill="#d03030"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = await toRgba(await addOutline(png, 8));
  const px = (x: number, y: number) => Array.from(out.data.subarray((y * 512 + x) * 4, (y * 512 + x) * 4 + 4));
  assert.deepEqual(px(256, 256), [208, 48, 48, 255], "inside keeps its colour");
  assert.deepEqual(px(256 + 154, 256), [255, 255, 255, 255], "just outside is white");
  assert.equal(px(256 + 170, 256)[3], 0, "far outside stays transparent");
  assert.equal(px(5, 5)[3], 0);
});

const flow = new FlowInterpolator();

async function makePack(kind: "animated" | "static", captions: boolean, interpolator?: Interpolator) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-test-"));
  const storage = new LocalStorage(dir, "http://test.local");
  const steps: string[] = [];
  const pack = await generatePack(
    { provider: new MockImageProvider(), storage, publisherName: "Test", stickerConcurrency: 3, interpolator },
    {
      packId: "pk_test",
      request: { prompt: "a happy corgi", style: "cartoon", kind, actions: ["wave", "laugh", "love", "cry"], captions },
      onProgress: (_done, step) => {
        steps.push(step);
      },
    },
  );
  return { pack, dir, steps };
}

test("animated pack: every sticker is a smooth, valid WhatsApp animated WebP", async () => {
  const { pack, dir, steps } = await makePack("animated", true, flow);
  assert.equal(pack.animated, true);
  assert.equal(pack.stickers.length, 4);
  assert.deepEqual(steps, ["character", ...steps.slice(1, 5), "packaging"]);
  for (const s of pack.stickers) {
    const file = await fs.readFile(path.join(dir, "packs/pk_test", s.fileName));
    assert.deepEqual(await inspectSticker(file, true), [], s.fileName);
    const meta = await sharp(file, { animated: true }).metadata();
    // 6 drawn frames + 2 in-betweens per step, forward and back = 30 (libwebp merges repeats of the mock's still frames).
    assert.ok(meta.pages! > 10, `in-between frames were added (${meta.pages} frames)`);
    assert.equal(meta.delay![0], 420, "the key pose holds");
    assert.ok(meta.delay!.slice(1).every((d) => d % 33 === 0 || d % 34 === 0), `in-betweens play at ~30 fps: ${meta.delay}`);
    assert.ok(file.length <= WA.ANIMATED_MAX_BYTES);
    // Corners must be transparent after keying.
    const first = await sharp(file, { page: 0 }).ensureAlpha().raw().toBuffer();
    assert.equal(first[3], 0);
  }
  const tray = await fs.readFile(path.join(dir, "packs/pk_test/tray.png"));
  const trayMeta = await sharp(tray).metadata();
  assert.equal(trayMeta.width, WA.TRAY_SIZE);
  assert.equal(trayMeta.height, WA.TRAY_SIZE);
  assert.ok(tray.length <= WA.TRAY_MAX_BYTES);
});

test("static pack: every sticker is a valid single-frame WebP under 100KB", async () => {
  const { pack, dir } = await makePack("static", false);
  assert.equal(pack.animated, false);
  for (const s of pack.stickers) {
    const file = await fs.readFile(path.join(dir, "packs/pk_test", s.fileName));
    assert.deepEqual(await inspectSticker(file, false), [], s.fileName);
    assert.ok(file.length <= WA.STATIC_MAX_BYTES);
  }
});

test("alignFrames pins drifting frames to the first frame's feet", () => {
  const box = (ox: number, oy: number) => {
    const w = 100, h = 100, data = Buffer.alloc(w * h * 4);
    for (let y = oy; y < oy + 30; y++) for (let x = ox; x < ox + 20; x++) data[(y * w + x) * 4 + 3] = 255;
    return { data, width: w, height: h };
  };
  const [a, b] = alignFrames([box(10, 10), box(40, 50)], "feet");
  assert.deepEqual(frameAnchor(b!), frameAnchor(a!));
  const [, c] = alignFrames([box(10, 10), box(40, 50)], "horizontal");
  assert.equal(frameAnchor(c!)!.x, frameAnchor(box(10, 10))!.x);
  assert.equal(frameAnchor(c!)!.y, 80);
});

test("animated pack falls back to the drawn frames when in-betweens fail", async () => {
  const broken: Interpolator = { inbetweens: async () => Promise.reject(new Error("boom")) };
  const { pack, dir } = await makePack("animated", false, broken);
  for (const s of pack.stickers) {
    const file = await fs.readFile(path.join(dir, "packs/pk_test", s.fileName));
    assert.deepEqual(await inspectSticker(file, true), [], s.fileName);
    const meta = await sharp(file, { animated: true }).metadata();
    assert.equal(meta.pages, 6, "only the drawn frames, forward and back (repeats merged)");
  }
});

test("in-between frames follow the motion halfway", async () => {
  const square = async (x: number) =>
    toRgba(await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect x="${x}" y="96" width="64" height="64" fill="#d03030"/><rect x="${x + 16}" y="112" width="16" height="16" fill="#202020"/></svg>`)).png().toBuffer());
  const pairs = await flow.inbetweens([await square(60), await square(110)], [0.5]);
  const b = alphaBounds(pairs[0]![0]!, 128)!;
  const centre = b.left + b.width / 2;
  assert.ok(Math.abs(centre - (85 + 32)) <= 6, `square centre ${centre} is halfway`);
  assert.ok(b.width <= 64 + 12, `one square, not two ghosts (width ${b.width})`);
});
