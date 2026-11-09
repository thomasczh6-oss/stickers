/**
 * Generates the project's own artwork with the image model: the mascot, app icons,
 * splash image, web favicon, the Open Graph card and the sample packs on the landing page.
 *
 *   pnpm --filter @stickers/server gen:assets                  # everything
 *   pnpm --filter @stickers/server gen:assets -- --only icons  # icons | samples | styles | og
 *   pnpm --filter @stickers/server gen:assets -- --only samples --samples knight,sloth   # just these packs
 *   IMAGE_PROVIDER=mock pnpm --filter @stickers/server gen:assets   # offline placeholders
 *
 * The model only draws the mascot and the sample characters. Backgrounds, gradients and
 * text are composed here, so icons stay crisp and on-brand whatever the model returns.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp, { type OverlayOptions } from "sharp";
import { STYLES, type ActionId, type StyleId } from "@stickers/shared";
import { loadConfig } from "../src/config";
import { generatePack } from "../src/pipeline/generatePack";
import { characterPrompt } from "../src/pipeline/prompts";
import { addOutline, alphaBounds, removeBackground } from "../src/pipeline/image";
import { createImageProvider } from "../src/providers";
import { LocalStorage } from "../src/storage/storage";

const { values } = parseArgs({ args: process.argv.slice(2).filter((a) => a !== "--"), options: { only: { type: "string" }, samples: { type: "string" } } });
const want = (part: string) => !values.only || values.only.split(",").includes(part);

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MOBILE = path.join(ROOT, "apps/mobile/assets/images");
const WEB_PUBLIC = path.join(ROOT, "apps/web/public");
const WEB_APP = path.join(ROOT, "apps/web/app");
const WORK = path.join(ROOT, "apps/server/out/assets");

/** Brand colours. Deliberately not WhatsApp green, so the app is never mistaken for WhatsApp. */
const BRAND = { from: "#7c3aed", to: "#ec4899", accent: "#facc15" };

const MASCOT_PROMPT = [
  "The mascot of a sticker maker app: one cute, chubby, rounded blob character shaped like a die-cut sticker,",
  "with big shiny eyes, rosy cheeks and a wide happy smile, its top-right corner curling up like a sticker being peeled off.",
  "It holds a tiny paintbrush with a drop of yellow paint. Violet and pink body with a small yellow star on its belly.",
  "Glossy 3D cartoon style, soft lighting, bold clean silhouette, centered, facing the viewer, plenty of empty space around it.",
  "Background: one flat, solid, pure green color (#00FF00) filling the entire image, with no gradient, no shadow and no floor.",
  "The character must not contain any green. No text, no letters, no watermark.",
].join(" ");

/** Landing-page sample packs, one or more per style. `blurb` is shown under the gallery. */
const SAMPLES: { slug: string; title: string; style: StyleId; prompt: string; blurb: string; actions: ActionId[] }[] = [
  { slug: "corgi", title: "Biscuit", style: "cartoon", prompt: "a chubby corgi wearing a red bandana", blurb: "“a chubby corgi wearing a red bandana”", actions: ["wave", "laugh", "love", "thumbs_up", "party", "cool"] },
  { slug: "girl", title: "Mia", style: "anime", prompt: "a chibi young woman with a big head and small body, short teal bob haircut, round glasses and a yellow hoodie, very expressive face", blurb: "“a young woman with a teal bob, round glasses and a yellow hoodie”", actions: ["wave", "shock", "cry", "love", "sleepy", "think"] },
  { slug: "cat", title: "Mochi", style: "3d", prompt: "a fluffy orange cat in a tiny yellow raincoat", blurb: "“a fluffy orange cat in a tiny yellow raincoat”", actions: ["wave", "angry", "laugh", "facepalm", "party", "sleepy"] },
  { slug: "knight", title: "Sir Pixel", style: "pixel", prompt: "a tiny brave knight in shiny silver armor with a red plume on the helmet, retro video game hero", blurb: "“a tiny brave knight with a red plume”", actions: ["wave", "cool", "party", "angry", "shock", "thumbs_up"] },
  { slug: "sloth", title: "Slowmo", style: "clay", prompt: "a sleepy sloth hugging a warm coffee mug, wearing a cozy knitted orange scarf", blurb: "“a sleepy sloth hugging a coffee mug”", actions: ["sleepy", "love", "laugh", "facepalm", "wave", "think"] },
  { slug: "leo", title: "Leo", style: "cartoon", prompt: "a chibi cheerful man with a big head and small body, short brown beard, messy brown hair, a red flannel shirt and a white T-shirt, very expressive face", blurb: "“a guy with a beard and a red flannel shirt”", actions: ["thumbs_up", "laugh", "facepalm", "cool", "cry", "wave"] },
  { slug: "grandma", title: "Nana", style: "3d", prompt: "a sweet grandma with silver curly hair, round glasses, rosy cheeks and a pink knitted cardigan, chibi proportions with a big head and small body", blurb: "“a sweet grandma with silver curls and a pink cardigan”", actions: ["love", "wave", "laugh", "shock", "think", "party"] },
];

