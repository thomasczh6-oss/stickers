import { fmt } from "@stickers/shared";
import type { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback-form";
import { CONTACT_EMAIL } from "@/lib/env";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.support.helpTitle };
}

export default async function HelpPage() {
  const { m } = await getI18n();
  const t = m.support;
  return (
    <div className="mx-auto max-w-3xl pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.helpTitle}</h1>
      <p className="mt-2 text-muted">{t.helpSubtitle}</p>

      <div className="mt-8 divide-y divide-line overflow-hidden rounded-[28px] border border-line bg-card">
        {t.faq.map((f) => (
          <details key={f.q} className="group px-5 py-4 md:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span aria-hidden className="text-xl text-muted transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>

      <section id="contact" className="mt-14 scroll-mt-24">
        <h2 className="font-display text-3xl font-bold tracking-tight">{t.stillStuck}</h2>
        <p className="mt-2 text-muted">{t.contactBody}</p>
        <div className="mt-6">
          <FeedbackForm />
        </div>
        <p className="mt-4 text-sm text-muted">
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-4">
            {fmt(t.emailUs, { email: CONTACT_EMAIL })}
          </a>
        </p>
      </section>
    </div>
  );
}
