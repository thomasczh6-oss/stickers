import type { DiscoverItem, DiscoverPage, DiscoverSort, PublishRequest, PublishState, RemixRequest, ReportRequest } from "./discover/types";
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

    // Discover: the public feed, one-tap remix, reports and blocks.
    discover: (opts: { sort?: DiscoverSort; style?: string; cursor?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== "") q.set(k, String(v));
      const qs = q.toString();
      return call<DiscoverPage>(`/v1/discover${qs ? `?${qs}` : ""}`);
    },
    getDiscoverItem: (id: string) => call<{ item: DiscoverItem; pack: StickerPack }>(`/v1/discover/${encodeURIComponent(id)}`),
    remix: (id: string, req: RemixRequest) =>
      call<{ job: Job }>(`/v1/discover/${encodeURIComponent(id)}/remix`, { method: "POST", body: JSON.stringify(req) }),
    report: (id: string, req: ReportRequest) =>
      call<{ ok: true }>(`/v1/discover/${encodeURIComponent(id)}/report`, { method: "POST", body: JSON.stringify(req) }),
    blockCreator: (id: string) => call<{ ok: true }>(`/v1/discover/${encodeURIComponent(id)}/block`, { method: "POST" }),
    unblockAll: () => call<{ ok: true; removed: number }>("/v1/discover/blocks", { method: "DELETE" }),
    getPublishState: (packId: string) => call<PublishState>(`/v1/packs/${encodeURIComponent(packId)}/publish`),
    publish: (packId: string, req: PublishRequest) =>
      call<PublishState>(`/v1/packs/${encodeURIComponent(packId)}/publish`, { method: "POST", body: JSON.stringify(req) }),
    unpublish: (packId: string) => call<PublishState>(`/v1/packs/${encodeURIComponent(packId)}/publish`, { method: "DELETE" }),

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
