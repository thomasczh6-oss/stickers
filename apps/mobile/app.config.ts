import type { ExpoConfig } from "expo/config";

/** Domain of the web app; /p/<id> links on it open this app (universal links / App Links). */
const domain = process.env.WEB_DOMAIN ?? "stickers.example.com";
const bundleId = process.env.APP_BUNDLE_ID ?? "ai.stickers.app";

const config: ExpoConfig = {
  name: "Stickers AI",
  slug: "stickers-ai",
  version: "0.1.0",
  scheme: "stickers",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    associatedDomains: [`applinks:${domain}`],
    infoPlist: {
      // Needed to check for WhatsApp and to open whatsapp://stickerPack.
      LSApplicationQueriesSchemes: ["whatsapp"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: { foregroundImage: "./assets/images/adaptive-icon.png", backgroundColor: "#7c3aed" },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: domain, pathPrefix: "/p/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 220, backgroundColor: "#faf7ff" }],
    ["expo-image-picker", { photosPermission: "Pick a photo to turn into your sticker character." }],
  ],
  experiments: { typedRoutes: true },
};

export default config;
