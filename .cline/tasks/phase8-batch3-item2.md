# Phase 8 Batch 3 Item 2 — Module 5 Inventory Phase 2 — StockMovement / Transfer / Adjustment

> Open this file in a NEW Claude Code session. Fresh context per Rule 24.
> Do NOT auto-chain from Item 1 in the same session.

---

## Pre-flight (MANDATORY before writing any code)

1. **Read `.cline/STATE.md` first.** Confirm `PHASE_8_BATCH_3.item-1: ✅ merged (69d1c6a)`.
2. **Read 9 governance docs** — lessons.md 🔴 first, 🟤 second.
3. **Run `pnpm preflight`** — anti-thrashing gate (V31):
   ```bash
   pnpm preflight \
     --task "Phase 8 Batch 3 Item 2: Module 5 Inventory Phase 2 (StockMovement extends inventoryRouter)" \
     --phase phase-8-batch \
     --read "apps/web/src/server/trpc/routers/_app.ts,apps/web/src/server/trpc/routers/inventory.ts,apps/web/src/__tests__/inventory.test.ts" \
     --new 2
   ```
   Expected: ✅ **SAFE** (~73,000 tokens — well below 80K).
   - **SAFE** → proceed.
   - **AT_RISK** → output the acknowledgment statement the script gives,
     then proceed with discipline (PRODUCT.md sections only, codebase_search
     over directory reads, /clear if context starts thrashing).
   - **MUST_SPLIT** → STOP. Sub-divide by movement type. Re-run preflight.
     Each sub-task must verdict SAFE before any code is written.

4. **Create branch:** `git checkout -b feat/inventory-phase2`.

---

## Scope (from handoff + PRODUCT.md Module 5)

**Module:** 5 — Inventory
**Phase:** 2 — Stock movement, transfer, and adjustment

**Important schema clarification (verify before coding):**
The Prisma schema has ONE `StockMovement` table with a `type` discriminator
(`in | out | adjustment | transfer`). There are NO separate `StockTransfer`
or `StockAdjustment` tables — those concepts are represented as
`StockMovement` records with the appropriate `type` value, plus optional
`fromWarehouseId` / `toWarehouseId` for transfers and `referenceType` /
`referenceId` for upstream linkage (PO receipt, POS sale, etc.).

**Entities touched (existing — no migrations):**
- `StockMovement` — primary write target, all types
- `WarehouseStock` — read-only summary (already exists from Phase 1)
- `Warehouse`, `Product` — read-only references

**Procedures to ADD to `inventoryRouter` (extends Phase 1 — same file):**
- `stockMovementList` — paginated, filters by `type`, `productId`, `warehouseId` (matches either from/to), date range
- `stockMovementById` — single record with related product/warehouse loaded
- `stockMovementCreate` — generic create (caller specifies type). Validates: `in` requires `toWarehouseId`; `out` requires `fromWarehouseId`; `transfer` requires BOTH; `adjustment` requires one warehouse + a reason note
- `stockTransfer` — convenience wrapper that creates a `transfer`-type StockMovement (WarehouseStock decrement at fromWarehouse + increment at toWarehouse — Phase 1 stockList already aggregates so no separate write needed if Phase 1 reads from WarehouseStock; verify before coding)
- `stockAdjustment` — convenience wrapper that creates an `adjustment`-type StockMovement requiring a reason note

**UI to implement (1 NEW page + 1 update):**
- `apps/web/src/app/(tenant)/[slug]/(app)/inventory/stock-movements/page.tsx` (NEW) — table of recent movements with type filter, date range, warehouse filter
- `apps/web/src/app/(tenant)/[slug]/(app)/inventory/page.tsx` (UPDATE) — add "Stock Movements →" link in the header to discover the new page

**Out of scope (deferred):**
- Disbursement / receipt workflows for Purchasing (Module 4 will own those flows; StockMovement records are written from Module 4 once Phase 1 lands)
- Serial-number tracking deep-dive — basic `ProductSerialNumber` interactions only; full lifecycle deferred
- POS stock deduction trigger (Module 11 territory)
- WarehouseStock direct mutation API (use StockMovement creation as the canonical write path)

---

## TDD Sequence (Rule 25)

