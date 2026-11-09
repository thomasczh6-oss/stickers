import type { ACTIONS, STYLES } from "@stickers/shared";

type Style = (typeof STYLES)[number];
type Action = (typeof ACTIONS)[number];

const BACKGROUND_RULES =
  "Background: one flat, solid, pure green color (#00FF00) filling the entire image, with no gradient, no shadow, no floor and no scenery. " +
  "The character itself must not contain any green. No text, no letters, no numbers, no watermark, no border.";

export function characterPrompt(opts: { style: Style; description?: string; fromPhoto: boolean }): string {
  const subject = opts.fromPhoto
    ? "Turn the person or pet in the reference photo into a cute sticker character. Keep what makes them recognizable: face shape, hairstyle and hair color, skin tone, eye color, glasses, facial hair, and outfit colors."
    : `Design one cute sticker character: ${opts.description}.`;
  const extra = opts.fromPhoto && opts.description ? ` Extra direction: ${opts.description}.` : "";
  return [
    subject + extra,
    `Art style: ${opts.style.prompt}.`,
    "Show the whole character, centered, facing the viewer, with a friendly neutral expression and plenty of empty space around it.",
    BACKGROUND_RULES,
  ].join(" ");
}

export function posePrompt(opts: { style: Style; action: Action }): string {
  return [
    `The same character as in the reference image, now ${opts.action.pose}.`,
    "Keep the character's identity, proportions, colors, outfit and art style exactly the same.",
    `Art style: ${opts.style.prompt}.`,
    "Exaggerated, expressive sticker pose. The whole character is visible and centered, with empty margin on every side.",
    BACKGROUND_RULES,
  ].join(" ");
}

export const SHEET = { columns: 2, rows: 2 } as const;

export function spriteSheetPrompt(opts: { style: Style; action: Action }): string {
  const n = SHEET.columns * SHEET.rows;
  return [
    `A sprite sheet of ${n} animation frames of the same character as in the reference image, arranged in a ${SHEET.columns} by ${SHEET.rows} grid of equal square cells, read left to right, top to bottom.`,
    `Frame 1 (top left) is the key pose: ${opts.action.pose}.`,
    `The next frames continue the motion: ${opts.action.motion}. The last frame comes back close to frame 1 so the animation loops smoothly.`,
    "In every cell: the same camera, the same scale, the character centered with empty margin, nothing crossing the cell edges.",
    "The character stays in the same spot and keeps the same pose in every cell; only the moving part changes. A raised hand or paw stays the same one (same side) in every frame; never mirror or flip the character.",
    "Keep the character's identity, proportions, colors and outfit identical in every frame.",
    `Art style: ${opts.style.prompt}.`,
    "The whole sheet shares one flat, solid, pure green background (#00FF00): no grid lines, no cell borders, no frame numbers, no text. The character itself must not contain any green.",
  ].join(" ");
}
