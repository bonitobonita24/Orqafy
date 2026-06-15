import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

interface AuditLogEntry {
  userId: string;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'ACTIVATE'
    | 'DEACTIVATE'
    | 'POST'
    | 'REVERSE'
    | 'PROCESS'
    | 'APPROVE'
    | 'MARK_PAID';
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient | PrismaClient,
  entry: AuditLogEntry
): Promise<void> {
  await (tx as PrismaClient).auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before !== undefined && entry.before !== null
        ? (entry.before as Prisma.InputJsonValue)
        : Prisma.DbNull,
      after: entry.after !== undefined && entry.after !== null
        ? (entry.after as Prisma.InputJsonValue)
        : Prisma.DbNull,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
