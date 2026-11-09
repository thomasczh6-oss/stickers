import samples from "@/public/samples/index.json";
import { CreateForm } from "./create-form";

const STEPS = [
  { title: "Describe or upload", body: "A selfie, your dog, or just an idea like “a sleepy panda chef”." },
  { title: "Pick the vibe", body: "Choose a style and the reactions you use most: LOL, love you, OMG…" },
  { title: "Add to WhatsApp", body: "Open the pack in our app and tap Add. It lands in your sticker tray." },
];

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
        <div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Make yourself
            <br />
            <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">a sticker pack</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-violet-950/70">
            Animated AI stickers of you, your pet or anything you can describe. Ready for WhatsApp in about a minute.
          </p>
          <a
            href="#create"
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-brand to-brand-2 px-7 py-3.5 font-bold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
          >
            Create my stickers
          </a>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {samples.flatMap((pack) =>
            pack.stickers.slice(0, 3).map((file) => (
              <img
                key={`${pack.slug}/${file}`}
                src={`/samples/${pack.slug}/${file}`}
                alt={`${pack.title} sample sticker`}
                width={160}
                height={160}
                className="aspect-square w-full"
                loading="lazy"
              />
            )),
          )}
        </div>
      </section>

      <section className="grid gap-4 py-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-violet-100">
            <div className="mb-3 grid size-9 place-items-center rounded-full bg-accent font-black text-violet-950">{i + 1}</div>
            <h3 className="font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-violet-950/70">{s.body}</p>
          </div>
        ))}
      </section>

      <section id="create" className="scroll-mt-6 py-10">
        <h2 className="mb-6 text-3xl font-black tracking-tight">Create a pack</h2>
        <CreateForm />
      </section>
    </>
  );
}
