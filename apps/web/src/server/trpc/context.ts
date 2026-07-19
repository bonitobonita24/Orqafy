import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { requireMobileBearer } from "@/server/auth/mobile-bearer";

export type TRPCContext = {
  req: NextRequest;
  userId: string | null;
  roles: string[];
  // Optional (not required) so the ~40 existing router test-context literals
  // that predate the RBAC matrix (tenant-rbac-standard.md §4) keep type-checking
  // unmodified. matrixProcedure treats a missing roleId as deny-by-default.
  roleId?: string | null;
  tenantSlug: string | null;
  tenantId: string | null;
  securityVersion: number;
  isDemoTenant: boolean;
  session: Session | null;
};

/**
 * Mobile bearer-token auth source (Wave 2 — trpc-bearer). Verifies the
 * `Authorization: Bearer <jwt>` header via the Wave-1 mobile-JWT verifier
 * (server/auth/mobile-jwt.ts, unmodified here) and, on a structurally valid
 * token, re-validates against the DB — same staleness contract as the web
 * session() callback (config.ts): a deactivated user or a stale
 * securityVersion (role/tenant/password changed since the token was minted)
 * is treated as unauthenticated, never thrown at context-build time (that's
 * `protectedProcedure`'s job — see trpc.ts).
 *
 * Returns null (never throws) so the caller can fall through to the cookie
 * session path on any failure — malformed header, expired/invalid JWT,
 * deactivated user, or stale securityVersion.
 */
async function resolveMobileBearerContext(req: NextRequest): Promise<TRPCContext | null> {
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

  // Same derivation verify-credentials.ts uses for the cookie path.
  const isDemoTenant = payload.tenantSlug === "demo";

  return {
    req,
    userId: payload.userId,
    roles: payload.roles,
    roleId: dbUser.roleId,
    tenantSlug: payload.tenantSlug,
    tenantId: payload.tenantId,
    securityVersion: payload.securityVersion,
    isDemoTenant,
    session: null,
  };
}

export async function createTRPCContext({ req }: { req: NextRequest }): Promise<TRPCContext> {
  // Precedence: a valid mobile bearer token wins over a cookie session — the
  // mobile app is an API client with no browser cookie jar, and a bearer
  // header is never sent by the web client, so in practice at most one of
  // the two is ever present. Preferring bearer keeps mobile requests off the
  // (unrelated, cookie-only) NextAuth session path entirely.
  const bearerCtx = await resolveMobileBearerContext(req);
  if (bearerCtx !== null) return bearerCtx;

  const session = await auth();

  if (!session?.user || session.user.error === "SESSION_INVALIDATED") {
    return {
      req,
      userId: null,
      roles: [],
      roleId: null,
      tenantSlug: null,
      tenantId: null,
      securityVersion: 0,
      isDemoTenant: false,
      session: null,
    };
  }

  return {
    req,
    userId: session.user.id,
    roles: session.user.roles,
    roleId: session.user.roleId,
    tenantSlug: session.user.tenantSlug,
    tenantId: session.user.tenantId,
    securityVersion: session.user.securityVersion,
    isDemoTenant: session.user.isDemoTenant,
    session,
  };
}
