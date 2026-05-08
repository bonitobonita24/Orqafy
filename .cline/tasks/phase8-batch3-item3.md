# Phase 8 Batch 3 Item 3 — Module 7 Tasks + Module 8 DTR Phase 1 (combined)

> Open this file in a NEW Claude Code session. Fresh context per Rule 24.
> Do NOT auto-chain from Item 2 in the same session.
> This item COMBINES two small modules in one batch — verified SAFE by preflight (~70.9K).

---

## Pre-flight (MANDATORY before writing any code)

1. **Read `.cline/STATE.md` first.** Confirm `PHASE_8_BATCH_3.item-2: ✅ merged`.
2. **Read 9 governance docs** — lessons.md 🔴 first, 🟤 second.
3. **Run `pnpm preflight`** — anti-thrashing gate (V31):
   ```bash
   pnpm preflight \
     --task "Phase 8 Batch 3 Item 3: Module 7 Tasks + Module 8 DTR Phase 1 combined" \
     --phase phase-8-batch \
     --read "apps/web/src/server/trpc/routers/_app.ts" \
     --new 7
   ```
   Expected: ✅ **SAFE** (~70,943 tokens — well below 80K).
   - **SAFE** → proceed.
   - **AT_RISK** → output the acknowledgment statement the script gives,
     then proceed with discipline.
   - **MUST_SPLIT** → STOP. Sub-divide into 3a (Tasks) + 3b (DTR) — they share
     no entities, so splitting is safe. Re-run preflight on each.

4. **Create branch:** `git checkout -b feat/tasks-dtr-phase1`.

**Why combined?** Tasks (Module 7) and DTR (Module 8) are both small — Tasks
spec is ~15 lines, DTR is ~5 lines in PRODUCT.md. They share no entities
(Tasks live under Projects/users; DTR lives under Employee/User). Combining
unblocks two downstream modules in one Sonnet 4.6 session: Tasks → Module 6
Projects, DTR → Module 10 HR/Payroll.

---

## Scope (from handoff + PRODUCT.md Modules 7 + 8)

### Module 7 — Tasks

**Entities (existing in schema — no migrations):**
- `Task` — primary entity; fields include title, description, projectId (optional), priority, status (Kanban-style), parentTaskId (self-ref for subtasks)
- `TaskAssignment` — multi-assignee join table
- `TaskAttachment` — image/document upload references
- `TaskStatusReport` — optional report on completion
- `ToDo` + `ToDoAttachment` — personal task list (Free-plan attachments gated)

**Procedures (`tasksRouter` — NEW file):**
- `task.list` — paginated, filter by `status`, `priority`, `projectId`, `assigneeId` (joins TaskAssignment), `parentTaskId`
- `task.byId` — with `assignments`, `attachments`, `subtasks` (children) included
- `task.create` — title + optional projectId/priority/parentTaskId; createdById from ctx
- `task.update` — partial: title, description, priority, status (state-machine validation: cannot skip from `todo` → `done` without intermediate?)
- `task.assign` — add or replace TaskAssignment rows (multi-assignee)
- `task.statusReport` — create a TaskStatusReport on a task
- `todo.list` / `todo.create` / `todo.update` / `todo.delete` — personal scope (filter by ctx.userId)
- `todo.addAttachment` — Free-plan gate: read tenant plan, reject if plan.code === "free"

### Module 8 — DTR (Daily Time Record)

**Entities (existing in schema — no migrations):**
- `AttendanceRecord` — GPS clock-in/out, `status` pending → approved workflow, `isSyncedFromOffline` flag
- `LeaveRequest` — vacation/sick/emergency, approval workflow

**Procedures (`dtrRouter` — NEW file):**
- `attendance.list` — filter by `employeeId`, `status`, date range
- `attendance.byId`
- `attendance.clockIn` — capture GPS lat/lng + timestamp; defaults status="pending"
- `attendance.clockOut` — closes the open AttendanceRecord for the user
- `attendance.approve` / `attendance.reject` — supervisor action; adds `reviewedById` + `reviewedAt`
- `leaveRequest.list` — filter by `employeeId`, `type`, `status`
- `leaveRequest.create` — type + start/end dates + reason
- `leaveRequest.approve` / `leaveRequest.reject` — supervisor action

**Combined wiring (1 file):**
- `apps/web/src/server/trpc/routers/_app.ts` — add `tasks: tasksRouter` and `dtr: dtrRouter`

**UI to implement (2 NEW pages):**
- `apps/web/src/app/(tenant)/[slug]/(app)/tasks/page.tsx` — Kanban board (todo / in_progress / done columns) + Calendar toggle stub. List from `task.list`.
- `apps/web/src/app/(tenant)/[slug]/(app)/dtr/page.tsx` — Attendance table + Leave requests table. Two sections.

