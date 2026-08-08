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
];

export function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
