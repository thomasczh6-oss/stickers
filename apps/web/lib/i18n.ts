import { getMessages, isLocale, type Locale, matchLocale, type Messages, parseAcceptLanguage } from "@stickers/shared";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE } from "./locale-cookie";

/**
 * The visitor's language: the one they picked in the footer (a cookie),
 * otherwise the best match for their browser's Accept-Language, otherwise English.
 */
export async function getLocale(): Promise<Locale> {
  const picked = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(picked)) return picked;
  return matchLocale(parseAcceptLanguage((await headers()).get("accept-language")));
}

export async function getI18n(): Promise<{ locale: Locale; m: Messages }> {
  const locale = await getLocale();
  return { locale, m: getMessages(locale) };
}
