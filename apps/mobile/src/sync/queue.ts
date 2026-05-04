import { database } from "@/storage";
import type { SyncQueueItem } from "@/storage";
import { apiFetch } from "@/api";

const MAX_ATTEMPTS = 5;

export async function enqueueSync(
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>,
): Promise<void> {
  await database.write(async () => {
    await database.get<SyncQueueItem>("sync_queue").create((item) => {
      item.entityType = entityType;
      item.entityId = entityId;
      item.action = action;
      item.payload = JSON.stringify(payload);
      item.attempts = 0;
    });
  });
}

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  const items = await database
    .get<SyncQueueItem>("sync_queue")
    .query()
    .fetch();

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed++;
      continue;
    }

    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      await apiFetch(`/api/sync/${item.entityType}`, {
        method: "POST",
        body: JSON.stringify({
          action: item.action,
          entityId: item.entityId,
          data: payload,
        }),
      });

      await database.write(async () => {
        await item.destroyPermanently();
      });
      synced++;
    } catch (error) {
      await database.write(async () => {
        await item.update((record) => {
          record.attempts = record.attempts + 1;
          record.lastError = error instanceof Error ? error.message : "Unknown error";
        });
      });
      failed++;
    }
  }

  return { synced, failed };
}

export async function getPendingCount(): Promise<number> {
  return database.get<SyncQueueItem>("sync_queue").query().fetchCount();
}
