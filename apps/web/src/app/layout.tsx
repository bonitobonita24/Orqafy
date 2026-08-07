import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Orqafy",
    template: "%s | Orqafy",
  },
  description: "Multi-tenant ERP platform for field operations, HR, inventory, and finance.",
  robots: { index: false, follow: false }, // internal tool — no public indexing
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
