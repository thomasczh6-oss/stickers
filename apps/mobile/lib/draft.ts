import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACTIONS, CREATE_LIMITS, DEFAULT_ACTIONS, STYLES, type ActionId, type StyleId } from "@stickers/shared";

/** Everything the create screen holds, so a failed job can reopen it exactly as it was. */
export interface CreateDraft {
  source: "photo" | "describe";
  prompt: string;
  photo?: { uri: string; base64: string };
  style: StyleId;
  animated: boolean;
  actions: ActionId[];
  captions: boolean;
}

const KEY = "stickers.createDraft";

// Memory first (instant, no size limit); AsyncStorage so it also survives the app being closed.
let latest: { jobId: string; draft: CreateDraft } | undefined;

/** Remembers the form behind a job. Only the latest job is kept. */
export async function saveDraft(jobId: string, draft: CreateDraft) {
  latest = { jobId, draft };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(latest));
  } catch {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ jobId, draft: { ...draft, photo: undefined } }));
    } catch {}
  }
}

/** The form behind a job, or undefined when it is gone or no longer valid. */
export async function loadDraft(jobId: string): Promise<CreateDraft | undefined> {
  let saved = latest?.jobId === jobId ? latest : undefined;
  if (!saved) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as typeof latest) : undefined;
      if (parsed?.jobId === jobId) saved = parsed;
    } catch {}
  }
  return saved ? clean(saved.draft) : undefined;
}

export async function clearDraft(jobId: string) {
  if (latest?.jobId === jobId) latest = undefined;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && (JSON.parse(raw) as { jobId?: string }).jobId === jobId) await AsyncStorage.removeItem(KEY);
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
    // The cached file may be gone after a restart, so preview from the base64 we kept.
    photo: d.photo && typeof d.photo.base64 === "string" ? { uri: `data:image/jpeg;base64,${d.photo.base64}`, base64: d.photo.base64 } : undefined,
    style: (typeof d.style === "string" && styles.includes(d.style) ? d.style : "cartoon") as StyleId,
    animated: d.animated !== false,
    actions: kept.length ? kept : DEFAULT_ACTIONS,
    captions: d.captions !== false,
  };
}
