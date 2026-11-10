import { fmt, styleName } from "@stickers/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RemixIcon } from "@/components/discover-card";
import { getDiscoverI18n, loadDiscoverItem } from "@/lib/discover";
import { RemixJump } from "./remix-jump";
import { RemixPanel } from "./remix-panel";
import { SafetyMenu } from "./safety-menu";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { d } = await getDiscoverI18n();
  const found = await loadDiscoverItem((await params).id).catch(() => undefined);
  if (!found) return { title: d.title };
  return {
    title: found.item.title,
    description: d.remixBody,
    openGraph: { images: [found.item.previewUrls[0] ?? "/og.png"] },
  };
}

export default async function DiscoverPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await loadDiscoverItem(id);
  if (!found) notFound();
  const { item, pack } = found;
  const { m, d } = await getDiscoverI18n();

  return (
    <div className="grid items-start gap-10 pt-8 pb-24 lg:grid-cols-[1fr_380px] lg:pb-6">
      <section>
        <Link href="/discover" className="text-sm font-semibold text-muted hover:text-ink">
          ← {d.backToDiscover}
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="checker size-16 shrink-0 overflow-hidden rounded-2xl border border-line">
              <img src={item.trayIconUrl} alt="" width={64} height={64} className="size-full" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] break-words md:text-4xl">{item.title}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>{fmt(d.by, { creator: item.creator })}</span>·
                <span className="inline-flex items-center gap-1">
                  <RemixIcon /> {fmt(d.remixes, { n: item.remixCount })}
                </span>
              </p>
            </div>
          </div>
          <SafetyMenu id={item.id} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pack.stickers.map((s) => (
            <div key={s.id} className="rounded-[24px] border border-line bg-card p-2">
              <img src={s.url} alt={s.accessibilityText} width={512} height={512} className="aspect-square w-full" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      <aside className="grid gap-4 lg:sticky lg:top-24">
        <div className="rounded-[28px] border border-line bg-card p-5">
          <p className="text-sm font-semibold text-muted">{d.recipeTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pr-3 pl-1 text-brand">
              <img src={`/styles/${item.style}.webp`} alt="" width={24} height={24} className="size-6 rounded-full bg-paper" />
              {fmt(d.recipeStyle, { style: styleName(m, item.style) })}
            </span>
            <span className="rounded-full bg-paper px-3 py-1">{item.kind === "animated" ? d.recipeAnimated : d.recipeStill}</span>
            <span className="rounded-full bg-paper px-3 py-1">{fmt(d.recipeReactions, { n: item.stickerCount })}</span>
            {item.captions && <span className="rounded-full bg-paper px-3 py-1">{d.recipeCaptions}</span>}
          </div>
        </div>
        <RemixPanel id={item.id} title={item.title} />
      </aside>

      {/* Phones: the remix panel sits below the stickers, so keep its button in reach. */}
      <RemixJump label={d.useThis} />
    </div>
  );
}
