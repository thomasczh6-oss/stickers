import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { openDb } from "./db/db";
import { createRepo } from "./db/repo";
import { createApp } from "./http/app";
import { createImageProvider } from "./providers";
import { createStorage } from "./storage/storage";
import { TelegramBot } from "./telegram/bot";
import { startWorker } from "./worker";

const cfg = loadConfig();
const db = await openDb({ databaseUrl: cfg.databaseUrl, dataDir: cfg.dataDir });
const repo = createRepo(db);
const storage = createStorage(cfg);
const provider = createImageProvider(cfg);

let telegram: TelegramBot | undefined;
if (cfg.telegram.token) {
  try {
    telegram = await new TelegramBot({ token: cfg.telegram.token, repo, storage }).init();
    if (cfg.telegram.webhookSecret) {
      await telegram.setWebhook(`${cfg.publicBaseUrl}/telegram/webhook`, cfg.telegram.webhookSecret);
      console.log(`[telegram] @${telegram.username} on webhook`);
    } else {
      void telegram.poll();
      console.log(`[telegram] @${telegram.username} polling`);
    }
  } catch (e) {
    console.error("[telegram] bot disabled:", (e as Error).message);
    telegram = undefined;
  }
}

const app = createApp({ cfg, repo, storage, telegram });
const server = serve({ fetch: app.fetch, port: cfg.port });
console.log(
  `[server] http://localhost:${cfg.port}  db=${cfg.databaseUrl ? "postgres" : "pglite"}  storage=${cfg.storage.kind}  images=${provider.name}`,
);
if (cfg.provider === "mock") console.log("[server] No GATEWAY_API_KEY set: stickers are drawn by the offline mock, not the AI model.");

const worker = cfg.worker.enabled
  ? startWorker(
      { repo, storage, provider, publisherName: cfg.publisherName, stickerConcurrency: cfg.worker.stickerConcurrency },
      { concurrency: cfg.worker.jobConcurrency, pollMs: cfg.worker.pollMs },
    )
  : undefined;

async function shutdown() {
  console.log("[server] shutting down");
  server.close();
  telegram?.stop();
  await worker?.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
