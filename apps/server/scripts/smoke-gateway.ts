/**
 * Makes one real sticker pack end to end and writes it to disk, plus a preview sheet.
 *
 *   pnpm --filter @stickers/server smoke:gateway -- --prompt "a corgi in a hoodie" --kind animated
 *   IMAGE_PROVIDER=mock pnpm --filter @stickers/server smoke:gateway      # offline
 *
 * Output goes to ./out/smoke-<time>/ (pack files, character.png, preview.png, pack.json).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { DEFAULT_ACTIONS, type ActionId, type StyleId } from "@stickers/shared";
import { loadConfig } from "../src/config";
import { generatePack } from "../src/pipeline/generatePack";
import { FlowInterpolator } from "../src/pipeline/interpolate";
import { createImageProvider } from "../src/providers";
import { LocalStorage } from "../src/storage/storage";

const { values } = parseArgs({
  // pnpm passes a literal "--" through; drop it so the flags after it still parse.
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    prompt: { type: "string", default: "a cheerful orange cat wearing a tiny blue scarf" },
    photo: { type: "string" },
    style: { type: "string", default: "cartoon" },
    kind: { type: "string", default: "animated" },
    actions: { type: "string", default: DEFAULT_ACTIONS.slice(0, 3).join(",") },
    captions: { type: "boolean", default: true },
    out: { type: "string" },
  },
});

const cfg = loadConfig();
const provider = createImageProvider(cfg);
const interpolator = cfg.worker.smoothMotion ? new FlowInterpolator() : undefined;
const outDir = path.resolve(values.out ?? `out/smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const storage = new LocalStorage(outDir, "file://");
const packId = "pk_smoke";

const photo = values.photo
  ? { data: await fs.readFile(values.photo), mimeType: values.photo.endsWith(".png") ? "image/png" : "image/jpeg" }
  : undefined;

console.log(`[smoke] provider=${provider.name} kind=${values.kind} style=${values.style} out=${outDir}`);
const started = Date.now();
const pack = await generatePack(
  { provider, storage, publisherName: cfg.publisherName, stickerConcurrency: cfg.worker.stickerConcurrency, interpolator },
  {
    packId,
    request: {
      prompt: photo ? undefined : values.prompt,
      style: values.style as StyleId,
      kind: values.kind === "static" ? "static" : "animated",
      actions: values.actions!.split(",") as ActionId[],
      captions: values.captions,
    },
    photo,
    onProgress: (done, step) => console.log(`[smoke] ${done} ${step} (${((Date.now() - started) / 1000).toFixed(1)}s)`),
  },
);

const dir = path.join(outDir, "packs", packId);
await fs.writeFile(path.join(outDir, "pack.json"), JSON.stringify(pack, null, 2));
await fs.copyFile(path.join(dir, "source/character.png"), path.join(outDir, "character.png"));

// Preview: the first frame of every sticker on a chat-like background, plus file sizes.
const cell = 256;
const cols = Math.min(4, pack.stickers.length);
const rows = Math.ceil(pack.stickers.length / cols);
const tiles = await Promise.all(
  pack.stickers.map(async (s, i) => ({
    input: await sharp(path.join(dir, s.fileName), { page: 0 }).resize(cell - 16, cell - 16).png().toBuffer(),
    left: (i % cols) * cell + 8,
    top: Math.floor(i / cols) * cell + 8,
  })),
);
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#efe7de" } })
  .composite(tiles)
  .png()
  .toFile(path.join(outDir, "preview.png"));

for (const s of pack.stickers) console.log(`[smoke] ${s.fileName} ${(s.bytes / 1024).toFixed(0)}KB ${s.emojis.join("")}`);
console.log(`[smoke] done in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${path.join(outDir, "preview.png")}`);
