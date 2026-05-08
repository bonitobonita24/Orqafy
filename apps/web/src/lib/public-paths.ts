// Public paths that never require auth.
// Extracted from middleware.ts so unit tests can import this helper
// without pulling next-auth + next/server side effects into vitest.

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/demo-login",
  "/api/health",
  "/api/auth",
  "/api/webhooks",
  "/_next",
  "/favicon.ico",
];

export function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
