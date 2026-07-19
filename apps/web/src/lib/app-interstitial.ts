/**
 * Mobile-web "Get the app" soft interstitial — pure decision logic.
 *
 * Kept dependency-free (no DOM/localStorage access here) so the show/hide
 * decision is fully unit-testable. The React component
 * (`components/app-download-interstitial.tsx`) is the only place that reads
 * `navigator`, `window.matchMedia`, and `localStorage`, and it delegates the
 * actual decision to `shouldShowInterstitial` below.
 */

/** Re-prompt window: don't nag more than once every 30 days. */
export const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage key used to persist the last-dismissed timestamp (ms epoch). */
export const DISMISS_STORAGE_KEY = "orqafy_app_interstitial_dismissed_at";

/**
 * Detects a real mobile browser (iOS or Android) from a User-Agent string.
 * Deliberately narrow — desktop UAs (including desktop Chrome device-toolbar
 * emulation, which does NOT change navigator.userAgent unless "mobile" is
 * explicitly toggled) must return false.
 */
export function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/**
 * Detects common in-app browser / WebView User-Agent markers so the
 * interstitial never shows inside a native WebView (e.g. our own future
 * mobile app's embedded browser, or social in-app browsers where "download
 * the app" prompts are broken/irrelevant).
 */
export function isWebViewUserAgent(ua: string): boolean {
  if (!ua) return false;
  const markers = [
    /; ?wv\)/i, // Android WebView marker
    /FBAN|FBAV/i, // Facebook in-app browser
    /Instagram/i, // Instagram in-app browser
    /Line\//i, // LINE in-app browser
    /MicroMessenger/i, // WeChat in-app browser
    /Twitter/i, // Twitter/X in-app browser
    /TikTok/i, // TikTok in-app browser
    /GSA\//i, // Google Search App in-app browser
    /OrqafyApp\//i, // reserved marker for our own future native app WebView
  ];
  return markers.some((re) => re.test(ua));
}

export interface ShouldShowInterstitialInput {
  /** navigator.userAgent looks like a real mobile browser (iOS/Android). */
  isMobileUA: boolean;
  /** window.matchMedia('(max-width: 767px)').matches — the actual viewport is mobile-sized. */
  viewportMobile: boolean;
  /** navigator.userAgent matches a known in-app/WebView marker. */
  isWebView: boolean;
  /** Epoch ms of the last dismissal, or null/undefined if never dismissed. */
  dismissedAt: number | null | undefined;
  /** Current time (epoch ms) — injected for deterministic testing. */
  now: number;
}

/**
 * Pure decision function: should the "Get the app" interstitial render?
 *
 * Rules (all must hold):
 *  - Looks like a genuine mobile browser (UA) AND the viewport is mobile-sized.
 *    Both signals are required so a desktop browser resized narrow, or a
 *    tablet UA at desktop width, doesn't trigger it.
 *  - NOT inside a WebView / in-app browser.
 *  - NOT dismissed within the last DISMISS_TTL_MS (30 days).
 */
export function shouldShowInterstitial(input: ShouldShowInterstitialInput): boolean {
  const { isMobileUA, viewportMobile, isWebView, dismissedAt, now } = input;

  if (!isMobileUA || !viewportMobile) return false;
  if (isWebView) return false;

  if (typeof dismissedAt === "number" && Number.isFinite(dismissedAt)) {
    const elapsed = now - dismissedAt;
    if (elapsed < DISMISS_TTL_MS) return false;
  }

  return true;
}
