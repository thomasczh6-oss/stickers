"use client";

import type { ModerationAction, ModerationItem } from "@stickers/shared";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/env";

const KEY = "stickers.adminToken";
const FILTERS = ["queue", "visible", "pending", "hidden", "removed", "all"] as const;
type Filter = (typeof FILTERS)[number];

export function ModerationQueue() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState<Filter>("queue");
  const [items, setItems] = useState<ModerationItem[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(KEY);
      if (t) {
        setToken(t);
        setSaved(true);
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    [token],
  );

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setItems((await call(`/v1/admin/discover?status=${filter}`)).items);
    } catch (e) {
      setError((e as Error).message);
      setItems(undefined);
    }
  }, [call, filter]);

  useEffect(() => {
    if (saved) void load();
  }, [saved, load]);

  async function act(id: string, action: ModerationAction) {
    if (action === "ban" && !window.confirm("Ban this creator? All their packs come off Discover.")) return;
    try {
      await call(`/v1/admin/discover/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!saved)
    return (
      <form
        className="mt-8 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            sessionStorage.setItem(KEY, token);
          } catch {
            /* fine, keep it in memory */
          }
          setSaved(true);
        }}
      >
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" className="flex-1 rounded-2xl border border-line bg-card px-4 py-3" />
        <button className="rounded-full bg-ink px-5 font-semibold text-white">Open</button>
      </form>
    );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filter === f ? "border-ink bg-ink text-white" : "border-line bg-card"}`}>
            {f}
          </button>
        ))}
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem(KEY);
            } catch {
              /* ignore */
            }
            setSaved(false);
            setToken("");
          }}
          className="ml-auto text-sm font-semibold text-muted"
        >
          Sign out
        </button>
      </div>
      {error && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {items?.length === 0 && <p className="mt-10 text-center text-muted">Nothing here. 🎉</p>}
      <div className="mt-6 grid gap-4">
        {items?.map((m) => (
          <div key={m.item.id} className="grid gap-4 rounded-[24px] border border-line bg-card p-4 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{m.item.title}</span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold">{m.status}</span>
                <span className="text-sm text-muted">
                  {m.item.creator} · {m.item.style} · {m.item.id}
                </span>
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto">
                {m.pack?.stickers.map((s) => (
                  <img key={s.id} src={s.url} alt="" width={72} height={72} className="size-18 shrink-0 rounded-xl bg-paper" />
                ))}
              </div>
              {m.reportCount > 0 && (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">{m.reportCount} open reports:</span>{" "}
                  {Object.entries(m.reasons)
                    .map(([r, n]) => `${r} ×${n}`)
                    .join(", ")}
                </p>
              )}
              {m.notes.map((n, i) => (
                <p key={i} className="mt-1 text-sm text-muted">
                  “{n}”
                </p>
              ))}
            </div>
            <div className="flex flex-wrap content-start gap-2 md:w-48 md:flex-col">
              <button onClick={() => act(m.item.id, "approve")} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Approve
              </button>
              <button onClick={() => act(m.item.id, "hide")} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
                Hide
              </button>
              <button onClick={() => act(m.item.id, "remove")} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                Remove
              </button>
              <button onClick={() => act(m.item.id, "ban")} className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700">
                Ban creator
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
