import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { openDb } from "./db/db";
import { createRepo } from "./db/repo";
import { createApp } from "./http/app";
import { createImageProvider } from "./providers";
import { createStorage } from "./storage/storage";
import { FlowInterpolator } from "./pipeline/interpolate";
import { startWorker } from "./worker";

const cfg = loadConfig();
const db = await openDb({ databaseUrl: cfg.databaseUrl, dataDir: cfg.dataDir });
const repo = createRepo(db);
const storage = createStorage(cfg);
const provider = createImageProvider(cfg);

const app = createApp({ cfg, repo, storage });
const server = serve({ fetch: app.fetch, port: cfg.port });
console.log(
  `[server] http://localhost:${cfg.port}  db=${cfg.databaseUrl ? "postgres" : "pglite"}  storage=${cfg.storage.kind}  images=${provider.name}`,
);
if (cfg.provider === "mock") console.log("[server] No GATEWAY_API_KEY set: stickers are drawn by the offline mock, not the AI model.");

const worker = cfg.worker.enabled
  ? startWorker(
      {
        repo,
        storage,
        provider,
        publisherName: cfg.publisherName,
        stickerConcurrency: cfg.worker.stickerConcurrency,
        interpolator: cfg.worker.smoothMotion ? new FlowInterpolator() : undefined,
      },
      { concurrency: cfg.worker.jobConcurrency, pollMs: cfg.worker.pollMs },
    )
  : undefined;

async function shutdown() {
  console.log("[server] shutting down");
  server.close();
  await worker?.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
