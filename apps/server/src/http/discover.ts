import { timingSafeEqual } from "node:crypto";
import {
  type DiscoverSort,
  DISCOVER_LIMITS,
  type ModerationAction,
  parseCreatePackRequest,
  parsePublishRequest,
  parseRemixRequest,
  parseReportRequest,
  type PublicationStatus,
  type PublishState,
} from "@stickers/shared";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { nanoid } from "nanoid";
import type { Config } from "../config";
import { toRecipe } from "../db/discover";
import { type Repo, type StoredRequest, toJob } from "../db/repo";
import type { Storage } from "../storage/storage";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SORTS: DiscoverSort[] = ["trending", "new", "top"];
const ACTIONS: ModerationAction[] = ["approve", "hide", "remove", "ban"];

const device = (c: Context) => {
  const id = c.req.header("x-device-id") ?? "";
  return DEVICE_ID.test(id) ? id : "";
};

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** Offset cursors keep paging simple; the feed is small enough that this stays cheap. */
const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString("base64url");
const decodeCursor = (raw: string | undefined) => {
  const n = raw ? Number.parseInt(Buffer.from(raw, "base64url").toString(), 10) : 0;
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : 0;
};

/**
 * Discover: people publish packs, others browse them and make their own version
 * ("remix") with the same style, reactions and captions but their own photo.
 * Includes the safety pieces stores ask for with user content: guidelines consent,
 * a title word filter, reports that auto-hide, blocking creators, and a moderation API.
 */
