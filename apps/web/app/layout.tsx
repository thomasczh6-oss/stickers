import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Stickers AI: animated WhatsApp stickers of you, made by AI", template: "%s · Stickers AI" },
  description: "Turn a selfie, your pet or any idea into an animated sticker pack for WhatsApp in about a minute. No sign-up needed.",
  openGraph: { images: ["/og.png"], type: "website", siteName: "Stickers AI" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#fffaf3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
              <img src="/icon.png" alt="" width={32} height={32} className="rounded-[9px]" />
              Stickers AI
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium text-muted sm:gap-2">
              <Link href="/#examples" className="hidden rounded-full px-3 py-2 hover:text-ink sm:block">
                Examples
              </Link>
              <Link href="/#faq" className="hidden rounded-full px-3 py-2 hover:text-ink sm:block">
                FAQ
              </Link>
              <Link href="/my" className="hidden rounded-full px-3 py-2 hover:text-ink sm:block">
                My packs
              </Link>
              <Link href="/create" className="ml-1 rounded-full bg-ink px-4 py-2 font-semibold whitespace-nowrap text-white transition hover:bg-ink/85">
                Make stickers
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5">{children}</main>
        <footer className="mt-24 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-sm text-muted md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
                <img src="/icon.png" alt="" width={24} height={24} className="rounded-md" />
                Stickers AI
              </div>
              <p className="mt-3 max-w-sm">
                Animated stickers of you, your pet or anything you can imagine. Stickers AI is an independent app and is not affiliated with
                WhatsApp or Meta.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium">
              <Link href="/create" className="hover:text-ink">
                Create
              </Link>
              <Link href="/my" className="hover:text-ink">
                My packs
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
