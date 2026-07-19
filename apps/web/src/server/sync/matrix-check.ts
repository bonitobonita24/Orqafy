import { prisma, hasPermission } from "@orqafy/db";
import type { FeatureKey, PermissionAction } from "@orqafy/shared/rbac";

export interface MatrixGrantArgs {
  tenantId: string;
  roleId: string;
  feature: FeatureKey;
  action: PermissionAction;
}

/**
 * Callable RBAC grant check usable OUTSIDE a tRPC procedure (mobile-sync
 * Route Handler and any other non-tRPC surface). Wraps the SAME
 * `hasPermission` matrix resolver that `matrixMiddleware`
 * (apps/web/src/server/trpc/middleware/matrix.ts) composes into every
 * tRPC procedure, so the REST sync surface and the tRPC surface enforce
 * IDENTICAL RBAC decisions from one matrix (tenant-rbac-standard.md §4 —
 * "matrix-driven enforcement, 3 surfaces"). `tenantId`/`roleId` MUST come
 * from a server-resolved auth context (never from the request body) —
 * see requireMobileBearer, which always re-derives them from the DB.
 */
export async function checkMatrixGrant(args: MatrixGrantArgs): Promise<boolean> {
  return hasPermission(prisma, args);
}
