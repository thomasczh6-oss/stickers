"use client";

import { fmt, styleName } from "@stickers/shared";
import { useState } from "react";
import { useI18n } from "./i18n";

type Pack = { slug: string; title: string; style: string; blurb?: string; stickers: string[] };

export function ExampleGallery({ packs }: { packs: Pack[] }) {
  const { m } = useI18n();
  const g = m.web.gallery;
  const [active, setActive] = useState(packs[0]?.slug);
  const pack = packs.find((p) => p.slug === active) ?? packs[0];
  if (!pack) return null;
  return (
    <div className="mt-12">
      <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
        <div role="tablist" className="mx-auto flex w-max gap-1 rounded-full border border-line bg-card p-1">
          {packs.map((p) => (
            <button
              key={p.slug}
              role="tab"
              aria-selected={p.slug === pack.slug}
              onClick={() => setActive(p.slug)}
              className={`flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-semibold whitespace-nowrap transition ${p.slug === pack.slug ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              <img src={`/samples/${p.slug}/${p.stickers[0]}`} alt="" width={28} height={28} className="size-7 rounded-full bg-paper" />
              {p.title}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        <span className="mr-2 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{fmt(g.styleTag, { style: styleName(m, pack.style) })}</span>
        {pack.blurb && fmt(g.fromPrompt, { prompt: pack.blurb })}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {pack.stickers.map((f) => (
          <div key={`${pack.slug}/${f}`} className="rounded-[24px] border border-line bg-card p-2 transition hover:-translate-y-1 hover:rotate-[-2deg]">
            <img src={`/samples/${pack.slug}/${f}`} alt={fmt(g.stickerAlt, { name: pack.title })} width={256} height={256} className="aspect-square w-full" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
