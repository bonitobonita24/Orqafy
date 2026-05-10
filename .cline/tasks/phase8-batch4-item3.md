# Phase 8 Batch 4 Item 3 — Module 4 Purchasing Phase 1 (Vendor + PO + GoodsReceipt)

**Tier:** T2-edge (score 29.5 — close to T3 boundary) | **Token estimate:** ~30K AT EDGE
**Predecessors:** Batch 4 Item 1 (Banking 2a) + Item 2 (Projects expansion) BOTH MERGED
**Architect:** Opus 4.7 (planning) | **Executor:** Sonnet 4.6 (this task) via `Agent(model: "sonnet")`

## ⚠ Pre-flight Split Decision (MANDATORY)

This item is at the edge of Sonnet's 30K budget. **Run `pnpm preflight` FIRST.** If preflight returns >25K estimated:

> **STOP — split into Item 3a + 3b before writing any code:**
> - **3a:** purchasing.ts router + purchasing.test.ts (~22K) — backend only
> - **3b:** UI pages (purchasing/page, vendors, orders/[id]) (~12K) — frontend only
> Open separate `phase8-batch4-item3a.md` and `phase8-batch4-item3b.md` task files.
> Architect (Opus) will re-decompose if Sonnet flags `BLOCKED — task too large`.

If preflight returns ≤25K → proceed as combined Item 3.

## Pre-flight (MANDATORY)

1. Read `.cline/STATE.md`. Confirm BOTH Item 1 AND Item 2 merged.
2. Read ONLY these PRODUCT.md sections:
   - Lines ~268–348 `### Purchasing` (full module spec)
   - Lines ~411–451 skim — Projects (ProjectExpense FK target)
   - Lines ~349–410 skim — Inventory (StockMovement write API)
3. Read existing files (READ ONLY, do not modify except `_app.ts`):
   - `apps/web/src/server/trpc/routers/inventory.ts` (438 lines — StockMovement create pattern)
   - `apps/web/src/server/trpc/routers/banking.ts` (post-Item-1 — transaction.recordExpense pattern)
   - `apps/web/src/server/trpc/routers/project.ts` (post-Item-2 — expense.recordProjectExpense pattern)
4. Inspect Prisma models: `grep -A 30 'model Vendor\|model PurchaseOrder\|model PurchaseOrderLine\|model GoodsReceipt\|model PurchaseAllocation' packages/db/prisma/schema/purchasing.prisma`
5. Run `pnpm preflight`. Apply split decision above.

## Scope (from PRODUCT.md Module 4 — Purchasing)

**Entities (existing in schema — NO migrations):**
- `Vendor` — supplier directory. Fields: name, type (direct_supplier/ecommerce/marketplace), contactName, email, phone, address, isActive, paymentTerms (net_30 etc.)
- `PurchaseOrder` — main PO. Fields: poNumber (auto), vendorId, status enum, subtotal, tax, totalAmount, paymentStatus, paymentFundSourceId (nullable), notes, createdById
- `PurchaseOrderLine` — line items. Fields: poId, productId (FK to Inventory.Product), quantity, unitCost, lineTotal, description (override)
- `PurchaseAllocation` — splits each line's quantity. Fields: poLineId, allocationType (`stock`/`project_expense`/`company_expense`), quantity, projectId (when type=project_expense), warehouseId (when type=stock)
- `GoodsReceipt` — receiving event. Fields: poId, receivedAt, receivedById, notes, status (partial/complete)
- `GoodsReceiptLine` — what was received per allocation. Fields: receiptId, allocationId, quantityReceived

**Status state-machines:**
- `PurchaseOrder.status`: `draft → submitted → approved → receiving → completed` · cancellable from draft/submitted
- `PurchaseOrder.paymentStatus`: `unpaid → partially_paid → paid`
- `GoodsReceipt.status`: `partial` (some lines short) · `complete` (all lines fully received)

**Procedures (`purchasingRouter` — NEW file):**

