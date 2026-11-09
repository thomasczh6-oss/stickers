import type { Config } from "../config";
import { GatewayImageProvider } from "./gateway";
import { MockImageProvider } from "./mock";
import type { ImageProvider } from "./types";

export function createImageProvider(cfg: Config): ImageProvider {
  return cfg.provider === "gateway" ? new GatewayImageProvider(cfg.gateway) : new MockImageProvider(300);
}

export type { ImageProvider, ImageRequest, ImageIntent } from "./types";
export { ProviderError } from "./types";
