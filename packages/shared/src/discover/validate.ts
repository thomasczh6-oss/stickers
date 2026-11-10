import { CREATE_LIMITS, type Result } from "../validate";
import { DISCOVER_LIMITS, type PublishRequest, REPORT_REASONS, type RemixRequest, type ReportReason, type ReportRequest } from "./types";

/**
 * Words that keep a title off Discover. This is a first filter only: reports and the
 * moderation queue catch the rest. Matched as whole words after undoing common letter swaps.
 */
const BLOCKED_WORDS = [
  "porn", "porno", "nude", "nudes", "naked", "sex", "sexy", "xxx", "nsfw", "cum", "dick", "cock", "pussy", "tits", "boobs", "anal",
  "rape", "rapist", "nazi", "hitler", "kkk", "isis", "kill", "suicide", "terrorist",
  "nigger", "nigga", "faggot", "fag", "retard", "tranny", "chink", "spic", "kike", "wetback",
  "fuck", "fucking", "shit", "bitch", "whore", "slut", "cunt",
];
const BLOCKED = new Set(BLOCKED_WORDS);
const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/** True when a public text (title, note) has a word from the block list. */
export function hasBlockedWords(text: string): boolean {
  const normal = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$!]/g, (ch) => SWAPS[ch] ?? ch);
  const words = normal.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => BLOCKED.has(w))) return true;
  // Also catch a word spelled out with spaces or dots between its letters ("s e x", "f.u.c.k").
  const letters: string[] = [];
  for (const w of [...words, ""]) {
    if (w.length === 1) letters.push(w);
    else {
      if (letters.length > 1 && BLOCKED.has(letters.join(""))) return true;
      letters.length = 0;
    }
  }
  return false;
}

export function parsePublishRequest(input: unknown): Result<PublishRequest> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  let title: string | undefined;
  if (body.title !== undefined) {
    if (typeof body.title !== "string") errors.push("title must be a string");
    else {
      title = body.title.replace(/\s+/g, " ").trim();
      if (title.length > DISCOVER_LIMITS.TITLE_MAX) errors.push(`title must be at most ${DISCOVER_LIMITS.TITLE_MAX} characters`);
      if (hasBlockedWords(title)) errors.push("that title isn’t allowed on Discover");
    }
  }
  if (body.agree !== true) errors.push("agree to the community guidelines to publish");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { title: title || undefined, agree: true } };
}

export function parseReportRequest(input: unknown): Result<ReportRequest> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const reason = REPORT_REASONS.find((r) => r === body.reason) as ReportReason | undefined;
  const errors: string[] = [];
  if (!reason) errors.push(`reason must be one of: ${REPORT_REASONS.join(", ")}`);
  let note: string | undefined;
  if (body.note !== undefined) {
    if (typeof body.note !== "string") errors.push("note must be a string");
    else note = body.note.trim().slice(0, DISCOVER_LIMITS.NOTE_MAX) || undefined;
  }
  if (errors.length || !reason) return { ok: false, errors };
  return { ok: true, value: { reason, note } };
}

/** Only the person (photo or description), the pack name and the language come from the remixer. */
export function parseRemixRequest(input: unknown): Result<RemixRequest> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const out: RemixRequest = {};
  if (body.photo !== undefined) out.photo = body.photo as RemixRequest["photo"];
  if (body.prompt !== undefined) {
    if (typeof body.prompt !== "string") errors.push("prompt must be a string");
    else if (body.prompt.length > CREATE_LIMITS.PROMPT_MAX) errors.push(`prompt must be at most ${CREATE_LIMITS.PROMPT_MAX} characters`);
    else out.prompt = body.prompt.trim() || undefined;
  }
  if (typeof body.packName === "string") out.packName = body.packName;
  if (typeof body.locale === "string") out.locale = body.locale;
  if (!out.photo && !out.prompt) errors.push("add your photo (or describe your character) to make your version");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out };
}
