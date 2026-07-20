# Mobile Down-Sync (server → phone pull) — Design

**Date:** 2026-07-20
**Status:** Approved (owner, 2026-07-20)
**Scope:** `apps/web` (2 new REST endpoints) · `apps/mobile` (pull module, auto-sync hook, 2 screens)
**Deploy posture:** HARD HOLD — local dev commits only. No staging/prod/demo deploy without explicit owner word.

---

## 1. Problem

Up-sync (phone → server) is fully built: a WatermelonDB `sync_queue` feeds `POST /api/sync/*`, guarded by an
idempotent `MobileSyncOp` ledger. **Down-sync does not exist.** No screen fetches entity data from the server.

The concrete consequence: the mobile `tasks` and `payslips` tables have a **non-null `server_id`** (they are
server-origin by design) but **nothing ever populates them**. The Tasks and Payslips screens are therefore
permanently empty — a task assigned on the web never reaches the worker's phone, and a generated payslip is
never visible.

## 2. Scope

**In scope:** pull for `tasks` and `payslips`.

Both are server-origin — the phone cannot create either. This makes the first slice a pure server→phone read
with no create-side collision surface.

**Explicitly out of scope (deferred):**
- Down-sync for `dtr_entries` and `expenses` (phone-origin; would require status-backfill merge semantics).
- Incremental/cursor sync and server-side tombstones.
- Conflict-resolution UI.
- Consuming the mobile tRPC client (still untyped `AnyRouter`; cross-package `AppRouter` typing stays deferred).

## 3. Governing rule

> **Up-sync owns rows with pending local writes. The server owns everything else.**

One rule resolves every case, with no conflict UI. Tasks are writable on the phone (status updates enqueue an
up-sync op), so a pull must never clobber an unsynced local edit.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Pull **tasks + payslips** only | Server-origin, no collision surface, closes the actual dead-screen gap |
| D2 | **REST `GET /api/sync/*`** endpoints | Mirrors the existing up-sync middleware chain; avoids deferred tRPC typing work |
| D3 | **Full replace** per pull (no cursor) | Ghost rows impossible; unassignment/void self-heal; per-user datasets are small |
| D4 | **Local pending edits win** — skip rows with `synced === false` | Preserves offline field work; the entire point of an offline-first app |
| D5 | **Push before pull** in the auto-sync tick | Pending edits land first, so fewer rows skip and the phone converges in one tick |
| D6 | Tasks scoped to **assigned-to-me only** | Field-worker model: smallest payload, tightest privacy boundary. *Revisit if supervisors need team visibility on mobile.* |
| D7 | Payslips restricted to **approved/paid payrolls** | A worker must not see a draft payslip mid-computation |
| D8 | `payslips.deductions` carries a **JSON breakdown string** | Mobile column is `type: "string"` but the server has 6 discrete deduction columns; a JSON object preserves the detail |

## 5. Data flow

```
auto-sync tick (30s)  ─┬─► processQueue()   push pending edits   (existing)
                       └─► pullAll()        adopt server truth   (NEW)

pull-to-refresh ──────────► pullAll()
app foreground  ──────────► pullAll()
```

## 6. Server design

Two new route handlers, both `GET`:

- `apps/web/src/app/api/sync/tasks/route.ts`
- `apps/web/src/app/api/sync/payslips/route.ts`

They reuse the existing up-sync middleware chain verbatim:

| Step | Behavior |
|---|---|
| Auth | `resolveSyncBearerContext(req)` → generic `401` on any failure |
| Rate limit | `rateLimiters.mobile_sync`, keyed by `userId` |
| RBAC | `checkMatrixGrant(feature, "view")` — `tasks` / `payroll` |
| Demo tenant | **Reads permitted.** `assertNotDemoTenant` is a write-side guard and is NOT called here |
| Response | `200 { records: [...], serverTime: <ISO> }` |

### 6.1 Tasks query

`Task` has **no** `assignedTo` scalar — assignment lives in the `TaskAssignment` join table
(`@@unique([taskId, userId])`).

```ts
prisma.task.findMany({
  where: {
    tenantId: ctx.tenantId,                          // tenant isolation
    assignments: { some: { userId: ctx.userId } },   // D6: assigned to me
  },
})
```

Serialized to the mobile `tasks` column shape:

| Mobile column | Source | Notes |
|---|---|---|
| `server_id` | `task.id` | |
| `tenant_id` | `task.tenantId` | |
| `title` | `task.title` | |
| `description` | `task.description` | nullable |
| `status` | `task.status` | `todo \| in_progress \| review \| done \| blocked` |
| `priority` | `task.priority` | `low \| medium \| high \| critical` |
| `assigned_to` | `ctx.userId` | Mobile holds a scalar; the result set is already filtered to this user, so this is exact for this view |
| `due_date` | `task.dueDate` | → epoch ms, nullable |
| `project_id` | `task.projectId` | |
| `created_at` / `updated_at` | ditto | → epoch ms |
| `synced` | `true` | Server-sourced rows are by definition in sync |

### 6.2 Payslips query

`Payslip` has **no period fields** — the period lives on the related `Payroll`. The employee link is
`Payslip.employeeId → Employee.userId` (`Employee.userId` is `@unique`).

```ts
prisma.payslip.findMany({
  where: {
    tenantId: ctx.tenantId,                          // tenant isolation
    employee: { userId: ctx.userId },                // own payslips only
    payroll: { status: { in: ["approved", "paid"] } }, // D7
  },
  include: { payroll: true },
})
```

Serialized to the mobile `payslips` column shape:

