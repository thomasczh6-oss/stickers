"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live front-camera view with a shutter, for desktop webcams.
 * Phones skip this and use the native camera via <input capture="user">.
 */
export function SelfieCamera({ onShot, onClose }: { onShot: (file: File) => void; onClose: (error?: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => onClose("We couldn’t open your camera. Allow camera access in your browser, or upload a photo instead."));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose]);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // Centre square crop, matching the square photo tile.
    const size = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, size, size);
    canvas.toBlob((blob) => blob && onShot(new File([blob], "selfie.jpg", { type: "image/jpeg" })), "image/jpeg", 0.92);
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-[22px] bg-ink">
      {/* Mirrored like a mirror; the saved shot is not mirrored. */}
      <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} className="size-full -scale-x-100 object-cover" />
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
        <button type="button" onClick={() => onClose()} className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink">
          Cancel
        </button>
        <button
          type="button"
          onClick={snap}
          disabled={!ready}
          aria-label="Take photo"
          className="size-12 rounded-full border-4 border-white bg-white/30 transition enabled:hover:bg-white/60 disabled:opacity-40"
        />
      </div>
    </div>
  );
}
