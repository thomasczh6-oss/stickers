export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";
/** Custom scheme of the mobile app (apps/mobile/app.json). */
export const APP_SCHEME = "stickers";
/** Address the Next.js server uses to reach the API. Can be an internal URL. */
export const API_INTERNAL_BASE_URL = process.env.API_INTERNAL_BASE_URL ?? API_BASE_URL;
/** Where privacy and support requests go. Set before launch. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@stickers.example.com";
