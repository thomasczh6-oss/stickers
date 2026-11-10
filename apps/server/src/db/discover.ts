import { createHash } from "node:crypto";
import type { DiscoverItem, DiscoverSort, ModerationItem, PublicationStatus, ReportReason, StickerPack } from "@stickers/shared";
import type { Db } from "./db";
import type { StoredRequest } from "./repo";

/**
 * Discover tables. They sit beside `packs` and never change its columns, so the
 * My packs work can evolve that table on its own. `deleted_at` is added here too
 * (same statement as My packs uses) so feed queries can skip deleted packs either way.
 */
export const DISCOVER_SCHEMA = `
alter table packs add column if not exists deleted_at timestamptz;
create table if not exists published_packs (
  id text primary key,
  pack_id text not null unique,
  device_id text not null,
  title text not null,
  style text not null,
  kind text not null,
  recipe jsonb not null,
  remix_of text,
  status text not null default 'visible',
  remix_count integer not null default 0,
  report_count integer not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists published_status_idx on published_packs (status, published_at desc);
create index if not exists published_device_idx on published_packs (device_id);
create table if not exists pack_reports (
  publication_id text not null,
  device_id text not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (publication_id, device_id)
);
create table if not exists pack_remixes (
  publication_id text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (publication_id, device_id)
);
create table if not exists creator_blocks (
  device_id text not null,
  blocked_device_id text not null,
  created_at timestamptz not null default now(),
  primary key (device_id, blocked_device_id)
);
create table if not exists banned_devices (
  device_id text primary key,
  reason text,
  created_at timestamptz not null default now()
);
`;

/** What a remix copies: everything about the pack except the person, the name and the language. */
export type Recipe = Omit<StoredRequest, "prompt" | "photoKey" | "photoMimeType" | "packName" | "locale" | "remixOf">;

export function toRecipe(req: StoredRequest): Recipe {
  const { prompt: _p, photoKey: _k, photoMimeType: _m, packName: _n, locale: _l, remixOf: _r, ...recipe } = req as StoredRequest & { remixOf?: string };
  return recipe;
}

interface PubRow {
  id: string;
  pack_id: string;
  device_id: string;
  title: string;
  style: string;
  kind: string;
  recipe: Recipe | string;
  remix_of: string | null;
  status: PublicationStatus;
  remix_count: number;
  report_count: number;
  published_at: Date | string;
  pack: StickerPack | string;
}

const json = <T>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/** Same device, same label; the device id itself is never sent to other people. */
export function creatorLabel(deviceId: string): string {
  return `Creator ${createHash("sha256").update(`creator:${deviceId}`).digest("hex").slice(0, 4).toUpperCase()}`;
}

function toItem(row: PubRow, viewer: string): DiscoverItem {
  const pack = json<StickerPack>(row.pack);
  const recipe = json<Recipe>(row.recipe);
  return {
    id: row.id,
    packId: row.pack_id,
    title: row.title,
    style: recipe.style,
    kind: recipe.kind,
    actions: recipe.actions,
    captions: recipe.captions === true,
    stickerCount: pack.stickers.length,
    previewUrls: pack.stickers.slice(0, 4).map((s) => s.url),
    trayIconUrl: pack.trayIconUrl,
    remixCount: row.remix_count,
    publishedAt: iso(row.published_at),
    creator: creatorLabel(row.device_id),
    mine: viewer !== "" && viewer === row.device_id,
    remixOf: row.remix_of ?? undefined,
  };
}

const SELECT = `select p.*, k.data as pack from published_packs p join packs k on k.id = p.pack_id`;

const ORDER: Record<DiscoverSort, string> = {
  new: "p.published_at desc, p.id",
  top: "p.remix_count desc, p.published_at desc, p.id",
  // Remixes count most, and newer packs get a head start that fades over a few days.
  trending: "(p.remix_count * 3 + 1) / power(extract(epoch from (now() - p.published_at)) / 3600 + 2, 1.5) desc, p.id",
};

