"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n";

/** Shown when a page crashes while rendering, instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto grid max-w-md justify-items-center py-24 text-center">
      <div className="text-6xl" aria-hidden>
        🫠
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.02em]">{m.errors.title}</h1>
      <p className="mt-3 text-muted">{m.errors.body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-ink px-6 py-3.5 font-semibold text-white">
          {m.errors.retry}
        </button>
        <Link href="/help#contact" className="rounded-full border border-line bg-card px-6 py-3.5 font-semibold">
          {m.support.contact}
        </Link>
      </div>
    </div>
  );
}
