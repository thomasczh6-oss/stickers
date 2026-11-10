import fs from "node:fs/promises";
import path from "node:path";
import { parseCreatePackRequest, parsePlanRequest, ACTIONS, STYLES } from "@stickers/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import type { Config } from "../config";
import { type Repo, type StoredRequest, toJob } from "../db/repo";
import { createPlanner, type Planner } from "../planner/planner";
import { ProviderError } from "../providers";
import { LocalStorage, type Storage } from "../storage/storage";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CONTENT_TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

export function createApp(deps: { cfg: Config; repo: Repo; storage: Storage; planner?: Planner }) {
  const { cfg, repo, storage } = deps;
  const planner = deps.planner ?? createPlanner(cfg);
  const planLimiter = createHourlyLimiter(cfg.maxPlansPerDevicePerHour);
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

  /** Turns the user's own idea into an editable list of stickers (character, poses, captions). */
  app.post("/v1/plan", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "request too large" }, 413) }), async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "body must be JSON" }, 400);
    }
    const parsed = parsePlanRequest(body);
    if (!parsed.ok) return c.json({ error: "invalid request", details: parsed.errors }, 400);
    if (!planLimiter.take(deviceId)) return c.json({ error: "too many ideas in a short time; try again later" }, 429);
    try {
      return c.json({ plan: await planner.plan(parsed.value) });
    } catch (e) {
      console.warn("[plan] failed:", (e as Error).message);
      const status = e instanceof ProviderError && e.status === 400 ? 422 : 502;
      return c.json({ error: status === 422 ? "We couldn't plan stickers from that description. Try wording it differently." : "Couldn't plan your stickers right now. Please try again." }, status);
    }
  });

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
    const row = await repo.insertJob({ id: jobId, deviceId, request: stored, total: (stored.stickers?.length ?? stored.actions.length) + 2 });
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

/** Small in-memory per-key limit over a sliding hour. Enough for one server; use Redis when scaling out. */
function createHourlyLimiter(max: number) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string): boolean {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) {
        for (const [k, times] of hits) if (now - times[times.length - 1]! >= 3_600_000) hits.delete(k);
      }
      return true;
    },
  };
}
