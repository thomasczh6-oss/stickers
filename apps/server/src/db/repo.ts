import type { CreatePackRequest, Job, JobStatus, StickerPack } from "@stickers/shared";
import type { Db } from "./db";
import { createDiscoverRepo } from "./discover";

/** The create request as stored: the photo lives in file storage, not in the database. */
export type StoredRequest = Omit<CreatePackRequest, "photo"> & {
  photoKey?: string;
  photoMimeType?: string;
  /** Discover publication this request remixes. */
  remixOf?: string;
};

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

export function createRepo(db: Db) {
  return {
    /** Public feed, remixes, reports and moderation (db/discover.ts). */
    discover: createDiscoverRepo(db),

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

    async insertPack(deviceId: string, pack: StickerPack) {
      await db.query(`insert into packs (id, device_id, data, created_at) values ($1, $2, $3, $4)`, [
        pack.id,
        deviceId,
        JSON.stringify(pack),
        pack.createdAt,
      ]);
    },

    async getPack(id: string) {
      const { rows } = await db.query<{ data: StickerPack | string }>(`select data from packs where id = $1`, [id]);
      const d = rows[0]?.data;
      return d === undefined ? undefined : typeof d === "string" ? (JSON.parse(d) as StickerPack) : d;
    },

    async listPacks(deviceId: string, limit = 50) {
      const { rows } = await db.query<{ data: StickerPack | string }>(
        `select data from packs where device_id = $1 order by created_at desc limit $2`,
        [deviceId, limit],
      );
      return rows.map((r) => (typeof r.data === "string" ? (JSON.parse(r.data) as StickerPack) : r.data));
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
