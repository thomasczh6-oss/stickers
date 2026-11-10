"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { APP_SCHEME, APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from "@/lib/env";

type Platform = "ios" | "android" | "desktop";

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/**
 * WhatsApp only accepts third-party sticker packs from an installed app, so the web
 * hands the pack to our mobile app: a deep link on phones, a QR code on desktop.
 */
export function AddToWhatsApp({ packId }: { packId: string }) {
  const { m } = useI18n();
  const t = m.web.pack;
  const [platform, setPlatform] = useState<Platform>();
  const [tried, setTried] = useState(false);
  useEffect(() => setPlatform(detect()), []);

  const pageUrl = `${SITE_URL}/p/${packId}`;
  const storeUrl = platform === "ios" ? APP_STORE_URL : platform === "android" ? PLAY_STORE_URL : "";

  const open = () => {
    setTried(true);
    window.location.href = `${APP_SCHEME}://pack/${packId}`;
  };

  return (
    <div className="rounded-[28px] border border-line bg-card p-6 shadow-[0_24px_60px_-36px_rgba(22,18,29,0.4)]">
      <h2 className="font-display text-2xl font-bold tracking-tight">{m.pack.addToWhatsApp}</h2>
      {platform === "desktop" ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.desktopBody}</p>
          <div className="mt-5 grid place-items-center rounded-[22px] bg-paper p-6">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={pageUrl} size={184} bgColor="#ffffff" fgColor="#16121d" level="M" />
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.mobileBody}</p>
          <button onClick={open} className="mt-5 w-full rounded-full bg-ink px-6 py-4 font-semibold text-white">
            {t.openInApp}
          </button>
          {tried && (
            <p className="mt-4 text-sm text-muted">
              {t.nothingHappened}{" "}
              {storeUrl ? (
                <a href={storeUrl} className="font-semibold text-ink underline underline-offset-4">
                  {t.getApp}
                </a>
              ) : (
                t.comingSoon
              )}
            </p>
          )}
        </>
      )}
      <ol className="mt-6 grid gap-3 text-sm">
        {t.steps.map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sun text-xs font-bold">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}
