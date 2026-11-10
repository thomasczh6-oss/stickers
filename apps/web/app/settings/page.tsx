import type { Metadata } from "next";
import Link from "next/link";
import { LanguagePicker } from "@/components/language-picker";
import { UsageCard } from "@/components/usage-card";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.settings.title };
}

export default async function SettingsPage() {
  const { m } = await getI18n();
  const t = m.settings;
  const link = "flex items-center justify-between px-5 py-4 transition hover:bg-paper";
  return (
    <div className="mx-auto max-w-2xl pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.title}</h1>
      <p className="mt-2 text-muted">{t.webSubtitle}</p>

      <Section title={t.plan}>
        <UsageCard />
      </Section>

      <Section title={m.web.nav.language}>
        <LanguagePicker />
      </Section>

      <Section title={t.help}>
        <nav className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-card">
          <Link href="/help" className={link}>
            {t.helpFaq} <span className="text-muted">→</span>
          </Link>
          <Link href="/help#contact" className={link}>
            {t.feedback} <span className="text-muted">→</span>
          </Link>
        </nav>
      </Section>

      <Section title={t.legal}>
        <nav className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-card">
          <Link href="/terms" className={link}>
            {m.legal.terms} <span className="text-muted">→</span>
          </Link>
          <Link href="/privacy" className={link}>
            {m.legal.privacy} <span className="text-muted">→</span>
          </Link>
          <Link href="/imprint" className={link}>
            {m.legal.imprint} <span className="text-muted">→</span>
          </Link>
        </nav>
      </Section>

      <Section title={t.yourData}>
        <div className="rounded-[24px] border border-line bg-card p-5">
          <p className="text-sm text-muted">{m.data.body}</p>
          <Link href="/delete-data" className="mt-4 inline-block rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">
            {m.data.button}
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
