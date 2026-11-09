import fs from "node:fs/promises";
import path from "node:path";
import { parseCreatePackRequest, ACTIONS, STYLES } from "@stickers/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import type { Config } from "../config";
import { type Repo, type StoredRequest, toJob } from "../db/repo";
import { LocalStorage, type Storage } from "../storage/storage";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CONTENT_TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

export function createApp(deps: { cfg: Config; repo: Repo; storage: Storage }) {
  const { cfg, repo, storage } = deps;
  const app = new Hono();

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
    return c.json({ packs: await repo.listPacks(deviceId) });
  });

  app.get("/v1/packs/:id", async (c) => {
    const pack = await repo.getPack(c.req.param("id"));
    return pack ? c.json({ pack }) : c.json({ error: "pack not found" }, 404);
  });

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
