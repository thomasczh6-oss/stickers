import type { Metadata } from "next";
import { CreateForm } from "@/components/create-form";
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
    </div>
  );
}
