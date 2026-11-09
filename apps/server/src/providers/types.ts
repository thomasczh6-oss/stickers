/**
 * What the pipeline asks for. Real providers only read `prompt` and `images`;
 * the mock provider reads `intent` to draw a matching placeholder.
 */
export type ImageIntent =
  | { kind: "character" }
  | { kind: "pose"; label: string }
  | { kind: "spritesheet"; label: string; columns: number; rows: number };

export interface ImageRequest {
  prompt: string;
  /** Reference images (character sheet, user photo). Empty means text-to-image. */
  images: { data: Buffer; mimeType: string }[];
  /** "1024x1024" etc. Sides must be multiples of 16. */
  size: string;
  intent: ImageIntent;
}

export interface ImageProvider {
  readonly name: string;
  /** Returns encoded image bytes (PNG, JPEG or WebP). */
  image(req: ImageRequest): Promise<Buffer>;
}

/** Thrown for failures worth showing to the user (content policy, bad photo). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}
