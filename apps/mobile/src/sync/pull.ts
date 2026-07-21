import { database } from "@/storage";
import type { Task, Payslip } from "@/storage/models";
import { apiFetch } from "@/api/client";
import {
  reconcile,
  assertRecords,
  createGuardState,
  runGuarded,
  isValidPulledTask,
  isValidPulledPayslip,
} from "./reconcile";

/**
 * Down-sync (server → phone). Full-replace semantics: each pull fetches the
 * caller's complete current set and makes the local table match it.
 *
 * SAFETY: a failed or malformed response must NEVER be treated as "the server
 * returned an empty set" — under full-replace that would wipe the local table.
 * Every pull therefore only mutates the DB after a successful, shape-checked
 * response (assertRecords); any error leaves local data completely untouched and
 * retries on the next tick.
 *
 * NOTE: the row types below intentionally mirror the server's PulledTask /
 * PulledPayslip (apps/web/src/server/sync/serializers/pull.ts). They are
 * duplicated rather than imported because mobile and web are separate packages
 * with no shared type boundary (the same reason the mobile tRPC client is still
 * untyped). The endpoint route tests are what keep the two in lockstep.
 */

interface PulledTask {
  server_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string;
  due_date: number | null;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  synced: true;
}

interface PulledPayslip {
  server_id: string;
  tenant_id: string;
  user_id: string;
  period_start: number;
  period_end: number;
  gross_pay: number;
  net_pay: number;
  deductions: string;
  created_at: number;
  updated_at: number;
}

async function pullTasksInternal(): Promise<void> {
  const body = await apiFetch<unknown>("/api/sync/tasks");
  const records = assertRecords<PulledTask>(body, isValidPulledTask);

  const collection = database.get<Task>("tasks");
  const local = await collection.query().fetch();

  // TOCTOU NOTE: `row.synced` is read at plan time (from the `local` fetch
  // above), not at write time. An edit landing on this row between that
  // fetch and the `database.write` below is invisible here and gets
  // overwritten — `synced` flips back to true along with it. This causes
  // NO data loss today ONLY because prepareSyncQueueItem (queue.ts)
  // JSON.stringify-snapshots the edit's payload at ENQUEUE time, so the
  // already-queued push still carries the user's edit regardless of what
  // this reconcile does to the row's columns. If a future refactor ever
  // makes the push read the row's current columns at push time instead of
  // replaying its enqueued snapshot, this window becomes real data loss —
  // don't remove the snapshot-at-enqueue behavior without re-solving this.
  const plan = reconcile<PulledTask, Task>(records, local, {
    serverKey: (row) => row.server_id,
    localKey: (row) => row.serverId,
    hasPendingWrites: (row) => row.synced === false,
  });

  if (
    plan.toCreate.length === 0 &&
    plan.toUpdate.length === 0 &&
    plan.toDestroy.length === 0
  ) {
    return;
  }

  await database.write(async () => {
    await database.batch(
      ...plan.toCreate.map((row) =>
        collection.prepareCreate((task) => {
          task.tenantId = row.tenant_id;
          task.serverId = row.server_id;
          task.title = row.title;
          task.description = row.description;
          task.status = row.status;
          task.priority = row.priority;
          task.assignedTo = row.assigned_to;
          task.dueDate = row.due_date === null ? null : new Date(row.due_date);
          task.projectId = row.project_id;
          task.synced = true;
        }),
      ),
      ...plan.toUpdate.map(({ local: task, server: row }) =>
        task.prepareUpdate((draft) => {
          draft.title = row.title;
          draft.description = row.description;
          draft.status = row.status;
          draft.priority = row.priority;
          draft.assignedTo = row.assigned_to;
          draft.dueDate = row.due_date === null ? null : new Date(row.due_date);
          draft.projectId = row.project_id;
          draft.synced = true;
        }),
      ),
      ...plan.toDestroy.map((task) => task.prepareDestroyPermanently()),
    );
  });
}

async function pullPayslipsInternal(): Promise<void> {
  const body = await apiFetch<unknown>("/api/sync/payslips");
  const records = assertRecords<PulledPayslip>(body, isValidPulledPayslip);

  const collection = database.get<Payslip>("payslips");
  const local = await collection.query().fetch();

  // Payslips have no `synced` column — the phone never writes them, so this is
  // unconditionally server-wins.
  const plan = reconcile<PulledPayslip, Payslip>(records, local, {
    serverKey: (row) => row.server_id,
    localKey: (row) => row.serverId,
    hasPendingWrites: () => false,
  });

  if (
    plan.toCreate.length === 0 &&
    plan.toUpdate.length === 0 &&
    plan.toDestroy.length === 0
  ) {
    return;
  }

  await database.write(async () => {
    await database.batch(
      ...plan.toCreate.map((row) =>
        collection.prepareCreate((slip) => {
          slip.tenantId = row.tenant_id;
          slip.userId = row.user_id;
          slip.serverId = row.server_id;
          slip.periodStart = new Date(row.period_start);
          slip.periodEnd = new Date(row.period_end);
          slip.grossPay = row.gross_pay;
          slip.netPay = row.net_pay;
          slip.deductions = row.deductions;
        }),
      ),
      ...plan.toUpdate.map(({ local: slip, server: row }) =>
        slip.prepareUpdate((draft) => {
          draft.periodStart = new Date(row.period_start);
          draft.periodEnd = new Date(row.period_end);
          draft.grossPay = row.gross_pay;
          draft.netPay = row.net_pay;
          draft.deductions = row.deductions;
        }),
      ),
      ...plan.toDestroy.map((slip) => slip.prepareDestroyPermanently()),
    );
  });
}

// Concurrency guard state — see runGuarded() in reconcile.ts for behavior.
const tasksGuard = createGuardState();
const payslipsGuard = createGuardState();

export async function pullTasks(): Promise<void> {
  await runGuarded(tasksGuard, pullTasksInternal);
}

export async function pullPayslips(): Promise<void> {
  await runGuarded(payslipsGuard, pullPayslipsInternal);
}

/**
 * Pull every down-synced entity. Concurrent invocations (interval tick landing
 * on top of a pull-to-refresh) are a no-op rather than a double fetch — this
 * holds both when pullAll() itself overlaps AND when a screen calls
 * pullTasks()/pullPayslips() directly while pullAll() is mid-flight, since all
 * three route through the same per-entity guards. Individual entity failures
 * are isolated so one bad endpoint cannot block the other.
 */
export async function pullAll(): Promise<void> {
  const results = await Promise.allSettled([pullTasks(), pullPayslips()]);
  for (const result of results) {
    if (result.status === "rejected") {
      // Non-fatal: keep local data, retry next tick.
      console.warn("down-sync pull failed", result.reason);
    }
  }
}
