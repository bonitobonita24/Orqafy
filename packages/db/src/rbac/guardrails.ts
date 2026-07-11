import type { FeatureKey } from '@orqafy/shared/rbac' with { 'resolution-mode': 'import' };

/**
 * A role's permission matrix — one row per feature, strict CRUD split
 * (view / create / update / delete) per tenant-rbac-standard.md §4.
 */
export type PermissionMatrix = Array<{
  featureKey: FeatureKey;
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}>;

/**
 * Stable error codes thrown by the RBAC guardrail validators below.
 * The tRPC layer maps these to TRPCError codes.
 */
export type RbacGuardrailErrorCode =
  | 'FORBIDDEN_FEATURE'
  | 'EXCEEDS_CEILING'
  | 'NOT_ROLE_MANAGER'
  | 'SYSTEM_ROLE_IMMUTABLE';

export class RbacGuardrailError extends Error {
  code: RbacGuardrailErrorCode;

  constructor(code: RbacGuardrailErrorCode, message: string) {
    super(message);
    this.name = 'RbacGuardrailError';
    this.code = code;
  }
}

const FORBIDDEN_FEATURE_KEYS: readonly FeatureKey[] = ['users', 'billing'];

/**
 * Custom roles may NEVER grant Billing or User-Management — those stay
 * exclusive to Tenant Super Admin (+ platform Platform Owner).
 */
export function assertNoForbiddenFeatures(perms: PermissionMatrix): void {
  const violation = perms.find(
    (row) =>
      FORBIDDEN_FEATURE_KEYS.includes(row.featureKey) &&
      (row.view || row.create || row.update || row.delete),
  );

  if (violation) {
    throw new RbacGuardrailError(
      'FORBIDDEN_FEATURE',
      `Custom roles may never grant access to the "${violation.featureKey}" feature (Billing and User Management are reserved for Tenant Super Admin / Platform Owner).`,
    );
  }
}

/**
 * A custom role's matrix must be strictly ≤ the Admin ceiling — never
 * exceeding what the Admin role may do, per feature and per action.
 */
export function assertWithinAdminCeiling(
  candidate: PermissionMatrix,
  adminCeiling: PermissionMatrix,
): void {
  const ceilingByFeature = new Map(adminCeiling.map((row) => [row.featureKey, row]));

  for (const row of candidate) {
    const ceiling = ceilingByFeature.get(row.featureKey);

    const exceeds =
      (row.view && ceiling?.view !== true) ||
      (row.create && ceiling?.create !== true) ||
      (row.update && ceiling?.update !== true) ||
      (row.delete && ceiling?.delete !== true);

    if (exceeds) {
      throw new RbacGuardrailError(
        'EXCEEDS_CEILING',
        `Custom role grants permissions on "${row.featureKey}" that exceed the Admin ceiling.`,
      );
    }
  }
}

/**
 * Only Tenant Super Admin (+ platform Platform Owner) may create, edit,
 * or assign custom roles.
 */
export function assertCanManageRoles(actorRoleName: string): void {
  const allowed = actorRoleName === 'Tenant Super Admin' || actorRoleName === 'Platform Owner';

  if (!allowed) {
    throw new RbacGuardrailError(
      'NOT_ROLE_MANAGER',
      'Only Tenant Super Admin or Platform Owner may manage custom roles.',
    );
  }
}

const SYSTEM_ROLE_NAMES = ['Platform Owner', 'Tenant Super Admin', 'Admin'] as const;

/**
 * The 3 fixed system-tier roles can never be matrix-edited.
 */
export function assertSystemRoleImmutable(role: { name: string; isSystem?: boolean }): void {
  const isFixedTier = (SYSTEM_ROLE_NAMES as readonly string[]).includes(role.name);

  if (isFixedTier || role.isSystem === true) {
    throw new RbacGuardrailError(
      'SYSTEM_ROLE_IMMUTABLE',
      `The "${role.name}" role is a fixed system role and cannot be matrix-edited.`,
    );
  }
}
