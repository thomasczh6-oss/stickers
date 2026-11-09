"use client";

import { ACTIONS, CREATE_LIMITS, DEFAULT_ACTIONS, parseCreatePackRequest, STYLES, type ActionId, type StyleId } from "@stickers/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

type Photo = { base64: string; mimeType: "image/jpeg"; previewUrl: string };

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
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<Photo>();
  const [style, setStyle] = useState<StyleId>("cartoon");
  const [animated, setAnimated] = useState(true);
  const [actions, setActions] = useState<ActionId[]>(DEFAULT_ACTIONS);
  const [captions, setCaptions] = useState(true);
  const [packName, setPackName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (id: ActionId) =>
    setActions((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : cur.length < CREATE_LIMITS.MAX_ACTIONS ? [...cur, id] : cur));

  async function onPhoto(file: File | undefined) {
    setError(undefined);
    if (!file) return setPhoto(undefined);
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError("That photo could not be read. Try a JPEG or PNG.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body = {
      prompt: prompt.trim() || undefined,
      photo: photo && { base64: photo.base64, mimeType: photo.mimeType },
      style,
      kind: animated ? "animated" : "static",
      actions,
      captions,
      packName: packName.trim() || undefined,
    };
    const parsed = parseCreatePackRequest(body);
    if (!parsed.ok) return setError(parsed.errors.join(". "));
    setBusy(true);
    try {
      const { job } = await api().createPack(parsed.value);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-violet-100 md:p-10">
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <label className="checker grid size-40 cursor-pointer place-items-center overflow-hidden rounded-3xl ring-2 ring-dashed ring-violet-200 hover:ring-brand">
          {photo ? (
            <img src={photo.previewUrl} alt="Your photo" className="size-full object-cover" />
          ) : (
            <span className="px-4 text-center text-sm font-semibold text-violet-900/60">
              Add a photo
              <br />
              <span className="font-normal">(optional)</span>
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        <div className="grid gap-3">
          <label className="text-sm font-bold" htmlFor="prompt">
            {photo ? "Anything to add? (optional)" : "Describe your character"}
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={CREATE_LIMITS.PROMPT_MAX}
            rows={3}
            placeholder={photo ? "e.g. give me a superhero cape" : "e.g. a chubby corgi wearing a red bandana"}
            className="w-full resize-none rounded-2xl border-0 bg-violet-50 p-4 outline-none ring-brand focus:ring-2"
          />
          {photo && (
            <button type="button" onClick={() => setPhoto(undefined)} className="justify-self-start text-sm font-semibold text-brand">
              Remove photo
            </button>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-bold">Style</legend>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${style === s.id ? "bg-brand text-white ring-brand" : "bg-white ring-violet-200 hover:ring-brand"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-bold">
          Reactions <span className="font-normal text-violet-900/60">({actions.length} stickers, pick 3 to 12)</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {ACTIONS.map((a) => {
            const on = actions.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${on ? "bg-violet-50 ring-brand" : "bg-white ring-violet-100 hover:ring-violet-300"}`}
              >
                <span className="text-xl">{a.emojis[0]}</span>
                {a.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-6 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={animated} onChange={(e) => setAnimated(e.target.checked)} className="size-4 accent-brand" />
          Animated
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="size-4 accent-brand" />
          Add captions (LOL, OMG…)
        </label>
        <input
          value={packName}
          onChange={(e) => setPackName(e.target.value)}
          maxLength={CREATE_LIMITS.PACK_NAME_MAX}
          placeholder="Pack name (optional)"
          className="min-w-48 flex-1 rounded-full border-0 bg-violet-50 px-4 py-2.5 font-normal outline-none ring-brand focus:ring-2"
        />
      </div>

      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

      <button
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-brand to-brand-2 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/30 transition enabled:hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? "Starting…" : `Make ${actions.length} stickers`}
      </button>
      <p className="-mt-4 text-center text-xs text-violet-900/50">
        Takes about a minute. Your photo is only used to draw your character and is deleted right after.
      </p>
    </form>
  );
}
