"use client";

import { isLocale, LOCALE_NAMES, LOCALES } from "@stickers/shared";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE } from "@/lib/locale-cookie";
import { useI18n } from "./i18n";

/** Language menu. The choice is kept in a cookie for a year and wins over the browser language. */
export function LanguagePicker({ compact = false, className = "inline-flex" }: { compact?: boolean; className?: string }) {
  const { locale, m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (value: string) => {
    if (!isLocale(value)) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <label className={`relative ${className} items-center gap-1.5 rounded-full border border-line bg-card text-sm font-medium text-ink transition hover:border-ink/30 ${compact ? "px-2.5 py-1.5" : "px-3 py-2"} ${pending ? "opacity-60" : ""}`}>
      <GlobeIcon />
      <span className="sr-only">{m.web.nav.language}</span>
      <span aria-hidden className={compact ? "uppercase" : ""}>
        {compact ? locale : LOCALE_NAMES[locale]}
      </span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-muted">
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        aria-label={m.web.nav.language}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="text-muted">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}
