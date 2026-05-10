# Phase 8 Batch 4 Item 1 — Module 9 Banking Phase 2a (FundTransaction + Transfer)

**Tier:** T2 (score 15.5) | **Token estimate:** ~20K | **Predecessor:** Batch 3 Item 3 (`4708bb1`)
**Architect:** Opus 4.7 (planning) | **Executor:** Sonnet 4.6 (this task) via `Agent(model: "sonnet")`

## Pre-flight (MANDATORY before any code)

1. Read `.cline/STATE.md` first. Confirm `LAST_DONE` shows Batch 3 complete and Batch 4 plan ready.
2. Read ONLY these PRODUCT.md sections (NEVER the full file — anti-thrashing 🟢 2026-05-08):
   - Lines ~474–578 `### Banking & Finance`
   - Lines ~349–410 `### Inventory` (FundSource cross-references only — skim)
3. Read existing `apps/web/src/server/trpc/routers/banking.ts` (123 lines — see `bankingRouter` shape).
4. Read `apps/web/src/__tests__/banking.test.ts` (302 lines — extend pattern).
5. Inspect Prisma `FundTransaction` model: `pnpm --filter @orqafy/db exec prisma format && grep -A 30 'model FundTransaction' packages/db/prisma/schema/banking.prisma`.
6. Run `pnpm preflight` — must report SAFE before starting.

## Scope (from PRODUCT.md Module 9 — Banking & Finance)

**Entities (existing in schema — NO migrations):**
- `FundTransaction` — primary entity. Fields likely: id, fundSourceId, type (income/expense/transfer/cc_charge/cc_payment/loan_out/loan_in/payback), amount, balanceAfter, description, referenceType, referenceId, fundSourceFromId (transfers), fundSourceToId (transfers), createdById, createdAt
- `FundSource` — already CRUDed in Batch 2 Item 1 (`20fe862`). Read currentBalance, type, isActive.

**Procedures (`bankingRouter` — EXTEND existing file):**

```
transaction.list           paginated, filters: fundSourceId, type, dateRange (createdAt gte/lte)
transaction.byId           NOT_FOUND guard
transaction.recordIncome   { fundSourceId, amount>0, description, referenceType?, referenceId? }
                           → +amount on FundSource.currentBalance, type='income'
transaction.recordExpense  { fundSourceId, amount>0, description, ... }
                           → -amount on FundSource.currentBalance (cash/bank/e-wallet:
                           reject if would go below 0; credit_card: increases liability)
                           → type='expense'
transaction.transfer       { fromFundSourceId, toFundSourceId, amount>0, description }
                           → atomic db.$transaction: paired FundTransactions
                             (1 expense on `from`, 1 income on `to`), both reference each other
                             via referenceType='transfer' + referenceId=peer.id (set after both inserted)
                           → reject if from balance insufficient (real-cash sources)
                           → reject if from === to
transaction.recordCreditCardCharge   { fundSourceId (must be type='credit_card'), amount, description }
                                     → increases outstandingBalance (positive number, displayed red)
transaction.payCreditCard            { creditCardFundSourceId, payerFundSourceId, amount, description }
                                     → atomic: -amount on payer (real cash), -amount on cc liability
transaction.loanMoneyOutTo           { loanFundSourceId, toFundSourceId, amount, description }
                                     → atomic: loan currentBalance -= amount, target += amount
                                     → only allowed for loan accounts; rejects if loan exhausted
transaction.loanMoneyIn              { loanFundSourceId, fromFundSourceId, amount, description }
                                     → atomic: loan outstandingBalance -= amount, source -= amount
                                     → tracks principal repayment
```

**UI to implement (2 NEW pages):**
- `apps/web/src/app/(tenant)/[slug]/(app)/banking/transactions/page.tsx` — server component, transaction ledger table. Filter UI via GET form (fundSourceId select, type select, date range). Mirror `inventory/stock-movements/page.tsx` pattern. Last 100 entries ordered desc.
- `apps/web/src/app/(tenant)/[slug]/(app)/banking/fund-sources/[id]/page.tsx` — per-account history. Top: FundSource summary card (balance, type, status). Below: filtered transaction list for this fundSourceId. Header link back to `/banking/fund-sources`.

