/**
 * Integration test: tenant-provisioning worker
 *
 * Verifies the full self-registration provisioning path:
 *   schema create → seed 13 standard roles → create owner user (bcrypt, super-admin)
 *   → flip tenant status to "active". Plus idempotency + failure-leaves-provisioning.
 *
 * Requires: live PostgreSQL (DATABASE_URL) + live Valkey (REDIS_URL) in env.
 * Run against dev stack: bash deploy/compose/start.sh dev up -d
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import {
  prisma,
  tenantSchemaExists,
  toSchemaName,
  dropTenantSchema,
  STANDARD_ROLES,
} from '@orqafy/db';
import { processTenantProvisioning } from '../processors/tenant-provisioning.js';
import type { TenantProvisioningJobData } from '@orqafy/jobs';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:42943';
const TEST_SLUG = 'inttest-worker-co';
const TEST_SCHEMA = toSchemaName(TEST_SLUG);
const OWNER_EMAIL = 'owner@inttest-worker-co.local';
const OWNER_PASSWORD = 'PlaceholderTestPassword123!';

// Minimal job shape required by the processor
function makeJob(data: TenantProvisioningJobData) {
  return {
    id: 'test-job-1',
    name: 'tenant-provisioning',
    data,
    opts: {},
    timestamp: Date.now(),
    attemptsMade: 0,
    processedOn: Date.now(),
    finishedOn: undefined,
    returnvalue: null,
    failedReason: undefined,
    stacktrace: [],
    token: 'test-token',
    queueName: 'tenant-provisioning',
    progress: 0,
    log: async () => {},
    updateProgress: async () => {},
    update: async () => {},
    remove: async () => {},
    retry: async () => {},
    discard: () => {},
    getState: () => Promise.resolve('active' as const),
    moveToCompleted: () => Promise.resolve(null),
    moveToFailed: async () => {},
    extendLock: async () => {},
    changePriority: async () => {},
    asJSON: () => ({}) as never,
    toJSON: () => ({}) as never,
    queue: null as never,
  };
}

/**
 * Remove all public-schema artifacts for a tenantId, in FK-safe order, then the tenant row.
 * Provisioning now seeds the finance baseline (chart of accounts + tax rate + fiscal year +
 * accounting settings + statutory rates) into PUBLIC tenant-scoped tables (see
 * packages/db/src/helpers/tenant-financials.ts), whose tenant FKs are restrict — so these
 * must be deleted before the tenant row or the final delete violates the constraint.
 * Order matters: accounts self-reference via parent_id, so clear child→parent by nulling
 * parents first is avoided by deleting all of a tenant's accounts in one statement.
 */