1. **Write failing tests FIRST** in `apps/web/src/__tests__/inventory.test.ts`
   (extend the existing 33-test file). Add at minimum:
   - `stockMovementList` — paginated returns, type filter, warehouse filter, unauthenticated rejection (4 tests)
   - `stockMovementById` — found, NOT_FOUND (2 tests)
   - `stockMovementCreate` — `in` happy path, `out` happy path, `transfer` validation (rejects without both warehouses), `adjustment` requires note, demo tenant rejection (5 tests)
   - `stockTransfer` — happy path + same-warehouse rejection (2 tests)
   - `stockAdjustment` — happy path + missing note rejection (2 tests)
   Total: ~15 new tests on top of existing 33 → ~48 total.
2. Run `pnpm vitest run src/__tests__/inventory.test.ts`. Confirm RED for the new tests.
3. Implement procedures in `apps/web/src/server/trpc/routers/inventory.ts` to drive RED → GREEN.
   No `_app.ts` change needed — `inventoryRouter` is already wired.
4. Run vitest again. Confirm GREEN.
5. Build the UI page.
6. Run `pnpm lint --max-warnings 0` and `pnpm typecheck` — must be clean.

---

## Lessons to apply proactively

- **Banking lesson 🔴 2026-05-08:** ID inputs use `z.string().min(1)`, NOT `.cuid()`.
- **CRM lesson:** `value !== null` (not `{value && ...}`) for nullable string JSX guards.
- **Vitest + Auth.js v5 🔴 2026-05-08:** NEVER import from `@/middleware` in unit tests.
  Extract any middleware-adjacent helper to `apps/web/src/lib/<name>.ts` first.
- **Anti-thrashing 🟢 2026-05-08:** PRODUCT.md is ~40K tokens — read SECTIONS only
  via `grep`, never the full file. `pnpm preflight` enforces this via budget computation.
- **Decimal handling (from accounting Item 1):** Prisma `Decimal` columns return as strings
  in mock fixtures. Convert via `Number(field)` before arithmetic. UI sums use
  `values.reduce((acc, v) => acc + Number(v.field), 0)`.
- **Warehouse-pair validation:** `from === to` on a transfer is a logic error — reject
  with `BAD_REQUEST` before persistence.

---

## Two-stage review (Rule 25, before merge)

**Stage 1 — Spec compliance:**
- [ ] All 5 procedures (list, byId, create, stockTransfer, stockAdjustment) implemented
- [ ] Type-specific validation enforced (in/out/transfer/adjustment requirements)
- [ ] Stock Movements page renders with type filter + warehouse filter
- [ ] Inventory page header has link to stock-movements

**Stage 2 — Code quality:**
- [ ] No `any` types
- [ ] Tests written BEFORE implementation (RED → GREEN verifiable in commit history)
- [ ] Only blast-radius files touched: inventory.ts, inventory.test.ts, 2 page files
- [ ] Conventional commit: `feat(inventory): Phase 2 — StockMovement/Transfer/Adjustment`
- [ ] No nested `include` from configurable foreign keys without explicit tenantId verification (security.md rule 7)

---

## Squash-merge + governance (Rule 23)

After both stages pass:
1. `git checkout main && git merge --squash feat/inventory-phase2`
2. `git commit -m "feat(inventory): Phase 8 Batch 3 Item 2 — Inventory Phase 2"`
3. `git branch -D feat/inventory-phase2`
4. **Governance writes (non-blocking):**
   - Append entry to `docs/CHANGELOG_AI.md` (Rule 15 format, Agent: CLAUDE_CODE)
   - Update `docs/IMPLEMENTATION_MAP.md`: Phase Status Phase 8 row + new detailed Item 2 section
   - Rewrite `.cline/STATE.md`: `PHASE_8_BATCH_3.item-2: ✅ merged ([sha])`
   - Append to `.cline/memory/agent-log.md`
   - Add 🟢 / 🟡 / 🔴 lesson if applicable (especially if Decimal arithmetic produced any new gotchas)
5. **Output:** `✅ Phase 8 Batch 3 Item 2 complete. Open phase8-batch3-item3.md in a NEW Claude Code session — STOP here.`
6. **Do NOT auto-chain to Item 3 in the same session.**

---

## Output Contract

Before reporting complete:
- [ ] All tests GREEN (`pnpm vitest run` for inventory.test.ts — ~48 tests)
- [ ] `pnpm lint --max-warnings 0` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] Two-stage review PASS
- [ ] Squash-merged to main, branch deleted
- [ ] CHANGELOG_AI + IMPLEMENTATION_MAP + STATE.md updated
- [ ] Final preflight verdict was SAFE or AT_RISK (acknowledged) — not MUST_SPLIT

If any check fails → fix before marking done. Do NOT merge with stale governance.
