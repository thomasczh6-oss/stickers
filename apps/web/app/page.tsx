import { STYLES } from "@stickers/shared";
import Link from "next/link";
import { ExampleGallery } from "@/components/example-gallery";
import samples from "@/public/samples/index.json";

const sticker = (slug: string, i: number) => {
  const pack = samples.find((p) => p.slug === slug) ?? samples[0]!;
  return `/samples/${pack.slug}/${pack.stickers[i % pack.stickers.length]}`;
};

/** Two stickers from each pack, interleaved so neighbours come from different packs and styles. */
const WALL = [0, 1].flatMap((i) => samples.map((p) => `/samples/${p.slug}/${p.stickers[(i * 3) % p.stickers.length]}`));

const STEPS = [
  {
    title: "Snap or describe",
    body: "Upload a selfie or a photo of your pet, or just type an idea like “a sleepy panda chef”.",
    img: "/styles/cartoon.webp",
  },
  {
    title: "Pick your vibe",
    body: "Choose a style and the reactions you actually send: LOL, love you, OMG, facepalm…",
    img: sticker("knight", 1),
  },
  {
    title: "Add to WhatsApp",
    body: "About a minute later your animated pack is ready. One tap adds it to your sticker tray.",
    img: sticker("corgi", 2),
  },
];