async function cleanupTenant(tenantId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.accountingSettings.deleteMany({ where: { tenantId } });
  await prisma.statutoryRate.deleteMany({ where: { tenantId } });
  await prisma.taxRate.deleteMany({ where: { tenantId } });
  await prisma.fiscalYear.deleteMany({ where: { tenantId } });
  // Accounts self-reference (parent_id, restrict): break the hierarchy before deleting rows.
  await prisma.account.updateMany({ where: { tenantId }, data: { parentId: null } });
  await prisma.account.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

describe('processTenantProvisioning', () => {
  let connection: Redis;
  let tenantId: string;

  beforeAll(async () => {
    connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

    // Clean slate: drop schema + any stale public rows from a prior run.
    const exists = await tenantSchemaExists(prisma, TEST_SCHEMA);
    if (exists) {
      await dropTenantSchema(prisma, TEST_SCHEMA);
    }
    await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
    const stale = await prisma.tenant.findUnique({ where: { slug: TEST_SLUG } });
    if (stale !== null) {
      await cleanupTenant(stale.id);
    }

    // A real tenant must exist (User/Role FK to tenant), mirroring /register.
    const tenant = await prisma.tenant.create({
      data: {
        slug: TEST_SLUG,
        name: 'Integration Test Worker Co',
        schemaName: TEST_SCHEMA,
        status: 'provisioning',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    const exists = await tenantSchemaExists(prisma, TEST_SCHEMA);
    if (exists) {
      await dropTenantSchema(prisma, TEST_SCHEMA);
    }
    await cleanupTenant(tenantId);
    await connection.quit();
    await prisma.$disconnect();
  });

  function jobData(overrides: Partial<TenantProvisioningJobData> = {}): TenantProvisioningJobData {
    return {
      tenantId,
      userId: 'system',
      traceId: 'trace-001',
      tenantSlug: TEST_SLUG,
      tenantName: 'Integration Test Worker Co',
      schemaName: TEST_SCHEMA,
      plan: 'starter',
      ownerEmail: OWNER_EMAIL,
      ownerName: 'Integration Test Owner',
      ownerPassword: OWNER_PASSWORD,
      ...overrides,
    };
  }

  it('creates the tenant schema, seeds roles, creates an active owner, and activates the tenant', async () => {
    await processTenantProvisioning(makeJob(jobData()) as never);

    // Schema created
    expect(await tenantSchemaExists(prisma, TEST_SCHEMA)).toBe(true);

    // Full 13-role set seeded for this tenant
    const roleCount = await prisma.role.count({ where: { tenantId } });
    expect(roleCount).toBe(STANDARD_ROLES.length);

    const superAdmin = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'tenant_super_admin' } },
    });
    expect(superAdmin).not.toBeNull();

    // Owner user created, active, super-admin, bcrypt-hashed password that verifies
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    expect(owner).not.toBeNull();
    expect(owner?.roleId).toBe(superAdmin?.id);
    expect(owner?.tenantId).toBe(tenantId);
    expect(owner?.isActive).toBe(true);
    expect(owner?.passwordHash).not.toBe(OWNER_PASSWORD); // hashed, not plaintext
    expect(await bcrypt.compare(OWNER_PASSWORD, owner?.passwordHash ?? '')).toBe(true);

    // Tenant flipped to active
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.status).toBe('active');
  });

  it('is idempotent — re-running does not duplicate roles or the owner user', async () => {
    await processTenantProvisioning(makeJob(jobData()) as never);
    await processTenantProvisioning(makeJob(jobData()) as never);

    expect(await prisma.role.count({ where: { tenantId } })).toBe(STANDARD_ROLES.length);
    expect(await prisma.user.count({ where: { email: OWNER_EMAIL } })).toBe(1);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.status).toBe('active');
  });

  it('leaves status="provisioning" when owner/role creation fails after schema exists', async () => {
    // Fresh tenant whose schema gets created (step 1), then point the job at a
    // non-existent tenantId so role/user upserts fail the FK → step 2 throws,
    // and the REAL tenant's status must NOT flip to active.
    const failSlug = 'inttest-worker-fail';
    const failSchema = toSchemaName(failSlug);
    if (await tenantSchemaExists(prisma, failSchema)) {
      await dropTenantSchema(prisma, failSchema);
    }
    const failTenant = await prisma.tenant.create({
      data: {
        slug: failSlug,
        name: 'Fail Co',
        schemaName: failSchema,
        status: 'provisioning',
      },
    });

    const bogusTenantId = 'tenant_does_not_exist_fk_violation';
    const data = jobData({
      tenantId: bogusTenantId,
      tenantSlug: failSlug,
      schemaName: failSchema,
      ownerEmail: 'owner@inttest-worker-fail.local',
    });

    await expect(processTenantProvisioning(makeJob(data) as never)).rejects.toThrow();

    // Schema got created (step 1) but the real tenant must stay "provisioning".
    expect(await tenantSchemaExists(prisma, failSchema)).toBe(true);
    const stillProvisioning = await prisma.tenant.findUnique({ where: { id: failTenant.id } });
    expect(stillProvisioning?.status).toBe('provisioning');

    // Cleanup
    await prisma.user.deleteMany({ where: { email: 'owner@inttest-worker-fail.local' } });
    await prisma.role.deleteMany({ where: { tenantId: bogusTenantId } });
    if (await tenantSchemaExists(prisma, failSchema)) {
      await dropTenantSchema(prisma, failSchema);
    }
    await prisma.tenant.deleteMany({ where: { id: failTenant.id } });
  });
});
