import type { Config } from "../config";
import { type ImageProvider, type ImageRequest, ProviderError } from "./types";

/**
 * Company AI gateway, OpenAI Images protocol (POST /v1/images/generations and /v1/images/edits).
 * Request shapes match the team's working integration in mvbuddy/server.js.
 * Works with gpt-image-2.6-flare (default) and gpt-image-2.5-flare; pick one with IMAGE_MODEL.
 */
export class GatewayImageProvider implements ImageProvider {
  readonly name: string;

  constructor(private readonly cfg: Config["gateway"]) {
    this.name = `gateway:${cfg.imageModel}`;
  }

  async image(req: ImageRequest): Promise<Buffer> {
    const res = req.images.length > 0 ? await this.edit(req) : await this.generate(req);
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      // The connection can drop while the (large) image body is still downloading.
      throw new ProviderError(`gateway response was cut off: ${(e as Error).message}`, res.status, true);
    }
    let data: { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } | string; message?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body, handled below */
    }
    if (!res.ok) {
      const msg =
        (typeof data.error === "object" ? data.error?.message : data.error) ?? data.message ?? text.slice(0, 300) ?? `HTTP ${res.status}`;
      throw new ProviderError(`gateway ${res.status}: ${msg}`, res.status, res.status === 429 || res.status >= 500);
    }
    const item = data.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item?.url) {
      const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!img.ok) throw new ProviderError(`downloading the generated image failed: HTTP ${img.status}`, img.status, true);
      return Buffer.from(await img.arrayBuffer());
    }
    throw new ProviderError("gateway returned no image");
  }

  private generate(req: ImageRequest) {
    return this.send("/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.cfg.imageModel, prompt: req.prompt, size: req.size, quality: this.cfg.quality, n: 1 }),
    });
  }

  private edit(req: ImageRequest) {
    const fd = new FormData();
    fd.append("model", this.cfg.imageModel);
    fd.append("prompt", req.prompt);
    fd.append("size", req.size);
    fd.append("quality", this.cfg.quality);
    fd.append("n", "1");
    const field = req.images.length > 1 ? "image[]" : "image";
    req.images.forEach((img, i) => {
      const ext = img.mimeType.split("/")[1] ?? "png";
      fd.append(field, new Blob([new Uint8Array(img.data)], { type: img.mimeType }), `ref${i}.${ext}`);
    });
    return this.send("/v1/images/edits", { method: "POST", body: fd });
  }

  /** The gateway may answer 503 + Retry-After before starting; wait and resend, at most 3 times. */
  private async send(pathname: string, init: RequestInit, attempt = 0): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cfg.apiKey) headers.set("authorization", `Bearer ${this.cfg.apiKey}`);
    let res: Response;
    try {
      res = await fetch(this.cfg.baseUrl + pathname, { ...init, headers, signal: AbortSignal.timeout(this.cfg.timeoutMs) });
    } catch (e) {
      throw new ProviderError(`gateway request failed: ${(e as Error).message}`, undefined, true);
    }
    if (res.status === 503 && attempt < 3) {
      const wait = Number(res.headers.get("retry-after")) || 2;
      await res.arrayBuffer().catch(() => undefined);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return this.send(pathname, init, attempt + 1);
    }
    return res;
  }
}
