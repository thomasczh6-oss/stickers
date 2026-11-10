import { getI18n } from "@/lib/i18n";

/**
 * Shared layout for Privacy and Terms: narrow column, readable type.
 * The legal text stays in English until a reviewed translation exists; other languages get a note saying so.
 */
export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const { locale, m } = await getI18n();
  return (
    <article lang="en" className="mx-auto max-w-2xl pt-12 pb-6 md:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
      {locale !== "en" && (
        <p lang={locale} className="mt-6 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
          {m.web.legalNote}
        </p>
      )}
      <div className="mt-10 grid gap-4 leading-relaxed text-ink/85 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-2">
        {children}
      </div>
    </article>
  );
}
