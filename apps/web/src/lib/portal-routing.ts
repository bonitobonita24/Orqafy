// Portal route isolation between staff and customer principals (W1-T1.4).
// Extracted from middleware.ts so this decision is unit-testable without
// pulling next-auth + next/server side effects into vitest (mirrors the
// public-paths.ts extraction convention).

const PORTAL_PATH_RE = /^\/[^/]+\/portal(\/.*)?$/;

/** True for /{slug}/portal and every path beneath it. */
export function isPortalPath(pathname: string): boolean {
  return PORTAL_PATH_RE.test(pathname);
}

/**
 * Given an ALREADY-AUTHENTICATED request's pathname + tenant slug + the
 * session's principalType, returns the path to redirect to for staff/customer
 * route isolation, or null if the request may proceed as-is.
 *
 * Caller runs this AFTER the isPublic() short-circuit (portal login/accept
 * pages) and AFTER the unauth + cross-tenant-slug guards — it only isolates
 * already-authed, same-tenant traffic between the staff (app) surface and the
 * customer portal surface:
 *   - staff on a /{slug}/portal/* path            -> /{slug}/dashboard
 *   - customer on any NON /{slug}/portal/* path   -> /{slug}/portal
 *   - staff off-portal, or customer on-portal      -> null (proceed)
 */
export function resolvePrincipalIsolationRedirect(
  pathname: string,
  slug: string,
  principalType: "staff" | "customer" | undefined,
): string | null {
  const onPortalPath = isPortalPath(pathname);

  if (principalType === "customer") {
    return onPortalPath ? null : `/${slug}/portal`;
  }

  // "staff" is the default/omitted principalType (existing sessions).
  return onPortalPath ? `/${slug}/dashboard` : null;
}
