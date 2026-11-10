"use client";

import { fmt, hoursUntil, type Usage } from "@stickers/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "./i18n";

/** Free packs left today for this browser, with a link to the plans. */
export function UsageCard({ pricingLink = true }: { pricingLink?: boolean }) {
  const { m } = useI18n();
  const [usage, setUsage] = useState<Usage>();
  useEffect(() => {
    api()
      .getUsage()
      .then((r) => setUsage(r.usage))
      .catch(() => undefined);
  }, []);
  const unlimited = usage && (usage.plan === "pro" || usage.limit <= 0);
  const pct = usage && !unlimited ? (usage.remaining / usage.limit) * 100 : 100;
  return (
    <div className="rounded-[24px] border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          {!usage ? "…" : unlimited ? m.usage.unlimited : usage.remaining > 0 ? fmt(m.usage.left, { n: usage.remaining, max: usage.limit }) : m.usage.none}
        </div>
        {pricingLink && (
          <Link href="/pricing" className="shrink-0 text-sm font-semibold underline underline-offset-4">
            {m.settings.pricing}
          </Link>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {usage && !unlimited && usage.used > 0 && <p className="mt-2 text-sm text-muted">{fmt(m.usage.resets, { h: hoursUntil(usage.resetsAt) })}</p>}
    </div>
  );
}
