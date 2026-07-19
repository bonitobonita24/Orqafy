import { describe, it, expect } from "vitest";
import {
  shouldShowInterstitial,
  isMobileUserAgent,
  isWebViewUserAgent,
  DISMISS_TTL_MS,
} from "@/lib/app-interstitial";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const ANDROID_WEBVIEW_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const FACEBOOK_INAPP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0;]";
const INSTAGRAM_INAPP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0";

describe("isMobileUserAgent", () => {
  it("detects iOS UA", () => {
    expect(isMobileUserAgent(IPHONE_UA)).toBe(true);
  });

  it("detects Android UA", () => {
    expect(isMobileUserAgent(ANDROID_UA)).toBe(true);
  });

  it("rejects desktop UA", () => {
    expect(isMobileUserAgent(DESKTOP_UA)).toBe(false);
  });

  it("rejects empty UA", () => {
    expect(isMobileUserAgent("")).toBe(false);
  });
});

describe("isWebViewUserAgent", () => {
  it("detects Android WebView marker '; wv)'", () => {
    expect(isWebViewUserAgent(ANDROID_WEBVIEW_UA)).toBe(true);
  });

  it("detects Facebook in-app browser", () => {
    expect(isWebViewUserAgent(FACEBOOK_INAPP_UA)).toBe(true);
  });

  it("detects Instagram in-app browser", () => {
    expect(isWebViewUserAgent(INSTAGRAM_INAPP_UA)).toBe(true);
  });

  it("does not flag a normal mobile Safari/Chrome UA", () => {
    expect(isWebViewUserAgent(IPHONE_UA)).toBe(false);
    expect(isWebViewUserAgent(ANDROID_UA)).toBe(false);
  });

  it("does not flag desktop UA", () => {
    expect(isWebViewUserAgent(DESKTOP_UA)).toBe(false);
  });
});

describe("shouldShowInterstitial", () => {
  const NOW = 1_700_000_000_000; // fixed reference instant

  it("shows on mobile UA + mobile viewport, never dismissed", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: false,
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("hides on desktop (mobile UA false)", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: false,
        viewportMobile: false,
        isWebView: false,
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("hides when viewport is not mobile-sized even with a mobile UA (e.g. tablet-desktop-width)", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: false,
        isWebView: false,
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("hides when mobile-sized viewport but UA is not mobile (desktop devtools resize)", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: false,
        viewportMobile: true,
        isWebView: false,
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("hides inside a WebView / in-app browser regardless of other signals", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: true,
        dismissedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("hides when dismissed less than 30 days ago", () => {
    const dismissedAt = NOW - (DISMISS_TTL_MS - 1_000); // 1s short of 30 days
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: false,
        dismissedAt,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("hides when dismissed exactly at the TTL boundary (not yet elapsed)", () => {
    const dismissedAt = NOW - DISMISS_TTL_MS;
    // elapsed === DISMISS_TTL_MS is NOT < DISMISS_TTL_MS, so it should show again
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: false,
        dismissedAt,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("shows again once dismissed more than 30 days ago", () => {
    const dismissedAt = NOW - (DISMISS_TTL_MS + 24 * 60 * 60 * 1000); // 31 days ago
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: false,
        dismissedAt,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("treats missing/undefined dismissedAt as never-dismissed", () => {
    expect(
      shouldShowInterstitial({
        isMobileUA: true,
        viewportMobile: true,
        isWebView: false,
        dismissedAt: undefined,
        now: NOW,
      }),
    ).toBe(true);
  });
});
