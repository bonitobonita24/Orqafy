import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Orqafy",
    template: "%s | Orqafy",
  },
  description:
    "Move as one — the all-in-one project & business operations platform for growing businesses.",
  // Fail-closed default: private/authed and utility routes inherit this unless
  // a route explicitly opts in to indexing (Scenario 44 / SEO Foundation).
  robots: { index: false, follow: false },
  openGraph: {
    siteName: "Orqafy",
    type: "website",
    locale: "en_US",
    title: "Orqafy",
    description:
      "Move as one — the all-in-one project & business operations platform for growing businesses.",
    // TODO(seo): add default OG image asset
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
