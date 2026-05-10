# Phase 8 Batch 4 Item 2 — Module 6 Projects Phase 1 Expansion (ProjectExpense + Milestones)

**Tier:** T2 (score 24) | **Token estimate:** ~25K | **Predecessor:** Batch 4 Item 1 (Banking 2a)
**Architect:** Opus 4.7 (planning) | **Executor:** Sonnet 4.6 (this task) via `Agent(model: "sonnet")`

## Pre-flight (MANDATORY before any code)

1. Read `.cline/STATE.md` first. Confirm `LAST_DONE` shows Batch 4 Item 1 merged.
2. Read ONLY these PRODUCT.md sections:
   - Lines ~411–451 `### Projects`
   - Lines ~474–578 skim — Banking & Finance (FundTransaction reference only)
3. Read existing files:
   - `apps/web/src/server/trpc/routers/project.ts` (90 lines — current stub)
   - `apps/web/src/server/trpc/routers/banking.ts` (post-Item-1 — for FundTransaction patterns)
   - `apps/web/src/server/trpc/routers/inventory.ts` (438 lines — for paginated list pattern reference; READ ONLY, do not modify)
4. Inspect Prisma models: `grep -A 30 'model Project\|model ProjectExpense\|model ProjectMilestone' packages/db/prisma/schema/project.prisma`
5. Run `pnpm preflight` — must report SAFE before starting.

## Scope (from PRODUCT.md Module 6 — Projects)

**Entities (existing in schema — NO migrations):**
- `Project` — core entity (already partially used). Confirm: name, customerId (FK to Customer), description, status enum, startDate, targetEndDate, actualEndDate, budget (Decimal), createdById
- `ProjectExpense` — line items. Confirm: projectId, amount, description, costType (`inventory_consumed`/`labor`/`materials`/`subcontractor`/`other`), fundSourceId (nullable — links to FundTransaction), fundTransactionId (nullable), expenseDate, recordedById
- `ProjectMilestone` — schedule markers. Confirm: projectId, title, description, dueDate, completedAt (nullable), order (int)

**Procedures (`projectRouter` — EXTEND existing 90-line file):**

```
KEEP existing (verify they match patterns):
  list                      paginated, filters: customerId, status
  byId                      with include: customer, milestones, expenses (counts only)
  create                    name+customer required

NEW procedures to add:
  update                    partial: name, description, status (state-machine), targetEndDate, budget
  archive                   sets status='cancelled' (cannot delete projects with expenses)
  budgetSummary({ projectId }) → { totalBudget, totalSpent, totalCommitted, remaining }
                            sums ProjectExpense.amount where projectId

expense.listByProject({ projectId, page, limit })
                            paginated. Include fundSource (name, type) on each row.
expense.recordProjectExpense({
   projectId, amount, description, costType, fundSourceId, expenseDate
})
                            atomic: creates ProjectExpense + paired FundTransaction
                            (calls Item 1's transaction.recordExpense pattern internally)
                            Stamps fundTransactionId on the ProjectExpense after txn insert.
                            recordedById from ctx.

milestone.listByProject({ projectId })           ordered by `order` asc
milestone.create({ projectId, title, description?, dueDate?, order })
milestone.complete({ milestoneId })              sets completedAt=now()
milestone.update({ milestoneId, title?, description?, dueDate?, order? })
```

**State machine (project.update):**
Valid transitions:
- `planning → active`
- `active → on_hold`
- `on_hold → active`
- `active → completed`
- `planning → cancelled` · `active → cancelled` · `on_hold → cancelled`
Reject any other transition with `BAD_REQUEST`.

