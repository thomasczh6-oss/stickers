import type { Metadata } from "next";
import { DiscoverFeed } from "@/components/discover-feed";
import { getDiscoverI18n } from "@/lib/discover";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDiscoverI18n();
  return { title: d.title, description: d.subtitle };
}

export default async function DiscoverPage() {
  const { d } = await getDiscoverI18n();
  return (
    <div className="pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{d.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{d.subtitle}</p>
      <DiscoverFeed />
    </div>
  );
}
