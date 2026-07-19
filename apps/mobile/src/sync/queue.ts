import { Q } from "@nozbe/watermelondb";
import * as FileSystem from "expo-file-system";

import { database } from "@/storage";
import type { SyncQueueItem, DtrEntry, Task, Expense } from "@/storage";
import { apiFetch } from "@/api";

const MAX_ATTEMPTS = 5;

// Queue-only sentinel entityType — it has NO matching WatermelonDB table.
// The route it maps to isn't the generic POST /api/sync/{entityType} (used
// by every REAL entityType below, which map 1:1 onto WatermelonDB table
// names: dtr_entries, tasks, expenses) — it's the dedicated receipt-upload
// leg, POST /api/sync/expenses/{serverId}/receipt. See
// syncReceiptUploadItem.
const RECEIPT_UPLOAD_ENTITY_TYPE = "expense_receipts";

interface ReceiptUploadPayload {
  receiptUri: string;
}

/**
 * Builds an UNSAVED sync_queue record via `prepareCreate` so callers can
 * pass it into `database.batch(...)` alongside the entity's own
 * create/update — atomically, in the SAME writer.
 *
 * WatermelonDB forbids nesting `database.write()` calls (a writer can't run
 * inside another writer without `callWriter`), so every screen that
 * creates/updates an entity AND enqueues its sync op in one action MUST use
 * this `prepare*` + `database.batch` pattern — never call the standalone
 * `enqueueSync` below from inside an existing `database.write()` block.
 */
export function prepareSyncQueueItem(
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>,
): SyncQueueItem {
  return database.get<SyncQueueItem>("sync_queue").prepareCreate((item) => {
    item.entityType = entityType;
    item.entityId = entityId;
    item.action = action;
    item.payload = JSON.stringify(payload);
    item.attempts = 0;
  });
}

/**
 * Companion to `prepareSyncQueueItem` for the expense receipt-upload leg.
 * `localExpenseId` is the WatermelonDB LOCAL id of the expense — its server
 * id doesn't exist yet at enqueue time. `syncReceiptUploadItem` resolves the
 * server id once the sibling `create` item (enqueued in the same batch, and
 * always processed first — see `processQueue`'s createdAt ordering) has
 * synced.
 */
export function prepareReceiptUploadQueueItem(
  localExpenseId: string,
  receiptUri: string,
): SyncQueueItem {
  return database.get<SyncQueueItem>("sync_queue").prepareCreate((item) => {
    item.entityType = RECEIPT_UPLOAD_ENTITY_TYPE;
    item.entityId = localExpenseId;
    item.action = "create";
    item.payload = JSON.stringify({ receiptUri } satisfies ReceiptUploadPayload);
    item.attempts = 0;
  });
}

/**
 * Standalone convenience wrapper — opens its OWN writer. Only safe to call
 * when NOT already inside a `database.write()` block. Screens that
 * create/update an entity and enqueue its sync op together must use
 * `prepareSyncQueueItem` + `database.batch` instead (see dtr/index.tsx,
 * tasks/[id].tsx, expenses/new.tsx).
 */
export async function enqueueSync(
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>,
): Promise<void> {
  await database.write(async () => {
    await database.batch(prepareSyncQueueItem(entityType, entityId, action, payload));
  });
}

/**
 * Writes the server's response back onto the SOURCE entity record after a
 * successful sync.
 *
 * `tasks` are pull-first (server/sync/handlers/tasks.ts treats the sync
 * `entityId` as the REAL server Task id already — see the enqueueSync call
 * in tasks/[id].tsx), so there's no local `serverId` column to fill in;
 * only `synced` flips, resolved by querying the `server_id` index.
 *
 * `dtr_entries` / `expenses` are mobile-originated: the sync `entityId` is
 * the LOCAL WatermelonDB id, so both `serverId` and `synced` are written
 * back onto that local record.
 */
async function writeBackSuccess(item: SyncQueueItem, serverId: string): Promise<void> {
  if (item.entityType === "tasks") {
    const collection = database.get<Task>("tasks");
    const [record] = await collection.query(Q.where("server_id", item.entityId)).fetch();
    if (record !== undefined) {
      await record.update((r) => {
        r.synced = true;
      });
    }
    return;
  }

  if (item.entityType === "dtr_entries") {
    const collection = database.get<DtrEntry>("dtr_entries");
    const record = await collection.find(item.entityId).catch(() => null);
    if (record !== null) {
      await record.update((r) => {
        r.serverId = serverId;
        r.synced = true;
      });
    }
    return;
  }

  if (item.entityType === "expenses") {
    const collection = database.get<Expense>("expenses");
    const record = await collection.find(item.entityId).catch(() => null);
    if (record !== null) {
      await record.update((r) => {
        r.serverId = serverId;
        r.synced = true;
      });
    }
  }
}

async function syncEntityItem(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
  const { serverId } = await apiFetch<{ serverId: string }>(`/api/sync/${item.entityType}`, {
    method: "POST",
    body: JSON.stringify({
      action: item.action,
      entityId: item.entityId,
      data: payload,
    }),
  });

  await database.write(async () => {
    await writeBackSuccess(item, serverId);
  });
}

async function syncReceiptUploadItem(item: SyncQueueItem, payload: ReceiptUploadPayload): Promise<void> {
  const collection = database.get<Expense>("expenses");
  const expense = await collection.find(item.entityId).catch(() => null);
  if (expense === null) {
    // Local expense record is gone (e.g. removed locally) — nothing left to
    // attach a receipt to. Returning (not throwing) lets processQueue treat
    // this item as done and drop it, instead of retrying forever.
    return;
  }
  if (expense.serverId === null) {
    // Sibling `create` item hasn't synced yet. Throwing routes this through
    // the normal retry/attempts path in processQueue — cheap and naturally
    // bounded (MAX_ATTEMPTS) — rather than a special no-op branch. Never
    // blocks or fails the expense record itself.
    throw new Error("Expense has not synced yet — will retry once it has.");
  }

  const bodyBase64 = await FileSystem.readAsStringAsync(payload.receiptUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await apiFetch<{ ok: boolean; storageKey: string }>(
    `/api/sync/expenses/${expense.serverId}/receipt`,
    {
      method: "POST",
      body: JSON.stringify({
        filename: `receipt-${expense.id}.jpg`,
        contentType: "image/jpeg",
        bodyBase64,
      }),
    },
  );
}

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  const items = await database.get<SyncQueueItem>("sync_queue").query().fetch();

  // Oldest-first: an expense's `create` item is always batched together
  // with (and therefore created no later than) its sibling
  // `expense_receipts` item — see expenses/new.tsx — so processing in
  // createdAt order guarantees the create's serverId write-back has landed
  // before the receipt item tries to resolve it.
  const ordered = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let synced = 0;
  let failed = 0;

  for (const item of ordered) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed++;
      continue;
    }

    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;

      if (item.entityType === RECEIPT_UPLOAD_ENTITY_TYPE) {
        await syncReceiptUploadItem(item, payload as unknown as ReceiptUploadPayload);
      } else {
        await syncEntityItem(item, payload);
      }

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