**Out of scope (deferred to Phase 2b):**
- FundReconciliation entity (bank statement reconciliation)
- Bulk import (CSV upload)
- Recurring transactions
- Multi-currency
- ProjectExpense FK from FundTransaction (added in Batch 4 Item 2)
- PO payment integration (added in Batch 4 Item 3)

## TDD Sequence (Rule 25 — RED → GREEN → REFACTOR)

For EACH new procedure:
1. Write the failing test FIRST in `banking.test.ts`. Run it. Confirm RED.
2. Implement minimal code in `banking.ts` to GREEN.
3. Refactor if obvious DRY opportunity (e.g. balance check helper).

Test coverage target: ~25 new tests, ~400 new lines. Categories:
- Each procedure: success path + at least 1 validation rejection + unauthenticated/demo-tenant rejection
- `transfer`: same-source rejection, insufficient-balance rejection, atomicity (mock $transaction)
- `recordExpense` real-cash: below-zero rejection
- `loanMoneyOutTo`: loan-exhausted rejection
- `payCreditCard`: payer-balance-insufficient rejection

## Lessons to apply proactively

- **Banking 🔴 2026-05-08:** ID inputs use `z.string().min(1)`, NOT `.cuid()`.
- **Vitest + Auth.js v5 🔴 2026-05-08:** NEVER import from `@/middleware`.
- **`createdById` Prisma-required 🔴 2026-05-08:** every transaction insert MUST include `createdById: ctx.userId`. Vitest mocks won't catch the missing field — typecheck will. Run `pnpm --filter @orqafy/web typecheck` after each edit.
- **`exactOptionalPropertyTypes` (item 3 lesson):** use conditional spread, not `Record<string,unknown> + cast`.
- **Atomic paired writes:** wrap transfer in `db.$transaction([...])` — both inserts succeed or both fail. Test by mocking `db.$transaction` to reject and assert both writes rolled back.
- **`value !== null` JSX guards** for nullable string fields (CRM lesson).

## Two-stage review (Rule 25, before merge)

Stage 1 — Spec compliance:
- [ ] All 8 listed procedures present and exported
- [ ] Both UI pages render without console errors
- [ ] FundSource.currentBalance updates correctly on every txn
- [ ] Transfer is atomic (both entries committed or both rolled back)

Stage 2 — Code quality:
- [ ] `pnpm --filter @orqafy/web lint --max-warnings 0` clean
- [ ] `pnpm --filter @orqafy/web typecheck` clean
- [ ] `pnpm --filter @orqafy/web vitest run banking.test.ts` all GREEN
- [ ] No `any` types, no `as` casts without comment
- [ ] Tests written BEFORE implementation (verifiable via git log if needed)

## Squash-merge + governance (Rule 23)

```
git checkout main && git merge --squash feat/banking-phase2a
git commit -m "feat(banking): Phase 8 Batch 4 Item 1 — FundTransaction + Transfer"
git branch -D feat/banking-phase2a
```

Governance writes (non-blocking, AFTER merge):
- `docs/CHANGELOG_AI.md` — Rule 15 format, Agent: CLAUDE_CODE
- `docs/IMPLEMENTATION_MAP.md` — new section under Phase Status
- `.cline/STATE.md` — `PHASE_8_BATCH_4.item-1: ✅ merged ([sha])`
- `.cline/memory/agent-log.md` — append entry
- `.cline/memory/lessons.md` — log any new 🔴/🟡/🟢/🟤

## Output Contract

When done, output:
```
✅ Phase 8 Batch 4 Item 1 COMPLETE — Banking Phase 2a merged ([sha]).
   8 new procedures + ~25 tests GREEN + 2 new UI pages.
   Open .cline/tasks/phase8-batch4-item2.md in a NEW Claude Code session.
```

## What unblocks after this item

- **Item 2** (Projects Phase 1 expansion) — ProjectExpense uses `FundTransaction` for cost recording.
- **Item 3** (Purchasing Phase 1) — `po.recordPayment` consumes `transaction.recordExpense` pattern; goods receipt creates ProjectExpense via Item 2.
- **Future Batch 5 Item 1** (HR/Payroll Phase 1) — payroll run deducts via `transaction.recordExpense`.
- **Future Module 11 POS** — every cash sale creates a FundTransaction.
