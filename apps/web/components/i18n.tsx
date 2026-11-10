"use client";

import { getMessages, type Locale, type Messages } from "@stickers/shared";
import { createContext, useContext, useMemo } from "react";

const I18nContext = createContext<{ locale: Locale; m: Messages }>({ locale: "en", m: getMessages("en") });

/** Hands the language chosen on the server to client components. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, m: getMessages(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
