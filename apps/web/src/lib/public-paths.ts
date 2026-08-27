// Public paths that never require auth.
// Extracted from middleware.ts so unit tests can import this helper
// without pulling next-auth + next/server side effects into vitest.

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/demo-login",
  "/privacy",
  "/api/health",
  "/api/auth",
  "/api/webhooks",
  "/_next",
  "/favicon.ico",
  // SEO infrastructure — crawlers must reach these without auth, else the
  // middleware 307-redirects them to /login and search engines never see the
  // robots directives or sitemap (Rule 35 SEO Foundation).
  "/robots.txt",
  "/sitemap.xml",
  // Demo storefront static assets (apps/web/public/demo/**, e.g. the Shopix
  // catalog photos seeded as /demo/shopix/... image URLs). Without this every
  // guest-visible product/brand/hero image 307-redirects to /login and the
  // storefront renders broken images for logged-out visitors + crawlers
  // (same omission class as the /{slug}/store 88190c4 fix).
  "/demo/shopix",
  // Public, token-authorised invoice view — /invoice/[token]. The token is
  // the sole authorisation (unguessable, opaque); the page itself sets
  // robots noindex,nofollow (D-4 Copy-share-link).
  "/invoice",
];

// Guest storefront — /{tenantSlug}/store(/...) — must be crawlable + usable
// without auth (guest cart, Turnstile guest checkout, order tracking) and
// its pages set robots index:true, else the middleware 307-redirects guests
// and crawlers to /login before they ever see the storefront (Rule 35 SEO
// Foundation / D-SEO 2026-08-08).
const STOREFRONT_PATH_RE = /^\/[^/]+\/store(\/.*)?$/;

// Customer-portal auth pages — /{tenantSlug}/portal/login + /{tenantSlug}/portal/accept
// must be reachable WITHOUT a session (a customer sets their password / signs in
// there). Every OTHER path under /{tenantSlug}/portal/* still requires auth —
// this regex intentionally does NOT match bare /{slug}/portal or any other
// /{slug}/portal/<sub> path (W1-T1.4).
const PORTAL_AUTH_PATH_RE = /^\/[^/]+\/portal\/(login|accept)(\/.*)?$/;

export function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return STOREFRONT_PATH_RE.test(pathname) || PORTAL_AUTH_PATH_RE.test(pathname);
}
