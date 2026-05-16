/**
 * Integration test: tenant-provisioning worker
 *
 * RED phase: this test fails because apps/worker/src/processors/tenant-provisioning.ts
 * does not exist yet and createTenantSchema has not been wired to the BullMQ worker.
 *
 * Requires: live PostgreSQL (DATABASE_URL) + live Valkey (REDIS_URL) in env.
 * Run against dev stack: bash deploy/compose/start.sh dev up -d
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { prisma, tenantSchemaExists, toSchemaName, dropTenantSchema } from '@orqafy/db';
import { processTenantProvisioning } from '../processors/tenant-provisioning.js';
import type { TenantProvisioningJobData } from '@orqafy/jobs';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:42943';
const TEST_SLUG = 'inttest-worker-co';
const TEST_SCHEMA = toSchemaName(TEST_SLUG);

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

describe('processTenantProvisioning', () => {
  let connection: Redis;

  beforeAll(async () => {
    connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    // Ensure the test schema doesn't already exist from a previous run
    const exists = await tenantSchemaExists(prisma, TEST_SCHEMA);
    if (exists) {
      await dropTenantSchema(prisma, TEST_SCHEMA);
    }
  });

  afterAll(async () => {
    // Clean up
    const exists = await tenantSchemaExists(prisma, TEST_SCHEMA);
    if (exists) {
      await dropTenantSchema(prisma, TEST_SCHEMA);
    }
    await connection.quit();
    await prisma.$disconnect();
  });

  it('creates the tenant schema when processing a provisioning job', async () => {
    const jobData: TenantProvisioningJobData = {
      tenantId: 'cuid_placeholder_tenant_001',
      userId: 'cuid_placeholder_user_001',
      traceId: 'trace-001',
      tenantSlug: TEST_SLUG,
      tenantName: 'Integration Test Worker Co',
      schemaName: TEST_SCHEMA,
      plan: 'starter',
      ownerEmail: 'owner@inttest-worker-co.local',
      ownerName: 'Integration Test Owner',
      ownerPassword: 'PlaceholderTestPassword123!',
    };

    // RED: processTenantProvisioning does not exist yet → import fails → test fails
    await processTenantProvisioning(makeJob(jobData) as never);

    const schemaExists = await tenantSchemaExists(prisma, TEST_SCHEMA);
    expect(schemaExists).toBe(true);
  });
});
