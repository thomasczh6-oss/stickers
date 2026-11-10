import { fmt, hoursUntil } from "@stickers/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { UsageCard } from "@/components/usage-card";
import { getI18n } from "@/lib/i18n";

/** Shown in the plan cards; the server's FREE_PACKS_PER_DAY should match. */
const FREE_PACKS_PER_DAY = Number(process.env.NEXT_PUBLIC_FREE_PACKS_PER_DAY ?? 2);

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.settings.pricing };
}

/** Plans. Opened with ?reason=quota when today's free packs ran out. Pro has no checkout until payments are set up. */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { m } = await getI18n();
  const t = m.usage;
  const quota = (await searchParams).reason === "quota";
  return (
    <div className="mx-auto max-w-4xl pt-10 pb-6 md:pt-14">
      {quota ? (
        <div className="text-center">
          <div className="text-5xl" aria-hidden>
            ⏳
          </div>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.quotaTitle}</h1>
          <p className="mx-auto mt-3 max-w-lg text-lg text-muted">{fmt(t.quotaBody, { n: FREE_PACKS_PER_DAY, h: hoursUntil(nextUtcMidnight()) })}</p>
        </div>
      ) : (
        <h1 className="text-center font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{m.settings.pricing}</h1>
      )}

      <div className="mx-auto mt-8 max-w-md">
        <UsageCard pricingLink={false} />
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-[32px] border border-line bg-card p-7">
          <h2 className="font-display text-3xl font-extrabold">{t.freeName}</h2>
          <p className="mt-1 font-semibold text-muted">{fmt(t.freePrice, { n: FREE_PACKS_PER_DAY })}</p>
          <ul className="mt-5 grid gap-2">
            {t.freePerks.map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
          </ul>
          <Link href="/create" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-white transition hover:bg-ink/85">
            {m.web.nav.makeStickers}
          </Link>
        </section>
        <section className="rounded-[32px] bg-ink p-7 text-white shadow-[0_24px_60px_-30px_rgba(22,18,29,0.7)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-extrabold">{t.proName}</h2>
            <span className="rounded-full bg-sun px-3 py-1 text-xs font-semibold text-ink">{t.proSoon}</span>
          </div>
          <ul className="mt-6 grid gap-2 text-white/85">
            {t.proPerks.map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** The free allowance resets at UTC midnight (same rule as the server). */
function nextUtcMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
