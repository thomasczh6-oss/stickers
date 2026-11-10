import { isLocale } from "./i18n";
import { ACTIONS, STYLES } from "./presets";
import { PACK_IDENTIFIER_PATTERN, WA } from "./spec";
import type { CreatePackRequest, StickerPack } from "./types";

export const CREATE_LIMITS = {
  MIN_ACTIONS: WA.PACK_MIN_STICKERS,
  MAX_ACTIONS: 12,
  PROMPT_MAX: 500,
  PACK_NAME_MAX: 40,
  /** Base64 of an ~8MB photo. */
  PHOTO_BASE64_MAX: 11_000_000,
} as const;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** Checks a create request coming from the web or mobile client. */
export function parseCreatePackRequest(input: unknown): Result<CreatePackRequest> {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const body = input as Record<string, unknown>;

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
  if (body.prompt !== undefined && typeof body.prompt !== "string") errors.push("prompt must be a string");
  if (prompt && prompt.length > CREATE_LIMITS.PROMPT_MAX) errors.push(`prompt must be at most ${CREATE_LIMITS.PROMPT_MAX} characters`);

  let photo: CreatePackRequest["photo"];
  if (body.photo !== undefined) {
    const p = body.photo as Record<string, unknown> | null;
    const mimeOk = p && (p.mimeType === "image/jpeg" || p.mimeType === "image/png" || p.mimeType === "image/webp");
    if (!p || typeof p.base64 !== "string" || !mimeOk) {
      errors.push("photo must be { base64, mimeType: image/jpeg | image/png | image/webp }");
    } else if (p.base64.length > CREATE_LIMITS.PHOTO_BASE64_MAX) {
      errors.push("photo is too large (max about 8MB)");
    } else {
      photo = { base64: p.base64, mimeType: p.mimeType as NonNullable<CreatePackRequest["photo"]>["mimeType"] };
    }
  }
  if (!prompt && !photo) errors.push("give a prompt, a photo, or both");

  const style = STYLES.find((s) => s.id === body.style)?.id;
  if (!style) errors.push(`style must be one of: ${STYLES.map((s) => s.id).join(", ")}`);

  const kind = body.kind === "animated" || body.kind === "static" ? body.kind : undefined;
  if (!kind) errors.push('kind must be "animated" or "static"');

  const actions: CreatePackRequest["actions"] = [];
  if (!Array.isArray(body.actions)) {
    errors.push("actions must be an array");
  } else {
    for (const a of body.actions) {
      const found = ACTIONS.find((x) => x.id === a);
      if (!found) errors.push(`unknown action: ${String(a)}`);
      else if (!actions.includes(found.id)) actions.push(found.id);
    }
    if (actions.length < CREATE_LIMITS.MIN_ACTIONS || actions.length > CREATE_LIMITS.MAX_ACTIONS) {
      errors.push(`pick ${CREATE_LIMITS.MIN_ACTIONS} to ${CREATE_LIMITS.MAX_ACTIONS} different actions`);
    }
  }

  let packName: string | undefined;
  if (body.packName !== undefined) {
    if (typeof body.packName !== "string") errors.push("packName must be a string");
    else {
      packName = body.packName.trim();
      if (packName.length > CREATE_LIMITS.PACK_NAME_MAX) errors.push(`packName must be at most ${CREATE_LIMITS.PACK_NAME_MAX} characters`);
    }
  }

  if (errors.length > 0 || !style || !kind) return { ok: false, errors };
  return {
    ok: true,
    value: {
      prompt: prompt || undefined,
      photo,
      style,
      kind,
      actions,
      packName: packName || undefined,
      captions: body.captions === true,
      // An unknown language is not an error: captions just stay in English.
      locale: isLocale(body.locale) ? body.locale : undefined,
    },
  };
}

/** Turns any string into a valid WhatsApp pack identifier. */
export function toPackIdentifier(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_\-. ]/g, "_").slice(0, WA.IDENTIFIER_MAX);
  return cleaned.length > 0 ? cleaned : "pack";
}

