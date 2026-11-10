"use client";

import { CREATE_LIMITS, fmt, type CustomSticker, type StickerPlan } from "@stickers/shared";
import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "./i18n";

/**
 * "Make it yours": the user describes their persona and stickers in their own words,
 * the server plans one sticker per idea, and the user can tweak every caption and pose.
 * The description and count live in the form, so a retry after a failed job keeps them.
 */
export function CustomStickers({
  plan,
  onPlan,
  description,
  onDescription,
  count,
  onCount,
  kind,
  hasPhoto,
  characterHint,
}: {
  plan?: StickerPlan;
  onPlan: (plan: StickerPlan | undefined) => void;
  description: string;
  onDescription: (text: string) => void;
  count: number;
  onCount: (n: number) => void;
  kind: "animated" | "static";
  hasPhoto: boolean;
  /** What the user already wrote in step 1, so the plan keeps it. */
  characterHint?: string;
}) {
  const { m } = useI18n();
  const t = m.custom;
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
        {t.describeLabel}
      </label>
      <textarea
        id="describe-pack"
        value={description}
        onChange={(e) => onDescription(e.target.value)}
        maxLength={CREATE_LIMITS.DESCRIPTION_MAX - 200}
        rows={3}
        placeholder={t.describePlaceholder}
        className="w-full resize-none rounded-2xl border border-line bg-paper p-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{t.tryLabel}</span>
        {t.ideas.map((idea) => (
          <button key={idea} type="button" onClick={() => onDescription(idea)} className="rounded-full border border-line px-3 py-1.5 text-left transition hover:border-ink/30">
            {idea}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          {t.countLabel}
          <select
            value={count}
            onChange={(e) => onCount(Number(e.target.value))}
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
          {busy ? t.writing : plan ? t.rewrite : t.write}
        </button>
      </div>
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {plan && (
        <div className="mt-2 grid gap-3">
          <label className="text-sm font-semibold" htmlFor="plan-character">
            {t.character}
          </label>
          <textarea
            id="plan-character"
            value={plan.character}
            onChange={(e) => onPlan({ ...plan, character: e.target.value })}
            maxLength={CREATE_LIMITS.PROMPT_MAX}
            rows={3}
            className="w-full resize-none rounded-2xl border border-line bg-paper p-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <p className="text-sm font-semibold">{t.yourStickers}</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {plan.stickers.map((s, i) => (
              <li key={i} className="grid gap-2 rounded-2xl border border-line bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none" aria-hidden>
                    {s.emojis?.[0] ?? "😀"}
                  </span>
                  <input
                    aria-label={fmt(t.captionLabel, { n: i + 1 })}
                    value={s.caption ?? ""}
                    onChange={(e) => update(i, { caption: e.target.value })}
                    maxLength={CREATE_LIMITS.CAPTION_MAX}
                    placeholder={t.noCaption}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={plan.stickers.length <= CREATE_LIMITS.MIN_ACTIONS}
                    aria-label={fmt(t.removeLabel, { n: i + 1 })}
                    className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-line hover:text-ink disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  aria-label={fmt(t.poseLabel, { n: i + 1 })}
                  value={s.pose}
                  onChange={(e) => update(i, { pose: e.target.value, motion: undefined })}
                  maxLength={CREATE_LIMITS.POSE_MAX}
                  rows={4}
                  placeholder={t.posePlaceholder}
                  className="w-full resize-none rounded-xl border border-line bg-card p-2.5 text-sm outline-none focus:border-brand"
                />
              </li>
            ))}
          </ol>
          {plan.stickers.length < CREATE_LIMITS.MAX_ACTIONS && (
            <button type="button" onClick={add} className="justify-self-start rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
              {t.add}
            </button>
          )}
          <p className="text-xs text-muted">{t.captionHint}</p>
        </div>
      )}
    </div>
  );
}