const cfg = loadConfig();
const provider = createImageProvider(cfg);
await fs.mkdir(WORK, { recursive: true });
console.log(`[assets] provider=${provider.name} root=${ROOT}`);
if (provider.name === "mock") console.log("[assets] mock provider: writing offline placeholders, not real artwork");

function gradient(w: number, h: number, extra = "") {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.from}"/><stop offset="1" stop-color="${BRAND.to}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>${extra}</svg>`);
}

/** Keys the background off a generated image and trims it to the character. */
async function cutout(png: Buffer): Promise<Buffer> {
  const rgba = await removeBackground(png);
  const box = alphaBounds(rgba);
  if (!box) throw new Error("nothing left after removing the background");
  return sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } }).extract(box).png().toBuffer();
}

/** Places a cut-out centered on a transparent square, filling `fill` of the side. */
async function fit(png: Buffer, size: number, fill: number, outline = false): Promise<Buffer> {
  const inner = Math.round(size * fill);
  const resized = await sharp(png).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const placed = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
  return outline ? addOutline(placed, Math.round(size / 64)) : placed;
}

if (want("icons")) {
  const raw = await provider.image({ prompt: MASCOT_PROMPT, images: [], size: "1024x1024", intent: { kind: "character" } });
  await fs.writeFile(path.join(WORK, "mascot-raw.png"), raw);
  const mascot = await cutout(raw);
  await fs.writeFile(path.join(WORK, "mascot.png"), mascot);

  await fs.mkdir(MOBILE, { recursive: true });
  // iOS and the store listing: opaque, full bleed; the OS rounds the corners.
  const onBrand = await fit(mascot, 1024, 0.72, true);
  await sharp(gradient(1024, 1024)).composite([{ input: onBrand }]).flatten().png().toFile(path.join(MOBILE, "icon.png"));
  // Android adaptive icon: transparent foreground inside the 66% safe zone, background colour set in app.json.
  await fs.writeFile(path.join(MOBILE, "adaptive-icon.png"), await fit(mascot, 1024, 0.56, true));
  await fs.writeFile(path.join(MOBILE, "splash-icon.png"), await fit(mascot, 1024, 0.9, true));
  await fs.writeFile(path.join(WORK, "mascot-outlined.png"), await fit(mascot, 1024, 0.9, true));

  await fs.mkdir(WEB_APP, { recursive: true });
  await sharp(path.join(MOBILE, "icon.png")).resize(512, 512).png().toFile(path.join(WEB_APP, "icon.png"));
  await sharp(path.join(MOBILE, "icon.png")).resize(180, 180).png().toFile(path.join(WEB_APP, "apple-icon.png"));
  console.log("[assets] icons written");
}

if (want("samples")) {
  type Entry = { slug: string; title: string; style: StyleId; blurb: string; stickers: string[] };
  const indexFile = path.join(WEB_PUBLIC, "samples/index.json");
  const previous = JSON.parse(await fs.readFile(indexFile, "utf8").catch(() => "[]")) as Entry[];
  const only = values.samples?.split(",");
  const made = new Map<string, Entry>();
  const todo = SAMPLES.filter((s) => !only || only.includes(s.slug));
  // Packs are independent: make two at a time.
  await mapLimit(todo, 2, async (s) => {
    const storage = new LocalStorage(path.join(WORK, "samples"), "file://");
    const pack = await generatePack(
      { provider, storage, publisherName: cfg.publisherName, stickerConcurrency: cfg.worker.stickerConcurrency },
      {
        packId: `sample-${s.slug}`,
        request: { prompt: s.prompt, style: s.style, kind: "animated", actions: s.actions, captions: true, packName: s.title },
        onProgress: (done, step) => console.log(`[assets] ${s.slug} ${done} ${step}`),
      },
    );
    const dest = path.join(WEB_PUBLIC, "samples", s.slug);
    await fs.mkdir(dest, { recursive: true });
    const src = path.join(WORK, "samples/packs", pack.id);
    for (const st of pack.stickers) await fs.copyFile(path.join(src, st.fileName), path.join(dest, st.fileName));
    // The app's home screen shows a few samples offline.
    await fs.mkdir(path.join(MOBILE, "samples"), { recursive: true });
    for (const st of pack.stickers.slice(0, 2)) await fs.copyFile(path.join(src, st.fileName), path.join(MOBILE, "samples", `${s.slug}-${st.fileName}`));
    await fs.copyFile(path.join(src, "source/character.png"), path.join(WORK, `${s.slug}-character.png`));
    made.set(s.slug, { slug: s.slug, title: s.title, style: s.style, blurb: s.blurb, stickers: pack.stickers.map((st) => st.fileName) });
  });
  // Keep packs that were not regenerated, in SAMPLES order, with fresh titles and blurbs.
  const index = SAMPLES.flatMap((s) => {
    const e = made.get(s.slug) ?? previous.find((p) => p.slug === s.slug);
    return e ? [{ ...e, title: s.title, style: s.style, blurb: s.blurb }] : [];
  });
  await fs.writeFile(indexFile, JSON.stringify(index, null, 2) + "\n");
  console.log("[assets] sample packs written");
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  }));
}

if (want("styles")) {
  // One subject drawn in every style, for the style picker on web and mobile.
  const subject = "a cheerful young woman with curly auburn hair, freckles, a denim jacket and a white T-shirt, waving hello, chibi proportions with a big head and a small body, shown from the knees up";
  const webDir = path.join(WEB_PUBLIC, "styles");
  const appDir = path.join(MOBILE, "styles");
  await fs.mkdir(webDir, { recursive: true });
  await fs.mkdir(appDir, { recursive: true });
  await Promise.all(
    STYLES.map(async (style) => {
      const raw = await provider.image({ prompt: characterPrompt({ style, description: subject, fromPhoto: false }), images: [], size: "1024x1024", intent: { kind: "character" } });
      await fs.writeFile(path.join(WORK, `style-${style.id}-raw.png`), raw);
      const tile = await fit(await cutout(raw), 512, 0.9, true);
      await sharp(tile).resize(384, 384).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(webDir, `${style.id}.webp`));
      await sharp(tile).resize(256, 256).png({ palette: true, quality: 90 }).toFile(path.join(appDir, `${style.id}.png`));
      console.log(`[assets] style ${style.id}`);
    }),
  );
}

if (want("og")) {
  // 1200x630 share card: brand gradient, headline, the mascot and three sample stickers.
  const mascot = await fs.readFile(path.join(WORK, "mascot-outlined.png")).catch(() => undefined);
  const index = JSON.parse(await fs.readFile(path.join(WEB_PUBLIC, "samples/index.json"), "utf8").catch(() => "[]")) as { slug: string; stickers: string[] }[];
  const text = `
    <text x="70" y="250" font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="76" fill="#ffffff">Make yourself</text>
    <text x="70" y="340" font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="76" fill="#ffffff">a sticker pack</text>
    <text x="72" y="420" font-family="DejaVu Sans, Arial, sans-serif" font-weight="600" font-size="34" fill="#fde68a">Animated AI stickers for WhatsApp</text>`;
  const layers: OverlayOptions[] = [];
  if (mascot) layers.push({ input: await sharp(mascot).resize(320, 320).png().toBuffer(), left: 810, top: 50 });
  const picks = index.slice(0, 3).map((p) => path.join(WEB_PUBLIC, "samples", p.slug, p.stickers[0]!));
  for (const [i, file] of picks.entries()) {
    layers.push({ input: await sharp(file, { page: 0 }).resize(170, 170).png().toBuffer(), left: 700 + i * 160, top: 440 - (i % 2) * 24 });
  }
  await fs.mkdir(WEB_PUBLIC, { recursive: true });
  await sharp(gradient(1200, 630, text)).composite(layers).flatten().png({ palette: true, quality: 90 }).toFile(path.join(WEB_PUBLIC, "og.png"));
  console.log("[assets] og.png written");
}
