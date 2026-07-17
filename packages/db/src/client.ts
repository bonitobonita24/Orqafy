import { PrismaClient } from '@prisma/client';

/**
 * Tenant isolation contract: ONE shared 'public' schema. Every query is
 * scoped by an explicit tenantId filter — there is NO per-tenant Postgres
 * schema / search_path at runtime. The former schema-per-tenant machinery
 * (createTenantPrisma/tenantGuardExtension) was dormant and removed 2026-07-11.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['APP_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env['APP_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
