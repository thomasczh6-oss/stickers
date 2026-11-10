import { ACTIONS, STYLES } from "./presets";
import { PACK_IDENTIFIER_PATTERN, WA } from "./spec";
import type { CreatePackRequest, CustomSticker, PlanRequest, StickerKind, StickerPack, StickerPlan } from "./types";

export const CREATE_LIMITS = {
  MIN_ACTIONS: WA.PACK_MIN_STICKERS,
  MAX_ACTIONS: 12,
  PROMPT_MAX: 500,
  PACK_NAME_MAX: 40,
  POSE_MAX: 300,
  MOTION_MAX: 300,
  /** Captions are one line along the bottom of a 512px sticker: 20 Latin letters, or 10 CJK characters (they count double). */
  CAPTION_MAX: 20,
  DESCRIPTION_MAX: 1000,
  DEFAULT_PLAN_COUNT: 6,
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
  let stickers: CustomSticker[] | undefined;
  if (body.stickers !== undefined) {
    // Custom stickers replace the preset actions.
    const r = parseCustomStickers(body.stickers);
    if (r.ok) stickers = r.value;
    else errors.push(...r.errors);
  } else if (!Array.isArray(body.actions)) {
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
      ...(stickers ? { stickers } : {}),
      packName: packName || undefined,
      captions: body.captions === true,
    },
  };
}

/** Wide (CJK) characters take about twice the room of a Latin letter on a sticker. */
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|[\u{20000}-\u{3fffd}]/u;

/** How much room a caption needs, in Latin-letter widths. Compare with CREATE_LIMITS.CAPTION_MAX. */
export function captionUnits(text: string): number {
  let n = 0;
  for (const ch of text.trim()) n += WIDE.test(ch) ? 2 : 1;
  return n;
}

/** Cuts a caption to fit, at a word boundary when it has spaces. */
function cutCaption(text: string): string {
  if (captionUnits(text) <= CREATE_LIMITS.CAPTION_MAX) return text;
  let out = "";
  for (const ch of text) {
    if (captionUnits(out + ch) > CREATE_LIMITS.CAPTION_MAX) break;
    out += ch;
  }
  const nextIsSpace = /\s/.test(text.charAt(out.length));
  return (nextIsSpace || !out.includes(" ") ? out : out.replace(/\s+\S*$/, "")).trim();
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Keeps strings that look like a single emoji (no letters or digits), at most 3. */
export function cleanEmojis(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const e of input) {
    if (typeof e !== "string") continue;
    const t = e.trim();
    if (!t || t.length > 16 || /[\p{L}\p{N}\s]/u.test(t) || !/\p{Extended_Pictographic}/u.test(t)) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length === 3) break;
  }
  return out;
}

function parseOneSticker(raw: unknown): { sticker?: CustomSticker; error?: string } {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pose = clean(s.pose, CREATE_LIMITS.POSE_MAX);
  if (!pose) return { error: "describe what the character is doing" };
  if (typeof s.caption === "string" && captionUnits(s.caption) > CREATE_LIMITS.CAPTION_MAX) {
    return { error: `caption is too long (at most ${CREATE_LIMITS.CAPTION_MAX} letters, or ${CREATE_LIMITS.CAPTION_MAX / 2} Chinese, Japanese or Korean characters)` };
  }
  const sticker: CustomSticker = { pose };
  const motion = clean(s.motion, CREATE_LIMITS.MOTION_MAX);
  if (motion) sticker.motion = motion;
  const caption = clean(s.caption, 100);
  if (caption) sticker.caption = caption;
  const emojis = cleanEmojis(s.emojis);
  if (emojis.length) sticker.emojis = emojis;
  if (s.wholeBody === true) sticker.wholeBody = true;
  return { sticker };
}

/** Checks a list of custom stickers sent by a client. */
export function parseCustomStickers(input: unknown): Result<CustomSticker[]> {
  if (!Array.isArray(input)) return { ok: false, errors: ["stickers must be an array"] };
  const errors: string[] = [];
  const out: CustomSticker[] = [];
  input.forEach((raw, i) => {
    const r = parseOneSticker(raw);
    if (r.sticker) out.push(r.sticker);
    else errors.push(`sticker ${i + 1}: ${r.error}`);
  });
  if (input.length < CREATE_LIMITS.MIN_ACTIONS || input.length > CREATE_LIMITS.MAX_ACTIONS) {
    errors.push(`a pack needs ${CREATE_LIMITS.MIN_ACTIONS} to ${CREATE_LIMITS.MAX_ACTIONS} stickers`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

export function parsePlanRequest(input: unknown): Result<Required<PlanRequest>> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) errors.push("describe the stickers you want");
  if (description.length > CREATE_LIMITS.DESCRIPTION_MAX) errors.push(`description must be at most ${CREATE_LIMITS.DESCRIPTION_MAX} characters`);
  const count = body.count === undefined ? CREATE_LIMITS.DEFAULT_PLAN_COUNT : Number(body.count);
  if (!Number.isInteger(count) || count < CREATE_LIMITS.MIN_ACTIONS || count > CREATE_LIMITS.MAX_ACTIONS) {
    errors.push(`count must be ${CREATE_LIMITS.MIN_ACTIONS} to ${CREATE_LIMITS.MAX_ACTIONS}`);
  }
  const kind: StickerKind = body.kind === "static" ? "static" : "animated";
  return errors.length ? { ok: false, errors } : { ok: true, value: { description, count, kind, hasPhoto: body.hasPhoto === true } };
}

/**
 * Cleans a plan coming back from the planner model: trims every field, drops stickers
 * without a pose, keeps at most `count`. Returns undefined when too little is usable.
 */
export function sanitizePlan(input: unknown, count: number): StickerPlan | undefined {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const character = clean(body.character, CREATE_LIMITS.PROMPT_MAX);
  const packName = clean(body.packName, CREATE_LIMITS.PACK_NAME_MAX) || "My stickers";
  const raw = Array.isArray(body.stickers) ? body.stickers : [];
  const stickers: CustomSticker[] = [];
  for (const item of raw) {
    if (stickers.length >= count) break;
    const s = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    // The model sometimes writes a long caption: cut it instead of dropping the sticker.
    const caption = cutCaption(clean(s.caption, 200));
    const r = parseOneSticker({ ...s, caption });
    if (r.sticker) stickers.push(r.sticker);
  }
  if (!character || stickers.length < CREATE_LIMITS.MIN_ACTIONS) return undefined;
  return { character, packName, stickers };
}

/** True when an (edited) plan can be sent: a character, 3-12 stickers, each saying what it shows. */
export function isPlanReady(plan?: StickerPlan): boolean {
  return Boolean(
    plan &&
      plan.character.trim() &&
      plan.stickers.length >= CREATE_LIMITS.MIN_ACTIONS &&
      plan.stickers.length <= CREATE_LIMITS.MAX_ACTIONS &&
      plan.stickers.every((s) => s.pose.trim() && captionUnits(s.caption ?? "") <= CREATE_LIMITS.CAPTION_MAX),
  );
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
