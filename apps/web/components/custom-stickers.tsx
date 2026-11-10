"use client";

import { CREATE_LIMITS, type CustomSticker, type StickerPlan } from "@stickers/shared";
import { useState } from "react";
import { api } from "@/lib/api";

const IDEAS = [
  "I’m a boxer. Chibi me throwing punches, with “KO!” and “Let’s go”",
  "A yoga teacher who’s always calm, even when chaos hits",
  "Our cat Miso judging everything, captions in Spanish",
  "A nurse on night shift: coffee, high fives, “Need sleep”",
];

/**
 * "Make it yours": the user describes their persona and stickers in their own words,
 * the server plans one sticker per idea, and the user can tweak every caption and pose.
 */
export function CustomStickers({
  plan,
  onPlan,
  kind,
  hasPhoto,
  characterHint,
}: {
  plan?: StickerPlan;
  onPlan: (plan: StickerPlan | undefined) => void;
  kind: "animated" | "static";
  hasPhoto: boolean;
  /** What the user already wrote in step 1, so the plan keeps it. */
  characterHint?: string;
}) {
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function makePlan() {
    setError(undefined);
    setBusy(true);
    try {
      const hint = characterHint?.trim();
      const full = hint ? `Character: ${hint}\n${description.trim()}` : description.trim();
      const { plan } = await api().planPack({ description: full.slice(0, CREATE_LIMITS.DESCRIPTION_MAX), count, kind, hasPhoto });
      onPlan(plan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<CustomSticker>) =>
    plan && onPlan({ ...plan, stickers: plan.stickers.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => plan && onPlan({ ...plan, stickers: plan.stickers.filter((_, j) => j !== i) });
  const add = () => plan && onPlan({ ...plan, stickers: [...plan.stickers, { pose: "", caption: "" }] });

  return (
    <div className="grid gap-4">
      <label className="text-sm font-semibold" htmlFor="describe-pack">
        Tell us who you are and what your stickers should do
      </label>
      <textarea
        id="describe-pack"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={CREATE_LIMITS.DESCRIPTION_MAX - 200}
        rows={3}
        placeholder="e.g. I’m a boxer. I want a chibi me throwing big punches, celebrating a KO, and captions like “Let’s go!”"
        className="w-full resize-none rounded-2xl border border-line bg-paper p-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Try:</span>
        {IDEAS.map((idea) => (
          <button key={idea} type="button" onClick={() => setDescription(idea)} className="rounded-full border border-line px-3 py-1.5 text-left transition hover:border-ink/30">
            {idea}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Stickers
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-full border border-line bg-paper px-3 py-2 outline-none focus:border-brand"
          >
            {Array.from({ length: CREATE_LIMITS.MAX_ACTIONS - CREATE_LIMITS.MIN_ACTIONS + 1 }, (_, i) => i + CREATE_LIMITS.MIN_ACTIONS).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={makePlan}
          disabled={busy || description.trim().length < 3}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Writing your stickers…" : plan ? "Write them again" : "✨ Write my stickers"}
        </button>
      </div>
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {plan && (
        <div className="mt-2 grid gap-3">
          <label className="text-sm font-semibold" htmlFor="plan-character">
            Your character
          </label>
          <textarea
            id="plan-character"
            value={plan.character}
            onChange={(e) => onPlan({ ...plan, character: e.target.value })}
            maxLength={CREATE_LIMITS.PROMPT_MAX}
            rows={3}
            className="w-full resize-none rounded-2xl border border-line bg-paper p-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <p className="text-sm font-semibold">Your stickers · edit anything</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {plan.stickers.map((s, i) => (
              <li key={i} className="grid gap-2 rounded-2xl border border-line bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none" aria-hidden>
                    {s.emojis?.[0] ?? "😀"}
                  </span>
                  <input
                    aria-label={`Caption for sticker ${i + 1}`}
                    value={s.caption ?? ""}
                    onChange={(e) => update(i, { caption: e.target.value })}
                    maxLength={CREATE_LIMITS.CAPTION_MAX}
                    placeholder="No caption"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={plan.stickers.length <= CREATE_LIMITS.MIN_ACTIONS}
                    aria-label={`Remove sticker ${i + 1}`}
                    className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-line hover:text-ink disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  aria-label={`What sticker ${i + 1} shows`}
                  value={s.pose}
                  onChange={(e) => update(i, { pose: e.target.value, motion: undefined })}
                  maxLength={CREATE_LIMITS.POSE_MAX}
                  rows={4}
                  placeholder="What is the character doing?"
                  className="w-full resize-none rounded-xl border border-line bg-card p-2.5 text-sm outline-none focus:border-brand"
                />
              </li>
            ))}
          </ol>
          {plan.stickers.length < CREATE_LIMITS.MAX_ACTIONS && (
            <button type="button" onClick={add} className="justify-self-start rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
              + Add a sticker
            </button>
          )}
          <p className="text-xs text-muted">Captions print in Latin letters (English, Spanish, French…). Leave one empty for no text.</p>
        </div>
      )}
    </div>
  );
}
