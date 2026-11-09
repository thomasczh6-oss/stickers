import sharp from "sharp";
import type { ImageProvider, ImageRequest } from "./types";

/**
 * Offline stand-in for the gateway. Draws a simple face on the same flat green
 * background the real prompts ask for, so the rest of the pipeline (matting,
 * sprite slicing, WebP encoding) runs exactly as it does with real images.
 * Never used in production unless IMAGE_PROVIDER=mock.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";

  constructor(private readonly delayMs = 0) {}

  async image(req: ImageRequest): Promise<Buffer> {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const [w, h] = req.size.split("x").map(Number) as [number, number];
    const hue = hash(req.prompt.slice(0, 80)) % 360;
    const intent = req.intent;
    let body = "";
    if (intent.kind === "spritesheet") {
      const cw = w / intent.columns;
      const ch = h / intent.rows;
      let i = 0;
      for (let r = 0; r < intent.rows; r++) {
        for (let c = 0; c < intent.columns; c++) {
          const t = i / (intent.columns * intent.rows);
          body += face(c * cw + cw / 2, r * ch + ch / 2 - Math.sin(t * Math.PI * 2) * ch * 0.08, Math.min(cw, ch) * 0.32, hue, Math.sin(t * Math.PI * 2) * 12, intent.label);
          i++;
        }
      }
    } else {
      body = face(w / 2, h / 2, Math.min(w, h) * 0.3, hue, 0, intent.kind === "pose" ? intent.label : "");
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#00ff00"/>${body}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

function face(cx: number, cy: number, r: number, hue: number, tilt: number, label: string) {
  const skin = `hsl(${hue},70%,62%)`;
  const dark = `hsl(${hue},60%,22%)`;
  return `<g transform="rotate(${tilt.toFixed(1)} ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}" stroke="${dark}" stroke-width="${r * 0.06}"/>
    <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.2}" r="${r * 0.12}" fill="${dark}"/>
    <circle cx="${cx + r * 0.35}" cy="${cy - r * 0.2}" r="${r * 0.12}" fill="${dark}"/>
    <path d="M ${cx - r * 0.45} ${cy + r * 0.2} Q ${cx} ${cy + r * 0.75} ${cx + r * 0.45} ${cy + r * 0.2}" fill="none" stroke="${dark}" stroke-width="${r * 0.08}" stroke-linecap="round"/>
    ${label ? `<text x="${cx}" y="${cy + r * 1.35}" font-size="${r * 0.35}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" text-anchor="middle" fill="${dark}">${escapeXml(label)}</text>` : ""}
  </g>`;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
