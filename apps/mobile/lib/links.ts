import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { CONTACT_EMAIL, SITE_URL, STORE_LINKS } from "./env";

/** Opens one of the website's pages (Terms, Privacy, Imprint) in the browser. */
export function openSitePage(path: "/terms" | "/privacy" | "/imprint" | "/help") {
  void Linking.openURL(`${SITE_URL}${path}`).catch(() => undefined);
}

export function emailSupport(subject = "Stickers AI") {
  void Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() => undefined);
}

/** The store page to rate the app on, or undefined until the store links are set for this build. */
export const RATE_URL: string | undefined =
  Platform.OS === "ios"
    ? STORE_LINKS.ios
      ? `${STORE_LINKS.ios}${STORE_LINKS.ios.includes("?") ? "&" : "?"}action=write-review`
      : undefined
    : STORE_LINKS.android || undefined;
