export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
export const STORE_LINKS = {
  ios: process.env.EXPO_PUBLIC_APP_STORE_URL ?? "",
  android: process.env.EXPO_PUBLIC_PLAY_STORE_URL ?? "",
};
/** Public website; pack share links point to <SITE_URL>/p/<id>, which also opens this app. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://stickers.example.com").replace(/\/$/, "");
/** Where support messages and privacy requests go. */
export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? "hello@stickers.example.com";
/**
 * The server address setting is for testers only. It shows in development, in builds made with
 * EXPO_PUBLIC_DEV_SETTINGS=1, and in builds that talk to a plain-http (local network) server.
 */
export const SHOW_DEV_SETTINGS = __DEV__ || process.env.EXPO_PUBLIC_DEV_SETTINGS === "1" || API_BASE_URL.startsWith("http://");
