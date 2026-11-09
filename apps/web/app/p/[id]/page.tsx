import type { StickerPack } from "@stickers/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { API_INTERNAL_BASE_URL } from "@/lib/env";
import { AddToWhatsApp } from "./add-to-whatsapp";
import { ShareButton } from "./share-button";

async function loadPack(id: string): Promise<StickerPack | undefined> {
  const res = await fetch(`${API_INTERNAL_BASE_URL}/v1/packs/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`pack ${id}: HTTP ${res.status}`);
  return ((await res.json()) as { pack: StickerPack }).pack;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const pack = await loadPack((await params).id).catch(() => undefined);
  if (!pack) return { title: "Sticker pack" };
  return {
    title: pack.name,
    description: `${pack.stickers.length} ${pack.animated ? "animated " : ""}stickers for WhatsApp, made with Stickers AI.`,
    openGraph: { images: [pack.stickers[0]?.url ?? "/og.png"] },
    robots: { index: false },
  };
}

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await loadPack(id);
  if (!pack) notFound();

  return (
    <div className="grid items-start gap-10 pt-10 pb-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="checker size-16 overflow-hidden rounded-2xl border border-line">
              <img src={pack.trayIconUrl} alt="" width={64} height={64} className="size-full" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] md:text-4xl">{pack.name}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {pack.stickers.length} {pack.animated ? "animated " : ""}stickers · {new Date(pack.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ShareButton name={pack.name} />
            <Link href="/create" className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-ink/30">
              Make another
            </Link>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pack.stickers.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group relative rounded-[24px] border border-line bg-card p-2 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-24px_rgba(22,18,29,0.4)]"
            >
              <img src={s.url} alt={s.accessibilityText} width={512} height={512} className="aspect-square w-full" />
              <span className="absolute top-3 right-3 rounded-full bg-paper/90 px-2 py-0.5 text-base opacity-0 transition group-hover:opacity-100">
                {s.emojis.join(" ")}
              </span>
            </a>
          ))}
        </div>
      </section>
      <aside className="lg:sticky lg:top-24">
        <AddToWhatsApp packId={pack.id} />
      </aside>
    </div>
  );
}
