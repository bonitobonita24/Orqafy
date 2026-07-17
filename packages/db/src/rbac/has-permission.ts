import type { PrismaClient } from '@prisma/client';
import type { FeatureKey, PermissionAction } from '@orqafy/shared/rbac' with { 'resolution-mode': 'import' };

/**
 * Role display names that bypass the data-driven permission matrix entirely
 * (tenant-rbac-standard.md §1/§4 — the fixed top-tier system roles). These
 * are the ONLY two names that bypass; every other role (including the
 * "Admin" system role) is resolved from the `role_permissions` matrix,
 * deny-by-default.
 */
const MATRIX_BYPASS_ROLE_NAMES: readonly string[] = [
  'Platform Owner',
  'Tenant Super Admin',
];

/**
 * Maps a PermissionAction to its RolePermission boolean column.
 */
function actionToField(action: PermissionAction): 'view' | 'create' | 'update' | 'delete' {
  return action;
}

export interface HasPermissionArgs {
  tenantId: string;
  roleId: string;
  feature: FeatureKey;
  action: PermissionAction;
}

/**
 * RBAC matrix resolver (tenant-rbac-standard.md §4). Deny-by-default: a
 * missing role, a role in a different tenant, or a missing matrix row all
 * resolve to `false`. Never trust a client-sent role — always resolve from
 * the DB by roleId.
 *
 * `Platform Owner` and `Tenant Super Admin` bypass the matrix entirely
 * (full access ceiling) — every other role (including "Admin") is resolved
 * from the `role_permissions` matrix row for (tenantId, roleId, feature).
 */
export async function hasPermission(
  prisma: PrismaClient,
  args: HasPermissionArgs,
): Promise<boolean> {
  const { tenantId, roleId, feature, action } = args;

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
  });
  if (!role) return false;

  if (MATRIX_BYPASS_ROLE_NAMES.includes(role.name)) return true;

  const matrixRow = await prisma.rolePermission.findUnique({
    where: {
      tenantId_roleId_featureKey: {
        tenantId,
        roleId,
        featureKey: feature,
      },
    },
  });
  if (!matrixRow) return false;

  return matrixRow[actionToField(action)];
}
