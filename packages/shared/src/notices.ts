import { fmt, type Messages } from "./i18n";
import type { GenerationNotice, NotificationsResponse } from "./types";

/** What to call a generation in the message center: its pack name, its description, or a fallback. */
export function noticeTitle(m: Messages, n: GenerationNotice): string {
  const text = n.name?.trim() || n.prompt?.trim();
  if (text) return text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
  return n.fromPhoto ? m.notifications.fromPhoto : m.notifications.untitled;
}

/** One status line: waiting, "Making · 3 of 8", ready or failed. */
export function noticeStatus(m: Messages, n: GenerationNotice): string {
  const t = m.notifications;
  if (n.status === "queued") return t.queued;
  if (n.status === "running") return fmt(t.making, { done: n.progress.done, total: n.progress.total });
  return n.status === "succeeded" ? t.ready : t.failed;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(m: Messages, iso: string, now = Date.now()): string {
  const t = m.notifications;
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return t.justNow;
  if (min < 60) return fmt(t.minutesAgo, { n: min });
  if (min < 48 * 60) return fmt(t.hoursAgo, { n: Math.floor(min / 60) });
  return fmt(t.daysAgo, { n: Math.floor(min / 1440) });
}

export interface NoticeState {
  data?: NotificationsResponse;
  error?: string;
  loading: boolean;
}

/**
 * Keeps the message center fresh for one app: polls every few seconds while a pack is being made
 * and slowly otherwise, and reports generations that finish while the app is open (for a toast).
 * Framework-free so the web and mobile apps share it; each wraps it in a React hook.
 */
export function createNoticeStore(opts: {
  load: () => Promise<NotificationsResponse>;
  markRead: (ids?: string[]) => Promise<unknown>;
  clear: (ids?: string[]) => Promise<unknown>;
  activeMs?: number;
  idleMs?: number;
}) {
  const activeMs = opts.activeMs ?? 3000;
  const idleMs = opts.idleMs ?? 30_000;
  let state: NoticeState = { loading: true };
  const listeners = new Set<() => void>();
  const finishListeners = new Set<(n: GenerationNotice) => void>();
  /** Jobs seen running in this app session; when one of them finishes we fire onFinish. */
  const watching = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let inflight: Promise<void> | undefined;

  const set = (next: Partial<NoticeState>) => {
    state = { ...state, ...next };
    for (const l of listeners) l();
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(() => void refresh(), state.data?.active ? activeMs : idleMs);
  };

  const refresh = (): Promise<void> => {
    inflight ??= (async () => {
      try {
        const data = await opts.load();
        for (const n of data.notifications) {
          const active = n.status === "queued" || n.status === "running";
          if (active) watching.add(n.id);
          else if (watching.delete(n.id) && !n.read) for (const l of finishListeners) l(n);
        }
        set({ data, error: undefined, loading: false });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
      } finally {
        inflight = undefined;
        schedule();
      }
    })();
    return inflight;
  };

  /** Applies a change locally right away, then confirms it with the server. */
  const optimistic = async (change: (d: NotificationsResponse) => NotificationsResponse, call: () => Promise<unknown>) => {
    if (state.data) set({ data: change(state.data) });
    try {
      await call();
    } finally {
      await refresh();
    }
  };
  const isUnread = (n: GenerationNotice, ids?: string[]) => !n.read && (!ids || ids.includes(n.id));
  const finished = (n: GenerationNotice) => n.status === "succeeded" || n.status === "failed";

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** Called with each generation that finishes while the store runs and nobody has seen yet. */
    onFinish(l: (n: GenerationNotice) => void) {
      finishListeners.add(l);
      return () => finishListeners.delete(l);
    },
    /** Starts polling (idempotent). */
    start() {
      if (running) return;
      running = true;
      void refresh();
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
    },
    /** Fetch now, e.g. right after starting a pack or when the window gets focus. */
    refresh,
    /** Tells the store a job was just started here, so its finish is reported even if the first poll misses it running. */
    watch(jobId: string) {
      watching.add(jobId);
      void refresh();
    },
    markRead: (ids?: string[]) =>
      optimistic(
        (d) => {
          const notifications = d.notifications.map((n) => (isUnread(n, ids) ? { ...n, read: true } : n));
          return { ...d, notifications, unread: notifications.filter((n) => !n.read).length };
        },
        () => opts.markRead(ids),
      ),
    clear: (ids?: string[]) =>
      optimistic(
        (d) => {
          const left = d.notifications.filter((n) => !(finished(n) && (!ids || ids.includes(n.id))));
          return { ...d, notifications: left, unread: left.filter((n) => !n.read).length };
        },
        () => opts.clear(ids),
      ),
  };
}

export type NoticeStore = ReturnType<typeof createNoticeStore>;