```
vendor.list               paginated, filter isActive/type
vendor.byId               NOT_FOUND guard
vendor.create             writeProcedure (rejects demo tenant)
vendor.update             partial
vendor.toggleActive

po.list                   paginated, filter status/vendorId/dateRange
po.byId                   include: vendor, lines (with allocations + product), receipts
po.create                 { vendorId, lines: [{ productId, quantity, unitCost, allocations: [{type, quantity, projectId?, warehouseId?}]}], notes? }
                          - sum of allocation.quantity per line === line.quantity (validate)
                          - allocation.type=stock requires warehouseId; type=project_expense requires projectId
                          - poNumber auto-generated (e.g. "PO-{YY}{MM}-{seq}")
                          - status='draft', paymentStatus='unpaid'
                          - subtotal/tax/totalAmount computed server-side
po.update                 ONLY when status='draft'. Replace lines if changed.
po.submit                 draft → submitted
po.approve                submitted → approved (admin/purchasing_manager only — role gate)
po.cancel                 draft|submitted → cancelled
po.recordPayment({ poId, fundSourceId, amount, partial?: boolean })
                          - calls Item 1's transaction.recordExpense pattern internally
                          - updates paymentStatus based on cumulative paid vs totalAmount
                          - links FundTransaction.referenceType='purchase_order', referenceId=poId

goodsReceipt.create({ poId, receivedAt, lines: [{ allocationId, quantityReceived }], notes? })
                          ATOMIC (db.$transaction):
                          - Validate PO.status === 'approved' or 'receiving'
                          - For EACH allocation in input:
                              - allocationType=stock: writes StockMovement (type=in,
                                referenceType='goods_receipt', referenceId=receipt.id,
                                productId, warehouseId, quantity)
                              - allocationType=project_expense: creates ProjectExpense
                                (calls Item 2's pattern; costType='inventory_consumed',
                                amount = quantityReceived * line.unitCost,
                                fundSourceId from PO.paymentFundSourceId, recordedById=ctx.userId)
                              - allocationType=company_expense: creates Expense entity
                                (existing expense router — reuse pattern)
                          - GoodsReceipt.status set: 'complete' if all allocations fully received
                            across all receipts, else 'partial'
                          - PO.status: → 'receiving' on first receipt, → 'completed' when all received
                          - createdById = ctx.userId
goodsReceipt.list({ poId })       all receipts for a PO
goodsReceipt.byId
```

**Wiring (1 file MODIFY):**
- `apps/web/src/server/trpc/routers/_app.ts` — add `purchasing: purchasingRouter` (1 import + 1 entry)

**UI to implement (3 NEW pages):**
- `apps/web/src/app/(tenant)/[slug]/(app)/purchasing/page.tsx` — PO list. Status filter (GET form). Columns: PO#, vendor, total, status, payment status, date. Header link → "Vendors".
- `apps/web/src/app/(tenant)/[slug]/(app)/purchasing/vendors/page.tsx` — vendor list. isActive filter.
- `apps/web/src/app/(tenant)/[slug]/(app)/purchasing/orders/[id]/page.tsx` — PO detail with lines + allocations table (productname, qty, unitCost, allocations breakdown), status banner, payment summary, list of receipts to date.

**Out of scope (deferred to Phase 2):**
- PO line-item edit while in non-draft status
- Vendor performance metrics (on-time %, dispute rate)
- E-commerce single-transaction-group purchases (Shopee bulk PO) — Phase 2
- Returns / RMA flow
- Vendor catalogs / price lists
- Multi-currency PO
- Approval workflow chain (only single-step approval in Phase 1)
- Goods receipt photo attachments
- 3-way match (PO + receipt + invoice reconciliation)

## TDD Sequence (Rule 25 — RED → GREEN → REFACTOR)

Test coverage target: ~35 tests, ~700 lines in `apps/web/src/__tests__/purchasing.test.ts` (NEW file).

Critical test categories:
- Each procedure: success + validation reject + auth/demo reject
- `po.create` allocation validation: sum mismatch → BAD_REQUEST; project_expense without projectId → BAD_REQUEST; stock without warehouseId → BAD_REQUEST
- `po.update` blocked when status !== 'draft'
- Status state-machine: each valid transition GREEN, each invalid REJECT
- `po.recordPayment`: atomic with FundTransaction; partial payment → paymentStatus='partially_paid'; full → 'paid'
- `goodsReceipt.create` ATOMIC: mock `db.$transaction` throw → assert NO StockMovement, NO ProjectExpense created
- `goodsReceipt.create` partial: receive < requested → status='partial', PO stays 'receiving'
- `goodsReceipt.create` full: receive all → status='complete', PO → 'completed'
- `goodsReceipt.create` allocation routing: 1 PO with 3 allocation types (stock + project + company) creates StockMovement + ProjectExpense + Expense in single transaction

## Lessons to apply proactively (cumulative — all prior batches)

