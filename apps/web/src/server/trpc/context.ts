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
  // Customer-portal discriminator (T1.2/T1.3). Defaults to "staff" so every
  // pre-existing context literal (bearer/unauthenticated/staff) keeps
  // type-checking and behaving unmodified. portalProcedure requires
  // "customer" + a non-null customerId; protectedProcedure/matrixProcedure
  // are unaffected by this field (a customer ctx still has userId: null).
  principalType?: "staff" | "customer";
  customerId?: string | null;
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
    // Mobile bearer auth is staff-only (Wave 2 — trpc-bearer predates the
    // customer portal); never a customer principal.
    principalType: "staff",
    customerId: null,
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

  const UNAUTHENTICATED_CTX: TRPCContext = {
    req,
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "staff",
    customerId: null,
  };

  if (!session?.user) {
    return UNAUTHENTICATED_CTX;
  }

  // Uniform invalidation guard (top-level `session.error`) — BOTH the staff
  // and customer session callbacks signal a revoked session via
  // `{ ...session, error: "SESSION_INVALIDATED" }` (config.ts). Reject it here,
  // before any principal branch, so an invalidated session can never fall
  // through to build a real ctx. (tRPC is excluded from the middleware
  // matcher, so this — not middleware — is the gate for /api/trpc.)
  if (session.error === "SESSION_INVALIDATED") {
    return UNAUTHENTICATED_CTX;
  }

  // Customer-portal principal — a SEPARATE branch from the staff check
  // below so the staff `session.user.error === "SESSION_INVALIDATED"` check
  // (unchanged) is never reached/altered for a customer session, and vice
  // versa. Portal invalidation is signaled via the TOP-LEVEL `session.error`
  // field (matches config.ts's `{ ...session, error: "SESSION_INVALIDATED" }`
  // for both branches — see config.ts session callback).
  if (session.principalType === "customer") {
    if (session.error === "SESSION_INVALIDATED") {
      return UNAUTHENTICATED_CTX;
    }
    return {
      req,
      userId: null,
      roles: [],
      roleId: null,
      tenantSlug: session.user.tenantSlug || null,
      tenantId: session.user.tenantId || null,
      securityVersion: 0,
      isDemoTenant: false,
      session,
      principalType: "customer",
      customerId: session.customerId ?? null,
    };
  }

  // Staff session — UNCHANGED check + shape.
  if (session.user.error === "SESSION_INVALIDATED") {
    return UNAUTHENTICATED_CTX;
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
    principalType: "staff",
    customerId: null,
  };
}
