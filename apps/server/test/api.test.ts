import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { loadConfig } from "../src/config";
import { openDb } from "../src/db/db";
import { createRepo } from "../src/db/repo";
import { createApp } from "../src/http/app";
import { GatewayImageProvider } from "../src/providers/gateway";
import { MockImageProvider } from "../src/providers/mock";
import { LocalStorage } from "../src/storage/storage";
import { processJob } from "../src/worker";

const DEVICE = "device-test-123";

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stickers-api-"));
  const cfg = loadConfig({ publicBaseUrl: "http://test.local", maxActiveJobsPerDevice: 1 });
  const db = await openDb({ dataDir: "memory://" });
  const repo = createRepo(db);
  const storage = new LocalStorage(dir, cfg.publicBaseUrl);
  const app = createApp({ cfg, repo, storage });
  const call = (p: string, init?: RequestInit) =>
    app.request(p, { ...init, headers: { "content-type": "application/json", "x-device-id": DEVICE, ...(init?.headers ?? {}) } });
  return { dir, db, repo, storage, app, call };
}

test("create a pack, run the job, fetch the pack and its files", async () => {
  const { db, repo, storage, call, dir } = await setup();
  const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#a0522d" } }).jpeg().toBuffer();

  const bad = await call("/v1/packs", { method: "POST", body: JSON.stringify({ style: "cartoon" }) });
  assert.equal(bad.status, 400);

  const res = await call("/v1/packs", {
    method: "POST",
    body: JSON.stringify({
      photo: { base64: photo.toString("base64"), mimeType: "image/jpeg" },
      style: "anime",
      kind: "animated",
      actions: ["wave", "party", "cool"],
      packName: "Me!",
    }),
  });
  assert.equal(res.status, 202);
  const { job } = (await res.json()) as { job: { id: string; status: string; progress: { total: number } } };
  assert.equal(job.status, "queued");
  assert.equal(job.progress.total, 5);

  // A second job from the same device is refused while the first is active.
  const busy = await call("/v1/packs", { method: "POST", body: JSON.stringify({ prompt: "cat", style: "3d", kind: "static", actions: ["wave", "cry", "cool"] }) });
  assert.equal(busy.status, 429);

  const row = await repo.claimNextJob();
  assert.ok(row);
  assert.equal(row.request.photoKey, `uploads/${job.id}/photo.jpeg`);
  await processJob({ repo, storage, provider: new MockImageProvider(), publisherName: "Test", stickerConcurrency: 2 }, row);

  const done = (await (await call(`/v1/jobs/${job.id}`)).json()) as { job: { status: string; packId: string; progress: { done: number } } };
  assert.equal(done.job.status, "succeeded");
  assert.equal(done.job.progress.done, 5);

  const { pack } = (await (await call(`/v1/packs/${done.job.packId}`)).json()) as { pack: { name: string; stickers: { url: string }[]; trayIconUrl: string } };
  assert.equal(pack.name, "Me!");
  assert.equal(pack.stickers.length, 3);
  assert.ok(pack.trayIconUrl.startsWith("http://test.local/files/packs/"));

  const file = await call(new URL(pack.stickers[0]!.url).pathname);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "image/webp");

  // The uploaded photo is deleted after the job, and uploads are never served.
  await assert.rejects(fs.access(path.join(dir, `uploads/${job.id}/photo.jpeg`)));
  assert.equal((await call(`/files/uploads/${job.id}/photo.jpeg`)).status, 404);

  const list = (await (await call("/v1/packs")).json()) as { packs: unknown[] };
  assert.equal(list.packs.length, 1);
  await db.close();
});

test("gateway provider sends the OpenAI Images request shapes and reads b64_json", async () => {
  const seen: { path: string; auth?: string; type?: string; body: string }[] = [];
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#00ff00" } }).png().toBuffer();
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    seen.push({ path: req.url!, auth: req.headers.authorization, type: req.headers["content-type"], body: Buffer.concat(chunks).toString("latin1") });
    if (seen.length === 1) {
      res.writeHead(503, { "retry-after": "0" }).end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const provider = new GatewayImageProvider({ baseUrl: `http://127.0.0.1:${port}`, apiKey: "test-key", imageModel: "gpt-image-2.5-flare", quality: "medium", timeoutMs: 5000 });

  const a = await provider.image({ prompt: "hello", images: [], size: "1024x1024", intent: { kind: "character" } });
  assert.deepEqual(a, png);
  assert.equal(seen.length, 2, "503 with Retry-After is retried");
  assert.equal(seen[1]!.path, "/v1/images/generations");
  assert.equal(seen[1]!.auth, "Bearer test-key");
  assert.deepEqual(JSON.parse(seen[1]!.body), { model: "gpt-image-2.5-flare", prompt: "hello", size: "1024x1024", quality: "medium", n: 1 });

  await provider.image({ prompt: "pose", images: [{ data: png, mimeType: "image/png" }], size: "1024x1024", intent: { kind: "character" } });
  const edit = seen[2]!;
  assert.equal(edit.path, "/v1/images/edits");
  assert.match(edit.type ?? "", /^multipart\/form-data/);
  assert.match(edit.body, /name="model"\r\n\r\ngpt-image-2\.5-flare/);
  assert.match(edit.body, /name="image"; filename="ref0\.png"/);
  server.close();
});
