"use client";

import { type DiscoverItem, type DiscoverSort, fmt, STYLES, styleName } from "@stickers/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DiscoverCard } from "./discover-card";
import { useDiscoverI18n } from "./i18n";

const SORTS: DiscoverSort[] = ["trending", "new", "top"];

/** The public feed: sort tabs, a style filter and a grid that loads more on demand. */
export function DiscoverFeed() {
  const { m, d } = useDiscoverI18n();
  const [sort, setSort] = useState<DiscoverSort>("trending");
  const [style, setStyle] = useState("");
  const [items, setItems] = useState<DiscoverItem[]>();
  const [cursor, setCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (next?: string) => {
      setError(undefined);
      try {
        const page = await api().discover({ sort, style, cursor: next });
        setItems((cur) => (next && cur ? [...cur, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [sort, style],
  );

  useEffect(() => {
    setItems(undefined);
    void load();
  }, [load]);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="flex gap-1 rounded-full border border-line bg-card p-1">
          {SORTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              onClick={() => setSort(s)}
              className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${sort === s ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {d.sort[s]}
            </button>
          ))}
        </div>
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5">
            {["", ...STYLES.map((s) => s.id)].map((id) => (
              <button
                key={id || "all"}
                onClick={() => setStyle(id)}
                aria-pressed={style === id}
                className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 text-sm font-semibold whitespace-nowrap transition ${id ? "pl-1" : "pl-3"} ${style === id ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink/30"}`}
              >
                {id && <img src={`/styles/${id}.webp`} alt="" width={24} height={24} className="size-6 rounded-full bg-paper" />}
                {id ? styleName(m, id) : d.allStyles}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{fmt(d.loadError, { error })}</p>}

      {!items && !error && (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-[28px] bg-line/50" />
          ))}
        </div>
      )}

      {items?.length === 0 && (
        <div className="mt-8 grid justify-items-center rounded-[32px] border border-dashed border-line bg-card px-6 py-16 text-center">
          <img src="/styles/3d.webp" alt="" width={120} height={120} className="size-28" />
          <h2 className="mt-4 font-display text-2xl font-bold">{d.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-muted">{d.emptyBody}</p>
          <Link href="/my" className="mt-6 rounded-full bg-ink px-6 py-3.5 font-semibold text-white">
            {m.web.nav.myPacks}
          </Link>
        </div>
      )}

      {!!items?.length && (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <DiscoverCard key={it.id} item={it} />
          ))}
        </div>
      )}

      {cursor && (
        <div className="mt-10 flex justify-center">
          <button
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(cursor);
              setLoadingMore(false);
            }}
            className="rounded-full border border-line bg-card px-6 py-3 font-semibold transition hover:border-ink/30 disabled:opacity-50"
          >
            {d.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