/** Checks pack metadata against WhatsApp rules. Returns a list of problems (empty when valid). */
export function validatePackMeta(pack: Pick<StickerPack, "identifier" | "name" | "publisher" | "animated" | "stickers">): string[] {
  const issues: string[] = [];
  if (!PACK_IDENTIFIER_PATTERN.test(pack.identifier)) issues.push("identifier has characters WhatsApp does not allow");
  if (pack.identifier.length > WA.IDENTIFIER_MAX) issues.push("identifier is too long");
  if (pack.name.length === 0 || pack.name.length > WA.NAME_MAX) issues.push(`name must be 1-${WA.NAME_MAX} characters`);
  if (pack.publisher.length === 0 || pack.publisher.length > WA.PUBLISHER_MAX) issues.push(`publisher must be 1-${WA.PUBLISHER_MAX} characters`);
  const n = pack.stickers.length;
  if (n < WA.PACK_MIN_STICKERS || n > WA.PACK_MAX_STICKERS) issues.push(`a pack needs ${WA.PACK_MIN_STICKERS}-${WA.PACK_MAX_STICKERS} stickers, has ${n}`);
  const accessibilityMax = pack.animated ? WA.ACCESSIBILITY_ANIMATED_MAX : WA.ACCESSIBILITY_STATIC_MAX;
  const sizeMax = pack.animated ? WA.ANIMATED_MAX_BYTES : WA.STATIC_MAX_BYTES;
  for (const s of pack.stickers) {
    if (s.emojis.length < WA.EMOJI_MIN || s.emojis.length > WA.EMOJI_MAX) issues.push(`sticker ${s.fileName}: needs 1-3 emoji`);
    if (s.accessibilityText.length > accessibilityMax) issues.push(`sticker ${s.fileName}: accessibility text over ${accessibilityMax} characters`);
    if (s.bytes > sizeMax) issues.push(`sticker ${s.fileName}: ${s.bytes} bytes is over ${sizeMax}`);
  }
  return issues;
}

export interface StickerFileFacts {
  width: number;
  height: number;
  bytes: number;
  /** Frame durations in ms; a single entry (or empty) means static. */
  frameDelaysMs: number[];
}

/** Checks one encoded sticker file against WhatsApp rules. */
export function validateStickerFile(facts: StickerFileFacts, animated: boolean): string[] {
  const issues: string[] = [];
  if (facts.width !== WA.STICKER_SIZE || facts.height !== WA.STICKER_SIZE) {
    issues.push(`must be ${WA.STICKER_SIZE}x${WA.STICKER_SIZE}, is ${facts.width}x${facts.height}`);
  }
  const max = animated ? WA.ANIMATED_MAX_BYTES : WA.STATIC_MAX_BYTES;
  if (facts.bytes > max) issues.push(`${facts.bytes} bytes is over the ${max} byte limit`);
  if (animated) {
    if (facts.frameDelaysMs.length < 2) issues.push("animated sticker needs at least 2 frames");
    if (facts.frameDelaysMs.some((d) => d < WA.MIN_FRAME_MS)) issues.push(`every frame must last at least ${WA.MIN_FRAME_MS}ms`);
    const total = facts.frameDelaysMs.reduce((a, b) => a + b, 0);
    if (total > WA.MAX_ANIMATION_MS) issues.push(`animation lasts ${total}ms, limit is ${WA.MAX_ANIMATION_MS}ms`);
  } else if (facts.frameDelaysMs.length > 1) {
    issues.push("static sticker must have one frame");
  }
  return issues;
}

/** Values the My packs list accepts; see ListPacksQuery. */
export const PACK_FILTERS = ["all", "favorites", "animated", "static"] as const;
export const PACK_SORTS = ["newest", "oldest", "name", "size"] as const;
export const BULK_ACTIONS: readonly string[] = ["delete", "restore", "favorite", "unfavorite"];
