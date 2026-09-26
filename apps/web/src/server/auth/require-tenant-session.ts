import "server-only";

import { cache } from "react";
import type { Session } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";

/**
 * ORQ-36 — second-layer (defense-in-depth) session + tenant guard for the
 * staff `(tenant)/[slug]/(app)/**` surface.
 *
 * `apps/web/src/middleware.ts` is the PRIMARY gate. Server pages under (app)
 * read Prisma directly by URL slug, so any middleware gap (matcher miss, a
 * public-path collision like ORQ-35) would expose tenant data. This helper
 * re-runs the SAME policy inside the render, close to the data source, as the
 * Next.js auth guide prescribes: layouts don't re-render on client navigation
 * and don't stop sibling segments from rendering, so every direct-DB page
 * calls this itself (the (app) layout calls it too). It is NOT new policy —
 * it mirrors middleware.ts branch-for-branch, in the same order:
 *
 *   1. no session                         → /login
 *   2. SESSION_INVALIDATED                → /login?error=session_expired
 *   3. customer (portal) principal        → /{slug}/portal   (principal isolation)
 *   4. URL slug "demo"                    → allow any authenticated staff
 *   5. session tenant ≠ URL slug          → notFound()   (middleware redirects to the
 *                                           caller's own dashboard; here we 404 so a
 *                                           bypass never confirms a tenant exists)
 *   6. tenantIsActive === false           → /login?error=tenant_suspended
 *
 * Deliberate fail-closed deltas (unreachable for real sessions — config.ts
 * always stamps id + tenantSlug on a staff session): missing user id → /login,
 * missing/empty tenantSlug → notFound(). Platform Owner gets NO cross-tenant
 * exemption because middleware grants none (its session is bound to the tenant
 * it signed into).
 *
 * The returned context is read from the SERVER session, never from params.
 * Note: on the demo slug, `tenantId` is the caller's own tenant, not demo's —
 * pages keep resolving the rendered tenant by URL slug exactly as before.
 */

export interface TenantSessionContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  roleId: string;
  isDemoTenant: boolean;
  /** The URL slug that was verified against the session. */
  urlSlug: string;
}

export type TenantSessionDecision =
  | { kind: "redirect"; url: string }
  | { kind: "notFound" }
  | { kind: "allow"; context: TenantSessionContext };

type SessionLike =
  | (Partial<Omit<Session, "user">> & {
      error?: string;
      principalType?: "staff" | "customer";
      user?: Partial<Session["user"]> & { tenantIsActive?: boolean; error?: string };
    })
  | null
  | undefined;

/** Pure decision logic — unit-testable without mocking next/navigation. */
export function resolveTenantSessionDecision(
  session: SessionLike,
  urlSlug: string,
): TenantSessionDecision {
  if (session === null || session === undefined || session.user === undefined) {
    return { kind: "redirect", url: "/login" };
  }

  if (session.error === "SESSION_INVALIDATED" || session.user.error === "SESSION_INVALIDATED") {
    return { kind: "redirect", url: "/login?error=session_expired" };
  }

  // Principal isolation — runs before the demo fast-path, as in middleware.
  if (session.principalType === "customer") {
    return { kind: "redirect", url: `/${urlSlug}/portal` };
  }

  const userId = session.user.id;
  if (typeof userId !== "string" || userId === "") {
    return { kind: "redirect", url: "/login" };
  }

  const sessionSlug = session.user.tenantSlug;
  if (urlSlug !== "demo") {
    if (typeof sessionSlug !== "string" || sessionSlug === "" || sessionSlug !== urlSlug) {
      return { kind: "notFound" };
    }
    if (session.user.tenantIsActive === false) {
      return { kind: "redirect", url: "/login?error=tenant_suspended" };
    }
  }

  return {
    kind: "allow",
    context: {
      userId,
      tenantId: session.user.tenantId ?? "",
      tenantSlug: sessionSlug ?? "",
      roles: session.user.roles ?? [],
      roleId: session.user.roleId ?? "",
      isDemoTenant: session.user.isDemoTenant === true,
      urlSlug,
    },
  };
}

/**
 * Verify the current request's session may render the staff (app) surface for
 * `urlSlug`. Redirects / 404s (never returns) on denial. Wrapped in React
 * `cache()` so the layout + page + generateMetadata share one auth() per request.
 */
export const requireTenantSession = cache(
  async (urlSlug: string): Promise<TenantSessionContext> => {
    const session = (await auth()) as SessionLike;
    const decision = resolveTenantSessionDecision(session, urlSlug);
    if (decision.kind === "redirect") {
      redirect(decision.url);
    }
    if (decision.kind === "notFound") {
      notFound();
    }
    return decision.context;
  },
);
