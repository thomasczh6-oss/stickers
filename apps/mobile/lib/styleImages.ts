import type { StyleId } from "@stickers/shared";

/** Small sample image for each style, bundled with the app. */
export const STYLE_IMAGES: Record<StyleId, number> = {
  cartoon: require("@/assets/images/styles/cartoon.png"),
  "3d": require("@/assets/images/styles/3d.png"),
  anime: require("@/assets/images/styles/anime.png"),
  pixel: require("@/assets/images/styles/pixel.png"),
  clay: require("@/assets/images/styles/clay.png"),
  photo: require("@/assets/images/styles/photo.png"),
  caricature: require("@/assets/images/styles/caricature.png"),
  painted: require("@/assets/images/styles/painted.png"),
  retro: require("@/assets/images/styles/retro.png"),
};
