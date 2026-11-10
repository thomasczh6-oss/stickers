import type { ActionId, StyleId } from "../presets";
import type { CreatePackRequest, StickerKind, StickerPack } from "../types";

/** How a published pack shows in the Discover feed. */
export type PublicationStatus = "visible" | "pending" | "hidden" | "removed";

export type DiscoverSort = "trending" | "new" | "top";

/** One pack in the Discover feed. */
export interface DiscoverItem {
  id: string;
  packId: string;
  title: string;
  style: StyleId;
  kind: StickerKind;
  actions: ActionId[];
  captions: boolean;
  stickerCount: number;
  /** Up to 4 sticker URLs for the card. */
  previewUrls: string[];
  trayIconUrl: string;
  /** How many different people made their own version. */
  remixCount: number;
  publishedAt: string;
  /** Anonymous label, e.g. "Creator 4F2A". The same device always gets the same label. */
  creator: string;
  /** True when the viewer published it. */
  mine: boolean;
  /** Set when this pack was itself made from another Discover pack. */
  remixOf?: string;
}

export interface DiscoverPage {
  items: DiscoverItem[];
  nextCursor?: string;
}

export interface PublishRequest {
  /** Title shown on Discover. Defaults to the pack name. */
  title?: string;
  /** The user agreed to the community guidelines and has the right to share the people in the pack. */
  agree: boolean;
}

export interface PublishState {
  published: boolean;
  publication?: { id: string; title: string; status: PublicationStatus; remixCount: number; publishedAt: string };
}

/** Remixing keeps the original's style, reactions and captions; only the person (photo or description) is the user's own. */
export type RemixRequest = Pick<CreatePackRequest, "photo" | "prompt" | "packName"> & { locale?: string };

export const REPORT_REASONS = ["sexual", "violence", "hate", "harassment", "privacy", "impersonation", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportRequest {
  reason: ReportReason;
  note?: string;
}

/** What the moderation queue shows for one publication. */
export interface ModerationItem {
  item: DiscoverItem;
  status: PublicationStatus;
  reportCount: number;
  reasons: Partial<Record<ReportReason, number>>;
  notes: string[];
  pack?: StickerPack;
}

export type ModerationAction = "approve" | "hide" | "remove" | "ban";

export const DISCOVER_LIMITS = {
  TITLE_MAX: 40,
  NOTE_MAX: 500,
  PAGE_MAX: 48,
} as const;
