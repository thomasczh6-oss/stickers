"use client";

import { ACTIONS, actionName, CREATE_LIMITS, DEFAULT_ACTIONS, fmt, isPlanReady, parseCreatePackRequest, STYLE_GROUPS, STYLES, styleGroupName, styleName, type ActionId, type StickerPlan, type StyleId } from "@stickers/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { loadDraft, saveDraft } from "@/lib/draft";
import { CustomStickers } from "./custom-stickers";
import { useI18n } from "./i18n";

type Photo = { base64: string; mimeType: "image/jpeg"; previewUrl: string };
type Source = "photo" | "describe";
type Mode = "presets" | "custom";

/** Downscales a picked photo to at most 1024px and re-encodes it as JPEG, so uploads stay small. */
async function preparePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg", previewUrl: dataUrl };
}

export function CreateForm() {
  const router = useRouter();
  const { locale, m } = useI18n();
  const c = m.create;
  const w = m.web.create;
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("photo");
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<Photo>();
  const [dragging, setDragging] = useState(false);
  const [style, setStyle] = useState<StyleId>("cartoon");
  const [animated, setAnimated] = useState(true);
  const [actions, setActions] = useState<ActionId[]>(DEFAULT_ACTIONS);
  const [captions, setCaptions] = useState(true);
  const [mode, setMode] = useState<Mode>("presets");
  const [plan, setPlan] = useState<StickerPlan>();
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(6);
  const [packName, setPackName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [restored, setRestored] = useState(false);

  // Coming back from a failed job ("Try again"): refill the form exactly as it was.
  useEffect(() => {
    const retry = new URLSearchParams(window.location.search).get("retry");
    const d = retry ? loadDraft(retry) : undefined;
    if (!d) return;
    setSource(d.source);
    setPrompt(d.prompt);
    if (d.photo) setPhoto({ ...d.photo, previewUrl: `data:${d.photo.mimeType};base64,${d.photo.base64}` });
    setStyle(d.style);
    setAnimated(d.animated);
    setActions(d.actions);
    setCaptions(d.captions);
    setPackName(d.packName);
    setMode(d.mode);
    setPlan(d.plan);
    setDescription(d.description);
    setCount(d.count);
    setRestored(true);
  }, []);

  const toggle = (id: ActionId) =>
    setActions((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : cur.length < CREATE_LIMITS.MAX_ACTIONS ? [...cur, id] : cur));

  async function onPhoto(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(w.notImage);
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError(w.unreadable);
    }
  }

  const usePhoto = source === "photo" && photo;
  const custom = mode === "custom";
  const ready = custom ? isPlanReady(plan) : (usePhoto || prompt.trim().length > 0) && actions.length >= CREATE_LIMITS.MIN_ACTIONS;
  const stickerCount = custom ? (plan?.stickers.length ?? 0) : actions.length;
  const emojis = custom ? (plan?.stickers ?? []).map((st) => st.emojis?.[0] ?? "😀") : actions.map((id) => ACTIONS.find((a) => a.id === id)?.emojis[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body = {
      // In custom mode the plan's character already includes what the user wrote in step 1.
      prompt: (custom ? plan?.character.trim() : prompt.trim()) || undefined,
      photo: usePhoto ? { base64: photo.base64, mimeType: photo.mimeType } : undefined,
      style,
      kind: animated ? "animated" : "static",
      ...(custom ? { actions: [], stickers: plan?.stickers } : { actions, captions }),
      packName: packName.trim() || (custom ? plan?.packName : undefined),
      locale,
    };
    const parsed = parseCreatePackRequest(body);
    if (!parsed.ok) return setError(parsed.errors.join(". "));
    setBusy(true);
    try {
      const { job } = await api().createPack(parsed.value);
      saveDraft(job.id, {
        source,
        prompt,
        photo: photo ? { base64: photo.base64, mimeType: photo.mimeType } : undefined,
        style,
        animated,
        actions,
        captions,
        packName,
        mode,
        plan,
        description,
        count,
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }


  return (
    <form onSubmit={submit} className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5">
        <Step n={1} title={c.who}>
          <div role="tablist" className="flex w-fit gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
            {(["photo", "describe"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={source === s}
                onClick={() => setSource(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${source === s ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {s === "photo" ? w.tabPhoto : w.tabDescribe}
              </button>
            ))}
          </div>

          {source === "photo" ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-[200px_1fr]">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void onPhoto(e.dataTransfer.files?.[0]);
                }}
                className={`grid aspect-square place-items-center overflow-hidden rounded-[22px] border-2 border-dashed transition ${dragging ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-ink/30"}`}
              >
                {photo ? (
                  <img src={photo.previewUrl} alt={w.yourPhoto} className="size-full object-cover" />
                ) : (
                  <span className="grid justify-items-center gap-2 px-4 text-center text-sm text-muted">
                    <UploadIcon />
                    <span className="font-semibold text-ink">{w.choosePhoto}</span>
                    <span>{w.dragHere}</span>
                  </span>
                )}
              </button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <div className="grid content-start gap-3">
                <p className="text-sm leading-relaxed text-muted">
                  {w.photoHint}
                </p>
                <label className="text-sm font-semibold" htmlFor="extra">
                  {w.extra} <span className="font-normal text-muted">{w.optional}</span>
                </label>
                <input
                  id="extra"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={CREATE_LIMITS.PROMPT_MAX}
                  placeholder={w.extraPlaceholder}
                  className="rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
                {photo && (
                  <button type="button" onClick={() => setPhoto(undefined)} className="justify-self-start text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
                    {w.removePhoto}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={CREATE_LIMITS.PROMPT_MAX}
                rows={3}
                placeholder={w.describePlaceholder}
                className="w-full resize-none rounded-2xl border border-line bg-paper p-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">{w.try}</span>
                {m.ideas.map((idea) => (
                  <button key={idea} type="button" onClick={() => setPrompt(idea)} className="rounded-full border border-line px-3 py-1.5 transition hover:border-ink/30">
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Step>

        <Step n={2} title={c.style}>
          {STYLE_GROUPS.map((g) => (
            <div key={g.id} className="mt-1 first:mt-0">
              <p className="mb-2 text-sm font-semibold text-muted">{styleGroupName(m, g.id)}</p>
              <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {STYLES.filter((s) => s.group === g.id).map((s) => {
                  const on = style === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      aria-pressed={on}
                      className={`rounded-[20px] border-2 p-1.5 text-left transition ${on ? "border-brand bg-brand-soft" : "border-transparent hover:border-line"}`}
                    >
                      <img src={`/styles/${s.id}.webp`} alt="" width={160} height={160} className="aspect-square w-full rounded-[14px] bg-paper" />
                      <span className="mt-1.5 block px-1 pb-0.5 text-sm font-semibold">{styleName(m, s.id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Step>

        <Step
          n={3}
          title={custom ? m.custom.title : c.reactions}
          aside={
            custom ? undefined : (
              <span className="text-sm text-muted">
                {fmt(c.reactionsCount, { n: actions.length, max: CREATE_LIMITS.MAX_ACTIONS })} · {fmt(c.reactionsMin, { min: CREATE_LIMITS.MIN_ACTIONS })}
              </span>
            )
          }
        >
          <div role="tablist" className="mb-5 flex w-fit gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
            {(["presets", "custom"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {k === "presets" ? m.custom.modeClassic : m.custom.modeCustom}
              </button>
            ))}
          </div>
          {custom ? (
            <CustomStickers
              plan={plan}
              onPlan={setPlan}
              description={description}
              onDescription={setDescription}
              count={count}
              onCount={setCount}
              kind={animated ? "animated" : "static"}
              hasPhoto={Boolean(usePhoto)}
              characterHint={prompt}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => {
                const on = actions.includes(a.id);
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full border py-2 pr-4 pl-2.5 text-sm font-semibold transition ${on ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink/30"}`}
                  >
                    <span className="text-lg leading-none">{a.emojis[0]}</span>
                    {actionName(m, a.id)}
                  </button>
                );
              })}
            </div>
          )}
        </Step>

        <Step n={4} title={c.finishing}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle checked={animated} onChange={setAnimated} title={c.animated} body={c.animatedBody} />
            {!custom && (
              <Toggle
                checked={captions}
                onChange={setCaptions}
                title={c.captions}
                body={fmt(c.captionsBody, { a: actionName(m, "laugh"), b: actionName(m, "shock") })}
              />
            )}
          </div>
          <label className="mt-5 block text-sm font-semibold" htmlFor="name">
            {w.packName} <span className="font-normal text-muted">{w.optional}</span>
          </label>
          <input
            id="name"
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
            maxLength={CREATE_LIMITS.PACK_NAME_MAX}
            placeholder={custom && plan ? plan.packName : w.packNamePlaceholder}
            className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </Step>
      </div>

      <aside className="sticky top-24 rounded-[28px] border border-line bg-card p-6 shadow-[0_24px_60px_-36px_rgba(22,18,29,0.4)]">
        <p className="text-sm font-semibold text-muted">{w.yourPack}</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-paper">
            {usePhoto ? (
              <img src={photo.previewUrl} alt="" className="size-full object-cover" />
            ) : (
              <img src={`/styles/${style}.webp`} alt="" width={80} height={80} className="size-full" />
            )}
          </div>
          <div>
            <div className="font-display text-3xl font-extrabold">{stickerCount}</div>
            <div className="text-sm text-muted">
              {fmt(animated ? w.summaryAnimated : w.summaryStill, { style: styleName(m, style) })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5 text-xl">
          {emojis.map((e, i) => (
            <span key={i}>{e}</span>
          ))}
        </div>
        {restored && !error && <p className="mt-5 rounded-2xl bg-brand-soft p-3 text-sm">{c.restored}</p>}
        {error && <p className="mt-5 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button
          disabled={busy || !ready}
          className="mt-6 w-full rounded-full bg-ink px-6 py-4 font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? c.starting : fmt(c.make, { n: stickerCount })}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          {ready ? c.takesMinute : custom ? m.custom.needPlan : source === "photo" ? w.needPhoto : c.needDescription}
        </p>
      </aside>
    </form>
  );
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line bg-card p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-3 font-display text-xl font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-sun text-sm">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, title, body }: { checked: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4 text-left transition hover:border-ink/30"
    >
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-line"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function UploadIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="9" cy="9.5" r="1.8" />
      <path d="M21 15.5l-4.5-4.5L8 19.5" />
    </svg>
  );
}
