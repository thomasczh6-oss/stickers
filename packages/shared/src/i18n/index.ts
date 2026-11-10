import { ACTIONS, STYLES } from "../presets";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { de } from "./messages/de";
import { en, type Messages } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { it } from "./messages/it";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { pt } from "./messages/pt";
import { zh } from "./messages/zh";

export type { Messages };
export * from "./locales";

const MESSAGES: Record<Locale, Messages> = { en, es, fr, de, it, pt, zh, ja, ko };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}

/** Fills {name} placeholders: fmt("Make {n} stickers", { n: 6 }). Unknown names are left as they are. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** A style's name in this language, or its English name for styles not translated yet. */
export function styleName(m: Messages, id: string): string {
  return m.styles[id] ?? STYLES.find((s) => s.id === id)?.label ?? id;
}

/** A reaction's short label in this language. It is also the caption printed on the sticker. */
export function actionName(m: Messages, id: string): string {
  return m.actions[id] ?? ACTIONS.find((a) => a.id === id)?.label ?? id;
}
