"use client";

import { createNoticeStore, fmt, noticeStatus, noticeTitle, styleName, timeAgo, type GenerationNotice, type NoticeState, type NoticeStore } from "@stickers/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useI18n } from "./i18n";

const StoreContext = createContext<NoticeStore | undefined>(undefined);

/** Where a notice leads: the finished pack, or the progress / failure page. */
export const noticeHref = (n: GenerationNotice) => (n.status === "succeeded" && n.packId ? `/p/${n.packId}` : `/jobs/${n.id}`);

/** Runs the message center for the whole site and shows a toast when a pack finishes on another page. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() =>
    createNoticeStore({
      load: () => api().listNotifications(),
      markRead: (ids) => api().markNotificationsRead(ids),
      clear: (ids) => api().clearNotifications(ids),
    }),
  );
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [toasts, setToasts] = useState<GenerationNotice[]>([]);

  useEffect(() => {
    store.start();
    const wake = () => document.visibilityState === "visible" && void store.refresh();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    const off = store.onFinish((n) => {
      // The progress page already moves on to the pack (or shows the error) by itself.
      if (pathRef.current === `/jobs/${n.id}`) return;
      setToasts((t) => [...t.filter((x) => x.id !== n.id), n].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 8000);
    });
    return () => {
      off();
      store.stop();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      {children}
      <Toasts items={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </StoreContext.Provider>
  );
}

export function useNoticeStore(): NoticeStore | undefined {
  return useContext(StoreContext);
}

const EMPTY: NoticeState = { loading: true };
const noState = () => EMPTY;
const noSubscribe = () => () => undefined;
function useNotices() {
  const store = useNoticeStore();
  const state = useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getState ?? noState, noState);
  return { store, ...state };
}

/** Bell in the header with the unread count, a spinner while a pack is being made, and the message list. */
export function NotificationBell() {
  const { m } = useI18n();
  const t = m.notifications;
  const { store, data } = useNotices();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    void store?.refresh();
    const outside = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open, store]);

  const unread = data?.unread ?? 0;
  const active = data?.active ?? 0;
  const label = unread ? `${t.open} (${fmt(t.newCount, { n: unread })})` : t.open;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative grid size-9 place-items-center rounded-full border border-line bg-card text-ink transition hover:border-ink/30 ${open ? "border-ink/30" : ""}`}
      >
        <BellIcon />
        {active > 0 && <span aria-hidden className="absolute -inset-px animate-spin rounded-full border-2 border-transparent border-t-brand [animation-duration:1.4s]" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-pop px-1 text-[11px] leading-none font-bold text-white ring-2 ring-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && <Panel onNavigate={() => setOpen(false)} />}
    </div>
  );
}

function Panel({ onNavigate }: { onNavigate: () => void }) {
  const { m } = useI18n();
  const t = m.notifications;
  const { store, data, error, loading } = useNotices();
  const router = useRouter();
  const items = data?.notifications ?? [];
  const hasFinished = items.some((n) => n.status === "succeeded" || n.status === "failed");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const go = useCallback(
    (n: GenerationNotice) => {
      if (!n.read) void store?.markRead([n.id]);
      onNavigate();
      router.push(noticeHref(n));
    },
    [onNavigate, router, store],
  );

  return (
    <div
      role="dialog"
      aria-label={t.title}
      className="fixed inset-x-3 top-[68px] z-40 overflow-hidden rounded-3xl border border-line bg-card text-left text-ink shadow-[0_24px_60px_-20px_rgba(22,18,29,0.35)] sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-[380px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-lg font-extrabold">{t.title}</h2>
        <div className="flex items-center gap-1 text-[13px] font-semibold">
          {(data?.unread ?? 0) > 0 && (
            <button type="button" onClick={() => void store?.markRead()} className="rounded-full px-2.5 py-1 text-brand hover:bg-brand-soft">
              {t.markAllRead}
            </button>
          )}
          {hasFinished && (
            <button type="button" onClick={() => void store?.clear()} className="rounded-full px-2.5 py-1 text-muted hover:bg-paper hover:text-ink">
              {t.clear}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[min(70dvh,520px)] overflow-y-auto">
        {loading && !data ? (
          <div className="grid gap-3 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-paper" />
            ))}
          </div>
        ) : error && !data ? (
          <p className="p-6 text-sm text-rose-700">{t.loadError}</p>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
              <BellIcon size={24} />
            </div>
            <p className="mt-4 font-display text-base font-bold">{t.emptyTitle}</p>
            <p className="mt-1.5 text-sm text-muted">{t.emptyBody}</p>
            <Link href="/create" onClick={onNavigate} className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
              {m.web.nav.makeStickers}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => go(n)} onRemove={() => void store?.clear([n.id])} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoticeRow({ n, now, onOpen, onRemove }: { n: GenerationNotice; now: number; onOpen: () => void; onRemove: () => void }) {
  const { m } = useI18n();
  const t = m.notifications;
  const active = n.status === "queued" || n.status === "running";
  const pct = Math.round((n.progress.done / Math.max(1, n.progress.total)) * 100);
  const action = n.status === "succeeded" ? t.view : n.status === "failed" ? t.details : t.viewProgress;

  return (
    <li className={`group relative flex gap-3.5 px-5 py-4 transition hover:bg-paper ${n.read ? "" : "bg-brand-soft/45"}`}>
      <button type="button" onClick={onOpen} className="absolute inset-0" aria-label={`${noticeTitle(m, n)}: ${action}`} />
      <Thumb n={n} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold">{noticeTitle(m, n)}</p>
          <span className="shrink-0 pt-0.5 text-xs text-muted">{timeAgo(m, n.updatedAt, now)}</span>
        </div>
        <p
          className={`mt-0.5 flex items-center gap-1.5 text-sm font-medium ${
            n.status === "failed" ? "text-rose-700" : n.status === "succeeded" ? "text-emerald-700" : "text-brand"
          }`}
        >
          <StatusDot status={n.status} />
          {noticeStatus(m, n)}
        </p>
        {n.status === "running" ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.max(6, pct)}%` }} />
          </div>
        ) : active ? null : n.status === "failed" && n.error ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{n.error}</p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            {styleName(m, n.style)} · {fmt(m.pack.stickers, { n: n.stickerCount })}
          </p>
        )}
      </div>
      {!n.read && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-pop" />}
      {!active && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.remove}
          title={t.remove}
          className="relative z-10 -mr-2 grid size-7 shrink-0 place-items-center self-center rounded-full text-muted opacity-0 transition group-hover:opacity-100 hover:bg-line hover:text-ink focus-visible:opacity-100 max-sm:opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </li>
  );
}

