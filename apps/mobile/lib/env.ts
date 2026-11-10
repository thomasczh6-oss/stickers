export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
export const STORE_LINKS = {
  ios: process.env.EXPO_PUBLIC_APP_STORE_URL ?? "",
  android: process.env.EXPO_PUBLIC_PLAY_STORE_URL ?? "",
};
/** Public website; pack share links point to <SITE_URL>/p/<id>, which also opens this app. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://stickers.example.com").replace(/\/$/, "");