**UI to implement (2 NEW pages, 1 page MODIFY):**
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/[id]/page.tsx` — NEW. Project detail with tabs: **Overview** (default — status/budget/dates/customer), **Tasks** (filter task.list by projectId), **Expenses** (link → expenses page), **Milestones** (inline list + complete button per milestone).
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/[id]/expenses/page.tsx` — NEW. ProjectExpense list table (date, description, costType, amount, fundSource). Total at bottom. "Record Expense" button (form below or modal-stub).
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/page.tsx` — MODIFY existing list page. Add status counts header (planning/active/on_hold/completed/cancelled) + filter dropdown.

**Out of scope (deferred to Phase 2):**
- Project file attachments
- Project user assignments (PM, members) — separate ProjectAssignment entity, not Phase 1
- Gantt chart / timeline view
- Project templates
- Recurring projects
- Budget alerts (>80% spent notifications)
- Profitability calculation (revenue from invoices vs expenses) — needs Invoice integration, defer

## TDD Sequence (Rule 25 — RED → GREEN → REFACTOR)

Test coverage target: ~30 tests, ~600 new lines in `apps/web/src/__tests__/project.test.ts` (NEW file).

Categories:
- Each new procedure: success path + ≥1 validation rejection + unauthenticated/demo rejection
- `update` state-machine: 3 valid transitions GREEN + 3 invalid transitions REJECT
- `expense.recordProjectExpense`: atomic mock — assert both ProjectExpense and FundTransaction created
- `expense.recordProjectExpense`: rollback test — mock $transaction throw, assert no orphan ProjectExpense
- `archive`: blocked when expenses exist
- `milestone.complete`: idempotency — already-completed milestone rejected with `BAD_REQUEST`
- `budgetSummary`: aggregation correctness with 0 expenses, with multiple expenses

## Lessons to apply proactively

- **Banking 🔴 2026-05-08:** `z.string().min(1)` for ALL ID inputs.
- **`createdById` Prisma-required 🔴 2026-05-08:** every Project, ProjectExpense, FundTransaction insert MUST stamp `createdById`/`recordedById: ctx.userId`. Run typecheck after each.
- **Atomic paired writes (Item 1 pattern):** `expense.recordProjectExpense` wraps `db.$transaction([...])` — ProjectExpense insert + FundTransaction insert + FundSource balance update. Tested via mock-throw rollback assertion.
- **Vitest + Auth.js v5 🔴 2026-05-08:** never import `@/middleware` from a unit test.
- **State-machine pattern (matches `journalEntry.post` and `task.updateStatus`):** const map of valid transitions, validate before update, throw `BAD_REQUEST` on invalid.
- **`exactOptionalPropertyTypes`:** conditional spread for filters with optional fields. Do NOT pass `{ key: undefined }`.
- **Schema-field-name bugs 🔴 2026-05-08:** verify field names against Prisma BEFORE writing tests. Specifically check `recordedById` vs `createdById` on ProjectExpense — different from Task pattern.

## Two-stage review (Rule 25, before merge)

Stage 1 — Spec compliance:
- [ ] All listed procedures present and exported
- [ ] State-machine validates 6 transitions correctly
- [ ] `expense.recordProjectExpense` is ATOMIC (FundTransaction created + linked + balance updated)
- [ ] Project detail page renders all 4 tabs
- [ ] Status counts header on /projects shows all 5 statuses

Stage 2 — Code quality:
- [ ] `pnpm --filter @orqafy/web lint --max-warnings 0` clean
- [ ] `pnpm --filter @orqafy/web typecheck` clean
- [ ] `pnpm --filter @orqafy/web vitest run project.test.ts` all GREEN
- [ ] Total test count post-merge ≥ 285 (was 222 + ~25 from Item 1 + ~30 here)
- [ ] No `any`, no unguarded `as`, no `value &&` for nullable strings in JSX

## Squash-merge + governance (Rule 23)

```
git checkout main && git merge --squash feat/projects-phase1-expand
git commit -m "feat(projects): Phase 8 Batch 4 Item 2 — ProjectExpense + Milestones + state-machine"
git branch -D feat/projects-phase1-expand
```

Governance writes:
- `docs/CHANGELOG_AI.md` — Rule 15 format
- `docs/IMPLEMENTATION_MAP.md` — Phase 8 Batch 4 Item 2 section
- `.cline/STATE.md` — `PHASE_8_BATCH_4.item-2: ✅ merged ([sha])`
- `.cline/memory/agent-log.md` + `lessons.md` if applicable

## Output Contract

```
✅ Phase 8 Batch 4 Item 2 COMPLETE — Projects Phase 1 Expansion merged ([sha]).
   ~9 new procedures + ~30 tests GREEN + 2 new pages + projects list enhanced.
   ProjectExpense atomic with FundTransaction (Item 1 pattern verified).
   Open .cline/tasks/phase8-batch4-item3.md in a NEW Claude Code session.
```

## What unblocks after this item

- **Item 3** (Purchasing Phase 1) — `goodsReceipt.create` writes ProjectExpense for `costType=inventory_consumed` via this item's pattern.
- **Future Module 11 POS** — POS sales linked to project use ProjectExpense for cost basis.
- **Future Reports** — project profitability calc (revenue vs ProjectExpense sum).
