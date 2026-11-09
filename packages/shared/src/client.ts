import type { CreatePackRequest, Job, StickerPack } from "./types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Small typed client for the sticker API, shared by the web and mobile apps.
 * `deviceId` identifies an anonymous user until accounts exist.
 */
export function createApiClient(baseUrl: string, deviceId: string) {
  const root = baseUrl.replace(/\/$/, "");

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${root}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-device-id": deviceId, ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ApiRequestError(res.status, body?.error ?? `HTTP ${res.status}`, body?.details);
    }
    return body as T;
  }

  const api = {
    createPack: (req: CreatePackRequest) => call<{ job: Job }>("/v1/packs", { method: "POST", body: JSON.stringify(req) }),
    getJob: (jobId: string) => call<{ job: Job }>(`/v1/jobs/${encodeURIComponent(jobId)}`),
    getPack: (packId: string) => call<{ pack: StickerPack }>(`/v1/packs/${encodeURIComponent(packId)}`),
    listMyPacks: () => call<{ packs: StickerPack[] }>("/v1/packs"),

    /** Polls a job until it finishes. Calls onUpdate on every poll. */
    async waitForJob(jobId: string, onUpdate?: (job: Job) => void, intervalMs = 2000): Promise<Job> {
      for (;;) {
        const { job } = await api.getJob(jobId);
        onUpdate?.(job);
        if (job.status === "succeeded" || job.status === "failed") return job;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    },
  };
  return api;
}

export type ApiClient = ReturnType<typeof createApiClient>;
