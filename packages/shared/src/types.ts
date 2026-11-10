import type { ActionId, StyleId } from "./presets";

export type StickerKind = "animated" | "static";

export interface CreatePackRequest {
  /** What the character is. Required when no photo is given. */
  prompt?: string;
  /** A selfie or pet photo to turn into the character, as base64 (no data: prefix). */
  photo?: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };
  style: StyleId;
  kind: StickerKind;
  /** One sticker per preset action, 3 to 12. Leave empty when `stickers` is given. */
  actions: ActionId[];
  /**
   * Stickers the user described themselves (usually from POST /v1/plan, then edited).
   * When given, these are made instead of `actions`; 3 to 12 in all.
   */
  stickers?: CustomSticker[];
  packName?: string;
  /** Print the action label (for example "LOL") on each sticker. */
  captions?: boolean;
}

/** One sticker the user asked for in their own words. */
export interface CustomSticker {
  /** The key pose, e.g. "throwing a big right hook, fierce grin". It is also the still WhatsApp shows. */
  pose: string;
  /** How it moves in an animated sticker, e.g. "punching forward again and again". */
  motion?: string;
  /** Text printed on the sticker, e.g. "KO!". Empty means no text. */
  caption?: string;
  /** 1 to 3 emoji WhatsApp uses to suggest the sticker. */
  emojis?: string[];
  /** True when the whole body jumps or falls, so frames are not pinned at the feet. */
  wholeBody?: boolean;
}

/** Ask the server to turn a free-text idea into a sticker plan the user can edit. */
export interface PlanRequest {
  /** e.g. "I'm a boxer. Chibi me throwing punches, with captions like KO! and Let's go". */
  description: string;
  /** How many stickers to plan, 3 to 12. Default 6. */
  count?: number;
  kind?: StickerKind;
  /** The user also gives a photo, so the plan should not describe their face. */
  hasPhoto?: boolean;
}

export interface StickerPlan {
  /** Who the character is, ready to use as CreatePackRequest.prompt. */
  character: string;
  packName: string;
  stickers: CustomSticker[];
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
}

export interface ApiError {
  error: string;
  details?: unknown;
}
