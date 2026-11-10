"use client";

import { REPORT_REASONS, type ReportReason } from "@stickers/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDiscoverI18n } from "@/components/i18n";
import { api } from "@/lib/api";

/** Report and block, as app stores require for user-generated content. */
export function SafetyMenu({ id }: { id: string }) {
  const router = useRouter();
  const { d } = useDiscoverI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>();
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string>();
  const [mine, setMine] = useState(false);

  // The page is rendered without the viewer's id; ask once in the browser whether this is their own pack.
  useEffect(() => {
    api()
      .getDiscoverItem(id)
      .then((r) => setMine(r.item.mine))
      .catch(() => undefined);
  }, [id]);

  async function send() {
    if (!reason) return;
    setState("busy");
    setError(undefined);
    try {
      await api().report(id, { reason, note: note.trim() || undefined });
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  async function block() {
    if (!window.confirm(d.blockBody)) return;
    try {
      await api().blockCreator(id);
      router.push("/discover");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (mine) return null;
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => dialog.current?.showModal()} className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-ink/30">
          {d.report}
        </button>
        <button onClick={block} className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-ink/30 hover:text-ink">
          {d.block}
        </button>
      </div>
      <dialog ref={dialog} className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[28px] border border-line bg-card p-0 text-ink backdrop:bg-ink/40">
        <div className="p-6">
          {state === "done" ? (
            <>
              <h2 className="font-display text-2xl font-bold">{d.reported}</h2>
              <button
                onClick={() => {
                  dialog.current?.close();
                  router.push("/discover");
                }}
                className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 font-semibold text-white"
              >
                {d.backToDiscover}
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">{d.reportTitle}</h2>
              <p className="mt-1.5 text-sm text-muted">{d.reportBody}</p>
              <div className="mt-4 grid gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${reason === r ? "border-ink bg-paper" : "border-line hover:border-ink/30"}`}>
                    <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--color-brand)]" />
                    {d.reasons[r]}
                  </label>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={d.notePlaceholder}
                className="mt-3 w-full resize-none rounded-2xl border border-line bg-paper p-3 text-sm outline-none focus:border-brand"
              />
              {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => dialog.current?.close()} className="flex-1 rounded-full border border-line px-4 py-3 font-semibold">
                  {d.cancel}
                </button>
                <button disabled={!reason || state === "busy"} onClick={send} className="flex-1 rounded-full bg-ink px-4 py-3 font-semibold text-white disabled:opacity-40">
                  {d.sendReport}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
