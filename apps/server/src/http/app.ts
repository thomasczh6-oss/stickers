import fs from "node:fs/promises";
import path from "node:path";
import { parseCreatePackRequest, ACTIONS, STYLES, type StickerPack } from "@stickers/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import type { Config } from "../config";
import { type Repo, type StoredRequest, toJob } from "../db/repo";
import { createExporter } from "../export/exports";
import type { TelegramBot } from "../telegram/bot";
import { LocalStorage, type Storage } from "../storage/storage";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".zip": "application/zip",
};
const SHARE_FILE = /^(\d{1,3})\.(gif|png)$/;

export function createApp(deps: { cfg: Config; repo: Repo; storage: Storage; telegram?: TelegramBot }) {
  const { cfg, repo, storage, telegram } = deps;
  const app = new Hono();
  const exporter = createExporter(storage);

  /** Adds the links for apps other than WhatsApp. */
  const withExports = (pack: StickerPack): StickerPack => {
    const base = `${cfg.publicBaseUrl}/v1/packs/${encodeURIComponent(pack.id)}`;
    const ext = pack.animated ? "gif" : "png";
    return {
      ...pack,
      exports: {
        share: pack.stickers.map((s, i) => ({
          url: `${base}/share/${i + 1}.${ext}`,
          mimeType: pack.animated ? "image/gif" : "image/png",
          fileName: `${s.fileName.replace(/\.webp$/, "")}.${ext}`,
        })),
        zipUrl: `${base}/download.zip`,
        telegramUrl: telegram?.username ? telegram.startUrl(pack.id) : undefined,
      },
    };
  };

  app.use(
    "/v1/*",
    cors({
      origin: (origin) => (cfg.corsOrigins.includes("*") || cfg.corsOrigins.includes(origin) ? origin : null),
      allowHeaders: ["content-type", "x-device-id"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.onError((err, c) => {
    console.error("[http]", err);
    return c.json({ error: "internal error" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true, provider: cfg.provider, model: cfg.provider === "gateway" ? cfg.gateway.imageModel : "mock" }));

  /** Styles and actions, so clients can render the picker without shipping a new build. */
  app.get("/v1/presets", (c) =>
    c.json({
      styles: STYLES.map(({ id, label }) => ({ id, label })),
      actions: ACTIONS.map(({ id, label, emojis }) => ({ id, label, emojis })),
    }),
  );

  app.post("/v1/packs", bodyLimit({ maxSize: 12 * 1024 * 1024, onError: (c) => c.json({ error: "request too large (max 12MB)" }, 413) }), async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "body must be JSON" }, 400);
    }
    const parsed = parseCreatePackRequest(body);
    if (!parsed.ok) return c.json({ error: "invalid request", details: parsed.errors }, 400);

    if ((await repo.countActiveJobs(deviceId)) >= cfg.maxActiveJobsPerDevice) {
      return c.json({ error: "you already have packs being made; wait for them to finish" }, 429);
    }

    const jobId = `job_${nanoid(16)}`;
    const { photo, ...rest } = parsed.value;
    const stored: StoredRequest = { ...rest };
    if (photo) {
      const ext = photo.mimeType.split("/")[1];
      stored.photoKey = `uploads/${jobId}/photo.${ext}`;
      stored.photoMimeType = photo.mimeType;
      await storage.put(stored.photoKey, Buffer.from(photo.base64, "base64"), photo.mimeType);
    }
    // character + one step per sticker + packaging
    const row = await repo.insertJob({ id: jobId, deviceId, request: stored, total: stored.actions.length + 2 });
    return c.json({ job: toJob(row) }, 202);
  });

  app.get("/v1/jobs/:id", async (c) => {
    const row = await repo.getJob(c.req.param("id"));
    return row ? c.json({ job: toJob(row) }) : c.json({ error: "job not found" }, 404);
  });

  app.get("/v1/packs", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    return c.json({ packs: (await repo.listPacks(deviceId)).map(withExports) });
  });

  app.get("/v1/packs/:id", async (c) => {
    const pack = await repo.getPack(c.req.param("id"));
    return pack ? c.json({ pack: withExports(pack) }) : c.json({ error: "pack not found" }, 404);
  });

  /** One sticker as GIF (animated packs) or PNG (static), for share sheets. Numbered from 1. */
  app.get("/v1/packs/:id/share/:file", async (c) => {
    const m = SHARE_FILE.exec(c.req.param("file"));
    const pack = await repo.getPack(c.req.param("id"));
    if (!m || !pack) return c.json({ error: "not found" }, 404);
    const index = Number(m[1]) - 1;
    if (index < 0 || index >= pack.stickers.length || m[2] !== (pack.animated ? "gif" : "png")) return c.json({ error: "not found" }, 404);
    const file = await exporter.shareFile(pack, index);
    return c.body(new Uint8Array(file.data), 200, {
      "content-type": file.contentType,
      "content-disposition": `inline; filename="${file.fileName}"`,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    });
  });

  /** The whole pack in every format, for Signal, Discord and LINE. */
  app.get("/v1/packs/:id/download.zip", async (c) => {
    const pack = await repo.getPack(c.req.param("id"));
    if (!pack) return c.json({ error: "pack not found" }, 404);
    const data = await exporter.zip(pack);
    const name = pack.name.replace(/[^A-Za-z0-9 _-]+/g, "").trim().slice(0, 60) || "stickers";
    return c.body(new Uint8Array(data), 200, {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}.zip"`,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    });
  });

  if (telegram && cfg.telegram.webhookSecret) {
    app.post("/telegram/webhook", async (c) => {
      if (c.req.header("x-telegram-bot-api-secret-token") !== cfg.telegram.webhookSecret) return c.json({ error: "forbidden" }, 403);
      const update = await c.req.json().catch(() => undefined);
      // Answer at once; Telegram retries slow webhooks, and building a set takes a while.
      if (update) telegram.handleUpdate(update).catch((e) => console.error("[telegram]", e));
      return c.json({ ok: true });
    });
  }

  // Local development: serve stored files. In production files come from the bucket's CDN.
  if (storage instanceof LocalStorage) {
    app.get("/files/*", async (c) => {
      const key = decodeURIComponent(c.req.path.slice("/files/".length));
      if (key.startsWith("uploads/")) return c.json({ error: "not found" }, 404);
      try {
        const file = await fs.readFile(storage.pathFor(key));
        return c.body(new Uint8Array(file), 200, {
          "content-type": CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        });
      } catch {
        return c.json({ error: "not found" }, 404);
      }
    });
  }

  return app;
}
