import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIONS,
  BULK_ACTIONS,
  CREATE_LIMITS,
  findStyle,
  PACK_FILTERS,
  PACK_SORTS,
  parseCreatePackRequest,
  STYLES,
  toPackIdentifier,
  type BulkPackAction,
  type ListPacksResponse,
  type NotificationsResponse,
  type PackFilter,
  type PackSort,
  type StickerPack,
  type StyleId,
} from "@stickers/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";
import type { Config } from "../config";
import { type Repo, type StoredRequest, toJob } from "../db/repo";
import { LocalStorage, packFileKeys, type Storage } from "../storage/storage";

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

  /** Message center: the device's recent generations, with unread and in-progress counts. */
  app.get("/v1/notifications", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const body: NotificationsResponse = await repo.listNotices(deviceId);
    return c.json(body);
  });

  for (const [route, run] of [
    ["read", repo.markNoticesRead],
    ["clear", repo.clearNotices],
  ] as const) {
    app.post(`/v1/notifications/${route}`, async (c) => {
      const deviceId = c.req.header("x-device-id") ?? "";
      if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
      const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown };
      let ids: string[] | undefined;
      if (body?.ids !== undefined) {
        if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string")) return c.json({ error: "ids must be a list of job ids" }, 400);
        ids = (body.ids as string[]).slice(0, 200);
      }
      return c.json({ updated: await run(deviceId, ids) });
    });
  }

  app.get("/v1/packs", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const q = c.req.query();
    const filter = (PACK_FILTERS as readonly string[]).includes(q.filter ?? "") ? (q.filter as PackFilter) : "all";
    const sort = (PACK_SORTS as readonly string[]).includes(q.sort ?? "") ? (q.sort as PackSort) : "newest";
    const style = findStyle(q.style ?? "") ? (q.style as StyleId) : undefined;
    const offset = Number.parseInt(q.cursor ?? "0", 10);
    const limit = Number.parseInt(q.limit ?? "24", 10);
    const page = await repo.listPacks(deviceId, {
      q: q.q?.slice(0, 80),
      filter,
      style,
      sort,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 24,
    });
    const body: ListPacksResponse = { packs: page.packs, total: page.total, counts: page.counts };
    if (page.nextOffset !== undefined) body.nextCursor = String(page.nextOffset);
    return c.json(body);
  });

  app.post("/v1/packs/bulk", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const body = (await c.req.json().catch(() => undefined)) as { ids?: unknown; action?: unknown } | undefined;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
    const action = body?.action as BulkPackAction;
    if (!ids.length || !BULK_ACTIONS.includes(action)) return c.json({ error: "send ids (1-200) and action: delete, restore, favorite or unfavorite" }, 400);
    return c.json({ updated: await repo.bulkUpdate(deviceId, ids, action) });
  });

  app.get("/v1/packs/:id", async (c) => {
    const pack = await repo.getPack(c.req.param("id"));
    return pack ? c.json({ pack }) : c.json({ error: "pack not found" }, 404);
  });

  app.patch("/v1/packs/:id", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const body = (await c.req.json().catch(() => undefined)) as { name?: unknown; favorite?: unknown } | undefined;
    const patch: { name?: string; favorite?: boolean } = {};
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      if (!name || name.length > CREATE_LIMITS.PACK_NAME_MAX) return c.json({ error: `name must be 1-${CREATE_LIMITS.PACK_NAME_MAX} characters` }, 400);
      patch.name = name;
    }
    if (body?.favorite !== undefined) {
      if (typeof body.favorite !== "boolean") return c.json({ error: "favorite must be true or false" }, 400);
      patch.favorite = body.favorite;
    }
    const pack = await repo.updatePack(deviceId, c.req.param("id"), patch);
    return pack ? c.json({ pack }) : c.json({ error: "pack not found" }, 404);
  });

  app.delete("/v1/packs/:id", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const n = await repo.bulkUpdate(deviceId, [c.req.param("id")], "delete");
    return n ? c.json({ ok: true }) : c.json({ error: "pack not found" }, 404);
  });

  app.post("/v1/packs/:id/restore", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    await repo.bulkUpdate(deviceId, [c.req.param("id")], "restore");
    const own = await repo.getOwnPack(deviceId, c.req.param("id"));
    return own && !own.deleted ? c.json({ pack: own.pack }) : c.json({ error: "pack not found" }, 404);
  });

  /** Copies a pack and its files under a new id, so it can be renamed or added to WhatsApp as a second pack. */
  app.post("/v1/packs/:id/duplicate", async (c) => {
    const deviceId = c.req.header("x-device-id") ?? "";
    if (!DEVICE_ID.test(deviceId)) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const own = await repo.getOwnPack(deviceId, c.req.param("id"));
    if (!own || own.deleted) return c.json({ error: "pack not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
    const src = own.pack;
    const id = `pk_${nanoid(16)}`;
    const copy = async (url: string, fileName: string) => {
      const from = packFileKeys({ ...src, trayIconUrl: url, stickers: [] })[0];
      const key = `packs/${id}/${fileName}`;
      if (from) await storage.put(key, await storage.get(from), CONTENT_TYPES[path.extname(fileName)] ?? "application/octet-stream");
      return storage.url(key);
    };
    const fallback = `${src.name} (2)`;
    const name = (typeof body.name === "string" && body.name.trim() ? body.name.trim() : fallback).slice(0, CREATE_LIMITS.PACK_NAME_MAX);
    const now = new Date().toISOString();
    const pack: StickerPack = {
      ...src,
      id,
      identifier: toPackIdentifier(id),
      name,
      favorite: false,
      trayIconUrl: await copy(src.trayIconUrl, src.trayIconFileName),
      stickers: await Promise.all(src.stickers.map(async (s) => ({ ...s, url: await copy(s.url, s.fileName) }))),
      imageDataVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.insertPack(deviceId, pack, { prompt: own.prompt });
    return c.json({ pack }, 201);
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
