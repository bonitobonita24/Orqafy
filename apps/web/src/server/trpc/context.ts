import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/server/auth";

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

export async function createTRPCContext({ req }: { req: NextRequest }): Promise<TRPCContext> {
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
