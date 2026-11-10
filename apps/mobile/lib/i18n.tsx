import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDiscoverMessages, getMessages, isLocale, type Locale, matchLocale, type Messages } from "@stickers/shared";
import { useLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "stickers.locale";

/** "device" follows the phone's language; a locale is a language picked in Settings. */
export type LanguagePreference = Locale | "device";

type I18n = { locale: Locale; m: Messages; preference: LanguagePreference; setPreference: (p: LanguagePreference) => Promise<void> };

const I18nContext = createContext<I18n>({ locale: "en", m: getMessages("en"), preference: "device", setPreference: async () => undefined });

/** Picks the UI language: the one saved in Settings, else the phone's preferred languages, else English. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const deviceLocales = useLocales();
  const [preference, setPref] = useState<LanguagePreference>("device");

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((saved) => {
      if (isLocale(saved)) setPref(saved);
    });
  }, []);

  const setPreference = useCallback(async (p: LanguagePreference) => {
    setPref(p);
    if (p === "device") await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, p);
  }, []);

  const deviceLocale = matchLocale(deviceLocales.map((l) => l.languageTag));
  const locale = preference === "device" ? deviceLocale : preference;
  const value = useMemo(() => ({ locale, m: getMessages(locale), preference, setPreference }), [locale, preference, setPreference]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Discover screen text in the app's language. */
export function useDiscoverI18n() {
  const i = useContext(I18nContext);
  return { ...i, d: getDiscoverMessages(i.locale) };
}
