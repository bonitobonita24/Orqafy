import type { FeatureKey } from "@orqafy/shared/rbac";
import type { SyncBearerContext } from "@/server/sync/bearer-context";
import { dtrEntriesHandler } from "@/server/sync/handlers/dtr-entries";
import { tasksHandler } from "@/server/sync/handlers/tasks";
import { expensesHandler } from "@/server/sync/handlers/expenses";

/** The mutation actions the mobile-sync route accepts. `delete` is
 * explicitly OUT of scope for v1 (see docs/PRODUCT.md mobile-sync decision
 * log) — the route rejects it with 400 before ever reaching a handler. */
export const SYNC_ACTIONS = ["create", "update"] as const;
export type SyncAction = (typeof SYNC_ACTIONS)[number];

/** Entity types the mobile app currently queues (apps/mobile/src/sync — dtr,
 * tasks, expenses). Adding a new synced entity means adding it here AND to
 * `ENTITY_FEATURE_MAP` AND `syncHandlers` — TypeScript's exhaustiveness on
 * the `Record` below enforces the last two stay in lockstep with this list. */
export const SYNC_ENTITY_TYPES = ["dtr_entries", "tasks", "expenses"] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export function isSyncEntityType(value: string): value is SyncEntityType {
  return (SYNC_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Maps each synced entity to its RBAC feature key (tenant-rbac-standard.md
 * §4 feature registry) so the route's matrix check
 * (`checkMatrixGrant`/matrix-check.ts) can resolve (feature, action) without
 * each per-entity handler re-deriving it. */
export const ENTITY_FEATURE_MAP: Record<SyncEntityType, FeatureKey> = {
  dtr_entries: "dtr",
  tasks: "tasks",
  expenses: "expenses",
};

/** Thrown by a stubbed handler. Mapped to HTTP 501 by the route — a
 * deliberate "not built yet" signal, distinct from a genuine server error. */
export class SyncHandlerNotImplementedError extends Error {
  constructor(entityType: SyncEntityType) {
    super(`Sync handler for "${entityType}" is not implemented yet.`);
    this.name = "SyncHandlerNotImplementedError";
  }
}

/**
 * The per-entity handler contract every future sync handler (dtr_entries,
 * tasks, expenses) implements. `ctx` is the server-resolved auth context
 * from `resolveSyncBearerContext` (bearer-context.ts) — a handler MUST
 * derive tenant/user scoping from `ctx`, never from `data`. `clientId` is
 * the mobile client's stable local record id — the SAME value the handler
 * passes as `SyncOpKey.clientId` to `recordSyncOp` (idempotency.ts) inside
 * its `$transaction`.
 *
 * Expected implementation shape (documented for W2/W3):
 *   1. `findSyncOp({ tenantId, userId, entityType, clientId, action })` —
 *      on a hit, return `{ serverId: <stored serverId> }` immediately.
 *   2. On a miss: matrix-check already happened in the route (still safe to
 *      re-check inside the handler if the write is more granular than the
 *      route-level (feature, action) pair).
 *   3. `demo guard already asserted in the route (assertNotDemoTenant) —
 *      handlers run only for non-demo tenants.
 *   4. Run the domain write + `recordSyncOp(tx, key, serverId)` inside ONE
 *      `prisma.$transaction(...)` call. Return `{ serverId }`.
 */
export type SyncHandler = (args: {
  ctx: Pick<SyncBearerContext, "tenantId" | "userId" | "roles" | "roleId">;
  action: SyncAction;
  clientId: string;
  data: unknown;
}) => Promise<{ serverId: string }>;

/**
 * Dispatch table. Kept as a plain `Record` (not a factory) so adding a
 * FUTURE synced entity is still a two-line change (add to
 * `SYNC_ENTITY_TYPES` + `ENTITY_FEATURE_MAP` above, add a handler here) and
 * TypeScript's exhaustiveness on the `Record` type catches a missing entry
 * at compile time. `SyncHandlerNotImplementedError`/501 stays live in the
 * route (route.ts) for that in-between state on a newly-added entity type.
 */
export const syncHandlers: Record<SyncEntityType, SyncHandler> = {
  dtr_entries: dtrEntriesHandler,
  tasks: tasksHandler,
  expenses: expensesHandler,
};
