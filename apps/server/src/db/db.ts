import fs from "node:fs";
import path from "node:path";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const SCHEMA = `
create table if not exists jobs (
  id text primary key,
  device_id text not null,
  status text not null,
  request jsonb not null,
  progress_done integer not null default 0,
  progress_total integer not null default 0,
  step text,
  pack_id text,
  error text,
  attempts integer not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_queue_idx on jobs (status, created_at);
create index if not exists jobs_device_idx on jobs (device_id, status);

create table if not exists packs (
  id text primary key,
  device_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists packs_device_idx on packs (device_id, created_at desc);

alter table packs add column if not exists name text;
alter table packs add column if not exists prompt text;
alter table packs add column if not exists style text;
alter table packs add column if not exists animated boolean;
alter table packs add column if not exists sticker_count integer;
alter table packs add column if not exists favorite boolean not null default false;
alter table packs add column if not exists deleted_at timestamptz;
alter table packs add column if not exists updated_at timestamptz;
alter table jobs add column if not exists seen_at timestamptz;
alter table jobs add column if not exists cleared_at timestamptz;
create index if not exists jobs_device_recent_idx on jobs (device_id, created_at desc);
create index if not exists packs_owner_idx on packs (device_id, deleted_at, created_at desc);

update packs set name = data->>'name', animated = (data->>'animated')::boolean,
  sticker_count = jsonb_array_length(data->'stickers'), updated_at = created_at
where name is null;
update packs p set style = j.request->>'style', prompt = j.request->>'prompt'
from jobs j where j.pack_id = p.id and p.style is null;
`;

/**
 * Opens Postgres. With a DATABASE_URL it uses a real server (node-postgres);
 * without one it runs an embedded Postgres (PGlite) so local dev needs no setup.
 * Pass "memory://" as dataDir for a throwaway in-memory database (tests).
 */
export async function openDb(opts: { databaseUrl?: string; dataDir: string }): Promise<Db> {
  let db: Db;
  if (opts.databaseUrl) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 10 });
    db = {
      query: async <T>(sql: string, params: unknown[] = []) => {
        const r = await pool.query(sql, params);
        return { rows: r.rows as T[] };
      },
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    let dir: string | undefined;
    if (opts.dataDir !== "memory://") {
      dir = path.join(opts.dataDir, "pglite");
      fs.mkdirSync(dir, { recursive: true });
    }
    const lite = new PGlite(dir);
    // PGlite runs one query at a time; chain calls so concurrent workers never overlap.
    let chain: Promise<unknown> = Promise.resolve();
    db = {
      query: <T>(sql: string, params: unknown[] = []) => {
        const run = chain.then(() => lite.query<T>(sql, params));
        chain = run.catch(() => undefined);
        return run.then((r) => ({ rows: r.rows }));
      },
      close: () => lite.close(),
    };
  }
  for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  return db;
}
