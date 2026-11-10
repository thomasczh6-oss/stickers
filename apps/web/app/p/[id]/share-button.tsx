"use client";

import { fmt } from "@stickers/shared";
import { useState } from "react";
import { useI18n } from "@/components/i18n";

/** Native share sheet where there is one (phones), otherwise copies the link. */
export function ShareButton({ name }: { name: string }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: fmt(m.pack.shareText, { name }), url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing else to do */
    }
  };
  return (
    <button onClick={share} className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/85">
      {copied ? m.web.pack.copied : m.web.pack.share}
    </button>
  );
}
