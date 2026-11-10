/** The UI languages and how a visitor's language is matched to one. No imports, so app config can read it too. */

/** UI languages, in the order the language picker lists them. */
export const LOCALES = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's name in that language, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the first supported language from a preference list such as
 * ["pt-BR", "en-US"]. Only the primary subtag counts, so "zh-TW" gets
 * Simplified Chinese and "en-GB" gets English. Falls back to English.
 */
export function matchLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const primary = tag?.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** Language tags from an Accept-Language header, most preferred first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}
