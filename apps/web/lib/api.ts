"use client";

import { createApiClient, type ApiClient } from "@stickers/shared";
import { API_BASE_URL } from "./env";

const KEY = "stickers.deviceId";

/** Anonymous id kept in this browser, so "My packs" works without an account. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** After "Delete all my data": forget this browser's id so new packs start a fresh, empty history. */
export function resetDeviceId() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
  client = undefined;
}

let client: ApiClient | undefined;
export function api(): ApiClient {
  client ??= createApiClient(API_BASE_URL, getDeviceId());
  return client;
}
