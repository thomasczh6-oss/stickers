import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { hasBlockedWords, type DiscoverItem, type DiscoverPage, type StickerPack } from "@stickers/shared";
import sharp from "sharp";
import { loadConfig } from "../src/config";
import { openDb } from "../src/db/db";
import { createRepo } from "../src/db/repo";
import { createApp } from "../src/http/app";
import { MockImageProvider } from "../src/providers/mock";
import { LocalStorage } from "../src/storage/storage";
import { processJob } from "../src/worker";

const ALICE = "device-alice-0001";
const BOB = "device-bob-000002";
const ADMIN = "test-admin-token";

async function setup(overrides: Partial<ReturnType<typeof loadConfig>> = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-discover-"));
  const cfg = loadConfig({ publicBaseUrl: "http://test.local", maxActiveJobsPerDevice: 2, adminToken: ADMIN, ...overrides });
  const db = await openDb({ dataDir: "memory://" });
  const repo = createRepo(db);
  const storage = new LocalStorage(dir, cfg.publicBaseUrl);
  const app = createApp({ cfg, repo, storage });
  const as = (deviceId: string) => async (p: string, init?: RequestInit & { json?: unknown }) => {
    const res = await app.request(p, {
      ...init,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      headers: { "content-type": "application/json", "x-device-id": deviceId, ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as any };
  };
  const runJobs = async () => {
    for (let row = await repo.claimNextJob(); row; row = await repo.claimNextJob()) {
      await processJob({ repo, storage, provider: new MockImageProvider(), publisherName: "Test", stickerConcurrency: 3 }, row);
    }
  };
  /** Makes a finished pack for a device and returns its id. */
  const makePack = async (deviceId: string, body: Record<string, unknown>) => {
    const r = await as(deviceId)("/v1/packs", { method: "POST", json: body });
    assert.equal(r.status, 202, JSON.stringify(r.body));
    await runJobs();
    return (await repo.getJob(r.body.job.id))!.pack_id!;
  };
  return { db, repo, as, runJobs, makePack };
}

const photo = async () => ({
  base64: (await sharp({ create: { width: 64, height: 64, channels: 3, background: "#336699" } }).jpeg().toBuffer()).toString("base64"),
  mimeType: "image/jpeg" as const,
});

test("publish, browse, remix with my own photo", async () => {
  const { db, repo, as, runJobs, makePack } = await setup();
  const alice = as(ALICE);
  const bob = as(BOB);
  const packId = await makePack(ALICE, {
    prompt: "a grumpy cat barista",
    style: "anime",
    kind: "animated",
    actions: ["wave", "laugh", "cool", "party"],
    captions: true,
    packName: "Barista cat",
  });

  // Only the creator sees and changes the publish state.
  assert.deepEqual((await alice(`/v1/packs/${packId}/publish`)).body, { published: false });
  assert.equal((await bob(`/v1/packs/${packId}/publish`)).status, 403);
  assert.equal((await bob(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true } })).status, 403);

  // Guidelines consent is required, and the title goes through the word filter.
  assert.equal((await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: {} })).status, 400);
  assert.equal((await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true, title: "s3xy nudes" } })).status, 400);

  const pub = await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true, title: "Coffee moods" } });
  assert.equal(pub.status, 201);
  assert.equal(pub.body.publication.status, "visible");
  const pubId: string = pub.body.publication.id;

  // Anyone can browse, even without a device id. The creator's device id never leaks.
  const anon = await as("")("/v1/discover?sort=new");
  assert.equal(anon.status, 200);
  const feed = anon.body as DiscoverPage;
  assert.equal(feed.items.length, 1);
  const item = feed.items[0]!;
  assert.equal(item.title, "Coffee moods");
  assert.equal(item.style, "anime");
  assert.deepEqual(item.actions, ["wave", "laugh", "cool", "party"]);
  assert.equal(item.captions, true);
  assert.equal(item.previewUrls.length, 4);
  assert.match(item.creator, /^Creator [0-9A-F]{4}$/);
  assert.ok(!JSON.stringify(anon.body).includes(ALICE));
  assert.ok(!JSON.stringify(anon.body).includes("grumpy cat"), "the original description stays private");
  assert.equal(item.mine, false);
  assert.equal((await alice("/v1/discover")).body.items[0].mine, true);
  assert.equal((await as("")("/v1/discover?style=pixel")).body.items.length, 0);

  const detail = await bob(`/v1/discover/${pubId}`);
  assert.equal(detail.status, 200);
  assert.equal((detail.body.pack as StickerPack).id, packId);

  // Remix needs a photo or a description.
  assert.equal((await bob(`/v1/discover/${pubId}/remix`, { method: "POST", json: {} })).status, 400);
  // The remixer can't change the recipe by sending extra fields.
  const remix = await bob(`/v1/discover/${pubId}/remix`, { method: "POST", json: { photo: await photo(), style: "pixel", actions: ["cry"], locale: "de" } });
  assert.equal(remix.status, 202, JSON.stringify(remix.body));
  const job = (await repo.getJob(remix.body.job.id))!;
  assert.equal(job.device_id, BOB);
  assert.equal(job.request.style, "anime");
  assert.deepEqual(job.request.actions, ["wave", "laugh", "cool", "party"]);
  assert.equal(job.request.captions, true);
  assert.equal(job.request.kind, "animated");
  assert.equal(job.request.locale, "de");
  assert.equal(job.request.prompt, undefined, "Alice's description is not reused");
  assert.equal(job.request.remixOf, pubId);
  await runJobs();
  const bobPack = (await repo.getPack((await repo.getJob(job.id))!.pack_id!))!;
  assert.equal(bobPack.remixOf, pubId);
  assert.equal(bobPack.stickers.length, 4);

  // One remix per person counts; the creator remixing their own pack doesn't.
  await bob(`/v1/discover/${pubId}/remix`, { method: "POST", json: { prompt: "a fox" } });
  await alice(`/v1/discover/${pubId}/remix`, { method: "POST", json: { prompt: "a fox" } });
  assert.equal((await as("")("/v1/discover?sort=top")).body.items[0].remixCount, 1);

  // Bob's remix can be published too and remembers where it came from.
  const bobPub = await bob(`/v1/packs/${bobPack.id}/publish`, { method: "POST", json: { agree: true } });
  assert.equal(bobPub.status, 201);
  const items = (await as("")("/v1/discover?sort=new")).body.items as DiscoverItem[];
  assert.equal(items.length, 2);
  assert.equal(items.find((i) => i.packId === bobPack.id)?.remixOf, pubId);

  // Re-publishing just updates the title; unpublishing takes it off the feed.
  const again = await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true, title: "Coffee moods 2" } });
  assert.equal(again.status, 200);
  assert.equal(again.body.publication.id, pubId);
  assert.equal((await alice(`/v1/packs/${packId}/publish`, { method: "DELETE" })).body.published, false);
  assert.equal((await bob(`/v1/discover/${pubId}`)).status, 404);
  assert.equal((await as("")("/v1/discover")).body.items.length, 1);
  await db.close();
});

