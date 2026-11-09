/**
 * WhatsApp third-party sticker pack limits.
 * Source: https://github.com/WhatsApp/stickers (Android/README.md, iOS/README.md)
 */
export const WA = {
  /** Every sticker must be exactly this many pixels wide and tall. */
  STICKER_SIZE: 512,
  STATIC_MAX_BYTES: 100 * 1024,
  ANIMATED_MAX_BYTES: 500 * 1024,
  /** Tray icon: static PNG, 96x96, at most 50KB. */
  TRAY_SIZE: 96,
  TRAY_MAX_BYTES: 50 * 1024,
  /** Animated stickers: each frame at least 8ms, whole loop at most 10s. */
  MIN_FRAME_MS: 8,
  MAX_ANIMATION_MS: 10_000,
  /** A pack holds 3 to 30 stickers, all static or all animated. */
  PACK_MIN_STICKERS: 3,
  PACK_MAX_STICKERS: 30,
  /** Each sticker carries 1 to 3 emoji (required on Android). */
  EMOJI_MIN: 1,
  EMOJI_MAX: 3,
  NAME_MAX: 128,
  PUBLISHER_MAX: 128,
  IDENTIFIER_MAX: 128,
  ACCESSIBILITY_STATIC_MAX: 125,
  ACCESSIBILITY_ANIMATED_MAX: 255,
} as const;

/** Pack identifiers may only use letters, digits, "_", "-", "." and spaces. */
export const PACK_IDENTIFIER_PATTERN = /^[A-Za-z0-9_\-. ]+$/;

/** Android package names WhatsApp ships under. */
export const WHATSAPP_PACKAGES = {
  consumer: "com.whatsapp",
  business: "com.whatsapp.w4b",
} as const;
