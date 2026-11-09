import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApiClient, type ApiClient } from "@stickers/shared";
import * as Crypto from "expo-crypto";
import { API_BASE_URL } from "./env";

const KEY = "stickers.deviceId";
let client: Promise<ApiClient> | undefined;

/** Anonymous id kept on this phone, so "My packs" works without an account. */
async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(KEY, id);
  return id;
}

export function api(): Promise<ApiClient> {
  client ??= deviceId().then((id) => createApiClient(API_BASE_URL, id));
  return client;
}