- **Banking 🔴 2026-05-08:** `z.string().min(1)` for IDs.
- **`createdById` Prisma-required 🔴 2026-05-08:** stamp on EVERY insert (Vendor, PO, POLine, Allocation, Receipt, ReceiptLine, StockMovement, ProjectExpense, FundTransaction).
- **Vitest + Auth.js v5 🔴 2026-05-08:** no `@/middleware` imports.
- **Atomic multi-write (Items 1+2 pattern):** `goodsReceipt.create` is the largest atomic op in the codebase — ALL writes wrapped in single `db.$transaction([...])`. Test rollback paths.
- **State-machine pattern:** PO has TWO independent state machines (status + paymentStatus). Define as separate const maps; validate independently.
- **`exactOptionalPropertyTypes`:** conditional spread for optional `projectId`, `warehouseId` on allocations.
- **Schema-field-name verification 🔴 2026-05-08:** confirm `paymentFundSourceId` vs `paymentSourceId`, `quantityReceived` vs `qtyReceived` in Prisma BEFORE writing tests.
- **Decimal arithmetic:** unitCost × quantity uses `Prisma.Decimal` math. Convert with `Number(Decimal)` only for display, never for math.
- **Role-gate on po.approve:** inline `requireApproverRole(ctx.roles, ["Administrator", "Purchasing Manager"])` per DTR pattern from Item 3 of Batch 3.

## Two-stage review (Rule 25, before merge)

Stage 1 — Spec compliance:
- [ ] All vendor + po + goodsReceipt procedures present
- [ ] PO status state-machine + paymentStatus state-machine both enforced
- [ ] `goodsReceipt.create` ATOMIC: tested rollback path
- [ ] All 3 allocation types correctly route to StockMovement / ProjectExpense / Expense
- [ ] All 3 UI pages render without console errors
- [ ] Cross-module integration verified: PO with stock allocation increases inventory; PO with project_expense allocation creates ProjectExpense linked to FundTransaction

Stage 2 — Code quality:
- [ ] `pnpm --filter @orqafy/web lint --max-warnings 0` clean
- [ ] `pnpm --filter @orqafy/web typecheck` clean
- [ ] `pnpm --filter @orqafy/web vitest run` all GREEN (target ≥320 total tests post-merge)
- [ ] No `any`, no unguarded `as`, no `value &&` JSX guards on nullable strings
- [ ] Decimal math correct (no floating-point drift)

## Squash-merge + governance (Rule 23)

```
git checkout main && git merge --squash feat/purchasing-phase1
git commit -m "feat(purchasing): Phase 8 Batch 4 Item 3 — Vendor + PO + GoodsReceipt with allocations"
git branch -D feat/purchasing-phase1
```

Governance writes:
- `docs/CHANGELOG_AI.md` — Rule 15 format. Note: this commit closes Batch 4.
- `docs/IMPLEMENTATION_MAP.md` — Phase 8 Batch 4 Item 3 section + Phase 8 row to "Batch 4 ✅ COMPLETE (3/3)"
- `.cline/STATE.md` — `PHASE_8_BATCH_4.item-3: ✅ merged ([sha])`. Mark Batch 4 as `status: COMPLETE`.
- `.cline/memory/agent-log.md` + `lessons.md` if applicable

## Output Contract

```
✅ Phase 8 Batch 4 Item 3 COMPLETE — Purchasing Phase 1 merged ([sha]).
   ✅ Phase 8 Batch 4 fully merged.
   ~14 new procedures + ~35 tests GREEN + 3 new UI pages.
   Cross-module integration verified: PO → StockMovement (Inventory) + ProjectExpense (Item 2) +
   FundTransaction (Item 1) all in single atomic goodsReceipt.create transaction.
   Run Phase 8 adaptive replan in a NEW session for Batch 5.
```

## What unblocks after this item

- **Future Batch 5 candidates:**
  - Module 10 HR/Payroll Phase 1 — add tests to existing employee.ts/payroll.ts; payroll runs use Item 1 FundTransaction.
  - Module 11 POS Phase 1 — POS session, cart, payment via FundTransaction.
  - Module 13 Job Order Phase 1 expansion — flesh out 188-line stub + tests.
  - Module 14 E-commerce Phase 1 — uses Customer ✅, Order, EcommerceOrder pulled into Purchasing PO.
  - Module 15 Support Phase 1 — Ticket entity, SupportComment, link to Project ✅ + Customer ✅.
- **Mobile app Phase 1** (apps/mobile WatermelonDB) — DTR clock-in offline sync now meaningful with full backend.
