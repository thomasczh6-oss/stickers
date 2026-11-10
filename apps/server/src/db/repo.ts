import type { BulkPackAction, CreatePackRequest, GenerationNotice, Job, JobStatus, PackFilter, PackSort, StickerPack, StyleId } from "@stickers/shared";
import type { Db } from "./db";

/** The create request as stored: the photo lives in file storage, not in the database. */
export type StoredRequest = Omit<CreatePackRequest, "photo"> & { photoKey?: string; photoMimeType?: string };

export interface JobRow {
  id: string;
  device_id: string;
  status: JobStatus;
  request: StoredRequest;
  progress_done: number;
  progress_total: number;
  step: string | null;
  pack_id: string | null;
  error: string | null;
  attempts: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status,
    progress: { done: row.progress_done, total: row.progress_total, step: row.step ?? undefined },
    packId: row.pack_id ?? undefined,
    error: row.error ?? undefined,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

interface NoticeRow extends JobRow {
  seen_at: Date | string | null;
  pack_data: StickerPack | null;
  pack_name: string | null;
}

function toNotice(row: NoticeRow): GenerationNotice {
  const req = row.request;
  const pack = row.pack_data;
  const finished = row.status === "succeeded" || row.status === "failed";
  return {
    id: row.id,
    status: row.status,
    progress: { done: row.progress_done, total: row.progress_total, step: row.step ?? undefined },
    name: row.pack_name ?? pack?.name ?? req.packName ?? undefined,
    prompt: req.prompt || undefined,
    style: req.style,
    kind: req.kind,
    stickerCount: pack?.stickers.length ?? req.actions.length,
    fromPhoto: Boolean(req.photoKey),
    packId: row.pack_id ?? undefined,
    previewUrl: pack?.stickers[0]?.url ?? undefined,
    error: row.error ?? undefined,
    read: !finished || row.seen_at !== null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** How far back the message center looks. */
const NOTICE_DAYS = 30;
const NOTICE_LIMIT = 30;

export function createRepo(db: Db) {
  return {
    async insertJob(job: { id: string; deviceId: string; request: StoredRequest; total: number }) {
      const { rows } = await db.query<JobRow>(
        `insert into jobs (id, device_id, status, request, progress_total) values ($1, $2, 'queued', $3, $4) returning *`,
        [job.id, job.deviceId, JSON.stringify(job.request), job.total],
      );
      return rows[0]!;
    },

    async getJob(id: string) {
      const { rows } = await db.query<JobRow>(`select * from jobs where id = $1`, [id]);
      return rows[0];
    },

    async countActiveJobs(deviceId: string) {
      const { rows } = await db.query<{ n: number | string }>(
        `select count(*)::int as n from jobs where device_id = $1 and status in ('queued', 'running')`,
        [deviceId],
      );
      return Number(rows[0]?.n ?? 0);
    },

    /** Takes the oldest queued job and marks it running. Safe with several workers (SKIP LOCKED). */
    async claimNextJob() {
      const { rows } = await db.query<JobRow>(
        `update jobs set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
         where id = (select id from jobs where status = 'queued' order by created_at for update skip locked limit 1)
         returning *`,
      );
      return rows[0];
    },

    async updateProgress(id: string, done: number, step: string) {
      await db.query(`update jobs set progress_done = $2, step = $3, locked_at = now(), updated_at = now() where id = $1`, [id, done, step]);
    },

    async finishJob(id: string, packId: string) {
      await db.query(
        `update jobs set status = 'succeeded', pack_id = $2, progress_done = progress_total, step = 'done', updated_at = now() where id = $1`,
        [id, packId],
      );
    },

    async failJob(id: string, error: string) {
      await db.query(`update jobs set status = 'failed', error = $2, updated_at = now() where id = $1`, [id, error.slice(0, 1000)]);
    },

    /** Puts jobs whose worker died (no heartbeat for staleMinutes) back in the queue, up to 3 attempts. */
    async requeueStaleJobs(staleMinutes = 10) {
      await db.query(
        `update jobs set status = case when attempts >= 3 then 'failed' else 'queued' end,
           error = case when attempts >= 3 then 'worker stopped too many times' else error end,
           updated_at = now()
         where status = 'running' and locked_at < now() - ($1 || ' minutes')::interval`,
        [String(staleMinutes)],
      );
    },

    /**
     * The device's recent generations for the message center, newest first.
     * Cleared ones and made packs that went to the bin are left out.
     */
    async listNotices(deviceId: string) {
      const visible = `j.device_id = $1 and j.cleared_at is null and j.created_at > now() - interval '${NOTICE_DAYS} days'
        and (j.status <> 'succeeded' or p.deleted_at is null)`;
      const { rows } = await db.query<NoticeRow>(
        `select j.*, p.data as pack_data, p.name as pack_name from jobs j left join packs p on p.id = j.pack_id
         where ${visible} order by j.created_at desc limit ${NOTICE_LIMIT}`,
        [deviceId],
      );
      const { rows: counts } = await db.query<{ unread: number | string; active: number | string }>(
        `select count(*) filter (where j.status in ('succeeded', 'failed') and j.seen_at is null)::int as unread,
           count(*) filter (where j.status in ('queued', 'running'))::int as active
         from jobs j left join packs p on p.id = j.pack_id where ${visible}`,
        [deviceId],
      );
      return { notifications: rows.map(toNotice), unread: Number(counts[0]?.unread ?? 0), active: Number(counts[0]?.active ?? 0) };
    },

    /** Marks finished generations as seen (all of them without ids). Ones still being made stay unread-able. */
    async markNoticesRead(deviceId: string, ids?: string[]) {
      const params: unknown[] = [deviceId];
      let only = "";
      if (ids) {
        params.push(ids);
        only = "and id = any($2)";
      }
      const { rows } = await db.query<{ id: string }>(
        `update jobs set seen_at = now() where device_id = $1 and status in ('succeeded', 'failed') and seen_at is null ${only} returning id`,
        params,
      );
      return rows.length;
    },

    /** Hides finished generations from the message center (all of them without ids). The packs stay. */
    async clearNotices(deviceId: string, ids?: string[]) {
      const params: unknown[] = [deviceId];
      let only = "";
      if (ids) {
        params.push(ids);
        only = "and id = any($2)";
      }
      const { rows } = await db.query<{ id: string }>(
        `update jobs set cleared_at = now(), seen_at = coalesce(seen_at, now())
         where device_id = $1 and status in ('succeeded', 'failed') and cleared_at is null ${only} returning id`,
        params,
      );
      return rows.length;
    },

    async insertPack(deviceId: string, pack: StickerPack, recipe: { prompt?: string } = {}) {
      await db.query(
        `insert into packs (id, device_id, data, created_at, name, prompt, style, animated, sticker_count, favorite, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $4)`,
        [pack.id, deviceId, JSON.stringify(pack), pack.createdAt, pack.name, recipe.prompt ?? null, pack.style ?? null, pack.animated, pack.stickers.length, pack.favorite ?? false],
      );
    },

    /** A pack anyone with its link can open. Packs in the bin are hidden. */
    async getPack(id: string) {
      const { rows } = await db.query<PackRow>(`select ${PACK_COLS} from packs where id = $1 and deleted_at is null`, [id]);
      return rows[0] ? toPack(rows[0]) : undefined;
    },

    /** The pack if this device made it, including packs in the bin. */
    async getOwnPack(deviceId: string, id: string) {
      const { rows } = await db.query<PackRow & { deleted_at: Date | string | null; prompt: string | null }>(
        `select ${PACK_COLS}, deleted_at, prompt from packs where id = $1 and device_id = $2`,
        [id, deviceId],
      );
      const row = rows[0];
      return row ? { pack: toPack(row), deleted: row.deleted_at !== null, prompt: row.prompt ?? undefined } : undefined;
    },

    /** One page of a device's packs, plus per-filter counts for the current search. */
    async listPacks(deviceId: string, opts: ListOptions = {}) {
      const limit = Math.min(Math.max(Math.floor(opts.limit ?? 24), 1), 60);
      const offset = Math.max(Math.floor(opts.offset ?? 0), 0);
      const params: unknown[] = [deviceId];
      const where = ["device_id = $1", "deleted_at is null"];
      const q = opts.q?.trim().toLowerCase();
      if (q) {
        params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        where.push(`(lower(name) like $${params.length} or lower(coalesce(prompt, '')) like $${params.length})`);
      }
      if (opts.style) {
        params.push(opts.style);
        where.push(`style = $${params.length}`);
      }
      const base = where.join(" and ");
      const { rows: countRows } = await db.query<Record<PackFilter, number | string>>(
        `select count(*)::int as "all",
           count(*) filter (where favorite)::int as favorites,
           count(*) filter (where animated)::int as animated,
           count(*) filter (where not animated)::int as "static"
         from packs where ${base}`,
        params,
      );
      const c = countRows[0];
      const counts: Record<PackFilter, number> = {
        all: Number(c?.all ?? 0),
        favorites: Number(c?.favorites ?? 0),
        animated: Number(c?.animated ?? 0),
        static: Number(c?.static ?? 0),
      };
      const filter = opts.filter ?? "all";
      const { rows } = await db.query<PackRow>(
        `select ${PACK_COLS} from packs where ${base}${FILTER_SQL[filter]}
         order by ${SORT_SQL[opts.sort ?? "newest"]} limit ${limit + 1} offset ${offset}`,
        params,
      );
      const more = rows.length > limit;
      return { packs: rows.slice(0, limit).map(toPack), total: counts[filter], counts, nextOffset: more ? offset + limit : undefined };
    },

    /** Renames or stars a pack. Renaming bumps imageDataVersion so WhatsApp picks up the new name. */
    async updatePack(deviceId: string, id: string, patch: { name?: string; favorite?: boolean }) {
      const own = await this.getOwnPack(deviceId, id);
      if (!own || own.deleted) return undefined;
      const pack = { ...own.pack };
      if (patch.name !== undefined && patch.name !== pack.name) {
        pack.name = patch.name;
        pack.imageDataVersion += 1;
      }
      if (patch.favorite !== undefined) pack.favorite = patch.favorite;
      pack.updatedAt = new Date().toISOString();
      await db.query(`update packs set data = $3, name = $4, favorite = $5, updated_at = $6 where id = $1 and device_id = $2`, [
        id,
        deviceId,
        JSON.stringify(pack),
        pack.name,
        pack.favorite ?? false,
        pack.updatedAt,
      ]);
      return pack;
    },

    /** Delete moves packs to the bin (deleted_at); restore takes them out. Returns how many changed. */
    async bulkUpdate(deviceId: string, ids: string[], action: BulkPackAction) {
      if (!ids.length) return 0;
      const set = {
        delete: "deleted_at = now()",
        restore: "deleted_at = null",
        favorite: "favorite = true",
        unfavorite: "favorite = false",
      }[action];
      const live = action === "restore" ? "deleted_at is not null" : "deleted_at is null";
      const { rows } = await db.query<{ id: string }>(
        `update packs set ${set}, updated_at = now() where device_id = $1 and id = any($2::text[]) and ${live} returning id`,
        [deviceId, ids],
      );
      return rows.length;
    },

    /** Removes packs that sat in the bin longer than `days` and returns them, so their files can go too. */
    async purgeDeletedPacks(days = 30) {
      const { rows } = await db.query<{ data: StickerPack | string }>(
        `delete from packs where deleted_at < now() - ($1 || ' days')::interval returning data`,
        [String(days)],
      );
      return rows.map((r) => parseData(r.data));
    },
  };
}

type ListOptions = { q?: string; filter?: PackFilter; style?: StyleId; sort?: PackSort; offset?: number; limit?: number };

/** Columns kept next to the JSON so lists can search, filter and sort. They win over the JSON copy. */
const PACK_COLS = "data, name, style, favorite, updated_at";
type PackRow = { data: StickerPack | string; name: string | null; style: string | null; favorite: boolean | null; updated_at: Date | string | null };

const FILTER_SQL: Record<PackFilter, string> = {
  all: "",
  favorites: " and favorite",
  animated: " and animated",
  static: " and not animated",
};
const SORT_SQL: Record<PackSort, string> = {
  newest: "created_at desc, id desc",
  oldest: "created_at asc, id asc",
  name: "lower(name) asc, created_at desc",
  size: "sticker_count desc, created_at desc",
};

function parseData(d: StickerPack | string): StickerPack {
  return typeof d === "string" ? (JSON.parse(d) as StickerPack) : d;
}

function toPack(row: PackRow): StickerPack {
  const pack = { ...parseData(row.data) };
  if (row.name) pack.name = row.name;
  if (row.style) pack.style = row.style as StyleId;
  pack.favorite = Boolean(row.favorite);
  if (row.updated_at) pack.updatedAt = iso(row.updated_at);
  return pack;
}

export type Repo = ReturnType<typeof createRepo>;
