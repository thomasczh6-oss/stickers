import type { BulkPackAction, CreatePackRequest, Job, ListPacksQuery, ListPacksResponse, NotificationsResponse, StickerPack } from "./types";

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
    /** One page of the device's packs. Without a query, the newest 24. */
    listMyPacks: (query: ListPacksQuery = {}) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
      const qs = params.toString();
      return call<ListPacksResponse>(`/v1/packs${qs ? `?${qs}` : ""}`);
    },
    updatePack: (packId: string, patch: { name?: string; favorite?: boolean }) =>
      call<{ pack: StickerPack }>(`/v1/packs/${encodeURIComponent(packId)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    /** Moves a pack to the bin; restorePack brings it back (kept for 30 days). */
    deletePack: (packId: string) => call<{ ok: true }>(`/v1/packs/${encodeURIComponent(packId)}`, { method: "DELETE" }),
    restorePack: (packId: string) => call<{ pack: StickerPack }>(`/v1/packs/${encodeURIComponent(packId)}/restore`, { method: "POST" }),
    duplicatePack: (packId: string, name?: string) =>
      call<{ pack: StickerPack }>(`/v1/packs/${encodeURIComponent(packId)}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }),
    bulkPacks: (ids: string[], action: BulkPackAction) =>
      call<{ updated: number }>("/v1/packs/bulk", { method: "POST", body: JSON.stringify({ ids, action }) }),

    /** Message center: recent generations of this device, newest first. */
    listNotifications: () => call<NotificationsResponse>("/v1/notifications"),
    /** Marks finished generations as seen. Without ids, all of them. */
    markNotificationsRead: (ids?: string[]) =>
      call<{ updated: number }>("/v1/notifications/read", { method: "POST", body: JSON.stringify(ids ? { ids } : {}) }),
    /** Removes finished generations from the message center. Without ids, all finished ones. */
    clearNotifications: (ids?: string[]) =>
      call<{ updated: number }>("/v1/notifications/clear", { method: "POST", body: JSON.stringify(ids ? { ids } : {}) }),

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
