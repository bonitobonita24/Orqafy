import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './middleware/tenant-guard.js';

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

export function createTenantPrisma(schemaName: string) {
  return prisma.$extends(tenantGuardExtension(schemaName));
}
