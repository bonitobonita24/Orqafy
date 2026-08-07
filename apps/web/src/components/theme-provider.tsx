"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * AdminCN Phase A2 — theme infrastructure.
 * Wraps next-themes with the app's locked defaults: class-based dark mode,
 * DARK as the default surface (preserves the pre-A2 look), system preference
 * disabled (the app deliberately ships one canonical dark theme + an explicit
 * light opt-in via ModeToggle, not OS-driven).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
