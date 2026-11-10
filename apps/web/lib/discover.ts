import { type DiscoverItem, getDiscoverMessages, type StickerPack } from "@stickers/shared";
import { API_INTERNAL_BASE_URL } from "./env";
import { getI18n } from "./i18n";

/** Loads one public Discover pack on the server (for the page and its link preview). */
export async function loadDiscoverItem(id: string): Promise<{ item: DiscoverItem; pack: StickerPack } | undefined> {
  const res = await fetch(`${API_INTERNAL_BASE_URL}/v1/discover/${encodeURIComponent(id)}`, { next: { revalidate: 60 } });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`discover ${id}: HTTP ${res.status}`);
  return (await res.json()) as { item: DiscoverItem; pack: StickerPack };
}

/** Discover text plus the main messages, for server components. */
export async function getDiscoverI18n() {
  const i = await getI18n();
  return { ...i, d: getDiscoverMessages(i.locale) };
}