**Out of scope (deferred):**
- Mobile app integration — `isSyncedFromOffline` flag is honored but mobile sync engine deferred to apps/mobile work
- Project board view (Module 6 Projects depends on this Item — that's the next batch)
- Payroll calculation hooks (Module 10 HR/Payroll consumes DTR — defer)
- Real Kanban drag-and-drop interactivity — Phase 1 just lists. Drag-and-drop is a Phase 2 enhancement.
- Calendar view rendering — header toggle stub only; full calendar view deferred.

---

## TDD Sequence (Rule 25)

**Files to create (5 new + 1 modified):**
1. `apps/web/src/__tests__/tasks.test.ts` (NEW) — write FIRST, RED
2. `apps/web/src/__tests__/dtr.test.ts` (NEW) — write FIRST, RED
3. `apps/web/src/server/trpc/routers/tasks.ts` (NEW) — bring tasks RED → GREEN
4. `apps/web/src/server/trpc/routers/dtr.ts` (NEW) — bring DTR RED → GREEN
5. `apps/web/src/server/trpc/routers/_app.ts` (MODIFIED) — wire both
6. `apps/web/src/app/(tenant)/[slug]/(app)/tasks/page.tsx` (NEW)
7. `apps/web/src/app/(tenant)/[slug]/(app)/dtr/page.tsx` (NEW)

**Sequence:**
1. Write `tasks.test.ts` — minimum 1 test per procedure + at least 1 unauthenticated/demo rejection per mutation. Target ~20 tests.
2. Write `dtr.test.ts` — same shape. Target ~15 tests.
3. Run `pnpm vitest run` for both — confirm RED.
4. Implement `tasks.ts` then `dtr.ts` to drive RED → GREEN.
5. Wire `_app.ts`.
6. Run `pnpm vitest run` — confirm GREEN.
7. Build the 2 UI pages.
8. Run `pnpm lint --max-warnings 0` and `pnpm typecheck` — must be clean.

---

## Lessons to apply proactively

- **Banking lesson 🔴 2026-05-08:** ID inputs use `z.string().min(1)`, NOT `.cuid()`.
- **CRM lesson:** `value !== null` (not `{value && ...}`) for nullable string JSX guards.
- **Vitest + Auth.js v5 🔴 2026-05-08:** NEVER import from `@/middleware` in unit tests.
- **Anti-thrashing 🟢 2026-05-08:** Read PRODUCT.md SECTIONS only (Modules 7 + 8 specifically), never the full 40K-token file. Use `grep -n -A 30 "## .*Module 7"` patterns.
- **Multi-router single-file batch (NEW for this item):** When wiring two new routers in `_app.ts` in one go, do BOTH imports and BOTH map entries in a single Edit to keep the diff atomic.
- **Free-plan gate pattern (Module 7 ToDo attachments):** Read tenant.planId → join plan.code; if `"free"` throw `FORBIDDEN` with message `"Upgrade to attach files to ToDos."`. Cache the plan lookup if multiple gated procedures use it.
- **State-machine validation pattern (Tasks status, Attendance status):** Define allowed transitions as a const map, validate before update. Match the existing `journalEntry.post` and `journalEntry.reverse` pattern from Item 1: read existing → check current state → throw `BAD_REQUEST` on invalid transition → write new state.

---

## Two-stage review (Rule 25, before merge)

**Stage 1 — Spec compliance:**
- [ ] Every Tasks procedure (task.list/byId/create/update/assign/statusReport, todo CRUD + attachment gate) implemented
- [ ] Every DTR procedure (attendance.list/byId/clockIn/clockOut/approve/reject, leaveRequest.list/create/approve/reject) implemented
- [ ] Both routers wired into _app.ts
- [ ] Tasks page renders Kanban-style columns
- [ ] DTR page renders attendance + leave sections
- [ ] Free-plan attachment gate enforced for ToDo

**Stage 2 — Code quality:**
- [ ] No `any` types in either router
- [ ] Tests written BEFORE implementation (RED → GREEN verifiable in commit history)
- [ ] Only blast-radius files touched (the 7 listed above)
- [ ] Conventional commit: `feat(tasks-dtr): Phase 1 — Tasks Kanban + DTR attendance/leave`

---

## Squash-merge + governance (Rule 23)

After both stages pass:
1. `git checkout main && git merge --squash feat/tasks-dtr-phase1`
2. `git commit -m "feat(tasks-dtr): Phase 8 Batch 3 Item 3 — Tasks + DTR Phase 1"`
3. `git branch -D feat/tasks-dtr-phase1`
4. **Governance writes (non-blocking):**
   - Append entry to `docs/CHANGELOG_AI.md` (Rule 15 format, Agent: CLAUDE_CODE)
   - Update `docs/IMPLEMENTATION_MAP.md`: Phase Status Phase 8 row + new detailed Item 3 section noting BOTH modules covered
   - Rewrite `.cline/STATE.md`: `PHASE_8_BATCH_3.item-3: ✅ merged ([sha])`. Mark Batch 3 as `status: COMPLETE`.
   - Append to `.cline/memory/agent-log.md`
   - Add 🟢 / 🟡 / 🔴 lesson if applicable
5. **After Item 3 merges, run Phase 8 adaptive replan** before proposing Batch 4. Re-cross-reference PRODUCT.md modules vs IMPLEMENTATION_MAP.md and propose the next 3-item batch (likely candidates per handoff: Banking 2a, Module 4 Purchasing Phase 1 unblocked by Item 2, Module 6 Projects Phase 1 unblocked by Tasks).
6. **Output:** `✅ Phase 8 Batch 3 Item 3 COMPLETE. Batch 3 fully merged. Run Phase 8 adaptive replan in a NEW session for Batch 4.`

---

## Output Contract

Before reporting complete:
- [ ] All tests GREEN (`pnpm vitest run` — tasks ~20 tests + dtr ~15 tests)
- [ ] `pnpm lint --max-warnings 0` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] Two-stage review PASS for BOTH modules
- [ ] Squash-merged to main, branch deleted
- [ ] CHANGELOG_AI + IMPLEMENTATION_MAP + STATE.md updated (Batch 3 marked COMPLETE)
- [ ] Final preflight verdict was SAFE or AT_RISK (acknowledged) — not MUST_SPLIT

If any check fails → fix before marking done. Do NOT merge with stale governance.

---

## What unblocks after this item

- **Module 6 Projects Phase 1** — needs Tasks ✅ (this item). Likely Batch 4 candidate.
- **Module 10 HR/Payroll Phase 1** — needs DTR ✅ (this item) + Employee model.
- **Mobile DTR sync engine** — once apps/mobile WatermelonDB is wired, AttendanceRecord.isSyncedFromOffline becomes meaningful.
