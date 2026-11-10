import type { Locale } from "../i18n/locales";
import { de } from "./messages/de";
import { type DiscoverMessages, en } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { it } from "./messages/it";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { pt } from "./messages/pt";
import { zh } from "./messages/zh";

export * from "./types";
export * from "./validate";
export type { DiscoverMessages };

const MESSAGES: Record<Locale, DiscoverMessages> = { en, es, fr, de, it, pt, zh, ja, ko };

/** Discover screen text in this language (English when missing). */
export function getDiscoverMessages(locale: Locale): DiscoverMessages {
  return MESSAGES[locale] ?? en;
}
