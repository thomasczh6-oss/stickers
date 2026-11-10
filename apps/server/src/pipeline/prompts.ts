import type { ACTIONS, STYLES } from "@stickers/shared";

type Style = (typeof STYLES)[number];
type Action = (typeof ACTIONS)[number];

const BACKGROUND_RULES =
  "Background: one flat, solid, pure green color (#00FF00) filling the entire image, with no gradient, no shadow, no floor and no scenery. " +
  "The character itself must not contain any green. No text, no letters, no numbers, no watermark, no border.";

const isReal = (style: Style) => style.group === "real";

/**
 * Realistic styles: keep the real face, real proportions, and a waist-up crop so the face is
 * big enough to read at 512px. Descriptions (or a planner) may still say "chibi" or "cute";
 * the style wins.
 */
const REAL_RULES =
  "Keep realistic human proportions and a true likeness; do not turn the subject into a cartoon, anime or chibi character, whatever the description says. " +
  "Frame the subject from the waist up, so the face is large and clearly readable.";

export function characterPrompt(opts: { style: Style; description?: string; fromPhoto: boolean }): string {
  const real = isReal(opts.style);
  const subject = opts.fromPhoto
    ? real
      ? "Make a sticker of the person or pet in the reference photo, keeping their real face and likeness: face shape and features, hairstyle and hair color, skin tone, eye color, glasses, facial hair, and outfit."
      : "Turn the person or pet in the reference photo into a cute sticker character. Keep what makes them recognizable: face shape, hairstyle and hair color, skin tone, eye color, glasses, facial hair, and outfit colors."
    : real
      ? `Create one sticker subject: ${opts.description}. An original, fictional person or animal, not anyone real or famous.`
      : `Design one cute sticker character: ${opts.description}.`;
  const extra = opts.fromPhoto && opts.description ? ` Extra direction: ${opts.description}.` : "";
  return [
    subject + extra,
    `Art style: ${opts.style.prompt}.`,
    real
      ? `${REAL_RULES} Centered, facing the viewer, with a friendly natural expression and empty space around them.`
      : "Show the whole character, centered, facing the viewer, with a friendly neutral expression and plenty of empty space around it.",
    BACKGROUND_RULES,
  ].join(" ");
}

export function posePrompt(opts: { style: Style; action: Action }): string {
  const real = isReal(opts.style);
  return [
    `The same ${real ? "person" : "character"} as in the reference image, now ${opts.action.pose}.`,
    real
      ? "Keep their face, likeness, hair, outfit and the art style exactly the same, rendered the same way as the reference (same brushwork, texture or photo look)."
      : "Keep the character's identity, proportions, colors, outfit and art style exactly the same.",
    `Art style: ${opts.style.prompt}.`,
    real
      ? `${REAL_RULES} Big, expressive, meme-worthy reaction. Centered, with empty margin on every side.`
      : "Exaggerated, expressive sticker pose. The whole character is visible and centered, with empty margin on every side.",
    BACKGROUND_RULES,
  ].join(" ");
}

/** 3x2 cells of 512px on a 1536x1024 sheet: six frames in one image call. */
export const SHEET = { columns: 3, rows: 2, size: "1536x1024" } as const;

export function spriteSheetPrompt(opts: { style: Style; action: Action }): string {
  const n = SHEET.columns * SHEET.rows;
  const real = isReal(opts.style);
  return [
    `A sprite sheet of ${n} animation frames of the same character as in the reference image, arranged in a grid of ${SHEET.columns} columns and ${SHEET.rows} rows of equal square cells, read left to right, top to bottom.`,
    `Frame 1 (top left) is the key pose: ${opts.action.pose}.`,
    `The next frames continue the motion in even steps, like ${real ? "frames of a short video clip" : "in-between frames of a cartoon"}, with clearly visible, exaggerated movement: ${opts.action.motion}. The last frame comes back close to frame 1 so the animation loops smoothly.`,
    "In every cell: the same camera, the same scale, the character centered with empty margin, nothing crossing the cell edges.",
    "The character stays in the same spot and keeps the same pose in every cell; only the moving part changes. A raised hand or paw stays the same one (same side) in every frame; never mirror or flip the character.",
    real
      ? `Keep the person's face, likeness, hair and outfit identical in every frame, rendered the same way as the reference (same brushwork, texture or photo look). ${REAL_RULES}`
      : "Keep the character's identity, proportions, colors and outfit identical in every frame.",
    `Art style: ${opts.style.prompt}.`,
    "The whole sheet shares one flat, solid, pure green background (#00FF00): no ground shadow, no grid lines, no cell borders, no frame numbers, no text. The character itself must not contain any green.",
  ].join(" ");
}
