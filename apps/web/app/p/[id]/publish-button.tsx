"use client";

import { DISCOVER_LIMITS, type PublishState } from "@stickers/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDiscoverI18n } from "@/components/i18n";
import { api } from "@/lib/api";

/** Share to Discover, for the pack's creator only (the server says who that is). */
export function PublishButton({ packId, name }: { packId: string; name: string }) {
  const { d } = useDiscoverI18n();
  const p = d.publish;
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<PublishState>();
  const [title, setTitle] = useState(name);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api()
      .getPublishState(packId)
      .then(setState)
      .catch(() => undefined); // not the creator, or an old pack: show nothing
  }, [packId]);

  if (!state) return null;

  async function run(fn: () => Promise<PublishState>) {
    setBusy(true);
    setError(undefined);
    try {
      setState(await fn());
      dialog.current?.close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pub = state.publication;
  return (
    <div className="mt-4 rounded-[28px] border border-line bg-card p-5">
      {pub ? (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={`size-2.5 rounded-full ${pub.status === "visible" ? "bg-emerald-500" : pub.status === "removed" ? "bg-rose-500" : "bg-amber-400"}`} />
            {p.status[pub.status]}
          </div>
          <p className="mt-1 truncate text-sm text-muted">“{pub.title}”</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {pub.status === "visible" && (
              <Link href={`/discover/${pub.id}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {p.view}
              </Link>
            )}
            {pub.status !== "removed" && (
              <button disabled={busy} onClick={() => run(() => api().unpublish(packId))} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
                {p.unpublish}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{d.subtitle}</p>
          <button onClick={() => dialog.current?.showModal()} className="mt-3 w-full rounded-full bg-sun px-5 py-3 font-semibold transition hover:-translate-y-0.5">
            {p.button}
          </button>
        </>
      )}
      {error && !dialog.current?.open && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <dialog ref={dialog} className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[28px] border border-line bg-card p-0 text-ink backdrop:bg-ink/40">
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api().publish(packId, { title: title.trim() || undefined, agree }));
          }}
        >
          <h2 className="font-display text-2xl font-bold">{p.title}</h2>
          <p className="mt-1.5 text-sm text-muted">{p.body}</p>
          <label className="mt-5 block text-sm font-semibold" htmlFor="pub-title">
            {p.titleLabel}
          </label>
          <input
            id="pub-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={DISCOVER_LIMITS.TITLE_MAX}
            className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <ul className="mt-5 grid gap-2 rounded-2xl bg-paper p-4 text-sm">
            {p.rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden>•</span>
                {r}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-medium">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
            <span>
              {p.agree}{" "}·{" "}
              <Link href="/terms#community" target="_blank" className="text-brand underline underline-offset-4">
                {p.guidelines}
              </Link>
            </span>
          </label>
          {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="flex-1 rounded-full border border-line px-4 py-3 font-semibold">
              {d.cancel}
            </button>
            <button disabled={!agree || busy} className="flex-1 rounded-full bg-ink px-4 py-3 font-semibold text-white disabled:opacity-40">
              {busy ? p.publishing : p.submit}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
