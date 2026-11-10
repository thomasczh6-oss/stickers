"use client";

import { fmt, PACK_FILTERS, PACK_SORTS, STYLES, styleName, type BulkPackAction, type PackFilter, type PackSort, type StickerPack, type StyleId } from "@stickers/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n";
import { api } from "@/lib/api";

const PAGE = 24;

type Query = { q: string; filter: PackFilter; style: StyleId | ""; sort: PackSort };
type Toast = { text: string; undo?: () => void };
type Counts = Record<PackFilter, number>;

/** Reads the list settings from the address bar, so a refresh or a shared link keeps them. */
function readQuery(): Query {
  const p = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const filter = p.get("filter") as PackFilter;
  const sort = p.get("sort") as PackSort;
  const style = p.get("style") as StyleId;
  return {
    q: p.get("q") ?? "",
    filter: PACK_FILTERS.includes(filter) ? filter : "all",
    sort: PACK_SORTS.includes(sort) ? sort : "newest",
    style: STYLES.some((s) => s.id === style) ? style : "",
  };
}

function writeQuery(q: Query) {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.filter !== "all") p.set("filter", q.filter);
  if (q.style) p.set("style", q.style);
  if (q.sort !== "newest") p.set("sort", q.sort);
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export default function MyPacks() {
  const { locale, m } = useI18n();
  const t = m.web.my;
  const l = m.library;

  const [query, setQuery] = useState<Query>({ q: "", filter: "all", style: "", sort: "newest" });
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);
  const [packs, setPacks] = useState<StickerPack[]>();
  const [counts, setCounts] = useState<Counts>();
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string>();
  const [renaming, setRenaming] = useState<StickerPack>();
  const [toast, setToast] = useState<Toast>();
  /** Bumped to reload page one, e.g. after an undo. */
  const [reload, setReload] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const q = readQuery();
    setQuery(q);
    setSearch(q.q);
    setReady(true);
  }, []);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const id = setTimeout(() => setQuery((q) => (q.q === search.trim() ? q : { ...q, q: search.trim() })), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!ready) return;
    writeQuery(query);
    const id = ++requestId.current;
    api()
      .listMyPacks({ ...query, style: query.style || undefined, limit: PAGE })
      .then((r) => {
        if (id !== requestId.current) return;
        setPacks(r.packs);
        setCounts(r.counts);
        setTotal(r.total);
        setCursor(r.nextCursor);
        setError(undefined);
      })
      .catch((e: Error) => id === requestId.current && setError(e.message));
  }, [query, ready, reload]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const r = await api().listMyPacks({ ...query, style: query.style || undefined, limit: PAGE, cursor });
      if (id !== requestId.current) return;
      // A delete in between shifts pages by one; skip anything already shown.
      setPacks((prev) => {
        const have = new Set(prev?.map((p) => p.id));
        return [...(prev ?? []), ...r.packs.filter((p) => !have.has(p.id))];
      });
      setCursor(r.nextCursor);
      setCounts(r.counts);
      setTotal(r.total);
    } catch (e) {
      setToast({ text: fmt(l.actionError, { error: (e as Error).message }) });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, query, l.actionError]);

  // Infinite scroll: load the next page when the end of the grid comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Close menus on outside click or Escape.
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof KeyboardEvent && selecting && !menu) exitSelect();
      setMenu(undefined);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  });

  const fail = (e: unknown) => setToast({ text: fmt(l.actionError, { error: (e as Error).message }) });
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const bumpCount = (key: PackFilter, by: number) => setCounts((c) => (c ? { ...c, [key]: Math.max(0, c[key] + by) } : c));

  /** Removes packs from view now; the server call follows, with Undo in the toast. */
  async function remove(ids: string[]) {
    const gone = packs?.filter((p) => ids.includes(p.id)) ?? [];
    setPacks((prev) => prev?.filter((p) => !ids.includes(p.id)));
    setTotal((n) => Math.max(0, n - gone.length));
    setCounts((c) =>
      c && {
        all: c.all - gone.length,
        favorites: c.favorites - gone.filter((p) => p.favorite).length,
        animated: c.animated - gone.filter((p) => p.animated).length,
        static: c.static - gone.filter((p) => !p.animated).length,
      },
    );
    exitSelect();
    try {
      if (ids.length === 1) await api().deletePack(ids[0]!);
      else await api().bulkPacks(ids, "delete");
      setToast({
        text: ids.length === 1 ? l.deleted : fmt(l.deletedCount, { n: ids.length }),
        undo: async () => {
          setToast(undefined);
          try {
            if (ids.length === 1) await api().restorePack(ids[0]!);
            else await api().bulkPacks(ids, "restore");
          } catch (e) {
            fail(e);
          }
          setReload((n) => n + 1);
        },
      });
    } catch (e) {
      fail(e);
      setReload((n) => n + 1);
    }
  }

  async function setFavorite(ids: string[], favorite: boolean) {
    const changed = packs?.filter((p) => ids.includes(p.id) && Boolean(p.favorite) !== favorite) ?? [];
    setPacks((prev) => {
      const next = prev?.map((p) => (ids.includes(p.id) ? { ...p, favorite } : p));
      // In the Favorites view, un-starred packs leave the list.
      return query.filter === "favorites" && !favorite ? next?.filter((p) => !ids.includes(p.id)) : next;
    });
    bumpCount("favorites", favorite ? changed.length : -changed.length);
    if (query.filter === "favorites" && !favorite) setTotal((n) => n - changed.length);
    try {
      if (ids.length === 1) await api().updatePack(ids[0]!, { favorite });
      else await api().bulkPacks(ids, (favorite ? "favorite" : "unfavorite") satisfies BulkPackAction);
      if (ids.length > 1) exitSelect();
    } catch (e) {
      fail(e);
      setReload((n) => n + 1);
    }
  }

  async function duplicate(p: StickerPack) {
    try {
      const { pack } = await api().duplicatePack(p.id, fmt(l.copyName, { name: p.name }).slice(0, 40));
      setToast({ text: l.duplicated });
      if (query.sort === "newest") {
        setPacks((prev) => [pack, ...(prev ?? [])]);
        setTotal((n) => n + 1);
        bumpCount("all", 1);
        bumpCount(pack.animated ? "animated" : "static", 1);
      } else setReload((n) => n + 1);
    } catch (e) {
      fail(e);
    }
  }

  async function rename(p: StickerPack, name: string) {
    setRenaming(undefined);
    if (!name.trim() || name.trim() === p.name) return;
    setPacks((prev) => prev?.map((x) => (x.id === p.id ? { ...x, name: name.trim() } : x)));
    try {
      await api().updatePack(p.id, { name: name.trim() });
    } catch (e) {
      fail(e);
      setReload((n) => n + 1);
    }
  }

  async function copyLink(p: StickerPack) {
    await navigator.clipboard?.writeText(`${window.location.origin}/p/${p.id}`).catch(() => undefined);
    setToast({ text: l.linkCopied });
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = query.q !== "" || query.filter !== "all" || query.style !== "";
  const nothingAtAll = counts?.all === 0 && !query.q && !query.style;
  const selectedPacks = useMemo(() => packs?.filter((p) => selected.has(p.id)) ?? [], [packs, selected]);
  const allStarred = selectedPacks.length > 0 && selectedPacks.every((p) => p.favorite);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });

  return (
    <div className="pt-10 pb-6 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.title}</h1>
          <p className="mt-2 text-muted">
            {counts && counts.all > 0 ? `${counts.all === 1 ? l.countOne : fmt(l.count, { n: counts.all })} · ` : ""}
            {t.subtitle}
          </p>
        </div>
        <Link href="/create" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/85">
          {t.newPack}
        </Link>
      </div>

      {!nothingAtAll && (
        <div className="z-20 -mx-5 mt-6 border-b border-line/70 bg-paper/90 px-5 py-3 backdrop-blur md:sticky md:top-16 md:mt-8">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 md:flex">
            <label className="relative col-span-3 min-w-0 md:flex-1">
              <span className="sr-only">{l.search}</span>
              <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted">
                <path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={l.search}
                className="h-11 w-full rounded-full border border-line bg-card pr-4 pl-10 text-sm outline-none placeholder:text-muted/80 focus:border-ink/40"
              />
            </label>
            <select
              aria-label={m.web.home.stylesEyebrow}
              value={query.style}
              onChange={(e) => setQuery((q) => ({ ...q, style: e.target.value as StyleId | "" }))}
              className="h-11 min-w-0 rounded-full border border-line bg-card px-4 text-sm font-medium outline-none focus:border-ink/40"
            >
              <option value="">{l.allStyles}</option>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {styleName(m, s.id)}
                </option>
              ))}
            </select>
            <select
              aria-label={l.sort}
              value={query.sort}
              onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as PackSort }))}
              className="h-11 min-w-0 rounded-full border border-line bg-card px-4 text-sm font-medium outline-none focus:border-ink/40"
            >
              {PACK_SORTS.map((s) => (
                <option key={s} value={s}>
                  {l.sorts[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selecting) exitSelect();
                else setSelecting(true);
              }}
              className={`h-11 rounded-full px-5 text-sm font-semibold transition ${selecting ? "bg-ink text-white" : "border border-line bg-card hover:border-ink/40"}`}
            >
              {selecting ? l.cancel : l.select}
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {PACK_FILTERS.map((f) => {
              const on = query.filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setQuery((q) => ({ ...q, filter: f }))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? "bg-ink text-white" : "bg-card text-ink ring-1 ring-line hover:ring-ink/30"}`}
                >
                  {f === "favorites" && <Star on={on} className="size-3.5" />}
                  {l.filters[f]}
                  {counts && <span className={`text-xs tabular-nums ${on ? "text-white/70" : "text-muted"}`}>{counts[f]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{fmt(t.loadError, { error })}</p>}

      {!packs && !error && (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-[24px] bg-line/50" />
          ))}
        </div>
      )}

      {nothingAtAll && (
        <div className="mt-10 grid justify-items-center rounded-[32px] border border-dashed border-line bg-card px-6 py-16 text-center">
          <img src="/styles/cartoon.webp" alt="" width={120} height={120} className="size-28" />
          <h2 className="mt-4 font-display text-2xl font-bold">{t.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-muted">{t.emptyBody}</p>
          <Link href="/create" className="mt-6 rounded-full bg-ink px-6 py-3.5 font-semibold text-white">
            {t.emptyCta}
          </Link>
        </div>
      )}

      {packs?.length === 0 && !nothingAtAll && (
        <div className="mt-10 grid justify-items-center rounded-[32px] border border-dashed border-line bg-card px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-bold">{query.filter === "favorites" && !query.q ? l.noFavorites : l.noResults}</h2>
          <p className="mt-2 max-w-sm text-muted">{query.filter === "favorites" && !query.q ? l.noFavoritesBody : l.noResultsBody}</p>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQuery((q) => ({ ...q, q: "", filter: "all", style: "" }));
              }}
              className="mt-6 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink/40"
            >
              {l.clear}
            </button>
          )}
        </div>
      )}

      {!!packs?.length && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {packs.map((p) => {
            const isSel = selected.has(p.id);
            const body = (
              <>
                <div className={`relative grid grid-cols-3 gap-0.5 rounded-[18px] bg-paper p-2 transition ${isSel ? "bg-brand-soft" : ""}`}>
                  {p.stickers.slice(0, 6).map((s) => (
                    <img key={s.id} src={s.url} alt="" width={96} height={96} className="aspect-square w-full" loading="lazy" />
                  ))}
                  {p.stickers.length < 6 && Array.from({ length: 6 - Math.min(6, p.stickers.length) }, (_, i) => <span key={i} className="aspect-square" />)}
                </div>
                <div className="mt-3 min-w-0 px-1 pr-8">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted sm:text-sm">
                    {fmt(m.pack.stickers, { n: p.stickers.length })}
                    <span className="hidden sm:inline">
                      {p.style ? ` · ${styleName(m, p.style)}` : ""} · {date(p.createdAt)}
                    </span>
                  </div>
                </div>
              </>
            );
            return (
              <div
                key={p.id}
                className={`group relative rounded-[24px] ${menu === p.id ? "z-10" : ""} border bg-card p-2.5 transition sm:p-3 ${isSel ? "border-brand ring-2 ring-brand" : "border-line hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_rgba(22,18,29,0.4)]"}`}
              >
                {selecting ? (
                  <button type="button" onClick={() => toggle(p.id)} className="block w-full text-left" aria-pressed={isSel}>
                    {body}
                    <span
                      className={`absolute top-4 left-4 grid size-6 place-items-center rounded-full border-2 text-xs font-bold ${isSel ? "border-brand bg-brand text-white" : "border-white bg-white/80 shadow"}`}
                    >
                      {isSel ? "✓" : ""}
                    </span>
                  </button>
                ) : (
                  <Link href={`/p/${p.id}`} className="block">
                    {body}
                  </Link>
                )}
                {!selecting && (
                  <>
                    <button
                      type="button"
                      aria-label={p.favorite ? l.unfavorite : l.favorite}
                      title={p.favorite ? l.unfavorite : l.favorite}
                      onClick={() => void setFavorite([p.id], !p.favorite)}
                      className={`absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-white/90 shadow-sm transition sm:top-5 sm:right-5 ${p.favorite ? "text-sun" : "text-muted hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"}`}
                    >
                      <Star on={!!p.favorite} className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label={l.more}
                      aria-haspopup="menu"
                      aria-expanded={menu === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(menu === p.id ? undefined : p.id);
                      }}
                      className="absolute right-2 bottom-3.5 grid size-8 place-items-center rounded-full text-lg leading-none text-muted transition hover:bg-paper hover:text-ink sm:bottom-4"
                    >
                      ⋯
                    </button>
                  </>
                )}
                {menu === p.id && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-[calc(100%-10px)] right-2 z-10 w-52 overflow-hidden rounded-2xl border border-line bg-card py-1.5 text-sm shadow-[0_20px_50px_-20px_rgba(22,18,29,0.45)]"
                  >
                    <MenuItem href={`/p/${p.id}`}>{m.pack.addToWhatsApp}</MenuItem>
                    <MenuItem onClick={() => (setMenu(undefined), void copyLink(p))}>{l.shareLink}</MenuItem>
                    <MenuItem onClick={() => (setMenu(undefined), setRenaming(p))}>{l.rename}</MenuItem>
                    <MenuItem onClick={() => (setMenu(undefined), void duplicate(p))}>{l.duplicate}</MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenu(undefined);
                        setSelecting(true);
                        setSelected(new Set([p.id]));
                      }}
                    >
                      {l.select}
                    </MenuItem>
                    <div className="my-1 border-t border-line" />
                    <MenuItem danger onClick={() => (setMenu(undefined), void remove([p.id]))}>
                      {l.delete}
                    </MenuItem>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div ref={sentinel} />
      {cursor && (
        <div className="mt-8 grid justify-items-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-full border border-line bg-card px-6 py-3 text-sm font-semibold hover:border-ink/40 disabled:opacity-60"
          >
            {loadingMore ? "…" : l.loadMore}
          </button>
        </div>
      )}
      {packs && filtered && total > 0 && <p className="mt-6 text-center text-sm text-muted">{total === 1 ? l.countOne : fmt(l.count, { n: total })}</p>}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-[22px] bg-ink p-2.5 pl-5 text-white shadow-[0_24px_60px_-20px_rgba(22,18,29,0.6)]">
            <span className="mr-auto text-sm font-semibold">{fmt(l.selected, { n: selected.size })}</span>
            <button
              type="button"
              onClick={() => setSelected(selected.size === packs?.length ? new Set() : new Set(packs?.map((p) => p.id)))}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              {l.selectAll}
            </button>
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => void setFavorite([...selected], !allStarred)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-40"
            >
              <Star on={allStarred} className="size-4 text-sun" />
              {allStarred ? l.unfavorite : l.favorite}
            </button>
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => void remove([...selected])}
              className="rounded-full bg-pop px-4 py-2 text-sm font-semibold text-white hover:bg-pop/90 disabled:opacity-40"
            >
              {selected.size ? fmt(l.deleteCount, { n: selected.size }) : l.delete}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-0 z-50 flex justify-center px-4 transition ${selecting ? "bottom-24" : "bottom-6"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-4 rounded-full bg-ink py-2.5 pr-2.5 pl-5 text-sm text-white shadow-[0_20px_50px_-20px_rgba(22,18,29,0.6)]">
            <span>{toast.text}</span>
            {toast.undo ? (
              <button type="button" onClick={toast.undo} className="rounded-full bg-sun px-4 py-1.5 font-semibold text-ink">
                {l.undo}
              </button>
            ) : (
              <span className="w-1" />
            )}
          </div>
        </div>
      )}

      {renaming && <RenameDialog pack={renaming} onClose={() => setRenaming(undefined)} onSave={(name) => void rename(renaming, name)} />}
    </div>
  );
}

function MenuItem({ children, onClick, href, danger }: { children: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `block w-full px-4 py-2.5 text-left transition hover:bg-paper ${danger ? "text-rose-700" : "text-ink"}`;
  return href ? (
    <Link role="menuitem" href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button role="menuitem" type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function Star({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className}>
      <path
        d="M10 2.2l2.35 4.9 5.35.68-3.93 3.7 1 5.3L10 14.2l-4.77 2.58 1-5.3-3.93-3.7 5.35-.68L10 2.2z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenameDialog({ pack, onClose, onSave }: { pack: StickerPack; onClose: () => void; onSave: (name: string) => void }) {
  const { m } = useI18n();
  const l = m.library;
  const [name, setName] = useState(pack.name);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
        }}
        className="w-full max-w-sm rounded-[28px] bg-card p-6 shadow-2xl"
      >
        <h2 className="font-display text-2xl font-bold">{l.renameTitle}</h2>
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="mt-4 h-12 w-full rounded-2xl border border-line bg-paper px-4 outline-none focus:border-ink/40"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink">
            {l.cancel}
          </button>
          <button type="submit" disabled={!name.trim()} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {l.save}
          </button>
        </div>
      </form>
    </div>
  );
}
