"use client";

import { type DiscoverItem, fmt, styleName } from "@stickers/shared";
import Link from "next/link";
import { useDiscoverI18n } from "./i18n";

/** One pack on the Discover grid: a 2x2 peek at its stickers, then title, creator and remixes. */
export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const { m, d } = useDiscoverI18n();
  return (
    <Link
      href={`/discover/${item.id}`}
      className="group grid rounded-[28px] border border-line bg-card p-3 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-24px_rgba(22,18,29,0.4)]"
    >
      <div className="relative grid grid-cols-2 gap-1 rounded-[20px] bg-paper p-2">
        {item.previewUrls.map((u, i) => (
          <img key={u} src={u} alt="" width={160} height={160} loading="lazy" className={`aspect-square w-full transition ${i % 2 ? "group-hover:rotate-3" : "group-hover:-rotate-3"}`} />
        ))}
        <span className="absolute top-2.5 left-2.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">{styleName(m, item.style)}</span>
        {item.mine && <span className="absolute top-2.5 right-2.5 rounded-full bg-sun px-2.5 py-1 text-xs font-semibold">{d.yours}</span>}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 px-1.5 pb-1">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.title}</div>
          <div className="truncate text-sm text-muted">{fmt(d.by, { creator: item.creator })}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-muted" title={fmt(d.remixes, { n: item.remixCount })}>
          <RemixIcon />
          {item.remixCount}
        </span>
      </div>
    </Link>
  );
}

export function RemixIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
