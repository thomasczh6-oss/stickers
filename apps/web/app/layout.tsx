import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Stickers AI: make your own WhatsApp stickers", template: "%s · Stickers AI" },
  description: "Turn a selfie, your pet or any idea into an animated sticker pack for WhatsApp in about a minute.",
  openGraph: { images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#7c3aed" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <img src="/icon.png" alt="" width={32} height={32} className="rounded-lg" />
            Stickers AI
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-violet-900/70">
            <Link href="/#create" className="hover:text-violet-900">
              Create
            </Link>
            <Link href="/my" className="hover:text-violet-900">
              My packs
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-24">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-violet-900/50">
          Not affiliated with WhatsApp or Meta. Photos you upload are deleted as soon as your pack is made.
        </footer>
      </body>
    </html>
  );
}
