import { fmt, STYLE_GROUPS, STYLES, styleGroupName, styleName } from "@stickers/shared";
import Link from "next/link";
import { ExampleGallery } from "@/components/example-gallery";
import { getI18n } from "@/lib/i18n";
import samples from "@/public/samples/index.json";

const sticker = (slug: string, i: number) => {
  const pack = samples.find((p) => p.slug === slug) ?? samples[0]!;
  return `/samples/${pack.slug}/${pack.stickers[i % pack.stickers.length]}`;
};

/** Two stickers from each pack, interleaved so neighbours come from different packs and styles. */
const WALL = [0, 1].flatMap((i) => samples.map((p) => `/samples/${p.slug}/${p.stickers[(i * 3) % p.stickers.length]}`));

/** Pictures for the three "How it works" steps; their text comes from the messages. */
const STEP_IMAGES = ["/styles/cartoon.webp", sticker("knight", 1), sticker("corgi", 2)];

export default async function Home() {
  const { m } = await getI18n();
  const h = m.web.home;
  return (
    <>
      {/* Hero */}
      <section className="grid items-center gap-12 pt-12 pb-16 md:grid-cols-[1.05fr_1fr] md:pt-20 md:pb-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-pop" /> {h.badge}
          </span>
          <h1 className="mt-6 [word-break:auto-phrase] font-display text-5xl leading-[0.98] font-extrabold tracking-[-0.03em] text-balance md:text-7xl">
            {h.heroBefore}
            <span className="marker">{h.heroHighlight}</span>
            {h.heroAfter}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            {h.heroBody}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white sm:px-7 sm:py-4 shadow-[0_8px_24px_-8px_rgba(22,18,29,0.5)] transition hover:-translate-y-0.5"
            >
              {h.cta}
            </Link>
            <Link href="#examples" className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-semibold transition hover:border-ink/30 sm:py-4">
              {h.seeExamples}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {h.perks.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check /> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroPhone chat={h.chat} />
      </section>

      {/* Sticker wall: a few stickers from every sample pack, all styles mixed */}
      <section aria-label={h.wallLabel} className="-mx-5 overflow-hidden border-y border-line bg-card py-6 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
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
        <SectionTitle eyebrow={h.howEyebrow} title={h.howTitle} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {h.steps.map((s, i) => (
            <div key={s.title} className="rounded-[28px] border border-line bg-card p-7">
              <div className="flex items-start justify-between">
                <span className="font-display text-sm font-bold text-muted">0{i + 1}</span>
                <img src={STEP_IMAGES[i]} alt="" width={96} height={96} className="-mt-2 -mr-2 size-24" loading="lazy" />
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section id="examples" className="scroll-mt-24 py-16">
        <SectionTitle eyebrow={h.examplesEyebrow} title={h.examplesTitle} body={h.examplesBody} />
        <ExampleGallery packs={samples} />
      </section>

      {/* Styles */}
      <section className="py-16">
        <SectionTitle eyebrow={h.stylesEyebrow} title={h.stylesTitle} body={h.stylesBody} />
        {STYLE_GROUPS.map((g) => (
          <div key={g.id} className="mt-12">
            <h3 className="font-display text-xl font-bold tracking-tight">{styleGroupName(m, g.id)}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {STYLES.filter((s) => s.group === g.id).map((s) => (
                <figure key={s.id} className="group rounded-[24px] border border-line bg-card p-3 transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(22,18,29,0.35)]">
                  <div className="rounded-[18px] bg-paper">
                    <img src={`/styles/${s.id}.webp`} alt={fmt(h.styleAlt, { style: styleName(m, s.id) })} width={384} height={384} className="aspect-square w-full" loading="lazy" />
                  </div>
                  <figcaption className="px-1 pt-3 pb-1 font-semibold">{styleName(m, s.id)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 py-16">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <SectionTitle eyebrow={h.faqEyebrow} title={h.faqTitle} align="left" />
          <div className="divide-y divide-line border-y border-line">
            {h.faq.map((f) => (
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
            {h.finalTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/70">{h.finalBody}</p>
          <Link href="/create" className="mt-8 inline-block rounded-full bg-sun px-8 py-4 font-semibold text-ink transition hover:-translate-y-0.5">
            {h.cta}
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
function HeroPhone({ chat }: { chat: { group: string; members: string; m1: string; m2: string; m3: string } }) {
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
              <div className="text-sm font-semibold">{chat.group}</div>
              <div className="text-xs text-muted">{chat.members}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 px-4 py-5 text-[15px]">
            <Bubble>{chat.m1}</Bubble>
            <img src={sticker("girl", 1)} alt="" width={132} height={132} className="size-[132px]" />
            <Bubble me>{chat.m2}</Bubble>
            <img src={sticker("leo", 1)} alt="" width={132} height={132} className="size-[132px] self-end" />
            <Bubble>{chat.m3}</Bubble>
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
