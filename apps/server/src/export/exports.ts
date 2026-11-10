import type { StickerPack } from "@stickers/shared";
import type { Storage } from "../storage/storage";
import { toApng, toGif, toPng } from "./formats";
import { zip } from "./zip";

/**
 * Other chat apps' formats, made from the WhatsApp WebP files the first time someone asks
 * and kept in storage next to the pack (packs/<id>/export/...).
 */
export function createExporter(storage: Storage) {
  const inFlight = new Map<string, Promise<Buffer>>();

  async function cached(key: string, contentType: string, make: () => Promise<Buffer>): Promise<Buffer> {
    try {
      return await storage.get(key);
    } catch {
      /* not made yet */
    }
    let p = inFlight.get(key);
    if (!p) {
      p = make().then(async (b) => {
        await storage.put(key, b, contentType);
        return b;
      });
      inFlight.set(key, p);
      p.finally(() => inFlight.delete(key)).catch(() => undefined);
    }
    return p;
  }

  const source = (pack: StickerPack, index: number) => storage.get(`packs/${pack.id}/${pack.stickers[index]!.fileName}`);
  const base = (pack: StickerPack, index: number) => pack.stickers[index]!.fileName.replace(/\.webp$/, "");

  const exporter = {
    /** GIF for animated packs, PNG for static ones: what a share sheet sends best. */
    shareFile(pack: StickerPack, index: number): Promise<{ data: Buffer; contentType: string; fileName: string }> {
      const name = base(pack, index);
      if (pack.animated) {
        return cached(`packs/${pack.id}/export/gif/${name}.gif`, "image/gif", async () => toGif(await source(pack, index))).then((data) => ({
          data,
          contentType: "image/gif",
          fileName: `${name}.gif`,
        }));
      }
      return cached(`packs/${pack.id}/export/png/${name}.png`, "image/png", async () => toPng(await source(pack, index))).then((data) => ({
        data,
        contentType: "image/png",
        fileName: `${name}.png`,
      }));
    },

    /** Every sticker in every format we can make, plus a how-to for each app. */
    zip(pack: StickerPack): Promise<Buffer> {
      return cached(`packs/${pack.id}/export/pack-v${pack.imageDataVersion}.zip`, "application/zip", async () => {
        const entries: { name: string; data: Buffer }[] = [];
        let apngCount = 0;
        for (let i = 0; i < pack.stickers.length; i++) {
          const name = base(pack, i);
          const webp = await source(pack, i);
          entries.push({ name: `webp/${name}.webp`, data: webp });
          entries.push({ name: `png/${name}.png`, data: (await exporter.shareFile({ ...pack, animated: false }, i)).data });
          if (pack.animated) {
            entries.push({ name: `gif/${name}.gif`, data: (await exporter.shareFile(pack, i)).data });
            const apng = await toApng(webp);
            if (apng) {
              entries.push({ name: `apng/${name}.png`, data: apng });
              apngCount++;
            }
          }
        }
        entries.push({ name: "tray.png", data: await storage.get(`packs/${pack.id}/${pack.trayIconFileName}`) });
        entries.push({ name: "HOW-TO.txt", data: Buffer.from(howTo(pack, apngCount > 0)) });
        return zip(entries);
      });
    },
  };
  return exporter;
}

export type Exporter = ReturnType<typeof createExporter>;

function howTo(pack: StickerPack, hasApng: boolean): string {
  const anim = pack.animated;
  return `“${pack.name}”: ${pack.stickers.length} ${anim ? "animated " : ""}stickers

Folders
  webp/   WhatsApp format, 512x512${anim ? " animated" : ""} WebP
  png/    512x512 PNG with a transparent background${anim ? " (first frame)" : ""}
${anim ? "  gif/    animated GIF\n" : ""}${hasApng ? "  apng/   animated PNG (APNG)\n" : ""}  tray.png  96x96 pack icon

WhatsApp and Telegram
  Use the "Add to WhatsApp" and "Add to Telegram" buttons in the app or on the pack page.

Signal
  Signal Desktop > File > Create/Upload Sticker Pack, then drop in the ${hasApng ? "apng/" : "png/"} files.
  Signal Desktop must be linked to Signal on your phone. Packs can't be edited after upload.

Discord (server stickers)
  Server Settings > Stickers > Upload Sticker. Discord wants 320x320 and at most 512KB;
  the ${hasApng ? "apng/ or " : ""}png/ files work and Discord scales them.

iMessage, Messenger, Instagram, Snapchat
  These apps don't import sticker packs from other apps. Send a ${anim ? "gif/" : "png/"} file as a
  picture, or use "Share" on a sticker in the app.

LINE
  LINE only adds stickers through LINE Creators Market (creator.line.me), with a review.
  Upload the png/ files there; LINE asks for 370x320 at most and will resize them.
`;
}
