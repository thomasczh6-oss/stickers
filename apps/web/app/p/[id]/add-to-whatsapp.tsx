"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
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
    <div className="sticky top-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-violet-100">
      <h2 className="text-lg font-black">Add to WhatsApp</h2>
      {platform === "desktop" ? (
        <>
          <p className="mt-2 text-sm text-violet-950/70">Scan with your phone camera to open this pack in the Stickers AI app, then tap Add.</p>
          <div className="mt-5 grid place-items-center rounded-2xl bg-violet-50 p-5">
            <QRCodeSVG value={pageUrl} size={200} bgColor="transparent" fgColor="#1f1235" level="M" />
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-violet-950/70">WhatsApp adds sticker packs through our free app. It opens right on this pack.</p>
          <button onClick={open} className="mt-5 w-full rounded-full bg-gradient-to-r from-brand to-brand-2 px-6 py-3.5 font-bold text-white">
            Open in the app
          </button>
          {tried && (
            <p className="mt-4 text-sm text-violet-950/70">
              Nothing happened?{" "}
              {storeUrl ? (
                <a href={storeUrl} className="font-semibold text-brand underline">
                  Get the app
                </a>
              ) : (
                "The app is coming soon to the App Store and Google Play."
              )}
            </p>
          )}
        </>
      )}
      <ol className="mt-6 grid gap-2 text-xs text-violet-950/60">
        <li>1. Open the pack in the Stickers AI app.</li>
        <li>2. Tap “Add to WhatsApp” and confirm.</li>
        <li>3. Find it in WhatsApp under the sticker tab.</li>
      </ol>
    </div>
  );
}