export function mountDiscover(app: Hono, deps: { cfg: Config; repo: Repo; storage: Storage }) {
  const { cfg, repo, storage } = deps;
  const d = repo.discover;

  const publishState = (row: Awaited<ReturnType<typeof d.publicationForPack>>): PublishState =>
    row
      ? {
          published: true,
          publication: { id: row.id, title: row.title, status: row.status, remixCount: row.remix_count, publishedAt: new Date(row.published_at).toISOString() },
        }
      : { published: false };

  // --- Publishing (pack owner only) ---

  app.get("/v1/packs/:id/publish", async (c) => {
    const me = device(c);
    const src = await d.packSource(c.req.param("id"));
    if (!src) return c.json({ error: "pack not found" }, 404);
    if (!me || src.deviceId !== me) return c.json({ error: "only the pack’s creator can see this" }, 403);
    return c.json(publishState(await d.publicationForPack(c.req.param("id"))));
  });

  app.post("/v1/packs/:id/publish", async (c) => {
    const me = device(c);
    if (!me) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const packId = c.req.param("id");
    const src = await d.packSource(packId);
    if (!src) return c.json({ error: "pack not found" }, 404);
    if (src.deviceId !== me) return c.json({ error: "only the pack’s creator can publish it" }, 403);
    if (!src.request) return c.json({ error: "this pack can’t be shared to Discover" }, 409);
    if (await d.isBanned(me)) return c.json({ error: "publishing is turned off for this device" }, 403);

    const parsed = parsePublishRequest(await readJson(c));
    if (!parsed.ok) return c.json({ error: parsed.errors[0], details: parsed.errors }, 400);

    const existing = await d.publicationForPack(packId);
    if (existing?.status === "removed") return c.json({ error: "our moderators removed this pack from Discover" }, 403);
    if (existing?.status === "hidden") return c.json({ error: "this pack is hidden while we check reports" }, 409);
    if (!existing && (await d.countPublishedSince(me, 24)) >= cfg.discover.publishPerDay) {
      return c.json({ error: "you’ve shared a lot today; try again tomorrow" }, 429);
    }

    const title = (parsed.value.title ?? src.pack.name).slice(0, DISCOVER_LIMITS.TITLE_MAX);
    const status: PublicationStatus = existing?.status === "visible" || cfg.discover.review === "post" ? "visible" : "pending";
    const row = await d.publish({
      id: existing?.id ?? `pub_${nanoid(12)}`,
      packId,
      deviceId: me,
      title,
      recipe: toRecipe(src.request),
      remixOf: src.pack.remixOf,
      status,
    });
    return c.json(publishState(row), existing ? 200 : 201);
  });

  app.delete("/v1/packs/:id/publish", async (c) => {
    const me = device(c);
    const src = await d.packSource(c.req.param("id"));
    if (!src) return c.json({ error: "pack not found" }, 404);
    if (!me || src.deviceId !== me) return c.json({ error: "only the pack’s creator can do this" }, 403);
    const existing = await d.publicationForPack(c.req.param("id"));
    // A removed pack stays on record so it can't be quietly re-published.
    if (existing && existing.status !== "removed") await d.unpublish(c.req.param("id"));
    return c.json({ published: false } satisfies PublishState);
  });

  // --- Browsing ---

  app.get("/v1/discover", async (c) => {
    const sortRaw = c.req.query("sort") as DiscoverSort | undefined;
    const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "trending";
    const limit = Math.min(Math.max(Number.parseInt(c.req.query("limit") ?? "24", 10) || 24, 1), DISCOVER_LIMITS.PAGE_MAX);
    const offset = decodeCursor(c.req.query("cursor"));
    const { items, more } = await d.feed({ viewer: device(c), sort, style: c.req.query("style") ?? "", offset, limit });
    return c.json({ items, nextCursor: more ? encodeCursor(offset + limit) : undefined }, 200, { "cache-control": "private, max-age=15" });
  });

  app.delete("/v1/discover/blocks", async (c) => {
    const me = device(c);
    if (!me) return c.json({ error: "missing or bad x-device-id header" }, 400);
    return c.json({ ok: true, removed: await d.unblockAll(me) });
  });

  app.get("/v1/discover/:id", async (c) => {
    const found = await d.getForViewer(c.req.param("id"), device(c));
    return found ? c.json({ item: found.item, pack: found.pack }) : c.json({ error: "not on Discover" }, 404);
  });

  // --- Remix: the original's recipe with the remixer's own photo ---

  app.post(
    "/v1/discover/:id/remix",
    bodyLimit({ maxSize: 12 * 1024 * 1024, onError: (c) => c.json({ error: "request too large (max 12MB)" }, 413) }),
    async (c) => {
      const me = device(c);
      if (!me) return c.json({ error: "missing or bad x-device-id header" }, 400);
      const found = await d.getForViewer(c.req.param("id"), me);
      if (!found) return c.json({ error: "not on Discover" }, 404);

      const remix = parseRemixRequest(await readJson(c));
      if (!remix.ok) return c.json({ error: remix.errors[0], details: remix.errors }, 400);
      // Run the merged request through the normal checks, so a remix can never do more than a regular create.
      const parsed = parseCreatePackRequest({ ...found.recipe, ...remix.value });
      if (!parsed.ok) return c.json({ error: "invalid request", details: parsed.errors }, 400);

      if ((await repo.countActiveJobs(me)) >= cfg.maxActiveJobsPerDevice) {
        return c.json({ error: "you already have packs being made; wait for them to finish" }, 429);
      }

      const jobId = `job_${nanoid(16)}`;
      const { photo, ...rest } = parsed.value;
      const stored: StoredRequest = { ...rest, remixOf: found.item.id };
      if (photo) {
        const ext = photo.mimeType.split("/")[1];
        stored.photoKey = `uploads/${jobId}/photo.${ext}`;
        stored.photoMimeType = photo.mimeType;
        await storage.put(stored.photoKey, Buffer.from(photo.base64, "base64"), photo.mimeType);
      }
      const row = await repo.insertJob({ id: jobId, deviceId: me, request: stored, total: stored.actions.length + 2 });
      await d.recordRemix(found.item.id, me, found.row.device_id);
      return c.json({ job: toJob(row) }, 202);
    },
  );

  // --- Safety: report and block ---

  app.post("/v1/discover/:id/report", async (c) => {
    const me = device(c);
    if (!me) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const parsed = parseReportRequest(await readJson(c));
    if (!parsed.ok) return c.json({ error: parsed.errors[0], details: parsed.errors }, 400);
    const found = await d.getForViewer(c.req.param("id"), me);
    if (!found) return c.json({ error: "not on Discover" }, 404);
    if (found.row.device_id === me) return c.json({ error: "that’s your own pack" }, 400);
    const { hidden } = await d.report(found.item.id, me, parsed.value.reason, parsed.value.note, cfg.discover.autoHideReports);
    if (hidden) console.log(`[discover] ${found.item.id} hidden after reports, waiting for review`);
    return c.json({ ok: true });
  });

  app.post("/v1/discover/:id/block", async (c) => {
    const me = device(c);
    if (!me) return c.json({ error: "missing or bad x-device-id header" }, 400);
    const found = await d.getForViewer(c.req.param("id"), me);
    if (!found) return c.json({ error: "not on Discover" }, 404);
    await d.block(me, found.row.device_id);
    return c.json({ ok: true });
  });

  // --- Moderation (Authorization: Bearer ADMIN_TOKEN) ---

  const isAdmin = (c: Context) => {
    if (!cfg.adminToken) return false;
    const given = Buffer.from((c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
    const want = Buffer.from(cfg.adminToken);
    return given.length === want.length && timingSafeEqual(given, want);
  };

  app.get("/v1/admin/discover", async (c) => {
    if (!isAdmin(c)) return c.json({ error: "not allowed" }, 401);
    const f = c.req.query("status") ?? "queue";
    const filter = (["queue", "all", "visible", "pending", "hidden", "removed"] as const).find((x) => x === f) ?? "queue";
    return c.json({ items: await d.moderationQueue(filter) });
  });

  app.post("/v1/admin/discover/:id", async (c) => {
    if (!isAdmin(c)) return c.json({ error: "not allowed" }, 401);
    const body = (await readJson(c)) as { action?: string } | undefined;
    const action = ACTIONS.find((a) => a === body?.action);
    if (!action) return c.json({ error: `action must be one of: ${ACTIONS.join(", ")}` }, 400);
    return (await d.moderate(c.req.param("id"), action)) ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });
}