export function createDiscoverRepo(db: Db) {
  async function one(sql: string, params: unknown[]) {
    const { rows } = await db.query<PubRow>(sql, params);
    return rows[0];
  }

  return {
    toItem,

    async isBanned(deviceId: string) {
      const { rows } = await db.query(`select 1 from banned_devices where device_id = $1`, [deviceId]);
      return rows.length > 0;
    },

    /** The pack's owner and the request it was made from, if it is still around. */
    async packSource(packId: string) {
      const { rows } = await db.query<{ device_id: string; data: StickerPack | string; request: StoredRequest | string | null }>(
        `select k.device_id, k.data, j.request from packs k left join jobs j on j.pack_id = k.id
         where k.id = $1 and k.deleted_at is null limit 1`,
        [packId],
      );
      const r = rows[0];
      return r ? { deviceId: r.device_id, pack: json<StickerPack>(r.data), request: r.request ? json<StoredRequest>(r.request) : undefined } : undefined;
    },

    async publicationForPack(packId: string) {
      return one(`${SELECT} where p.pack_id = $1`, [packId]);
    },

    async countPublishedSince(deviceId: string, hours: number) {
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from published_packs where device_id = $1 and published_at > now() - ($2 || ' hours')::interval`,
        [deviceId, String(hours)],
      );
      return Number(rows[0]?.n ?? 0);
    },

    /** Publishes or re-titles a pack. Keeps the remix count when it was published before. */
    async publish(p: { id: string; packId: string; deviceId: string; title: string; recipe: Recipe; remixOf?: string; status: PublicationStatus }) {
      await db.query(
        `insert into published_packs (id, pack_id, device_id, title, style, kind, recipe, remix_of, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (pack_id) do update set title = excluded.title, status = excluded.status, updated_at = now()`,
        [p.id, p.packId, p.deviceId, p.title, p.recipe.style, p.recipe.kind, JSON.stringify(p.recipe), p.remixOf ?? null, p.status],
      );
      return (await one(`${SELECT} where p.pack_id = $1`, [p.packId]))!;
    },

    async unpublish(packId: string) {
      const { rows } = await db.query<{ id: string }>(`delete from published_packs where pack_id = $1 returning id`, [packId]);
      for (const r of rows) {
        await db.query(`delete from pack_reports where publication_id = $1`, [r.id]);
        await db.query(`delete from pack_remixes where publication_id = $1`, [r.id]);
      }
    },

    /** One page of the public feed for a viewer: visible packs, minus blocked creators and packs the viewer reported. */
    async feed(opts: { viewer: string; sort: DiscoverSort; style?: string; offset: number; limit: number }) {
      const { rows } = await db.query<PubRow>(
        `${SELECT}
         where p.status = 'visible' and k.deleted_at is null
           and not exists (select 1 from banned_devices b where b.device_id = p.device_id)
           and not exists (select 1 from creator_blocks cb where cb.device_id = $1 and cb.blocked_device_id = p.device_id)
           and not exists (select 1 from pack_reports r where r.device_id = $1 and r.publication_id = p.id)
           and ($2 = '' or p.style = $2)
         order by ${ORDER[opts.sort]}
         limit $3 offset $4`,
        [opts.viewer, opts.style ?? "", opts.limit + 1, opts.offset],
      );
      return { items: rows.slice(0, opts.limit).map((r) => toItem(r, opts.viewer)), more: rows.length > opts.limit };
    },

    /** A publication as a viewer may see it: visible ones for everyone, any status for its owner. */
    async getForViewer(id: string, viewer: string) {
      const row = await one(`${SELECT} where p.id = $1 and k.deleted_at is null`, [id]);
      if (!row) return undefined;
      if (row.status !== "visible" && row.device_id !== viewer) return undefined;
      if (row.device_id !== viewer && (await this.isBanned(row.device_id))) return undefined;
      return { row, item: toItem(row, viewer), pack: json<StickerPack>(row.pack), recipe: json<Recipe>(row.recipe) };
    },

    /** Counts one remix per person; the creator remixing their own pack doesn't count. */
    async recordRemix(id: string, deviceId: string, ownerId: string) {
      if (deviceId === ownerId) return;
      const { rows } = await db.query(
        `insert into pack_remixes (publication_id, device_id) values ($1, $2) on conflict do nothing returning publication_id`,
        [id, deviceId],
      );
      if (rows.length) await db.query(`update published_packs set remix_count = remix_count + 1 where id = $1`, [id]);
    },

    /** Saves a report (one per person per pack). Hides the pack once it has `hideAt` open reports. */
    async report(id: string, deviceId: string, reason: ReportReason, note: string | undefined, hideAt: number) {
      const { rows } = await db.query(
        `insert into pack_reports (publication_id, device_id, reason, note) values ($1, $2, $3, $4)
         on conflict do nothing returning publication_id`,
        [id, deviceId, reason, note ?? null],
      );
      if (!rows.length) return { hidden: false };
      const { rows: upd } = await db.query<{ report_count: number; status: string }>(
        `update published_packs set report_count = report_count + 1, updated_at = now() where id = $1 returning report_count, status`,
        [id],
      );
      const u = upd[0];
      if (u && u.status === "visible" && u.report_count >= hideAt) {
        await db.query(`update published_packs set status = 'hidden', updated_at = now() where id = $1`, [id]);
        return { hidden: true };
      }
      return { hidden: false };
    },

    async block(deviceId: string, blockedDeviceId: string) {
      if (deviceId === blockedDeviceId) return;
      await db.query(`insert into creator_blocks (device_id, blocked_device_id) values ($1, $2) on conflict do nothing`, [deviceId, blockedDeviceId]);
    },

    async unblockAll(deviceId: string) {
      const { rows } = await db.query(`delete from creator_blocks where device_id = $1 returning blocked_device_id`, [deviceId]);
      return rows.length;
    },

    /** The moderation queue: anything waiting for review, hidden, or with open reports. */
    async moderationQueue(filter: "queue" | PublicationStatus | "all", limit = 100): Promise<ModerationItem[]> {
      const where =
        filter === "all"
          ? "true"
          : filter === "queue"
            ? `(p.status in ('pending', 'hidden') or exists (select 1 from pack_reports r where r.publication_id = p.id and r.resolved_at is null))`
            : `p.status = $2`;
      const { rows } = await db.query<PubRow>(
        `${SELECT} where ${where} order by p.report_count desc, p.updated_at desc limit $1`,
        filter === "all" || filter === "queue" ? [limit] : [limit, filter],
      );
      const out: ModerationItem[] = [];
      for (const row of rows) {
        const { rows: reports } = await db.query<{ reason: ReportReason; note: string | null }>(
          `select reason, note from pack_reports where publication_id = $1 and resolved_at is null order by created_at desc`,
          [row.id],
        );
        const reasons: ModerationItem["reasons"] = {};
        for (const r of reports) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
        out.push({
          item: toItem(row, ""),
          status: row.status,
          reportCount: reports.length,
          reasons,
          notes: reports.map((r) => r.note).filter((n): n is string => !!n),
          pack: json<StickerPack>(row.pack),
        });
      }
      return out;
    },

    async moderate(id: string, action: "approve" | "hide" | "remove" | "ban") {
      const row = await one(`${SELECT} where p.id = $1`, [id]);
      if (!row) return false;
      const resolve = () => db.query(`update pack_reports set resolved_at = now() where publication_id = $1 and resolved_at is null`, [id]);
      if (action === "approve") {
        await db.query(`update published_packs set status = 'visible', report_count = 0, updated_at = now() where id = $1`, [id]);
        await resolve();
      } else if (action === "hide") {
        await db.query(`update published_packs set status = 'hidden', updated_at = now() where id = $1`, [id]);
      } else if (action === "remove") {
        await db.query(`update published_packs set status = 'removed', updated_at = now() where id = $1`, [id]);
        await resolve();
      } else {
        await db.query(`insert into banned_devices (device_id, reason) values ($1, $2) on conflict do nothing`, [row.device_id, `publication ${id}`]);
        await db.query(`update published_packs set status = 'removed', updated_at = now() where device_id = $1`, [row.device_id]);
        await db.query(
          `update pack_reports set resolved_at = now() where resolved_at is null and publication_id in (select id from published_packs where device_id = $1)`,
          [row.device_id],
        );
      }
      return true;
    },

    /** Removes everything Discover holds about a device (for "delete my data"). */
    async deleteDeviceData(deviceId: string) {
      const { rows } = await db.query<{ id: string }>(`select id from published_packs where device_id = $1`, [deviceId]);
      for (const r of rows) {
        await db.query(`delete from pack_reports where publication_id = $1`, [r.id]);
        await db.query(`delete from pack_remixes where publication_id = $1`, [r.id]);
      }
      await db.query(`delete from published_packs where device_id = $1`, [deviceId]);
      await db.query(`delete from pack_reports where device_id = $1`, [deviceId]);
      await db.query(`delete from pack_remixes where device_id = $1`, [deviceId]);
      await db.query(`delete from creator_blocks where device_id = $1 or blocked_device_id = $1`, [deviceId]);
    },
  };
}

export type DiscoverRepo = ReturnType<typeof createDiscoverRepo>;
