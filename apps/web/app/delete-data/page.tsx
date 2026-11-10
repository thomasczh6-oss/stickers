import type { Metadata } from "next";
import { DeleteDataButton } from "@/components/delete-data";
import { CONTACT_EMAIL } from "@/lib/env";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.data.pageTitle };
}

/** Public page for data deletion. Google Play asks for this URL in the Data safety form. */
export default async function DeleteDataPage() {
  const { m } = await getI18n();
  const t = m.data;
  const card = "rounded-[24px] border border-line bg-card p-5 md:p-6";
  return (
    <div className="mx-auto max-w-2xl pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{t.pageTitle}</h1>
      <p className="mt-3 leading-relaxed text-muted">{t.pageIntro}</p>

      <div className="mt-8 grid gap-4">
        <section className={card}>
          <h2 className="font-display text-xl font-bold">{t.inApp}</h2>
          <p className="mt-1 text-muted">{t.inAppBody}</p>
        </section>
        <section className={card}>
          <h2 className="font-display text-xl font-bold">{t.inBrowser}</h2>
          <p className="mt-1 mb-4 text-muted">{t.inBrowserBody}</p>
          <DeleteDataButton />
        </section>
        <section className={card}>
          <h2 className="font-display text-xl font-bold">{t.byEmail}</h2>
          <p className="mt-1 text-muted">
            {t.byEmailBody.split("{email}")[0]}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20data`} className="font-semibold text-ink underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            {t.byEmailBody.split("{email}")[1]}
          </p>
        </section>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-muted">{t.whatDeleted}</p>
    </div>
  );
}
