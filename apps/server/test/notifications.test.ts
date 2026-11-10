import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { NotificationsResponse } from "@stickers/shared";
import { loadConfig } from "../src/config";
import { openDb } from "../src/db/db";
import { createRepo } from "../src/db/repo";
import { createApp } from "../src/http/app";
import { MockImageProvider } from "../src/providers/mock";
import { LocalStorage } from "../src/storage/storage";
import { processJob } from "../src/worker";

const ME = "device-me-123456";
const OTHER = "device-other-9876";

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-notices-"));
  const cfg = loadConfig({ publicBaseUrl: "http://test.local", maxActiveJobsPerDevice: 5 });
  const db = await openDb({ dataDir: "memory://" });
  const repo = createRepo(db);
  const storage = new LocalStorage(dir, cfg.publicBaseUrl);
  const app = createApp({ cfg, repo, storage });
  const call = async <T = unknown>(p: string, init?: RequestInit & { device?: string }) => {
    const res = await app.request(p, { ...init, headers: { "content-type": "application/json", "x-device-id": init?.device ?? ME } });
    return { status: res.status, body: (await res.json()) as T };
  };
  const create = async (prompt: string, device = ME) => {
    const r = await call<{ job: { id: string } }>("/v1/packs", {
      method: "POST",
      device,
      body: JSON.stringify({ prompt, style: "cartoon", kind: "static", actions: ["wave", "cry", "cool"] }),
    });
    assert.equal(r.status, 202);
    return r.body.job.id;
  };
  const runNext = async () => {
    const row = await repo.claimNextJob();
    assert.ok(row);
    await processJob({ repo, storage, provider: new MockImageProvider(), publisherName: "Test", stickerConcurrency: 2 }, row);
    return row.id;
  };
  const list = async (device = ME) => (await call<NotificationsResponse>("/v1/notifications", { device })).body;
  return { db, repo, call, create, runNext, list };
}

test("message center shows packs being made, made and failed, with unread counts", async () => {
  const { db, repo, call, create, runNext, list } = await setup();

  const a = await create("a corgi in sunglasses");
  let center = await list();
  assert.equal(center.active, 1);
  assert.equal(center.unread, 0);
  assert.equal(center.notifications[0]!.status, "queued");
  assert.equal(center.notifications[0]!.read, true, "packs still being made are never unread");
  assert.equal(center.notifications[0]!.prompt, "a corgi in sunglasses");
  assert.equal(center.notifications[0]!.stickerCount, 3);

  assert.equal(await runNext(), a);
  const b = await create("a sleepy sloth");
  await repo.claimNextJob();
  await repo.failJob(b, "The image service is busy. Please try again in a minute.");

  center = await list();
  assert.equal(center.active, 0);
  assert.equal(center.unread, 2);
  const [failed, made] = center.notifications;
  assert.equal(failed!.id, b);
  assert.equal(failed!.status, "failed");
  assert.match(failed!.error!, /busy/);
  assert.equal(made!.id, a);
  assert.equal(made!.status, "succeeded");
  assert.ok(made!.packId);
  assert.ok(made!.previewUrl?.startsWith("http://test.local/files/packs/"));
  assert.equal(made!.read, false);

  // Other devices see nothing.
  assert.equal((await list(OTHER)).notifications.length, 0);
  assert.equal((await call("/v1/notifications", { device: "x" })).status, 400);

  // Marking one read, then all.
  assert.deepEqual((await call("/v1/notifications/read", { method: "POST", body: JSON.stringify({ ids: [a] }) })).body, { updated: 1 });
  center = await list();
  assert.equal(center.unread, 1);
  assert.equal(center.notifications.find((n) => n.id === a)!.read, true);
  assert.equal((await call("/v1/notifications/read", { method: "POST", body: JSON.stringify({ ids: "nope" }) })).status, 400);
  // Another device cannot mark mine.
  assert.deepEqual((await call("/v1/notifications/read", { method: "POST", device: OTHER, body: "{}" })).body, { updated: 0 });
  await call("/v1/notifications/read", { method: "POST", body: "{}" });
  assert.equal((await list()).unread, 0);

  // Renaming the pack shows the new name.
  await call(`/v1/packs/${made!.packId}`, { method: "PATCH", body: JSON.stringify({ name: "Cool dog" }) });
  assert.equal((await list()).notifications.find((n) => n.id === a)!.name, "Cool dog");

  // A pack sent to the bin drops out of the message center.
  await call(`/v1/packs/${made!.packId}`, { method: "DELETE" });
  assert.deepEqual((await list()).notifications.map((n) => n.id), [b]);
  await call(`/v1/packs/${made!.packId}/restore`, { method: "POST" });

  // Clearing hides finished ones but never a pack still being made.
  const c = await create("a dancing cat");
  assert.deepEqual((await call("/v1/notifications/clear", { method: "POST", body: "{}" })).body, { updated: 2 });
  center = await list();
  assert.deepEqual(center.notifications.map((n) => n.id), [c]);
  assert.equal(center.active, 1);

  // A job that finishes after a "mark all read" is unread again.
  await runNext();
  center = await list();
  assert.equal(center.unread, 1);
  assert.equal(center.notifications[0]!.read, false);

  // Old generations fall out after 30 days.
  await db.query(`update jobs set created_at = now() - interval '31 days' where id = $1`, [c]);
  assert.equal((await list()).notifications.length, 0);
});
