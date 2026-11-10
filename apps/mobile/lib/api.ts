import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApiClient, type ApiClient } from "@stickers/shared";
import * as Crypto from "expo-crypto";
import { API_BASE_URL } from "./env";

const KEY = "stickers.deviceId";
const SERVER_KEY = "stickers.apiBaseUrl";
let client: Promise<ApiClient> | undefined;

/** Anonymous id kept on this phone, so "My packs" works without an account. */
async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(KEY, id);
  return id;
}

/** The API server this app talks to: the one saved in Settings, else the build default. */
export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_KEY)) || API_BASE_URL;
}

/** Saves a server address (empty resets to the build default) and makes the next call use it. */
export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) await AsyncStorage.setItem(SERVER_KEY, clean);
  else await AsyncStorage.removeItem(SERVER_KEY);
  client = undefined;
}

/** Calls /health on a server; resolves to its description or throws a readable error. */
export async function checkServer(url: string): Promise<string> {
  const res = await fetch(`${url.trim().replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`The server answered HTTP ${res.status}`);
  const body = (await res.json()) as { ok?: boolean; model?: string };
  if (!body.ok) throw new Error("The server is not ready");
  return body.model ? `Connected · ${body.model}` : "Connected";
}

export function api(): Promise<ApiClient> {
  client ??= Promise.all([getServerUrl(), deviceId()]).then(([url, id]) => createApiClient(url, id));
  return client;
}
