import type { StickerPack } from "@stickers/shared";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Sends one sticker through the system share sheet, as a GIF for animated packs (PNG for
 * static). This is how stickers reach apps that can't import packs: iMessage, Messenger,
 * Instagram, Signal and so on.
 */
export async function shareSticker(pack: StickerPack, index: number): Promise<void> {
  const file = pack.exports?.share[index];
  if (!file) throw new Error("This pack can’t be shared yet. Update the server.");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn’t available on this device.");
  const dir = new Directory(Paths.cache, "share", pack.id);
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, file.fileName);
  if (!target.exists) await File.downloadFileAsync(file.url, target);
  await Sharing.shareAsync(target.uri, {
    mimeType: file.mimeType,
    UTI: file.mimeType === "image/gif" ? "com.compuserve.gif" : "public.png",
    dialogTitle: "Send sticker",
  });
}