function Thumb({ n }: { n: GenerationNotice }) {
  if (n.status === "succeeded" && n.previewUrl) {
    return <img src={n.previewUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl bg-paper object-contain p-1" />;
  }
  if (n.status === "failed") {
    return <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-rose-50 text-2xl">😵‍💫</div>;
  }
  return (
    <div className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft">
      <span className="size-7 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand" />
    </div>
  );
}

function StatusDot({ status }: { status: GenerationNotice["status"] }) {
  if (status === "succeeded") return <span aria-hidden>✓</span>;
  if (status === "failed") return <span aria-hidden>!</span>;
  return <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />;
}

function Toasts({ items, onClose }: { items: GenerationNotice[]; onClose: (id: string) => void }) {
  const { m } = useI18n();
  const t = m.notifications;
  const store = useNoticeStore();
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-50 grid justify-items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-items-end" aria-live="polite">
      {items.map((n) => {
        const ok = n.status === "succeeded";
        const name = noticeTitle(m, n);
        return (
          <div key={n.id} className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink p-3 pr-2 text-white shadow-xl">
            {ok && n.previewUrl ? (
              <img src={n.previewUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl bg-white/10 object-contain p-0.5" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">{ok ? "🎉" : "😵‍💫"}</span>
            )}
            <p className="min-w-0 flex-1 text-sm font-semibold">
              <span className="line-clamp-2">{fmt(ok ? t.toastReady : t.toastFailed, { name })}</span>
            </p>
            <Link
              href={noticeHref(n)}
              onClick={() => {
                void store?.markRead([n.id]);
                onClose(n.id);
              }}
              className="shrink-0 rounded-full bg-sun px-3.5 py-1.5 text-sm font-semibold text-ink"
            >
              {t.toastOpen}
            </Link>
            <button type="button" onClick={() => onClose(n.id)} aria-label={t.remove} className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 hover:text-white">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BellIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8.5a6 6 0 1 1 12 0c0 4.4 1.6 6.3 2.4 7.1a.6.6 0 0 1-.4 1H4a.6.6 0 0 1-.4-1C4.4 14.8 6 12.9 6 8.5z" />
      <path d="M9.8 20a2.4 2.4 0 0 0 4.4 0" />
    </svg>
  );
}
