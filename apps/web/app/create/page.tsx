import type { Metadata } from "next";
import { CreateForm } from "@/components/create-form";
import { LegalLine } from "@/components/legal-line";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.web.meta.create };
}

export default async function CreatePage() {
  const { m } = await getI18n();
  return (
    <div className="pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">{m.web.create.title}</h1>
      <p className="mt-3 text-lg text-muted">{m.web.create.subtitle}</p>
      <CreateForm />
      {/* Consent to the terms and to sending photos to the AI image provider (App Store 5.1.2, GDPR). */}
      <LegalLine m={m} template={m.legal.createNotice} className="mt-6 max-w-2xl text-sm leading-relaxed text-muted" />
    </div>
  );
}