| Mobile column | Source | Notes |
|---|---|---|
| `server_id` | `payslip.id` | |
| `tenant_id` | `payslip.tenantId` | |
| `user_id` | `ctx.userId` | |
| `period_start` | `payslip.payroll.periodStart` | → epoch ms (join) |
| `period_end` | `payslip.payroll.periodEnd` | → epoch ms (join) |
| `gross_pay` | `payslip.grossPay` | `Decimal` → `number` |
| `net_pay` | `payslip.netPay` | `Decimal` → `number` |
| `deductions` | JSON string (D8) | `{sss, philhealth, pagibig, tax, cashAdvance, other, total}` |
| `created_at` / `updated_at` | ditto | → epoch ms |

**Decimal handling:** Prisma `Decimal(12,2)` values convert via `.toNumber()`. At payroll magnitudes this is
exact in IEEE-754; conversion happens once, server-side, in the serializer — never ad hoc in the UI.

**Employer shares** (`sssEmployerShare` etc.) are employer cost, NOT employee deductions. They are excluded
from the `deductions` payload.

### 6.3 Security

Payslips are financial PII. Tenant scoping **alone is insufficient** — the query must also bind to the
requesting user's own employee record. A cross-user payslip read inside one tenant would be a serious IDOR.
This gets a dedicated regression test (§8).

## 7. Mobile design

New module `apps/mobile/src/sync/pull.ts`.

### 7.1 Pure reconcile function

The reconcile *decision* is separated from the WatermelonDB *writes* so it is unit-testable with no database:

```ts
reconcile(serverRows, localRows, { hasPendingWrites })
  → { toCreate, toUpdate, toDestroy, skipped }
```

Logic:

```
for each server row:
    local = byServerId[row.server_id]
    if local && hasPendingWrites(local) → SKIP        (pending up-sync wins, D4)
    else if local                       → toUpdate
    else                                → toCreate

for each local row absent from the server set:
    if hasPendingWrites(local) → KEEP                 (never destroy unsynced work)
    else                       → toDestroy
```

`hasPendingWrites` is injected per entity:
- **tasks** → `(row) => row.synced === false`
- **payslips** → `() => false` — the table has **no `synced` column**; the phone never writes payslips, so it is
  always server-wins.

### 7.2 Applying writes

All mutations are applied in a **single** `database.write(() => database.batch(...))` using
`prepareCreate` / `prepareUpdate` / `prepareDestroyPermanently`.

This is mandatory, not stylistic: WatermelonDB forbids nested writers, and violating that is exactly the class
of bug that broke the up-sync before it was refactored to the prepare/batch pattern.

### 7.3 Triggers

- **Auto-sync** — extend `apps/mobile/src/sync/auto-sync.ts` so each 30s tick runs `processQueue()` **then**
  `pullAll()` (D5).
- **Pull-to-refresh** — `RefreshControl` on the Tasks and Payslips list screens.
- **App foreground** — `AppState` listener fires `pullAll()` on `active`.

Concurrent pulls are guarded by an in-flight flag so an overlapping trigger is a no-op rather than a double
fetch.

## 8. Failure handling

**The dangerous edge:** a failed or malformed fetch must never be interpreted as "the server returned an empty
set" — under full-replace semantics that would destroy the worker's entire local table.

**Rule:** reconcile-and-destroy runs **only** on a `200` whose body passes schema validation. Any non-200,
network error, timeout, or parse failure → log, leave local data **completely untouched**, retry next tick.

Pull failures are non-fatal and never block the UI. The app stays fully usable offline; a stale local table is
always preferable to an empty one.

## 9. Testing

**Server (per endpoint):**
- `401` when the bearer is absent/invalid/stale.
- RBAC denial when the matrix lacks `view`.
- **Tenant IDOR:** user in tenant A receives zero rows belonging to tenant B.
- **User IDOR:** a worker cannot retrieve a colleague's payslips within the same tenant.
- Payslips from `draft` payrolls are excluded (D7).
- Payload shape: column names, epoch-ms dates, `deductions` parses as JSON.

**Mobile (pure reconcile — no DB):**
- Creates rows absent locally.
- Updates rows present in both.
- Destroys local rows absent from the server set.
- **Skips** server rows whose local counterpart has `synced === false`.
- **Preserves** local-only rows with `synced === false` (never destroyed).
- Payslips path: `hasPendingWrites` always false → pure server-wins.
- A failed fetch produces **no** mutations at all.

## 10. Files

**New**
- `apps/web/src/app/api/sync/tasks/route.ts`
- `apps/web/src/app/api/sync/payslips/route.ts`
- `apps/web/src/server/sync/serializers/` — task + payslip serializers (shared shape contract)
- `apps/mobile/src/sync/pull.ts` — `reconcile`, `pullTasks`, `pullPayslips`, `pullAll`
- Test files for each of the above

**Modified**
- `apps/mobile/src/sync/auto-sync.ts` — push-then-pull
- `apps/mobile/src/sync/index.ts` — export the pull surface
- `apps/mobile/src/app/(app)/tasks/index.tsx` — `RefreshControl`
- `apps/mobile/src/app/(app)/payslips/index.tsx` — `RefreshControl`; align rendering with the `deductions` JSON shape (D8)

**No schema migration.** No change to `packages/db/prisma/schema.prisma` and no WatermelonDB schema version
bump — every column this design writes already exists.

## 11. Open items for implementation

1. Confirm what `payslips/index.tsx` currently renders for `deductions`; align it with the D8 JSON shape. The
   screen has never received real data, so its current handling is untested.
2. Confirm the exact matrix feature key for payroll/payslip `view` in `ENTITY_FEATURE_MAP`.
