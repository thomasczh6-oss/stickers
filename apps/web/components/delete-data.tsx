"use client";

import { fmt } from "@stickers/shared";
import { useState } from "react";
import { api, resetDeviceId } from "@/lib/api";
import { useI18n } from "./i18n";

/** "Delete all my data" for this browser, with a confirm step. */
export function DeleteDataButton() {
  const { m } = useI18n();
  const t = m.data;
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [error, setError] = useState<string>();

  async function run() {
    setState("busy");
    setError(undefined);
    try {
      await api().deleteMyData();
      resetDeviceId();
      setState("done");
    } catch (e) {
      setError(fmt(t.error, { error: (e as Error).message }));
      setState("confirm");
    }
  }

  if (state === "done") return <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{t.done}</p>;
  return (
    <div className="grid gap-3">
      {state === "idle" ? (
        <button
          type="button"
          onClick={() => setState("confirm")}
          className="w-fit rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          {t.button}
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="del-title" className="grid gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div>
            <div id="del-title" className="font-semibold text-rose-800">
              {t.confirmTitle}
            </div>
            <p className="mt-1 text-sm text-rose-700">{t.confirmBody}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state === "busy"}
              onClick={run}
              className="rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-60"
            >
              {state === "busy" ? t.deleting : t.confirm}
            </button>
            <button type="button" onClick={() => setState("idle")} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold">
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
