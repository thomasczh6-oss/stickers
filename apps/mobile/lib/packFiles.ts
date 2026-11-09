import type { StickerPack } from "@stickers/shared";
import { Directory, File, Paths } from "expo-file-system";
import * as WhatsApp from "@/modules/whatsapp-stickers";

/**
 * Downloads a pack into the folder the native module serves to WhatsApp:
 * <packsDirectory>/<identifier>/{contents.json, tray.png, 01.webp, ...}.
 * contents.json uses the field names of WhatsApp's sample apps.
 */
export async function savePackForWhatsApp(pack: StickerPack, onProgress?: (done: number, total: number) => void): Promise<Directory> {
  const root = WhatsApp.packsDirectory ? new Directory(WhatsApp.packsDirectory) : new Directory(Paths.document, "sticker_packs");
  const dir = new Directory(root, pack.identifier);
  dir.create({ intermediates: true, idempotent: true });

  const files = [{ url: pack.trayIconUrl, name: pack.trayIconFileName }, ...pack.stickers.map((s) => ({ url: s.url, name: s.fileName }))];
  let done = 0;
  for (const f of files) {
    const target = new File(dir, f.name);
    if (!target.exists) await File.downloadFileAsync(f.url, target);
    onProgress?.(++done, files.length);
  }

  const contents = {
    identifier: pack.identifier,
    name: pack.name,
    publisher: pack.publisher,
    tray_image_file: pack.trayIconFileName,
    image_data_version: String(pack.imageDataVersion),
    avoid_cache: false,
    animated_sticker_pack: pack.animated,
    publisher_email: "",
    publisher_website: "",
    privacy_policy_website: "",
    license_agreement_website: "",
    stickers: pack.stickers.map((s) => ({ image_file: s.fileName, emojis: s.emojis, accessibility_text: s.accessibilityText })),
  };
  const json = new File(dir, "contents.json");
  if (!json.exists) json.create();
  json.write(JSON.stringify(contents));
  return dir;
}
