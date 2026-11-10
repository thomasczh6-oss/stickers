import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/create", "/help", "/pricing", "/privacy", "/terms", "/delete-data", "/imprint"].map((p) => ({ url: `${SITE_URL}${p}` }));
}
