"use client";

import { fmt, FEEDBACK_LIMITS, type FeedbackKind } from "@stickers/shared";
import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "./i18n";

const KINDS: FeedbackKind[] = ["bug", "idea", "question", "other"];

/** Support and feedback form; messages go to the API's /v1/feedback. */
export function FeedbackForm() {
  const { locale, m } = useI18n();
  const t = m.support;
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (message.trim().length < FEEDBACK_LIMITS.MESSAGE_MIN) return setError(t.tooShort);
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.badEmail);
    setBusy(true);
    try {
      await api().sendFeedback({ kind, message: message.trim(), email: email.trim() || undefined, platform: "web", locale });
      setSent(true);
    } catch (err) {
      setError(fmt(t.sendError, { error: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="grid justify-items-center rounded-[28px] border border-line bg-card px-6 py-12 text-center">
        <div className="text-5xl" aria-hidden>
          💌
        </div>
        <p className="mt-3 font-display text-2xl font-bold">{t.sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-[28px] border border-line bg-card p-5 md:p-7">
      <fieldset>
        <legend className="mb-2 font-semibold">{t.kind}</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition has-focus-visible:ring-2 has-focus-visible:ring-brand ${kind === k ? "border-ink bg-ink text-white" : "border-line bg-paper hover:border-ink/30"}`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2">
        <span className="font-semibold">{t.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.messagePlaceholder}
          rows={6}
          maxLength={FEEDBACK_LIMITS.MESSAGE_MAX}
          className="rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink/40"
        />
      </label>
      <label className="grid gap-2">
        <span className="font-semibold">{t.email}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={FEEDBACK_LIMITS.EMAIL_MAX}
          autoComplete="email"
          className="rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink/40"
        />
        <span className="text-sm text-muted">{t.emailHint}</span>
      </label>
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-fit rounded-full bg-ink px-6 py-3 font-semibold text-white transition hover:bg-ink/85 disabled:opacity-60">
        {busy ? t.sending : t.send}
      </button>
    </form>
  );
}
