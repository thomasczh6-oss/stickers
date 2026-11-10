import type { Metadata } from "next";
import { CreateForm } from "@/components/create-form";

export const metadata: Metadata = { title: "Create a sticker pack" };

export default function CreatePage() {
  return (
    <div className="pt-10 pb-6 md:pt-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">Create your pack</h1>
      <p className="mt-3 text-lg text-muted">Four quick choices, then we draw and animate every sticker for you.</p>
      <CreateForm />
    </div>
  );
}
