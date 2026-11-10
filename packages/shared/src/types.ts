import type { ActionId, StyleId } from "./presets";

export type StickerKind = "animated" | "static";

export interface CreatePackRequest {
  /** What the character is. Required when no photo is given. */
  prompt?: string;
  /** A selfie or pet photo to turn into the character, as base64 (no data: prefix). */
  photo?: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };
  style: StyleId;
  kind: StickerKind;
  /** One sticker per action, 3 to 12. */
  actions: ActionId[];
  packName?: string;
  /** Print the action label (for example "LOL") on each sticker. */
  captions?: boolean;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  /** Finished steps out of total steps (character + one per sticker + packaging). */
  progress: { done: number; total: number; step?: string };
  packId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sticker {
  id: string;
  index: number;
  /** File name inside the pack, e.g. "01.webp". */
  fileName: string;
  url: string;
  bytes: number;
  emojis: string[];
  accessibilityText: string;
}

export interface StickerPack {
  id: string;
  /** WhatsApp pack identifier (letters, digits, _ - . and spaces). */
  identifier: string;
  name: string;
  publisher: string;
  animated: boolean;
  trayIconUrl: string;
  trayIconFileName: string;
  stickers: Sticker[];
  /** Bump when stickers change so WhatsApp reloads them (Android image_data_version). */
  imageDataVersion: number;
  createdAt: string;
  /** Ways to get the pack into apps other than WhatsApp. Filled in by the API when it serves a pack. */
  exports?: PackExports;
}

export interface PackExports {
  /** One file per sticker, in sticker order, for share sheets (iMessage, Messenger, Instagram...): GIF when animated, PNG when static. */
  share: { url: string; mimeType: "image/gif" | "image/png"; fileName: string }[];
  /** ZIP with WebP, PNG, GIF and APNG files plus a how-to, for Signal, Discord and LINE. */
  zipUrl: string;
  /** Opens our Telegram bot, which builds a Telegram sticker set. Absent when the server has no bot. */
  telegramUrl?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
