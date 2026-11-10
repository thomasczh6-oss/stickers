import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ListPacksResponse, StickerPack } from "@stickers/shared";
import { loadConfig } from "../src/config";
import { openDb } from "../src/db/db";
import { createRepo } from "../src/db/repo";
import { createApp } from "../src/http/app";
import { LocalStorage } from "../src/storage/storage";
import { purgeBin } from "../src/worker";

const ME = "device-me-123456";
const OTHER = "device-other-9876";

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-packs-"));
  const cfg = loadConfig({ publicBaseUrl: "http://test.local" });
  const db = await openDb({ dataDir: "memory://" });
  const repo = createRepo(db);
  const storage = new LocalStorage(dir, cfg.publicBaseUrl);
  const app = createApp({ cfg, repo, storage });
  const call = async <T = unknown>(p: string, init?: RequestInit & { device?: string }) => {
    const res = await app.request(p, { ...init, headers: { "content-type": "application/json", "x-device-id": init?.device ?? ME } });
    return { status: res.status, body: (await res.json()) as T };
  };

  let n = 0;
  /** Adds a finished pack straight to the database, with real files on disk. */
  const addPack = async (o: { name: string; animated?: boolean; stickers?: number; style?: string; prompt?: string; device?: string }) => {
    n += 1;
    const id = `pk_test${String(n).padStart(4, "0")}`;
    const put = async (file: string) => {
      await storage.put(`packs/${id}/${file}`, Buffer.from(`${id}/${file}`));
      return storage.url(`packs/${id}/${file}`);
    };
    const count = o.stickers ?? 3;
    const pack: StickerPack = {
      id,
      identifier: id,
      name: o.name,
      publisher: "Test",
      animated: o.animated ?? true,
      trayIconFileName: "tray.png",
      trayIconUrl: await put("tray.png"),
      stickers: await Promise.all(
        Array.from({ length: count }, async (_, i) => ({
          id: `s${i}`,
          index: i,
          fileName: `0${i + 1}.webp`,
          url: await put(`0${i + 1}.webp`),
          bytes: 10,
          emojis: ["😀"],
          accessibilityText: "x",
        })),
      ),
      imageDataVersion: 1,
      createdAt: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
      style: (o.style ?? "cartoon") as StickerPack["style"],
    };
    await repo.insertPack(o.device ?? ME, pack, { prompt: o.prompt });
    return pack;
  };
  return { dir, db, repo, storage, call, addPack };
}

test("list: paging, search, filters, sort and counts", async () => {
  const { call, addPack, db } = await setup();
  await addPack({ name: "Biscuit moods", prompt: "a chubby corgi", stickers: 6 });
  await addPack({ name: "Grandma", animated: false, style: "photo" });
  await addPack({ name: "anime me", style: "anime", stickers: 4 });
  for (let i = 0; i < 30; i++) await addPack({ name: `Pack ${i}` });
  await addPack({ name: "Not mine", device: OTHER });

  const first = await call<ListPacksResponse>("/v1/packs?limit=10");
  assert.equal(first.status, 200);
  assert.equal(first.body.packs.length, 10);
  assert.equal(first.body.total, 33);
  assert.deepEqual(first.body.counts, { all: 33, favorites: 0, animated: 32, static: 1 });
  assert.equal(first.body.packs[0]!.name, "Pack 29", "newest first");
  assert.equal(first.body.nextCursor, "10");

  const seen = new Set<string>();
  let cursor: string | undefined = "0";
  while (cursor !== undefined) {
    const page: { body: ListPacksResponse } = await call<ListPacksResponse>(`/v1/packs?limit=10&cursor=${cursor}`);
    for (const p of page.body.packs) seen.add(p.id);
    cursor = page.body.nextCursor;
  }
  assert.equal(seen.size, 33, "pages cover every pack once and never another device's");

  const corgi = await call<ListPacksResponse>("/v1/packs?q=CORGI");
  assert.deepEqual(corgi.body.packs.map((p) => p.name), ["Biscuit moods"], "search matches the description too");
  assert.equal((await call<ListPacksResponse>("/v1/packs?q=100%25")).body.total, 0, "% is matched literally");

  const still = await call<ListPacksResponse>("/v1/packs?filter=static");
  assert.deepEqual(still.body.packs.map((p) => p.name), ["Grandma"]);
  const anime = await call<ListPacksResponse>("/v1/packs?style=anime");
  assert.deepEqual(anime.body.packs.map((p) => p.name), ["anime me"]);
  assert.equal(anime.body.packs[0]!.style, "anime");

  const byName = await call<ListPacksResponse>("/v1/packs?sort=name&limit=3");
  assert.deepEqual(byName.body.packs.map((p) => p.name), ["anime me", "Biscuit moods", "Grandma"], "name sort ignores case");
  const bySize = await call<ListPacksResponse>("/v1/packs?sort=size&limit=1");
  assert.equal(bySize.body.packs[0]!.name, "Biscuit moods");
  const oldest = await call<ListPacksResponse>("/v1/packs?sort=oldest&limit=1&sort=bogus");
  assert.equal(oldest.status, 200);
  await db.close();
});

