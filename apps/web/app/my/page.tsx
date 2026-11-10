"use client";

import { fmt, type StickerPack } from "@stickers/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { api } from "@/lib/api";

export default function MyPacks() {
  const { locale, m } = useI18n();
  const t = m.web.my;
  const [packs, setPacks] = useState<StickerPack[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api()
      .listMyPacks()
      .then((r) => setPacks(r.packs))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="pt-10 pb-6 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.title}</h1>
          <p className="mt-2 text-muted">{t.subtitle}</p>
        </div>
        <Link href="/create" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/85">
          {t.newPack}
        </Link>
      </div>
      {error && <p className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{fmt(t.loadError, { error })}</p>}
      {!packs && !error && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-60 animate-pulse rounded-[28px] bg-line/50" />
          ))}
        </div>
      )}
      {packs?.length === 0 && (
        <div className="mt-10 grid justify-items-center rounded-[32px] border border-dashed border-line bg-card px-6 py-16 text-center">
          <img src="/styles/cartoon.webp" alt="" width={120} height={120} className="size-28" />
          <h2 className="mt-4 font-display text-2xl font-bold">{t.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-muted">{t.emptyBody}</p>
          <Link href="/create" className="mt-6 rounded-full bg-ink px-6 py-3.5 font-semibold text-white">
            {t.emptyCta}
          </Link>
        </div>
      )}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {packs?.map((p) => (
          <Link
            key={p.id}
            href={`/p/${p.id}`}
            className="group rounded-[28px] border border-line bg-card p-4 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-24px_rgba(22,18,29,0.4)]"
          >
            <div className="grid grid-cols-3 gap-1 rounded-[20px] bg-paper p-2">
              {p.stickers.slice(0, 6).map((s) => (
                <img key={s.id} src={s.url} alt="" width={120} height={120} className="aspect-square w-full" loading="lazy" />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-sm text-muted">
                  {fmt(m.pack.stickers, { n: p.stickers.length })} · {new Date(p.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                </div>
              </div>
              <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
