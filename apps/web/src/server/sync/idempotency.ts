import type { Prisma } from "@prisma/client";
import { prisma } from "@orqafy/db";

/**
 * The compound key a mobile push-sync operation is idempotent on. `clientId`
 * is the mobile client's stable local WatermelonDB record id (never
 * server-generated), so a retried POST for the same logical mutation always
 * carries the same key (apps/mobile/src/sync/queue.ts retries on any
 * network failure).
 */
export interface SyncOpKey {
  tenantId: string;
  userId: string;
  entityType: string;
  clientId: string;
  action: string;
}

/**
 * Idempotency lookup (mobile-sync-foundation). Returns the previously
 * recorded `serverId` if this exact (tenant, user, entity, clientId,
 * action) has already been applied — the caller MUST short-circuit and
 * return that serverId WITHOUT re-running the domain mutation. Returns
 * `null` on a genuine first attempt.
 */
export async function findSyncOp(key: SyncOpKey): Promise<string | null> {
  const op = await prisma.mobileSyncOp.findUnique({
    where: {
      tenantId_userId_entityType_clientId_action: {
        tenantId: key.tenantId,
        userId: key.userId,
        entityType: key.entityType,
        clientId: key.clientId,
        action: key.action,
      },
    },
    select: { serverId: true },
  });
  return op?.serverId ?? null;
}

/**
 * Records a sync op. Intended pattern for per-entity handlers (documented
 * here for the workers that implement dtr_entries / tasks / expenses):
 *
 *   1. `findSyncOp(key)` FIRST, outside any transaction — a hit means the
 *      op already applied; return its `serverId` immediately, no write.
 *   2. On a miss, run the domain mutation AND `recordSyncOp` together
 *      inside ONE `prisma.$transaction(...)` call, so a create can never
 *      succeed unrecorded (and a crash between the two never leaves a
 *      half-applied op — the transaction rolls back both).
 *
 * `recordSyncOp` takes the transaction client so it can be the last
 * statement inside that `$transaction` callback.
 */
export async function recordSyncOp(
  tx: Prisma.TransactionClient,
  key: SyncOpKey,
  serverId: string,
): Promise<void> {
  await tx.mobileSyncOp.create({
    data: { ...key, serverId },
  });
}
