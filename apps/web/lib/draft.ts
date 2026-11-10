import { ACTIONS, CREATE_LIMITS, DEFAULT_ACTIONS, STYLES, type ActionId, type StickerPlan, type StyleId } from "@stickers/shared";

/** Everything the create form holds, so a failed job can reopen the form exactly as it was. */
export interface CreateDraft {
  source: "photo" | "describe";
  prompt: string;
  photo?: { base64: string; mimeType: "image/jpeg" };
  style: StyleId;
  animated: boolean;
  actions: ActionId[];
  captions: boolean;
  packName: string;
  /** "Make it yours": the free-text description, how many stickers, and the edited plan. */
  mode: "presets" | "custom";
  description: string;
  count: number;
  plan?: StickerPlan;
}

const KEY = "stickers.createDraft";

// Kept in memory as well, because sessionStorage can be full or blocked (private mode).
let latest: { jobId: string; draft: CreateDraft } | undefined;

/** Remembers the form behind a job. Only the latest job is kept. */
export function saveDraft(jobId: string, draft: CreateDraft) {
  latest = { jobId, draft };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(latest));
  } catch {
    // Too big for storage: keep the choices at least, the photo stays in memory.
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ jobId, draft: { ...draft, photo: undefined } }));
    } catch {}
  }
}

/** The form behind a job, or undefined when it is gone or no longer valid. */
export function loadDraft(jobId: string): CreateDraft | undefined {
  let saved = latest?.jobId === jobId ? latest : undefined;
  if (!saved) {
    try {
      const raw = sessionStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as typeof latest) : undefined;
      if (parsed?.jobId === jobId) saved = parsed;
    } catch {}
  }
  return saved ? clean(saved.draft) : undefined;
}

export function clearDraft(jobId: string) {
  if (latest?.jobId === jobId) latest = undefined;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw && (JSON.parse(raw) as { jobId?: string }).jobId === jobId) sessionStorage.removeItem(KEY);
  } catch {}
}

/** Drops anything an app update may have removed (a style or action that no longer exists). */
function clean(d: Partial<CreateDraft>): CreateDraft | undefined {
  if (!d || typeof d !== "object") return undefined;
  const styles = STYLES.map((s) => s.id) as string[];
  const actions = ACTIONS.map((a) => a.id) as string[];
  const kept = (Array.isArray(d.actions) ? d.actions.filter((a) => actions.includes(a)) : []).slice(0, CREATE_LIMITS.MAX_ACTIONS) as ActionId[];
  return {
    source: d.source === "describe" ? "describe" : "photo",
    prompt: typeof d.prompt === "string" ? d.prompt : "",
    photo: d.photo && typeof d.photo.base64 === "string" ? { base64: d.photo.base64, mimeType: "image/jpeg" } : undefined,
    style: (typeof d.style === "string" && styles.includes(d.style) ? d.style : "cartoon") as StyleId,
    animated: d.animated !== false,
    actions: kept.length ? kept : DEFAULT_ACTIONS,
    captions: d.captions !== false,
    packName: typeof d.packName === "string" ? d.packName : "",
    ...cleanCustom(d),
  };
}

/** The "Make it yours" part. A plan with a broken shape is dropped rather than half restored. */
export function cleanCustom(d: Partial<Pick<CreateDraft, "mode" | "description" | "count" | "plan">>) {
  const plan = d.plan;
  const planOk =
    !!plan &&
    typeof plan.character === "string" &&
    typeof plan.packName === "string" &&
    Array.isArray(plan.stickers) &&
    plan.stickers.every((st) => st && typeof st.pose === "string");
  const count = typeof d.count === "number" ? d.count : 6;
  return {
    mode: d.mode === "custom" ? ("custom" as const) : ("presets" as const),
    description: typeof d.description === "string" ? d.description : "",
    count: Math.min(CREATE_LIMITS.MAX_ACTIONS, Math.max(CREATE_LIMITS.MIN_ACTIONS, Math.round(count))),
    plan: planOk ? plan : undefined,
  };
}
