"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDiscoverI18n } from "@/components/i18n";
import { api } from "@/lib/api";
import { type PickedPhoto, preparePhoto } from "@/lib/photo";

/** "Use this style": the remixer adds only their photo (or a description); everything else comes from the pack. */
export function RemixPanel({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const { locale, m, d } = useDiscoverI18n();
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PickedPhoto>();
  const [describe, setDescribe] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onFile(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(m.web.create.notImage);
    try {
      setPhoto(await preparePhoto(file));
      setDescribe(false);
    } catch {
      setError(m.web.create.unreadable);
    }
  }

  const ready = !!photo || (describe && prompt.trim().length > 0);

  async function make() {
    setError(undefined);
    setBusy(true);
    try {
      const { job } = await api().remix(id, {
        photo: photo && !describe ? { base64: photo.base64, mimeType: photo.mimeType } : undefined,
        prompt: describe ? prompt.trim() : undefined,
        packName: title,
        locale,
      });
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div id="remix" className="scroll-mt-24 rounded-[28px] border border-line bg-card p-6 shadow-[0_24px_60px_-36px_rgba(22,18,29,0.4)]">
      <h2 className="font-display text-2xl font-bold tracking-tight">{d.remixTitle}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{d.remixBody}</p>

      {!describe && (
        <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-4">
          <button
            type="button"
            onClick={() => library.current?.click()}
            className="grid aspect-square place-items-center overflow-hidden rounded-[20px] border-2 border-dashed border-line bg-paper transition hover:border-ink/30"
            aria-label={d.choosePhoto}
          >
            {photo ? <img src={photo.previewUrl} alt={m.web.create.yourPhoto} className="size-full object-cover" /> : <span className="text-3xl text-muted">+</span>}
          </button>
          <div className="grid gap-2">
            <button type="button" onClick={() => library.current?.click()} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
              {photo ? d.changePhoto : d.choosePhoto}
            </button>
            {/* On phones this opens the front camera; desktops treat it like a file picker. */}
            <button type="button" onClick={() => camera.current?.click()} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink/30 md:hidden">
              {d.takeSelfie}
            </button>
          </div>
          <input ref={library} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      )}

      {describe ? (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={500}
          autoFocus
          placeholder={d.describePlaceholder}
          className="mt-5 w-full resize-none rounded-2xl border border-line bg-paper p-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
      ) : null}
      <button type="button" onClick={() => setDescribe((v) => !v)} className="mt-3 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
        {describe ? d.choosePhoto : d.orDescribe}
      </button>

      {error && <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button
        disabled={!ready || busy}
        onClick={make}
        className="mt-5 w-full rounded-full bg-ink px-6 py-4 font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? d.starting : d.makeMine}
      </button>
      <p className="mt-3 text-center text-xs text-muted">{d.photoNote}</p>
    </div>
  );
}