test("reports hide packs, blocks hide creators, moderators decide", async () => {
  const { db, as, makePack } = await setup({ discover: { review: "post", autoHideReports: 2, publishPerDay: 2 } });
  const alice = as(ALICE);
  const bob = as(BOB);
  const carol = as("device-carol-0003");
  const packId = await makePack(ALICE, { prompt: "a robot", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] });
  const pubId: string = (await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true } })).body.publication.id;

  // Reports: validated, not on your own pack, once per person, and the reporter stops seeing it.
  assert.equal((await bob(`/v1/discover/${pubId}/report`, { method: "POST", json: { reason: "nope" } })).status, 400);
  assert.equal((await alice(`/v1/discover/${pubId}/report`, { method: "POST", json: { reason: "spam" } })).status, 400);
  assert.equal((await bob(`/v1/discover/${pubId}/report`, { method: "POST", json: { reason: "privacy", note: "that's me" } })).status, 200);
  assert.equal((await bob(`/v1/discover/${pubId}/report`, { method: "POST", json: { reason: "privacy" } })).status, 200);
  assert.equal((await bob("/v1/discover")).body.items.length, 0);
  assert.equal((await carol("/v1/discover")).body.items.length, 1, "one report doesn't hide it for everyone");

  // A second person's report reaches the threshold: hidden for everyone, still visible to its creator.
  await carol(`/v1/discover/${pubId}/report`, { method: "POST", json: { reason: "sexual" } });
  assert.equal((await as("")("/v1/discover")).body.items.length, 0);
  assert.equal((await alice(`/v1/discover/${pubId}`)).status, 200);
  assert.equal((await alice(`/v1/packs/${packId}/publish`)).body.publication.status, "hidden");

  // Moderation API needs the token.
  assert.equal((await as("")("/v1/admin/discover")).status, 401);
  assert.equal((await as("")("/v1/admin/discover", { headers: { authorization: "Bearer wrong" } })).status, 401);
  const auth = { authorization: `Bearer ${ADMIN}` };
  const queue = await as("")("/v1/admin/discover", { headers: auth });
  assert.equal(queue.body.items.length, 1);
  assert.equal(queue.body.items[0].reportCount, 2);
  assert.deepEqual(queue.body.items[0].reasons, { privacy: 1, sexual: 1 });
  assert.deepEqual(queue.body.items[0].notes, ["that's me"]);

  // Approve: visible again, the queue clears.
  assert.equal((await as("")(`/v1/admin/discover/${pubId}`, { method: "POST", headers: auth, json: { action: "approve" } })).status, 200);
  assert.equal((await as("")("/v1/discover")).body.items.length, 1);
  assert.equal((await as("")("/v1/admin/discover", { headers: auth })).body.items.length, 0);

  // Block: Carol no longer sees anything from Alice, until she unblocks.
  await carol(`/v1/discover/${pubId}/block`, { method: "POST" });
  assert.equal((await carol("/v1/discover")).body.items.length, 0);
  assert.equal((await carol("/v1/discover/blocks", { method: "DELETE" })).body.removed, 1);

  // Remove: gone, and the creator can't quietly publish it again.
  await as("")(`/v1/admin/discover/${pubId}`, { method: "POST", headers: auth, json: { action: "remove" } });
  assert.equal((await as("")("/v1/discover")).body.items.length, 0);
  assert.equal((await alice(`/v1/packs/${packId}/publish`, { method: "POST", json: { agree: true } })).status, 403);

  // Ban: the device can't publish anything else.
  const other = await makePack(ALICE, { prompt: "a dog", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] });
  const otherPub = await alice(`/v1/packs/${other}/publish`, { method: "POST", json: { agree: true } });
  assert.equal(otherPub.status, 201);
  await as("")(`/v1/admin/discover/${otherPub.body.publication.id}`, { method: "POST", headers: auth, json: { action: "ban" } });
  const third = await makePack(ALICE, { prompt: "a fish", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] });
  assert.equal((await alice(`/v1/packs/${third}/publish`, { method: "POST", json: { agree: true } })).status, 403);
  await db.close();
});

