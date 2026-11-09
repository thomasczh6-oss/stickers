import type { StickerPack } from "@stickers/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_INTERNAL_BASE_URL } from "@/lib/env";
import { AddToWhatsApp } from "./add-to-whatsapp";

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
    description: `${pack.stickers.length} ${pack.animated ? "animated " : ""}stickers for WhatsApp`,
    openGraph: { images: [pack.stickers[0]?.url ?? "/og.png"] },
  };
}

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await loadPack(id);
  if (!pack) notFound();

  return (
    <div className="grid gap-10 py-8 md:grid-cols-[1fr_320px]">
      <section>
        <div className="flex items-center gap-4">
          <img src={pack.trayIconUrl} alt="" width={56} height={56} className="checker rounded-2xl" />
          <div>
            <h1 className="text-3xl font-black tracking-tight">{pack.name}</h1>
            <p className="text-sm text-violet-950/60">
              {pack.stickers.length} {pack.animated ? "animated" : ""} stickers · by {pack.publisher}
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pack.stickers.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="checker group relative rounded-3xl p-2 ring-1 ring-violet-100">
              <img src={s.url} alt={s.accessibilityText} width={512} height={512} className="aspect-square w-full" />
              <span className="absolute top-3 right-3 text-lg">{s.emojis.join("")}</span>
            </a>
          ))}
        </div>
      </section>
      <aside>
        <AddToWhatsApp packId={pack.id} />
      </aside>
    </div>
  );
}
