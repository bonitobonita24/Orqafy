import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { hasPermission } from '../has-permission';

/**
 * Minimal hand-rolled prisma stub — packages/db has no existing test-mock
 * pattern yet. Only the two model methods has-permission touches are
 * implemented; everything else is intentionally absent.
 */
function makePrismaStub(overrides: {
  role?: unknown;
  matrixRow?: unknown;
}): PrismaClient {
  return {
    role: {
      findFirst: vi.fn().mockResolvedValue(overrides.role ?? null),
    },
    rolePermission: {
      findUnique: vi.fn().mockResolvedValue(overrides.matrixRow ?? null),
    },
  } as unknown as PrismaClient;
}

const TENANT_ID = 'tenant_1';
const ROLE_ID = 'role_1';

describe('hasPermission', () => {
  it('bypasses the matrix for Platform Owner even with no matrix rows', async () => {
    const prisma = makePrismaStub({
      role: { id: ROLE_ID, tenantId: TENANT_ID, name: 'Platform Owner' },
      matrixRow: null,
    });

    await expect(
      hasPermission(prisma, { tenantId: TENANT_ID, roleId: ROLE_ID, feature: 'billing', action: 'delete' }),
    ).resolves.toBe(true);
  });

  it('bypasses the matrix for Tenant Super Admin even with no matrix rows', async () => {
    const prisma = makePrismaStub({
      role: { id: ROLE_ID, tenantId: TENANT_ID, name: 'Tenant Super Admin' },
      matrixRow: null,
    });

    await expect(
      hasPermission(prisma, { tenantId: TENANT_ID, roleId: ROLE_ID, feature: 'users', action: 'view' }),
    ).resolves.toBe(true);
  });

  it('returns false for an unknown roleId', async () => {
    const prisma = makePrismaStub({ role: null });

    await expect(
      hasPermission(prisma, { tenantId: TENANT_ID, roleId: 'does-not-exist', feature: 'invoices', action: 'view' }),
    ).resolves.toBe(false);
  });

  it('returns false (deny-by-default) when the role exists but has no matrix row for the feature', async () => {
    const prisma = makePrismaStub({
      role: { id: ROLE_ID, tenantId: TENANT_ID, name: 'Admin' },
      matrixRow: null,
    });

    await expect(
      hasPermission(prisma, { tenantId: TENANT_ID, roleId: ROLE_ID, feature: 'invoices', action: 'view' }),
    ).resolves.toBe(false);
  });

  it('resolves each CRUD field independently from the matrix row', async () => {
    const prisma = makePrismaStub({
      role: { id: ROLE_ID, tenantId: TENANT_ID, name: 'Admin' },
      matrixRow: {
        tenantId: TENANT_ID,
        roleId: ROLE_ID,
        featureKey: 'invoices',
        view: true,
        create: false,
        update: true,
        delete: false,
      },
    });

    const args = { tenantId: TENANT_ID, roleId: ROLE_ID, feature: 'invoices' as const };
    await expect(hasPermission(prisma, { ...args, action: 'view' })).resolves.toBe(true);
    await expect(hasPermission(prisma, { ...args, action: 'create' })).resolves.toBe(false);
    await expect(hasPermission(prisma, { ...args, action: 'update' })).resolves.toBe(true);
    await expect(hasPermission(prisma, { ...args, action: 'delete' })).resolves.toBe(false);
  });

  it('returns false when the role belongs to a different tenant', async () => {
    // role.findFirst is scoped by { id, tenantId } — a role from another
    // tenant simply will not match and prisma returns null. The mock is
    // captured in its own variable (rather than read off `prisma.role`)
    // to avoid an unbound-method reference to a typed PrismaClient method.
    const findFirstMock = vi.fn().mockResolvedValue(null);
    const prisma = {
      role: { findFirst: findFirstMock },
      rolePermission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    await expect(
      hasPermission(prisma, { tenantId: 'other_tenant', roleId: ROLE_ID, feature: 'invoices', action: 'view' }),
    ).resolves.toBe(false);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: ROLE_ID, tenantId: 'other_tenant' },
    });
  });
});
