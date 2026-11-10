import { Worker } from "node:worker_threads";
import type { Rgba } from "./image";

/** Draws in-between frames: for each pair of neighbouring frames, one frame per time t (0 < t < 1). */
export interface Interpolator {
  inbetweens(frames: Rgba[], ts: number[]): Promise<Rgba[][]>;
}

const JOB_TIMEOUT_MS = 60_000;

interface Reply {
  id: number;
  pairs?: ArrayBuffer[][];
  error?: string;
}

/**
 * Optical-flow in-betweens, computed in one long-lived worker thread so the server keeps
 * answering requests while it works (about 0.15s per flow on a 512px frame). The worker
 * loads OpenCV once, on first use.
 */
export class FlowInterpolator implements Interpolator {
  private worker?: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

  async inbetweens(frames: Rgba[], ts: number[]): Promise<Rgba[][]> {
    if (frames.length < 2 || ts.length === 0) return frames.slice(1).map(() => []);
    const { width, height } = frames[0]!;
    if (frames.some((f) => f.width !== width || f.height !== height)) throw new Error("frames must share one size");
    const id = this.nextId++;
    const buffers = frames.map((f) => new Uint8Array(f.data).buffer);
    const worker = this.ensureWorker();
    const reply = await new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("in-between frames timed out"));
        this.reset();
      }, JOB_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (r) => (clearTimeout(timer), resolve(r)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      // Keep the process alive only while a job is running.
      worker.ref();
      worker.postMessage({ id, width, height, frames: buffers, ts }, buffers);
    });
    if (reply.error || !reply.pairs) throw new Error(reply.error ?? "no frames returned");
    return reply.pairs.map((pair) => pair.map((b) => ({ data: Buffer.from(b), width, height })));
  }

  /** Stops the worker; a later call starts a new one. */
  async close() {
    const w = this.worker;
    this.reset();
    await w?.terminate();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./flow-worker.mjs", import.meta.url));
    worker.unref();
    worker.on("message", (r: Reply) => {
      const job = this.pending.get(r.id);
      this.pending.delete(r.id);
      if (this.pending.size === 0) worker.unref();
      job?.resolve(r);
    });
    const fail = (e: Error) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      for (const job of this.pending.values()) job.reject(e);
      this.pending.clear();
    };
    worker.on("error", fail);
    worker.on("exit", (code) => fail(new Error(`in-between worker stopped (code ${code})`)));
    this.worker = worker;
    return worker;
  }

  private reset() {
    const w = this.worker;
    this.worker = undefined;
    for (const job of this.pending.values()) job.reject(new Error("in-between worker was reset"));
    this.pending.clear();
    void w?.terminate();
  }
}
