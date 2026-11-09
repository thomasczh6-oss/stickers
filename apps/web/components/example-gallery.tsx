"use client";

import { useState } from "react";

type Pack = { slug: string; title: string; style: string; stickers: string[] };

const BLURB: Record<string, string> = {
  corgi: "From the prompt “a chubby corgi wearing a red bandana”",
  girl: "From a description of a person, in the Anime style",
  cat: "From “a fluffy orange cat in a tiny yellow raincoat”, in 3D",
};

export function ExampleGallery({ packs }: { packs: Pack[] }) {
  const [active, setActive] = useState(packs[0]?.slug);
  const pack = packs.find((p) => p.slug === active) ?? packs[0];
  if (!pack) return null;
  return (
    <div className="mt-12">
      <div role="tablist" className="mx-auto flex w-fit gap-1 rounded-full border border-line bg-card p-1">
        {packs.map((p) => (
          <button
            key={p.slug}
            role="tab"
            aria-selected={p.slug === pack.slug}
            onClick={() => setActive(p.slug)}
            className={`flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-semibold transition ${p.slug === pack.slug ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          >
            <img src={`/samples/${p.slug}/${p.stickers[0]}`} alt="" width={28} height={28} className="size-7 rounded-full bg-paper" />
            {p.title}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted">{BLURB[pack.slug]}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {pack.stickers.map((f) => (
          <div key={`${pack.slug}/${f}`} className="rounded-[24px] border border-line bg-card p-2 transition hover:-translate-y-1 hover:rotate-[-2deg]">
            <img src={`/samples/${pack.slug}/${f}`} alt={`${pack.title} sticker`} width={256} height={256} className="aspect-square w-full" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
