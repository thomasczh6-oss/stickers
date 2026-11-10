import fs from "node:fs/promises";
import path from "node:path";
import { parseCreatePackRequest, parseFeedbackRequest, ACTIONS, STYLES, type Usage } from "@stickers/shared";
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
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.onError((err, c) => {
    console.error("[http]", err);
    return c.json({ error: "internal error" }, 500);
  });

  /** Start of the current UTC day and the next one: the free allowance resets at UTC midnight. */
  const today = () => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return { start, next: new Date(start.getTime() + 86_400_000) };
  };

  async function usageFor(deviceId: string): Promise<Usage> {
    const { start, next } = today();
    const limit = cfg.freePacksPerDay;
    const used = await repo.countJobsSince(deviceId, start);
    return { plan: "free", limit, used, remaining: limit > 0 ? Math.max(0, limit - used) : Number.MAX_SAFE_INTEGER, resetsAt: next.toISOString() };
  }

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
    const usage = await usageFor(deviceId);
    if (usage.limit > 0 && usage.remaining <= 0) {
      return c.json({ error: "you have used today’s free packs", code: "quota", details: usage }, 402);
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

  /** The device's plan and free packs left today. */
  app.get("/v1/me", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    return c.json({ usage: await usageFor(deviceId) });
  });

  /** "Delete all my data": every pack, job, feedback message and file made with this device id. */
  app.delete("/v1/me", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const { packIds, jobIds } = await repo.deleteDeviceData(deviceId);
    await Promise.all([
      ...packIds.map((id) => storage.deleteFolder(`packs/${id}`)),
      ...jobIds.map((id) => storage.deleteFolder(`uploads/${id}`)),
    ]);
    return c.json({ deleted: { packs: packIds.length, jobs: jobIds.length } });
  });

  app.post("/v1/feedback", bodyLimit({ maxSize: 32 * 1024, onError: (c) => c.json({ error: "message too long" }, 413) }), async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "body must be JSON" }, 400);
    }
    const parsed = parseFeedbackRequest(body);
    if (!parsed.ok) return c.json({ error: "invalid request", details: parsed.errors }, 400);
    if ((await repo.countFeedbackSince(deviceId, today().start)) >= 20) return c.json({ error: "too many messages today" }, 429);
    const f = parsed.value;
    await repo.insertFeedback({ id: `fb_${nanoid(16)}`, deviceId, ...f });
    console.info(`[feedback] ${f.kind} from ${f.platform ?? "?"}${f.email ? " (wants a reply)" : ""}`);
    return c.json({ ok: true }, 201);
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