test("rename, favorite, delete with undo, bulk actions, duplicate and owner checks", async () => {
  const { call, addPack, db, dir, repo, storage } = await setup();
  const a = await addPack({ name: "Alpha" });
  const b = await addPack({ name: "Beta" });
  const c = await addPack({ name: "Gamma" });

  const renamed = await call<{ pack: StickerPack }>(`/v1/packs/${a.id}`, { method: "PATCH", body: JSON.stringify({ name: "  Alpha   v2 " }) });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.pack.name, "Alpha v2");
  assert.equal(renamed.body.pack.imageDataVersion, 2, "renaming tells WhatsApp to reload");
  assert.equal((await call<{ pack: StickerPack }>(`/v1/packs/${a.id}`)).body.pack.name, "Alpha v2");
  assert.equal((await call(`/v1/packs/${a.id}`, { method: "PATCH", body: JSON.stringify({ name: "" }) })).status, 400);
  assert.equal((await call(`/v1/packs/${a.id}`, { method: "PATCH", body: JSON.stringify({ name: "x".repeat(41) }) })).status, 400);
  assert.equal((await call(`/v1/packs/${a.id}`, { method: "PATCH", body: JSON.stringify({ name: "Hack" }), device: OTHER })).status, 404);

  await call(`/v1/packs/${b.id}`, { method: "PATCH", body: JSON.stringify({ favorite: true }) });
  const favs = await call<ListPacksResponse>("/v1/packs?filter=favorites");
  assert.deepEqual(favs.body.packs.map((p) => p.id), [b.id]);
  assert.equal(favs.body.packs[0]!.favorite, true);

  // Delete hides the pack everywhere; restore brings it back.
  assert.equal((await call(`/v1/packs/${c.id}`, { method: "DELETE", device: OTHER })).status, 404);
  assert.equal((await call(`/v1/packs/${c.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await call(`/v1/packs/${c.id}`)).status, 404);
  assert.equal((await call<ListPacksResponse>("/v1/packs")).body.total, 2);
  assert.equal((await call(`/v1/packs/${c.id}`, { method: "PATCH", body: JSON.stringify({ favorite: true }) })).status, 404);
  const restored = await call<{ pack: StickerPack }>(`/v1/packs/${c.id}/restore`, { method: "POST" });
  assert.equal(restored.status, 200);
  assert.equal((await call<ListPacksResponse>("/v1/packs")).body.total, 3);

  // Bulk
  const bulk = await call<{ updated: number }>("/v1/packs/bulk", { method: "POST", body: JSON.stringify({ ids: [a.id, c.id, "pk_nope"], action: "favorite" }) });
  assert.equal(bulk.body.updated, 2);
  assert.equal((await call<ListPacksResponse>("/v1/packs")).body.counts.favorites, 3);
  assert.equal((await call("/v1/packs/bulk", { method: "POST", body: JSON.stringify({ ids: [a.id], action: "explode" }) })).status, 400);
  const other = await call<{ updated: number }>("/v1/packs/bulk", { method: "POST", body: JSON.stringify({ ids: [a.id], action: "delete" }), device: OTHER });
  assert.equal(other.body.updated, 0, "another device can't delete my packs");
  await call("/v1/packs/bulk", { method: "POST", body: JSON.stringify({ ids: [a.id, b.id], action: "delete" }) });
  assert.equal((await call<ListPacksResponse>("/v1/packs")).body.total, 1);

  // Duplicate copies the files under a new id and WhatsApp identifier.
  const dup = await call<{ pack: StickerPack }>(`/v1/packs/${c.id}/duplicate`, { method: "POST", body: JSON.stringify({ name: "Gamma copy" }) });
  assert.equal(dup.status, 201);
  assert.notEqual(dup.body.pack.id, c.id);
  assert.notEqual(dup.body.pack.identifier, c.identifier);
  assert.equal(dup.body.pack.name, "Gamma copy");
  assert.equal(dup.body.pack.favorite, false);
  assert.match(dup.body.pack.stickers[0]!.url, new RegExp(`/files/packs/${dup.body.pack.id}/01\\.webp$`));
  assert.equal(String(await storage.get(`packs/${dup.body.pack.id}/01.webp`)), `${c.id}/01.webp`);
  assert.equal((await call(`/v1/packs/${c.id}/duplicate`, { method: "POST", device: OTHER })).status, 404);
  assert.equal((await call<ListPacksResponse>("/v1/packs")).body.packs[0]!.id, dup.body.pack.id, "the copy is newest");

  // Packs in the bin for 30 days are purged with their files.
  await db.query(`update packs set deleted_at = now() - interval '31 days' where id = $1`, [a.id]);
  await purgeBin({ repo, storage });
  await assert.rejects(fs.access(path.join(dir, `packs/${a.id}/01.webp`)));
  await fs.access(path.join(dir, `packs/${b.id}/01.webp`));
  assert.equal((await call(`/v1/packs/${a.id}/restore`, { method: "POST" })).status, 404);
  await db.close();
});
