import { describe, expect, it } from 'vitest';
import type { FeatureKey } from '@orqafy/shared/rbac';
import {
  assertCanManageRoles,
  assertNoForbiddenFeatures,
  assertSystemRoleImmutable,
  assertWithinAdminCeiling,
  type PermissionMatrix,
} from '../guardrails';

function row(
  featureKey: FeatureKey,
  overrides: Partial<{ view: boolean; create: boolean; update: boolean; delete: boolean }> = {},
) {
  return {
    featureKey,
    view: false,
    create: false,
    update: false,
    delete: false,
    ...overrides,
  };
}

describe('assertNoForbiddenFeatures', () => {
  it('rejects a matrix granting view on billing', () => {
    const perms: PermissionMatrix = [row('billing', { view: true })];
    expect(() => assertNoForbiddenFeatures(perms)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN_FEATURE' }),
    );
  });

  it('rejects a matrix granting any action on users', () => {
    const perms: PermissionMatrix = [row('users', { update: true })];
    expect(() => assertNoForbiddenFeatures(perms)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN_FEATURE' }),
    );
  });

  it('passes when billing/users rows exist but grant nothing', () => {
    const perms: PermissionMatrix = [row('billing'), row('users'), row('invoices', { view: true })];
    expect(() => assertNoForbiddenFeatures(perms)).not.toThrow();
  });
});

describe('assertWithinAdminCeiling', () => {
  const adminCeiling: PermissionMatrix = [
    row('invoices', { view: true, create: true, update: true, delete: false }),
    row('expenses', { view: true }),
  ];

  it('rejects a candidate that exceeds the ceiling on an allowed feature', () => {
    const candidate: PermissionMatrix = [row('invoices', { view: true, delete: true })];
    expect(() => assertWithinAdminCeiling(candidate, adminCeiling)).toThrowError(
      expect.objectContaining({ code: 'EXCEEDS_CEILING' }),
    );
  });

  it('rejects a candidate granting a feature the ceiling does not cover at all', () => {
    const candidate: PermissionMatrix = [row('payroll', { view: true })];
    expect(() => assertWithinAdminCeiling(candidate, adminCeiling)).toThrowError(
      expect.objectContaining({ code: 'EXCEEDS_CEILING' }),
    );
  });

  it('passes when the candidate is within the ceiling', () => {
    const candidate: PermissionMatrix = [
      row('invoices', { view: true, create: true }),
      row('expenses', { view: true }),
    ];
    expect(() => assertWithinAdminCeiling(candidate, adminCeiling)).not.toThrow();
  });
});

describe('assertCanManageRoles', () => {
  it('rejects a non-superadmin actor', () => {
    expect(() => assertCanManageRoles('Admin')).toThrowError(
      expect.objectContaining({ code: 'NOT_ROLE_MANAGER' }),
    );
  });

  it('passes for Tenant Super Admin', () => {
    expect(() => assertCanManageRoles('Tenant Super Admin')).not.toThrow();
  });

  it('passes for Platform Owner', () => {
    expect(() => assertCanManageRoles('Platform Owner')).not.toThrow();
  });
});

describe('assertSystemRoleImmutable', () => {
  it('rejects editing a fixed-tier role by name', () => {
    expect(() => assertSystemRoleImmutable({ name: 'Admin' })).toThrowError(
      expect.objectContaining({ code: 'SYSTEM_ROLE_IMMUTABLE' }),
    );
  });

  it('rejects editing a role flagged isSystem', () => {
    expect(() => assertSystemRoleImmutable({ name: 'Custom Ops', isSystem: true })).toThrowError(
      expect.objectContaining({ code: 'SYSTEM_ROLE_IMMUTABLE' }),
    );
  });

  it('passes for a valid narrow custom role', () => {
    expect(() => assertSystemRoleImmutable({ name: 'Warehouse Viewer' })).not.toThrow();
  });
});