const FAQ = [
  {
    q: "How long does it take?",
    a: "Usually about a minute for a pack of six animated stickers. You can close the page while it works; the pack waits for you under My packs.",
  },
  {
    q: "What happens to my photo?",
    a: "It is used once, to draw your character, and deleted as soon as your pack is made. Your pack itself is private unless you share its link.",
  },
  {
    q: "Why do I need the app to add stickers?",
    a: "WhatsApp only accepts sticker packs from an installed app. Make your pack here, then scan the QR code and our free app adds it for you.",
  },
  {
    q: "Do the stickers move?",
    a: "Yes. Packs are animated by default, with a short loop for every reaction. You can switch to still stickers if you prefer.",
  },
  {
    q: "Can I share my pack with friends?",
    a: "Every pack has its own link. Send it to anyone and they can add the same stickers to their WhatsApp.",
  },
  {
    q: "Is this made by WhatsApp?",
    a: "No. Stickers AI is an independent app. It uses WhatsApp’s official sticker pack format so your stickers work like any others.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="grid items-center gap-12 pt-12 pb-16 md:grid-cols-[1.05fr_1fr] md:pt-20 md:pb-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-pop" /> Animated stickers for WhatsApp
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.98] font-extrabold tracking-[-0.03em] text-balance md:text-7xl">
            Turn yourself into a <span className="marker">sticker pack</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Upload a selfie, your pet or just an idea. Get six animated reactions you’ll actually use, ready for WhatsApp in about a minute.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white sm:px-7 sm:py-4 shadow-[0_8px_24px_-8px_rgba(22,18,29,0.5)] transition hover:-translate-y-0.5"
            >
              Make my stickers
            </Link>
            <Link href="#examples" className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-semibold transition hover:border-ink/30 sm:py-4">
              See examples
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {["No sign-up", "Ready in ~1 minute", "Photos deleted after"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check /> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroPhone />
      </section>

      {/* Sticker wall: a few stickers from every sample pack, all styles mixed */}
      <section aria-label="Stickers made with Stickers AI" className="-mx-5 overflow-hidden border-y border-line bg-card py-6 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-4" aria-hidden={copy === 1}>
              {WALL.map((src) => (
                <img key={`${copy}-${src}`} src={src} alt="" width={112} height={112} className="size-28 shrink-0" loading="lazy" />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 py-16">
        <SectionTitle eyebrow="How it works" title="Three taps from selfie to sticker" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-[28px] border border-line bg-card p-7">
              <div className="flex items-start justify-between">
                <span className="font-display text-sm font-bold text-muted">0{i + 1}</span>
                <img src={s.img} alt="" width={96} height={96} className="-mt-2 -mr-2 size-24" loading="lazy" />
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section id="examples" className="scroll-mt-24 py-16">
        <SectionTitle eyebrow="Examples" title="Every pack is one of a kind" body="Real packs made with Stickers AI, in every style. Each sticker loops, just like in your chats." />
        <ExampleGallery packs={samples} />
      </section>

      {/* Styles */}
      <section className="py-16">
        <SectionTitle eyebrow="Styles" title="Pick a look that’s you" body="Same idea, five ways. Switch styles any time and make as many packs as you like." />
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {STYLES.map((s) => (
            <figure key={s.id} className="group rounded-[24px] border border-line bg-card p-3 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(22,18,29,0.35)]">
              <div className="rounded-[18px] bg-paper">
                <img src={`/styles/${s.id}.webp`} alt={`${s.label} style`} width={384} height={384} className="aspect-square w-full" loading="lazy" />
              </div>
              <figcaption className="px-1 pt-3 pb-1 font-semibold">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 py-16">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" align="left" />
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-6 text-lg font-semibold">
                  {f.q}
                  <span className="chev grid size-8 shrink-0 place-items-center rounded-full border border-line text-xl leading-none transition">+</span>
                </summary>
                <p className="mt-3 max-w-xl leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10">
        <div className="relative overflow-hidden rounded-[36px] bg-ink px-8 py-16 text-center text-white md:py-20">
          <img src={sticker("corgi", 0)} alt="" width={140} height={140} className="absolute -bottom-4 -left-4 hidden size-36 -rotate-12 md:block" />
          <img src={sticker("grandma", 0)} alt="" width={140} height={140} className="absolute -top-2 -right-2 hidden size-36 rotate-12 md:block" />
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold tracking-[-0.02em] text-balance md:text-5xl">
            Your group chat deserves better stickers
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/70">Make your first pack now. It takes about a minute and no account.</p>
          <Link href="/create" className="mt-8 inline-block rounded-full bg-sun px-8 py-4 font-semibold text-ink transition hover:-translate-y-0.5">
            Make my stickers
          </Link>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title, body, align = "center" }: { eyebrow: string; title: string; body?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : ""}>
      <p className="text-sm font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.02em] text-balance md:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
    </div>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-brand">
      <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.15" />
      <path d="M4.5 8.2l2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A generic chat on a phone, showing stickers the way they look in a conversation. */
function HeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <img
        src={sticker("cat", 0)}
        alt=""
        width={128}
        height={128}
        style={{ ["--r" as string]: "-10deg" }}
        className="absolute top-24 -left-24 z-10 hidden size-32 animate-float drop-shadow-xl lg:block"
      />
      <img
        src={sticker("girl", 3)}
        alt=""
        width={120}
        height={120}
        style={{ ["--r" as string]: "8deg" }}
        className="absolute -right-24 bottom-10 z-10 hidden size-30 animate-float-slow drop-shadow-xl lg:block"
      />
      <div className="rounded-[48px] bg-ink p-3 shadow-[0_40px_80px_-30px_rgba(22,18,29,0.55)]">
        <div className="overflow-hidden rounded-[38px] bg-[#f4f1ec]">
          <div className="flex items-center gap-3 border-b border-black/5 bg-white px-5 pt-7 pb-3">
            <div className="grid size-9 place-items-center rounded-full bg-sun font-display text-sm font-bold">BF</div>
            <div>
              <div className="text-sm font-semibold">Besties 💛</div>
              <div className="text-xs text-muted">Emma, Lucas, you</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 px-4 py-5 text-[15px]">
            <Bubble>did you see my new stickers??</Bubble>
            <img src={sticker("girl", 1)} alt="" width={132} height={132} className="size-[132px]" />
            <Bubble me>wait that’s literally you 😂</Bubble>
            <img src={sticker("leo", 1)} alt="" width={132} height={132} className="size-[132px] self-end" />
            <Bubble>made one of Biscuit too</Bubble>
            <img src={sticker("corgi", 2)} alt="" width={132} height={132} className="size-[132px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ children, me }: { children: React.ReactNode; me?: boolean }) {
  return (
    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${me ? "self-end rounded-br-md bg-brand text-white" : "self-start rounded-bl-md bg-white"}`}>
      {children}
    </div>
  );
}
