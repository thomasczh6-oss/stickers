import type { Locale } from "./i18n";
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
  /** UI language of the person making the pack, e.g. "es". Captions are written in it. */
  locale?: Locale;
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
  /** Style the pack was made in (packs made before this field existed may lack it). */
  style?: StyleId;
  /** The maker starred this pack in My packs. */
  favorite?: boolean;
  /** Last rename, star or other change by the owner. */
  updatedAt?: string;
}

/** Filters for the My packs list. */
export type PackFilter = "all" | "favorites" | "animated" | "static";
export type PackSort = "newest" | "oldest" | "name" | "size";

export interface ListPacksQuery {
  /** Matches the pack name or the description it was made from. */
  q?: string;
  filter?: PackFilter;
  style?: StyleId;
  sort?: PackSort;
  /** Opaque value from a previous page's nextCursor. */
  cursor?: string;
  /** Page size, 1 to 60 (default 24). */
  limit?: number;
}

export interface ListPacksResponse {
  packs: StickerPack[];
  /** Pass as cursor to get the next page; missing on the last page. */
  nextCursor?: string;
  /** Packs matching the query and filter. */
  total: number;
  /** Packs per filter for the current search and style, for the filter chips. */
  counts: Record<PackFilter, number>;
}

export type BulkPackAction = "delete" | "restore" | "favorite" | "unfavorite";

export interface ApiError {
  error: string;
  details?: unknown;
}
