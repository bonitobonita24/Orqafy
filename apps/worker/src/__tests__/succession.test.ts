/**
 * Integration test: two-way tenant-owner succession (tenant-rbac-3tier Wave B)
 *
 * Verifies:
 *   1. one_tenant_owner_per_tenant partial-unique index rejects a second owner
 *   2. transferTenantOwnership — in-tenant owner→owner handoff (mediated, index-safe)
 *   3. reassignTenantOwner — platform break-glass reassign, incl. NOT_FOUND on a bad tenantId
 *
 * Requires: live PostgreSQL (DATABASE_URL) in env.
 * Run against dev stack: bash deploy/compose/start.sh dev up -d
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  prisma,
  toSchemaName,
  provisionTenantRolesAndOwner,
  transferTenantOwnership,
  reassignTenantOwner,
} from '@orqafy/db';

const TEST_SLUG = 'inttest-succession-co';
const TEST_SCHEMA = toSchemaName(TEST_SLUG);
const OWNER_EMAIL = 'owner@inttest-succession-co.local';
const OTHER_EMAIL = 'other@inttest-succession-co.local';
const THIRD_EMAIL = 'third@inttest-succession-co.local';

async function cleanupTenant(tenantId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

describe('tenant-owner succession', () => {
  let tenantId: string;
  let ownerUserId: string;
  let otherUserId: string;

  beforeAll(async () => {
    // Clean slate from any prior aborted run.
    const stale = await prisma.tenant.findUnique({ where: { slug: TEST_SLUG } });
    if (stale !== null) {
      await cleanupTenant(stale.id);
    }

    const tenant = await prisma.tenant.create({
      data: {
        slug: TEST_SLUG,
        name: 'Integration Test Succession Co',
        schemaName: TEST_SCHEMA,
        status: 'active',
      },
    });
    tenantId = tenant.id;

    // Seed the standard role set + create the owner user (isTenantOwner: true).
    const { ownerUserId: createdOwnerId } = await provisionTenantRolesAndOwner(prisma, {
      tenantId,
      ownerEmail: OWNER_EMAIL,
      ownerName: 'Integration Test Owner',
      ownerPassword: 'PlaceholderTestPassword123!',
    });
    ownerUserId = createdOwnerId;

    // A second, non-owner user in the same tenant (Admin role) to transfer to.
    const adminRole = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'admin' } },
    });
    if (adminRole === null) throw new Error('admin role not seeded');

    const passwordHash = await bcrypt.hash('PlaceholderTestPassword123!', 10);
    const other = await prisma.user.create({
      data: {
        email: OTHER_EMAIL,
        passwordHash,
        firstName: 'Other',
        lastName: 'User',
        displayName: 'Other User',
        roleId: adminRole.id,
        tenantId,
        isActive: true,
        securityVersion: 1,
        isTenantOwner: false,
      },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: THIRD_EMAIL } });
    await cleanupTenant(tenantId);
    await prisma.$disconnect();
  });

  it('rejects a second isTenantOwner=true user in the same tenant (partial-unique index)', async () => {
    const adminRole = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'admin' } },
    });
    if (adminRole === null) throw new Error('admin role not seeded');

    const passwordHash = await bcrypt.hash('PlaceholderTestPassword123!', 10);
    await expect(
      prisma.user.create({
        data: {
          email: THIRD_EMAIL,
          passwordHash,
          firstName: 'Third',
          lastName: 'User',
          displayName: 'Third User',
          roleId: adminRole.id,
          tenantId,
          isActive: true,
          securityVersion: 1,
          isTenantOwner: true, // violates one_tenant_owner_per_tenant — owner already exists
        },
      }),
    ).rejects.toThrow();
  });

  it('transferTenantOwnership: promotes toUser and demotes fromUser, exactly one owner remains', async () => {
    const superAdminRole = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'tenant_super_admin' } },
    });
    const adminRole = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'admin' } },
    });
    if (superAdminRole === null || adminRole === null) throw new Error('roles not seeded');

    const beforeFrom = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const beforeTo = await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });

    await transferTenantOwnership(prisma, {
      tenantId,
      fromUserId: ownerUserId,
      toUserId: otherUserId,
    });

    const fromUser = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const toUser = await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });

    expect(fromUser.isTenantOwner).toBe(false);
    expect(fromUser.roleId).toBe(adminRole.id);
    expect(fromUser.securityVersion).toBe(beforeFrom.securityVersion + 1);

    expect(toUser.isTenantOwner).toBe(true);
    expect(toUser.roleId).toBe(superAdminRole.id);
    expect(toUser.securityVersion).toBe(beforeTo.securityVersion + 1);

    const ownerCount = await prisma.user.count({ where: { tenantId, isTenantOwner: true } });
    expect(ownerCount).toBe(1);
  });

  it('reassignTenantOwner: platform break-glass reassigns the sole owner', async () => {
    // At this point otherUserId is the owner (from the previous test). Reassign back to ownerUserId.
    const superAdminRole = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'tenant_super_admin' } },
    });
    if (superAdminRole === null) throw new Error('tenant_super_admin role not seeded');

    await reassignTenantOwner(prisma, {
      tenantId,
      newOwnerUserId: ownerUserId,
    });

    const newOwner = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const previousOwner = await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });

    expect(newOwner.isTenantOwner).toBe(true);
    expect(newOwner.roleId).toBe(superAdminRole.id);
    expect(previousOwner.isTenantOwner).toBe(false);

    const ownerCount = await prisma.user.count({ where: { tenantId, isTenantOwner: true } });
    expect(ownerCount).toBe(1);
  });

  it('reassignTenantOwner: rejects a non-existent tenantId with NOT_FOUND', async () => {
    await expect(
      reassignTenantOwner(prisma, {
        tenantId: 'tenant_does_not_exist_succession_test',
        newOwnerUserId: ownerUserId,
      }),
    ).rejects.toThrow('NOT_FOUND');
  });
});
