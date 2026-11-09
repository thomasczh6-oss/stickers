"use client";

import type { StickerPack } from "@stickers/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function MyPacks() {
  const [packs, setPacks] = useState<StickerPack[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api()
      .listMyPacks()
      .then((r) => setPacks(r.packs))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="py-8">
      <h1 className="text-3xl font-black tracking-tight">My packs</h1>
      <p className="mt-1 text-sm text-violet-950/60">Packs made in this browser.</p>
      {error && <p className="mt-6 text-rose-700">{error}</p>}
      {packs?.length === 0 && (
        <p className="mt-10">
          Nothing here yet.{" "}
          <Link href="/#create" className="font-semibold text-brand underline">
            Make your first pack
          </Link>
        </p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {packs?.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-100 transition hover:ring-brand">
            <div className="grid grid-cols-3 gap-1">
              {p.stickers.slice(0, 3).map((s) => (
                <img key={s.id} src={s.url} alt="" width={120} height={120} className="aspect-square w-full" loading="lazy" />
              ))}
            </div>
            <div className="mt-3 font-bold">{p.name}</div>
            <div className="text-xs text-violet-950/60">
              {p.stickers.length} stickers · {new Date(p.createdAt).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
