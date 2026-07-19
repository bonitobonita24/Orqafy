// Shared mobile bearer-context resolver for non-tRPC surfaces (mobile-sync
// Route Handler). Non-tRPC endpoints must do their own auth (security.md
// L11 — "// Non-tRPC: manual auth required").
//
// This mirrors `resolveMobileBearerContext` in
// `apps/web/src/server/trpc/context.ts` EXACTLY: verify the bearer access
// token (server/auth/mobile-bearer.ts -> server/auth/mobile-jwt.ts, signed
// with the DEDICATED MOBILE_JWT_SECRET — never AUTH_SECRET), then
// re-resolve tenant/role fresh from the DB by userId. This is the SAME
// staleness contract the web session() callback and the tRPC bearer path
// use: a deactivated user or a stale `securityVersion` (role/tenant/
// password changed since the token was minted) is treated as
// unauthenticated. Kept as a small dedicated helper (rather than exporting
// context.ts's tRPC-shaped function) so the sync route never depends on
// `TRPCContext`/`NextAuth Session` typing it doesn't need.
import type { NextRequest } from "next/server";
import { prisma } from "@orqafy/db";
import { requireMobileBearer } from "@/server/auth/mobile-bearer";

export interface SyncBearerContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  roleId: string;
  roles: string[];
  isDemoTenant: boolean;
}

/**
 * Verifies the request's `Authorization: Bearer <jwt>` header and
 * re-derives tenant/role/roles/isDemoTenant fresh from the DB. Returns
 * `null` (never throws) on ANY failure — missing/malformed header,
 * invalid/expired JWT, deactivated user, or stale securityVersion — so the
 * caller always maps it to a generic 401.
 */
export async function resolveSyncBearerContext(
  req: NextRequest,
): Promise<SyncBearerContext | null> {
  const payload = await requireMobileBearer(req);
  if (payload === null) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { securityVersion: true, isActive: true, roleId: true },
  });
  if (
    dbUser === null ||
    !dbUser.isActive ||
    dbUser.securityVersion !== payload.securityVersion
  ) {
    return null;
  }

  // Same derivation the cookie path (verify-credentials.ts) and the tRPC
  // bearer path (server/trpc/context.ts) use.
  const isDemoTenant = payload.tenantSlug === "demo";

  return {
    userId: payload.userId,
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    roleId: dbUser.roleId,
    roles: payload.roles,
    isDemoTenant,
  };
}
