# Next-Session Handoff — K-prime Extended Phase 2 (storefront/portal IDOR audit)

**Generated:** 2026-06-01 06:42 GMT+8 by Opus 4.7
**Prior session:** [[project_orqafy_kprime_idor_tests_2026-06-01]] — IDOR tests shipped (commit 39a9fb6)
**Full scout report (Sonnet-generated, 400L):** `/tmp/storefront-phase2-scout.md`

---

## Why this session

Sonnet scout of `apps/web/src/server/trpc/routers/storefront.ts` (796L) + 6 store/ecommerce pages identified **5 confirmed 🔴 cross-tenant bugs** in the storefront router. The bugs are reachable via direct tRPC calls today — production UI is dormant (all 6 pages are 0-byte stubs) so impact is mitigated, but the API surface is live.

This validates the K-prime Extended Phase 2 direction: storefront/portal is exactly where unknown-unknown IDOR risk hid, per [[orqafy-kprime-idor-tests-2026-06-01]] reasoning.

---

## 🔴 P0 — Confirmed cross-tenant bugs (storefront.ts)

| # | Procedure | Risk | Fix |
|---|-----------|------|-----|
| 1 | `getOrderById` | `findUnique({ where: { id } })` no tenantId — any authenticated staff reads any tenant's order | Use new `loadOrderForTenant(id, tenantId)` helper |
| 2 | `listMyOrders` | Scoped by `customerId` only — pass foreign customer CUID → leaks their orders | Add `tenantId: ctx.tenantId` to where clause |
| 3 | `listAllOrders` | Admin list unscoped — admin sees ALL tenants' orders | Add `tenantId: ctx.tenantId` to where clause |
| 4 | `updateFulfillment` | Admin can mutate any tenant's order fulfillment | `loadOrderForTenant` guard before mutation |
| 5 | `updateOrderStatus` | Same as #4 + stock reversal also unscoped | `loadOrderForTenant` guard + scope reversal query |

**Pattern is well-banked** — mirrors `loadInvoiceForTenant` / `loadExpenseForTenant` / `loadCustomerForTenant`. ~55 LOC total fix. TIER 1, single Sonnet dispatch.

## ⚠ P1 — Defensive review

| # | Procedure | Note |
|---|-----------|------|
| 6 | `browseProducts` | `Product` model has **NO tenantId column** — design decision needed: global catalog vs tenant-owned |
| 7 | `getProductById` | Same as #6 |
| 8 | `placeOrder` | Customer CUID accepted from input but not verified against `ctx.tenantId` |

**P1.8 fix:** ~5 LOC (verify customer.tenantId matches ctx.tenantId before order creation).

**P1.6+7 blocker:** ASK USER — is Product a per-tenant catalog or a shared global catalog? If per-tenant, this is a full K-prime-style cycle (schema migration + parent guard + tests). If global, document the decision and add a comment.

## ✅ Already safe

- `placeOrderAsCustomer` (public token flow)
- `trackGuestOrder` (token-gated)
- `createXenditInvoice` (uses Order's existing tenantId)

---

## Recommended execution order

```
STEP 1  — Read /tmp/storefront-phase2-scout.md for full procedure-by-procedure detail
STEP 2  — Single Sonnet dispatch (TIER 1, ~55 LOC + tests):
            a) Add loadOrderForTenant helper in storefront.ts
            b) Fix all 5 🔴 procedures (1 helper call each)
            c) Fix #8 placeOrder customer ownership check
            d) Write storefront-order-tenant-parity.test.ts (~5 cases, mirror precedent)
STEP 3  — Ask user about Product model (global vs tenant-owned)
STEP 4  — If per-tenant: separate K-prime-style cycle (schema + migration + tests)
            If global: document in DECISIONS_LOG.md, add comment, close out
STEP 5  — Build pages (separate session — ~320 LOC, lower priority since stubs)
```

## Budget

- Router fixes + tests: ~135 LOC, 1 Sonnet dispatch (TIER 1 per V32)
- Product decision + follow-up: 0–500 LOC depending on user answer
- Page implementation: defer to its own session

---

## Pre-flight for next session

```
1. cat .cline/STATE.md
2. cat /tmp/storefront-phase2-scout.md   # full scout findings
3. cat .cline/handoffs/next-session-storefront-phase2.md   # this file
4. Verify suite still green: pnpm --filter @orqafy/web exec vitest run
5. Pin Product model decision to user (don't guess)
6. Dispatch single Sonnet for STEP 2 (router fixes + tests)
```

## Files Sonnet will touch (STEP 2)

- `apps/web/src/server/trpc/routers/storefront.ts` — modify (~55 LOC across helper + 6 procedures)
- `apps/web/src/server/trpc/routers/__tests__/storefront-order-tenant-parity.test.ts` — create (~150 LOC)

Reference patterns (DO NOT modify):
- `apps/web/src/server/trpc/routers/invoice.ts` lines 8–14 (loadInvoiceForTenant)
- `apps/web/src/server/trpc/routers/__tests__/invoice-tenant-parity.test.ts` (test precedent)
