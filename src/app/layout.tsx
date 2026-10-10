import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Outfit } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

// Geometric sans for the wordmark only.
const logo = Outfit({ subsets: ["latin"], weight: ["600"], variable: "--font-logo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Alimea", template: "%s · Alimea" },
  description: "Produtividade clínica para nutricionistas",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#222122",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale().catch(() => "pt-PT");
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable} ${logo.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
