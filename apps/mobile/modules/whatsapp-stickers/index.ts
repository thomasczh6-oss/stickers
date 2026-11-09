import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface AddResult {
  /** On Android: WhatsApp confirmed the pack. On iOS: WhatsApp was opened with the pack (it confirms there). */
  added: boolean;
  alreadyAdded?: boolean;
  /** WhatsApp's validation message when it refused the pack (Android only). */
  error?: string | null;
}

interface NativeModule {
  packsDirectory: string;
  isWhatsAppInstalled(): Promise<boolean>;
  isPackAdded?(identifier: string): Promise<boolean>;
  addPack(...args: unknown[]): Promise<AddResult>;
}

/** Undefined in Expo Go and on the web, where the native code is not built in. */
const native = requireOptionalNativeModule<NativeModule>("WhatsAppStickers");

export const isAvailable = native != null;

/** Folder (file:// URI, ending in "/") where pack folders must be written so WhatsApp can read them. */
export const packsDirectory: string | undefined = native?.packsDirectory;

export async function isWhatsAppInstalled(): Promise<boolean> {
  return native ? native.isWhatsAppInstalled() : false;
}

/** Android only; iOS has no way to ask WhatsApp, so it always resolves false. */
export async function isPackAdded(identifier: string): Promise<boolean> {
  return native?.isPackAdded ? native.isPackAdded(identifier) : false;
}

/**
 * Hands a pack folder (written beforehand under `packsDirectory`) to WhatsApp.
 * `storeLinks` are shown by WhatsApp to people who receive a sticker from this pack.
 */
export async function addPack(pack: { identifier: string; name: string; directory: string }, storeLinks: { ios?: string; android?: string } = {}): Promise<AddResult> {
  if (!native) throw new Error("Adding to WhatsApp needs a development or store build of the app, not Expo Go.");
  if (Platform.OS === "android") return native.addPack(pack.identifier, pack.name);
  return native.addPack(pack.directory, { ios: storeLinks.ios ?? "", android: storeLinks.android ?? "" });
}