test("pre-review mode, daily limit, deleted packs", async () => {
  const { db, as, makePack } = await setup({ discover: { review: "pre", autoHideReports: 3, publishPerDay: 1 } });
  const alice = as(ALICE);
  const a = await makePack(ALICE, { prompt: "a robot", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] });
  const b = await makePack(ALICE, { prompt: "a dog", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] });
  const pub = await alice(`/v1/packs/${a}/publish`, { method: "POST", json: { agree: true } });
  assert.equal(pub.body.publication.status, "pending");
  assert.equal((await as("")("/v1/discover")).body.items.length, 0);
  assert.equal((await alice(`/v1/packs/${b}/publish`, { method: "POST", json: { agree: true } })).status, 429);

  await as("")(`/v1/admin/discover/${pub.body.publication.id}`, { method: "POST", headers: { authorization: `Bearer ${ADMIN}` }, json: { action: "approve" } });
  assert.equal((await as("")("/v1/discover")).body.items.length, 1);

  // A pack deleted from My packs drops out of Discover.
  await db.query(`update packs set deleted_at = now() where id = $1`, [a]);
  assert.equal((await as("")("/v1/discover")).body.items.length, 0);
  await db.close();
});

test("title word filter", () => {
  assert.equal(hasBlockedWords("Coffee moods"), false);
  assert.equal(hasBlockedWords("Sussex sunsets"), false, "whole words only");
  assert.equal(hasBlockedWords("NUD3S"), true);
  assert.equal(hasBlockedWords("s e x"), true);
  assert.equal(hasBlockedWords("f.u.c.k"), true);
});
