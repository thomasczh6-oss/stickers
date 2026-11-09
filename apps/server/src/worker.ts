import { nanoid } from "nanoid";
import type { JobRow, Repo } from "./db/repo";
import { generatePack, type GenerateDeps } from "./pipeline/generatePack";
import { ProviderError } from "./providers";
import type { Storage } from "./storage/storage";

export interface WorkerDeps extends GenerateDeps {
  repo: Repo;
  storage: Storage;
}

/** Runs one claimed job to the end and records the result. */
export async function processJob(deps: WorkerDeps, row: JobRow): Promise<void> {
  const req = row.request;
  const packId = `pk_${nanoid(16)}`;
  try {
    const photo = req.photoKey ? { data: await deps.storage.get(req.photoKey), mimeType: req.photoMimeType ?? "image/jpeg" } : undefined;
    const pack = await generatePack(deps, {
      packId,
      request: req,
      photo,
      onProgress: (done, step) => deps.repo.updateProgress(row.id, done, step),
    });
    await deps.repo.insertPack(row.device_id, pack);
    await deps.repo.finishJob(row.id, pack.id);
  } catch (e) {
    console.error(`[worker] job ${row.id} failed`, e);
    await deps.repo.failJob(row.id, friendlyError(e));
  } finally {
    // The user's photo is only needed to draw the character; do not keep it.
    if (req.photoKey) await deps.storage.delete(req.photoKey).catch(() => undefined);
  }
}

function friendlyError(e: unknown): string {
  if (e instanceof ProviderError) {
    if (e.status === 400 || e.status === 422) return "The image service refused this request. Try a different photo or description.";
    if (e.status === 429) return "The image service is busy. Please try again in a minute.";
    return e.message;
  }
  return "Something went wrong while making your stickers. Please try again.";
}

/** Polls the job table and runs up to `concurrency` jobs at once. */
export function startWorker(deps: WorkerDeps, opts: { concurrency: number; pollMs: number }) {
  let stopped = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const loop = async () => {
    while (!stopped) {
      try {
        const row = await deps.repo.claimNextJob();
        if (!row) {
          await sleep(opts.pollMs);
          continue;
        }
        await processJob(deps, row);
      } catch (e) {
        console.error("[worker] loop error", e);
        await sleep(opts.pollMs * 5);
      }
    }
  };

  const reaper = setInterval(() => void deps.repo.requeueStaleJobs().catch(() => undefined), 5 * 60_000);
  void deps.repo.requeueStaleJobs().catch(() => undefined);
  const loops = Array.from({ length: Math.max(1, opts.concurrency) }, loop);

  return {
    async stop() {
      stopped = true;
      clearInterval(reaper);
      await Promise.all(loops);
    },
  };
}
