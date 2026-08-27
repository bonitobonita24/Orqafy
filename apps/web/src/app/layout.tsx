import type { Metadata } from "next";
import { Geist, Source_Serif_4, Source_Code_Pro } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

// shadcn/studio "orqafy" theme fonts. All three are variable fonts, so we omit
// the weight array (loads the full variable range at one file each) and keep
// subsets tight (latin/latin-ext) to protect LCP/CWV (Rule 35 SEO).
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
  preload: true,
});
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif-4",
  display: "swap",
});
const sourceCodePro = Source_Code_Pro({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-code-pro",
  display: "swap",
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
    <html
      lang="en"
      className={cn(
        geist.variable,
        sourceSerif4.variable,
        sourceCodePro.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
          {/* App-wide toast host — previously unmounted, so every toast.*()
              call (copy-link, portal invite, transfer-ownership, …) rendered
              nothing. Mounted here inside ThemeProvider so it's theme-aware. */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
