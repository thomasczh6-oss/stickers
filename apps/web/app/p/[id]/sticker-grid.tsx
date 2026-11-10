"use client";

import type { StickerPack } from "@stickers/shared";
import { useState } from "react";

/**
 * Tap a sticker to send it anywhere: the phone's share sheet (iMessage, Messenger, Instagram,
 * Signal...) where the browser can share files, otherwise a download.
 */
export function StickerGrid({ pack }: { pack: StickerPack }) {
  const [busy, setBusy] = useState<number>();
  const [note, setNote] = useState<string>();

  const shareOne = async (i: number) => {
    const file = pack.exports?.share[i];
    if (!file) return window.open(pack.stickers[i]!.url, "_blank", "noopener");
    setBusy(i);
    try {
      const blob = await (await fetch(file.url)).blob();
      const f = new File([blob], file.fileName, { type: file.mimeType });
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] }).catch(() => undefined);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = file.fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setNote(`Saved ${file.fileName}. Drag it into any chat to send it.`);
      }
    } catch {
      setNote("Couldn’t get that sticker. Please try again.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {pack.stickers.map((s, i) => (
          <button
            key={s.id}
            onClick={() => shareOne(i)}
            aria-label={`Share sticker: ${s.accessibilityText}`}
            className="group relative rounded-[24px] border border-line bg-card p-2 text-left transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-24px_rgba(22,18,29,0.4)]"
          >
            <img src={s.url} alt={s.accessibilityText} width={512} height={512} className={`aspect-square w-full ${busy === i ? "opacity-50" : ""}`} />
            <span className="absolute top-3 right-3 rounded-full bg-paper/90 px-2 py-0.5 text-base opacity-0 transition group-hover:opacity-100">
              {s.emojis.join(" ")}
            </span>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              {pack.animated ? "Send as GIF" : "Send"}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {note ?? "Tap a sticker to send it in iMessage, Messenger, Instagram or any other chat."}
      </p>
    </>
  );
}
