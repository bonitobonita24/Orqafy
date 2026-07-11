import "server-only";

import { redirect } from "next/navigation";
import { prisma, hasPermission } from "@orqafy/db";
import type { FeatureKey, PermissionAction } from "@orqafy/shared/rbac";
import { auth } from "@/server/auth";

/**
 * Matrix-driven route-level deny-by-default — surface 2 of 3
 * (tenant-rbac-standard.md §4). Surface 1 is the tRPC `matrixProcedure`
 * (apps/web/src/server/trpc/middleware/matrix.ts); surface 3 is nav
 * filtering. This is the App Router server-component enforcement: call
 * `guardPage()` at the top of a server layout/page under
 * `app/(tenant)/[slug]/(app)/<feature>/` to gate the whole route on the
 * same (feature, action) grant the tRPC surface checks.
 *
 * Deliberately does NOT touch `apps/web/src/middleware.ts` — the edge
 * auth/tenant-slug guard (unauthenticated → /login, session-invalidated →
 * /login, cross-tenant slug → own tenant) stays exactly as-is. By the time
 * a page under (tenant)/[slug]/(app)/ renders, middleware has already
 * guaranteed a valid, non-invalidated session whose tenantSlug matches the
 * URL slug — the branches below are defense-in-depth, not the primary gate.
 */

export interface GuardPageSessionInput {
  userId: string | null;
  tenantId: string | null;
  roleId: string | null;
  sessionInvalidated: boolean;
}

export type GuardPageDecision =
  | { kind: "redirect"; url: string }
  | { kind: "allow" };

/**
 * Pure decision logic, extracted so it is unit-testable without mocking
 * `next/navigation`'s `redirect()`, `auth()`, or Prisma. `guardPage()` below
 * resolves `session` + `allowed` (via `hasPermission`) then defers the
 * redirect-or-allow call to this function.
 *
 * - No session / invalidated session → redirect to `/login` (matches the
 *   middleware's own login-redirect pattern; belt-and-suspenders).
 * - Session present but the matrix denies → redirect to the tenant
 *   dashboard with `?denied=<feature>` (Ruling Q-R1) so the dashboard can
 *   surface a toast/flash for the blocked feature.
 * - Allowed → render the page.
 */
export function resolveGuardDecision(
  session: GuardPageSessionInput,
  allowed: boolean,
  slug: string,
  feature: FeatureKey,
): GuardPageDecision {
  if (session.userId === null || session.sessionInvalidated) {
    return { kind: "redirect", url: "/login" };
  }
  if (!allowed) {
    return { kind: "redirect", url: `/${slug}/dashboard?denied=${feature}` };
  }
  return { kind: "allow" };
}

/**
 * Server-only page guard. Never trust a client-sent role — `roleId` and
 * `tenantId` are always read from the server session, never from route
 * params or input. `action` defaults to `"view"` since page-level guards
 * gate whether the route renders at all.
 */
export async function guardPage(
  slug: string,
  feature: FeatureKey,
  action: PermissionAction = "view",
): Promise<void> {
  const session = await auth();

  const sessionInput: GuardPageSessionInput = {
    userId: session?.user?.id ?? null,
    tenantId: session?.user?.tenantId ?? null,
    roleId: session?.user?.roleId ?? null,
    sessionInvalidated: session?.user?.error === "SESSION_INVALIDATED",
  };

  const canCheckMatrix =
    sessionInput.userId !== null &&
    !sessionInput.sessionInvalidated &&
    sessionInput.tenantId !== null &&
    sessionInput.roleId !== null;

  const allowed = canCheckMatrix
    ? await hasPermission(prisma, {
        tenantId: sessionInput.tenantId as string,
        roleId: sessionInput.roleId as string,
        feature,
        action,
      })
    : false;

  const decision = resolveGuardDecision(sessionInput, allowed, slug, feature);
  if (decision.kind === "redirect") {
    redirect(decision.url);
  }
}
