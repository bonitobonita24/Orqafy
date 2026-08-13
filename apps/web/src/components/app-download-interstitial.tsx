"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Apple, Smartphone } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  shouldShowInterstitial,
  isMobileUserAgent,
  isWebViewUserAgent,
  DISMISS_STORAGE_KEY,
} from "@/lib/app-interstitial";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (raw === null || raw.length === 0) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // localStorage may be unavailable (private mode, disabled storage) —
    // fail safe by treating as never-dismissed rather than throwing.
    return null;
  }
}

function writeDismissedAt(now: number): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(now));
  } catch {
    // Storage write failure is non-fatal — worst case the prompt reappears
    // next visit, which is an acceptable degradation.
  }
}

/**
 * Full-screen, dismissible "Get the Orqafy app" prompt shown ONLY to real
 * mobile-web visitors (not desktop, not tablets at desktop width, not inside
 * a native WebView / in-app browser). Dismissal is remembered for 30 days
 * via localStorage so it never nags on every visit.
 *
 * Mount this ONCE in the authenticated app shell
 * (`app/(tenant)/[slug]/(app)/layout.tsx`) — it renders nothing when the
 * decision logic (`shouldShowInterstitial`) says not to show.
 */
export function AppDownloadInterstitial() {
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    // Runs once on mount, client-only — reads navigator/window which don't
    // exist during SSR.
    const ua = window.navigator.userAgent;
    const isMobileUA = isMobileUserAgent(ua);
    const isWebView = isWebViewUserAgent(ua);
    const viewportMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    const dismissedAt = readDismissedAt();

    const show = shouldShowInterstitial({
      isMobileUA,
      viewportMobile,
      isWebView,
      dismissedAt,
      now: Date.now(),
    });

    setOpen(show);
    setChecked(true);
  }, []);

  const dismiss = React.useCallback(() => {
    writeDismissedAt(Date.now());
    setOpen(false);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) dismiss();
    },
    [dismiss],
  );

  // Nothing to render until the client-only check has run (avoids a flash
  // on desktop / already-dismissed visits) and nothing to render once the
  // decision is "don't show".
  if (!checked || !open) return null;

  const androidUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? "";
  const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL ?? "";
  const hasAndroidUrl = androidUrl.length > 0;
  const hasIosUrl = iosUrl.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-100 bg-background" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-center",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
          onOpenAutoFocus={(e) => {
            // Let Radix's default focus-trap behavior run (focuses the
            // first focusable element) — no need to prevent default here.
            void e;
          }}
          aria-describedby="app-interstitial-description"
        >
          <DialogPrimitive.Title className="text-2xl font-semibold tracking-tight">
            Get the Orqafy app
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id="app-interstitial-description"
            className="max-w-sm text-sm text-muted-foreground"
          >
            For a faster, native experience on your phone, install the Orqafy
            app.
          </DialogPrimitive.Description>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <Button
              asChild={hasAndroidUrl}
              size="lg"
              className="h-12 w-full text-base"
              disabled={!hasAndroidUrl}
              onClick={hasAndroidUrl ? dismiss : undefined}
            >
              {hasAndroidUrl ? (
                <a href={androidUrl} target="_blank" rel="noopener noreferrer">
                  <Smartphone className="mr-2 h-5 w-5" aria-hidden="true" />
                  Get it on Google Play
                </a>
              ) : (
                <span>
                  <Smartphone className="mr-2 h-5 w-5" aria-hidden="true" />
                  Android app — coming soon
                </span>
              )}
            </Button>

            <Button
              asChild={hasIosUrl}
              size="lg"
              variant="outline"
              className="h-12 w-full text-base"
              disabled={!hasIosUrl}
              onClick={hasIosUrl ? dismiss : undefined}
            >
              {hasIosUrl ? (
                <a href={iosUrl} target="_blank" rel="noopener noreferrer">
                  <Apple className="mr-2 h-5 w-5" aria-hidden="true" />
                  Download on the App Store
                </a>
              ) : (
                <span>
                  <Apple className="mr-2 h-5 w-5" aria-hidden="true" />
                  iOS app — coming soon
                </span>
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-11 text-sm text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            Continue in browser
          </Button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
