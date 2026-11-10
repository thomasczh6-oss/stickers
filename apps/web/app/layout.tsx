import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import { I18nProvider } from "@/components/i18n";
import { LanguagePicker } from "@/components/language-picker";
import { SITE_URL } from "@/lib/env";
import { getI18n } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-bricolage", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await getI18n();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: m.web.meta.title, template: "%s · Stickers AI" },
    description: m.web.meta.description,
    openGraph: { images: ["/og.png"], type: "website", siteName: "Stickers AI", locale },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export const viewport: Viewport = { themeColor: "#fffaf3" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, m } = await getI18n();
  const nav = m.web.nav;
  return (
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <I18nProvider locale={locale}>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
              <img src="/icon.png" alt="" width={32} height={32} className="rounded-[9px]" />
              Stickers AI
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium text-muted sm:gap-2">
              <Link href="/#examples" className="hidden rounded-full px-3 py-2 whitespace-nowrap hover:text-ink lg:block">
                {nav.examples}
              </Link>
              <Link href="/#faq" className="hidden rounded-full px-3 py-2 whitespace-nowrap hover:text-ink lg:block">
                {nav.faq}
              </Link>
              <Link href="/my" className="hidden rounded-full px-3 py-2 whitespace-nowrap hover:text-ink md:block">
                {nav.myPacks}
              </Link>
              {/* No room on phones; the footer has the picker too. */}
              <LanguagePicker compact className="hidden sm:inline-flex" />
              <Link href="/create" className="ml-1 rounded-full bg-ink px-4 py-2 font-semibold whitespace-nowrap text-white transition hover:bg-ink/85">
                {nav.makeStickers}
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
              <p className="mt-3 max-w-sm">{m.web.footer}</p>
            </div>
            <div className="grid content-start gap-5 md:justify-items-end">
              <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium">
                <Link href="/create" className="hover:text-ink">
                  {nav.create}
                </Link>
                <Link href="/my" className="hover:text-ink">
                  {nav.myPacks}
                </Link>
                <Link href="/privacy" className="hover:text-ink">
                  {nav.privacy}
                </Link>
                <Link href="/terms" className="hover:text-ink">
                  {nav.terms}
                </Link>
              </nav>
              <LanguagePicker />
            </div>
          </div>
        </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
