# Pause Handoff — Phase 8 Batch 3 confirmed, awaiting Sonnet 4.6 execution

**Date:** 2026-05-08
**Branch:** `main` (clean tree, no in-flight feature branch)
**HEAD commit:** `f980a48` (post-merge STATE.md bump after anti-thrashing preflight)
**Status:** PAUSED — user switching from Opus 4.7 to Sonnet 4.6 for Batch 3 execution.

---

## Why This Pause

User explicitly requested session pause AFTER confirming Batch 3 plan and BEFORE
any code is written. They want Batch 3 to execute in **Claude Sonnet 4.6** (the
project's primary execution model per `inputs.yml` model routing) rather than
in this Opus 4.7 session.

The anti-thrashing tooling (`pnpm preflight`) is calibrated for Sonnet 4.6's
80K SAFE zone — switching to Sonnet 4.6 for execution is the intended workflow.

---

## What This Session Accomplished (committed on main)

### 1. Phase 8 Batch 2 governance reconcile (commit `5993368`)
STATE.md was stale by 2 commits. Reconciled:
- `docs/CHANGELOG_AI.md` — added Item 3 entry (Module 5 Inventory Phase 1, merged `4c6b1f3`) + framework housekeeping note for `e0780ac` (CLAUDE.md V31 backups)
- `docs/IMPLEMENTATION_MAP.md` — Phase Status row updated, new detailed Item 3 section, Next Action rewritten
- `.cline/STATE.md` — `PHASE_8_BATCH_2.item-3: ✅ merged` + new `PHASE_8_BATCH_3` row

### 2. Anti-thrashing pre-flight gate (commit `5993368`)
- **NEW** `tools/preflight-context.mjs` — Node CLI, 373 lines.
  - Verdicts: `SAFE` (≤80K, exit 0) | `AT_RISK` (80–100K, exit 0 + acknowledgment required) | `MUST_SPLIT` (>100K, **exit 1 hard stop**)
  - Calibration: 3.8 chars/token, +15K conversation overhead, +2K per new file
  - Phase profiles: phase-4-part / phase-7-feature / phase-8-batch / generic
  - 6/6 self-tests pass via `pnpm preflight:test`
- `package.json` — `pnpm preflight` and `pnpm preflight:test` scripts
- `.claude/rules/phases.md` — Phase 4 + Phase 7 + Phase 8 anti-thrashing rules rewritten to mandate `pnpm preflight`. Mental token math now flagged as Rule 29 violation. **11 references** to `pnpm preflight` in the rules file.
- **NEW** `.cline/tasks/phase8-batch-template.md` — reusable batch task template
- 🟢 lesson logged in `.cline/memory/lessons.md` documenting calibration constants
- Empirical insight: `docs/PRODUCT.md` is ~40K tokens (half the SAFE zone) — confirms long-standing rule "PRODUCT.md sections only, never full file"

### 3. Phase 8 adaptive replan (this turn — not yet committed)
User confirmed Batch 3 plan. **Nothing committed for Batch 3 yet — execution begins
in next session.** Preflights validated all 3 items SAFE for Sonnet 4.6.

---

## CONFIRMED Batch 3 Plan

Calibrated for Claude Sonnet 4.6 (200K window, ~120K practical, ≤80K SAFE zone).
Each item preflight-verified. Foundation-first sequencing.

### Item 1 — Module 12 ACCOUNTING Phase 1
**Branch:** `feat/accounting-phase1`
**Preflight:** ~68,943 tokens ✅ **SAFE**
**New files:** ~4

**Scope:**
- `JournalEntry` CRUD + `JournalEntryLine` (debit/credit lines)
- `post` and `reverse` procedures (state transitions)
- `ChartOfAccount` list/byId (read-only — 31 accounts already seeded by Phase 6)
- `TaxRate` CRUD (VAT 12% already seeded)
- `FiscalYear` management (FY 2026 already seeded)

**Why first:** every transaction-bearing module (PO, Invoice, Payment, Payroll, Credit Card
billing) posts journal entries. Without Accounting Phase 1, every later module has to stub
or defer its accounting hook.

**Out of scope (defer to a later batch):**
- ProjectExpense.costType=inventory_consumed exception logic (PRODUCT.md line 596-598) —
  document the rule in router comments but enforce it later when ProjectExpense exists
- Reporting (P&L, Balance Sheet, Trial Balance) — separate feature

**Files (per template):**
- `apps/web/src/server/trpc/routers/accounting.ts` (NEW)
- `apps/web/src/__tests__/accounting.test.ts` (NEW — TDD RED first)
- `apps/web/src/server/trpc/routers/_app.ts` (wire `accounting` router)
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/page.tsx` (NEW — chart of accounts list)
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/journal-entries/page.tsx` (NEW — journal list)

### Item 2 — Module 5 INVENTORY Phase 2
**Branch:** `feat/inventory-phase2`
**Preflight:** ~72,992 tokens ✅ **SAFE**
**New files:** ~2

**Scope:**
- `StockMovement` CRUD (in/out/adjustment types — referenced from PO receipt, POS sale, transfers)
- `StockTransfer` (warehouse-to-warehouse)
- `StockAdjustment` (manual reconciliation with reason codes)
- Extends existing `inventoryRouter` — same file, same wiring

**Why second:** unblocks Purchasing (Module 4) goods receipt flow and POS (Module 11) stock
deduction. Both Module 4 and Module 11 are downstream targets.

**Out of scope:**
- Disbursement workflow (Module 4 Purchasing handles this)
- Serial-number tracking deep-dive (basic ProductSerialNumber only)

**Files:**
- `apps/web/src/server/trpc/routers/inventory.ts` (EXTEND — adds ~5 procedures)
- `apps/web/src/__tests__/inventory.test.ts` (EXTEND — adds ~10 tests)
- `apps/web/src/app/(tenant)/[slug]/(app)/inventory/stock-movements/page.tsx` (NEW)
- `apps/web/src/app/(tenant)/[slug]/(app)/inventory/page.tsx` (UPDATE — add Movements tab/link)

### Item 3 — Module 7 TASKS + Module 8 DTR Phase 1 (combined)
**Branch:** `feat/tasks-dtr-phase1`
**Preflight:** ~70,943 tokens ✅ **SAFE**
**New files:** ~5

**Scope (Tasks):**
- `Task` CRUD (title, description, projectId optional, priority, status Kanban)
- `TaskAssignment` (multi-assignee join — replaces single assignedTo)
- `Task.parentTaskId` (subtasks, self-referencing)
- `TaskAttachment` (image/document upload references)
- `TaskStatusReport` (optional report on completion)
- `ToDo` (personal task list, attachments behind Free-plan gate)

**Scope (DTR):**
- `AttendanceRecord` (GPS clock-in/out, pending→approved workflow, isSyncedFromOffline)
- `LeaveRequest` (vacation/sick/emergency, approval workflow)

**Why combined:** Tasks (15 lines spec) and DTR (5 lines spec) are both small. They share
no entities — Tasks live under Projects/users, DTR lives under Employee/User. Combining is
safe (preflight 70.9K SAFE) and unblocks two modules in one Sonnet 4.6 session:
Tasks → Module 6 Projects, DTR → Module 10 HR/Payroll.

**Files:**
- `apps/web/src/server/trpc/routers/tasks.ts` (NEW)
- `apps/web/src/__tests__/tasks.test.ts` (NEW)
- `apps/web/src/server/trpc/routers/dtr.ts` (NEW)
- `apps/web/src/__tests__/dtr.test.ts` (NEW)
- `apps/web/src/server/trpc/routers/_app.ts` (wire `tasks` and `dtr` routers)
- `apps/web/src/app/(tenant)/[slug]/(app)/tasks/page.tsx` (NEW — Kanban + Calendar toggle)
- `apps/web/src/app/(tenant)/[slug]/(app)/dtr/page.tsx` (NEW — attendance list + leave requests)

---

## Deferred (preflight returned AT_RISK or larger)

These are NOT in Batch 3. They're documented here so the next session knows they exist.

- **Module 9 BANKING Phase 2** (CreditCard + Loan + FundTransfer + FundRequest + FundTransaction
  ledger enhancements). Full Phase 2 preflight: ~88,405 tokens ⚠ AT_RISK.
  → Future split: 2a (CreditCard + transactions) + 2b (Loan + Transfers + Requests + ledger).
- **Module 3 CRM Phase 2** (Proposals + Quotations + Invoices + Payments + Subscriptions).
  Full Phase 2 preflight: ~97,374 tokens ⚠ AT_RISK (very close to 100K MUST_SPLIT).
  → Future split: 2a (Proposals + Quotations + Revisions) + 2b (Invoices + Payments + Subscriptions).
- **Module 4 Purchasing Phase 1** — depends on Inventory Phase 2 StockMovement. Sequence after
  Batch 3 Item 2.
- **Module 6 Projects Phase 1** — depends on Tasks ✅ (Batch 3 Item 3). Sequence after Batch 3 Item 3.
- **Module 10 HR/Payroll Phase 1** — depends on DTR ✅ (Batch 3 Item 3) + Employee model.
- **Module 11 POS, Module 13 Tickets, Module 14 E-Commerce, Module 15 Repairs, Module 16
  Customer Portal** — pending. POS depends on Inventory Phase 2 ✅. E-Commerce/Repairs/Portal
  are large; defer.

---

## Resume Instructions for the Sonnet 4.6 Session

**Step 0 — Switch to Sonnet 4.6.** Verify `inputs.yml` model routing already locks
`execution: claude-sonnet-4-6 via Claude Code` (it does — see STATE.md MODELS row).

**Step 1 — Open a NEW Claude Code session.** Sonnet 4.6 with fresh context.

**Step 2 — Verify branch is `main` and clean.**
```bash
git branch --show-current   # → main
git status --short          # → clean
git log --oneline -3        # → f980a48 (state bump) | 5993368 (preflight) | e0780ac (CLAUDE.md backups)
```

**Step 3 — Read STATE.md FIRST**, then this handoff. STATE.md will point here.

**Step 4 — Run preflight on Item 1 BEFORE writing any code:**
```bash
pnpm preflight \
  --task "Phase 8 Batch 3 Item 1: Module 12 Accounting Phase 1" \
  --phase phase-8-batch \
  --read "apps/web/src/server/trpc/routers/_app.ts,packages/db/prisma/schema.prisma" \
  --new 4
```
Expected: `✅ SAFE` (~68,943 tokens). If it returns differently because schema or _app.ts grew,
honor the new verdict. **MUST_SPLIT → STOP, sub-divide.**

**Step 5 — Open `.cline/tasks/phase8-batch-template.md` as the working pattern.**
Fill in `[bracket]` placeholders for Item 1. Follow Pre-flight → Scope → TDD →
Two-stage review → Squash-merge → Governance writes sequence.

**Step 6 — Create branch:** `git checkout -b feat/accounting-phase1`

**Step 7 — TDD (Rule 25):**
1. Write `apps/web/src/__tests__/accounting.test.ts` first. Run vitest. Confirm RED.
2. Write `apps/web/src/server/trpc/routers/accounting.ts` minimum to GREEN.
3. Wire into `apps/web/src/server/trpc/routers/_app.ts`.
4. Build UI pages.
5. `pnpm lint --max-warnings 0` and `pnpm typecheck` clean.

**Step 8 — Two-stage review** (Rule 25 — both stages MUST PASS):
- Stage 1: spec compliance per PRODUCT.md Module 12 Accounting section.
- Stage 2: no `any` types, TDD RED→GREEN verifiable in commits, blast-radius scope only.

**Step 9 — Squash-merge + governance** (Rule 23):
1. `git checkout main && git merge --squash feat/accounting-phase1`
2. `git commit -m "feat(accounting): Phase 8 Batch 3 Item 1 — Accounting Phase 1"`
3. `git branch -D feat/accounting-phase1`
4. Append entry to `docs/CHANGELOG_AI.md` (Rule 15 format, Agent: CLAUDE_CODE)
5. Update `docs/IMPLEMENTATION_MAP.md` Phase Status row + add detailed Item 1 section
6. Rewrite `.cline/STATE.md`: `PHASE_8_BATCH_3.item-1: ✅ merged ([sha])`
7. Append `.cline/memory/agent-log.md`
8. Add 🟢 / 🟡 / 🔴 lesson if applicable

**Step 10 — STOP.** Output `✅ Phase 8 Batch 3 Item 1 complete. Open Item 2 in a NEW
Claude Code session.` Per Rule 24, do NOT auto-chain to Item 2 in the same session.

Repeat steps 4–10 for Item 2 (`feat/inventory-phase2`) and Item 3 (`feat/tasks-dtr-phase1`).
After Item 3 merges, run Phase 8 adaptive replan again before proposing Batch 4.

---

## Lessons to Apply Proactively (avoid repeat thrashing)

From `.cline/memory/lessons.md` — these are 🔴 gotchas already burned in:

1. **z.string().cuid() rejects test fixture IDs** → use `z.string().min(1)` for ALL ID inputs
   (not just .cuid()). Banking lesson 2026-05-08.

2. **strict-boolean-expressions in JSX** → use `value !== null` not `{value && ...}` for
   nullable string fields. CRM lesson.

3. **Vitest cannot import from @/middleware** — middleware.ts has top-level `auth(...)` which
   transitively loads next-auth which fails to resolve next/server under vitest's Node runner.
   **RULE: extract any helper to `apps/web/src/lib/<name>.ts` BEFORE writing the test against
   it. NEVER import from @/middleware in a unit test.** 2026-05-08 thrashing root cause.

4. **PRODUCT.md is ~40K tokens — read SECTIONS only.** The preflight tool will catch this
   (PRODUCT.md full read alone consumes half the SAFE zone) but apply the discipline
   manually too: use `--read` only for files you actually need verbatim, use `codebase_search`
   or grep for everything else.

5. **AT_RISK acknowledgment is not optional.** If preflight returns AT_RISK, output the exact
   acknowledgment statement the script provides BEFORE writing any code. Then read PRODUCT.md
   sections only, use codebase_search over directory reads, and `/clear` if context starts
   thrashing mid-session.

6. **Branch deletion after squash-merge requires `-D` (force).** After `git merge --squash`,
   the branch is technically un-merged from git's perspective. `git branch -D feat/[name]`
   to delete cleanly.

---

## Repo State at Pause

```
Branch:          main
HEAD:            f980a48 (chore(governance): post-merge STATE.md bump)
Working tree:    clean (apart from this handoff being created in this turn)
Recent commits:
  f980a48  chore(governance): post-merge STATE.md bump (anti-thrashing preflight + Batch 2 reconcile)
  5993368  feat(tooling): anti-thrashing pre-flight gate + Phase 8 Batch 2 reconcile
  e0780ac  Add backup versions of CLAUDE.md for V31 with updated prompts and phase details
  4c6b1f3  feat(inventory): Phase 8 Batch 2 Item 3 — Inventory Phase 1 Product catalog + Warehouse CRUD
  e11c9df  chore(governance): Phase 8 Batch 2 Item 2 governance writes complete
  0f00247  feat(crm): Phase 8 Batch 2 Item 2 — CRM Phase 1 Customer/Contact/Credit CRUD
  20fe862  feat(banking): Phase 8 Batch 2 Item 1 — FundSource CRUD complete
```

**No uncommitted feature work.** No open feature branches. Pre-flight tool is on main and
ready to use. Sonnet 4.6 session can begin Item 1 immediately after reading STATE.md and
this handoff.

---

## Confirmation Trail

- 2026-05-08 (this Opus 4.7 session): Phase 8 adaptive replan output presented with 3-item
  Batch 3 plan + 2 deferred AT_RISK items. User replied:
  > "this is confirmed but dont start yet, let me switch first to sonnet 4.6 model.
  >  save this session so that i will continue this in sonnet 4.6 model"
- Plan is **CONFIRMED**. No reordering, no substitution. Item 1 first, Item 2 next, Item 3 last.
- Sonnet 4.6 session has authority to begin Item 1 immediately upon reading STATE.md +
  this handoff. No additional confirmation needed.

## What is NOT Done

Everything in Batch 3 — that is the entire next-session scope.

No DECISIONS_LOG.md updates this turn. The `pnpm preflight` calibration constants are
documented in `.cline/memory/lessons.md` (🟢 change format) which is sufficient — these
are tactical tooling values, not architectural decisions.
