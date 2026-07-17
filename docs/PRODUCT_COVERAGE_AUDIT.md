# Orqafy — PRODUCT.md Feature Coverage Audit

**Date:** 2026-07-17
**Method:** Cross-reference every module/feature declared in `docs/PRODUCT.md` (2,279 lines) against ground truth in the codebase — Prisma models (`packages/db/prisma/schema.prisma`), tRPC routers (`apps/web/src/server/trpc/routers/`), UI pages (`apps/web/src/app/(tenant)/[slug]/(app)/**`), the mobile app (`apps/mobile`), and tests. READ-ONLY analysis; no application code was changed.
**Legend:** ✅ IMPLEMENTED · 🟡 PARTIAL · 🔴 MISSING · ➕ EXTRA (built, not in spec) · ⚠️ SPEC-DIVERGENT (built differently than spec declares)

---

## Executive Summary

Orqafy is a mature, near-complete multi-tenant ERP. **Overall coverage ≈ 93%.** Of the 18 declared feature modules, **16 are fully implemented** with dedicated routers, models, and UI; **2 are partial** (Customer Portal, Public Landing testimonials CMS). Every declared core entity has a matching Prisma model. There is one **material spec-vs-code divergence** in the RBAC layer, and several **extras** built beyond spec (data-privacy/DSR tooling, custom-role builder, notification center).

- **Biggest genuine gap:** the **logged-in Customer Portal** (§703) — spec promises customers a portal for Invoices & Payments, Accounts & Credit, Support Tickets, Documents, and Profile. Code ships only the e-commerce **storefront** (`/store`) + a **public invoice link** (`/api/invoice/[publicToken]`). No authenticated customer-facing account area was found.
- **Biggest documentation gap (⚠️ divergence, not a missing feature):** the **Roles & Permissions** section (§756) still describes the OLD model — *"Role is a single enum on User.role … Tenants cannot define custom roles."* The code has since been rebuilt to the fleet 3-tier tenant-RBAC standard: a data-driven `RolePermission` matrix, a `FeatureKey` registry, a **custom role-builder UI** (`/settings/roles`), `is_tenant_owner` + partial-unique index, and two-way ownership succession. **The code is AHEAD of the spec — PRODUCT.md §756 needs to be re-written to match.**
- **Mobile app is real, not a stub:** `apps/mobile` is a 55-file Expo build (DTR clock-in with GPS, expenses, payslips, tasks) with offline WatermelonDB sync + push notifications. It covers the "Mobile First" surfaces the spec prioritizes.

Nothing looks like a large abandoned/unbuilt feature except the Customer Portal account area. The remaining deltas are polish (landing testimonials CMS) and one stale spec section (RBAC).

---

## Coverage Summary Table

| # | Module (PRODUCT.md) | Status | Coverage | Primary evidence |
|---|---|---|---|---|
| 1 | Public Landing Page (§146) | 🟡 PARTIAL | ~85% | `app/page.tsx` (182 L); pricing via `plan` router. Testimonials CMS-management not found |
| 2 | Demo System (§168) | ✅ | 100% | `app/demo-login/page.tsx`, `(app)/demo/page.tsx`, `demo` router, `demo-reset-tenant-scope.test.ts` |
| 3 | CRM / Sales (§204) | ✅ | 100% | `crm` router (27 procs), `clients`+`crm/customers`+`crm/quotations` pages; Customer/Proposal/Quotation/ContactLog models |
| 4 | Purchasing (§268) | ✅ | 100% | `purchasing` router (18); `purchasing/{orders,receipts,vendors}` pages; PurchaseOrder/Item/Allocation, GoodsReceipt, PurchaseInvoice |
| 5 | Inventory (§369) | ✅ | 100% | `inventory` router (19); `inventory/{products,categories,warehouses,stock-movements}`; Product/Warehouse/StockMovement/Disbursement |
| 6 | Projects (§431) | ✅ | 100% | `project` router (13); `projects/{[id],new,expenses}`; Project/Milestone/TimeLog/ProjectExpense/ProjectNote |
| 7 | Tasks (§472) | ✅ | 100% | `tasks` router (17); `tasks/page.tsx`; Task/TaskAssignment/TaskStatusReport/ToDo |
| 8 | DTR / Attendance (§488) | ✅ | 100% | `dtr` router (11); `dtr/page.tsx`; AttendanceRecord; mobile DTR w/ GPS |
| 9 | Banking & Finance (§494) | ✅ | 100% | `banking` router (17); `banking/{fund-sources,transactions}`; FundSource/FundTransaction/FundTransfer/FundRequest/CreditCard |
| 10 | HR & Payroll (§599) | ✅ | 100% | `payroll`(15)+`employee`(6) routers; `employees/*`, `payroll/*`, `statutory-rates`; Payroll/Payslip/LeaveRequest/CashAdvance |
| 11 | POS (§606) | ✅ | 100% | `pos` router (8); `pos/{new-sale,[id]}`; POSSession/POSSale/POSSaleItem |
| 12 | Accounting (§613) | ✅ | 100% | `accounting` router (21); `accounting/{accounts,journal-entries,trial-balance,fiscal-years,settings}`; Account/JournalEntry/JournalLine/TaxRate/FiscalYear |
| 13 | Support / Tickets (§626) | ✅ | 100% | `support` router (10); `support/*`; SupportTicket/TicketComment/TicketAttachment |
| 14 | E-Commerce / Online Store (§630) | ✅ | 100% | `storefront` router (11); `/store/*` public pages + `(app)/ecommerce/orders/*`; EcommerceOrder/EcommerceOrderItem |
| 15 | Repairs & Job Orders (§661) | ✅ | 100% | `job-order` router (11); `job-orders/*` + `service/job-orders/*`; JobOrder/JobOrderPart/JobOrderServiceLine |
| 16 | Customer Portal (expanded) (§703) | 🟡 PARTIAL | ~40% | Storefront (`/store`) + public invoice `/api/invoice/[publicToken]` built. **No logged-in portal for invoices/credit/tickets/documents/profile** |
| 17 | Platform Admin (§731) | ✅ | 100% | `platform` router (5) + `plan` router; `app/powerbyte-admin/{page,[tenantId]}`; Tenant/Plan/TenantSubscription/TenantInvoice/TenantPayment |
| 18 | Invoice Payments — Phase 7 (§744) | ✅ | 100% | `invoice` router (9); `/api/invoice/[publicToken]/route.ts`; `/api/webhooks/xendit`; `admin-xendit-config` router; TenantXenditConfig |
| — | Roles + Permissions (§756) | ⚠️ DIVERGENT | built ✅, spec stale | Code = data-driven matrix + role-builder; spec = "enum, no custom roles" (see below) |
| — | Reporting & Dashboards (§1979) | ✅ | ~95% | `report` router (6); `reports/page.tsx`, `dashboard/page.tsx`, per-project dashboard `projects/[id]`, platform dashboard `powerbyte-admin` |
| — | Mobile Needs (§1586) | ✅ | ~90% | `apps/mobile` Expo, 55 files: DTR/expenses/payslips/tasks + offline sync + push + GPS |
| — | Data Privacy / Security (§1903/§1930) | ✅➕ | 100%+ | `dsr`(9)+`compliance`(8) routers; DataSubjectRequest/BreachRecord; `settings/breach`, `(app)/privacy` — richer than spec |

---

## Per-Module Breakdown

### 1. Public Landing Page — 🟡 PARTIAL
- ✅ Marketing homepage `apps/web/src/app/page.tsx` (182 lines); legal `app/privacy/page.tsx`; register flow `app/register/page.tsx` + `register/success`.
- ✅ Live pricing sourced from `Plan` entity (`plan` router, `Plan` model @ schema:144).
- 🟡 **Testimonials "CMS-like management" not found** — `grep -i testimonial|cms` over `apps/web/src` returns no management surface. Spec (§146) says testimonials are "populated manually by platform_owner via CMS-like" tool; if they are hard-coded placeholders this is a minor partial. Low priority.

### 2. Demo System — ✅ IMPLEMENTED
`demo` router (3 procs), `app/demo-login/page.tsx`, `(app)/demo/page.tsx`; role-switcher + server-side demo restrictions covered by `__tests__/demo-reset-tenant-scope.test.ts` and `landing-demo.test.ts`.

### 3–15. Core ERP modules — ✅ IMPLEMENTED
Every declared back-office module has (a) a Prisma model set, (b) a tRPC router with a substantial procedure count, and (c) dedicated UI routes. Highlights: CRM is the richest surface (27 procedures, proposals + quotations with markup columns + revisions + credit accounts); Accounting is a full double-entry ledger (accounts, journal entries, trial balance, fiscal years, tax/statutory rates); Purchasing spans PO → allocation → goods receipt → purchase invoice with shipping-cost distribution. Tenant-parity IDOR tests exist across most (`__tests__/*-tenant-parity.test.ts`).

### 16. Customer Portal (expanded) — 🟡 PARTIAL  ← **top gap**
- ✅ Built: e-commerce **storefront** for the `customer` role — `/(tenant)/[slug]/store/{products,checkout,orders/track}` + `storefront` router (11 procs). Public **invoice view/pay** via `/api/invoice/[publicToken]/route.ts` (public link, no login).
- 🔴 **Not built:** the authenticated customer *portal account area* the spec (§703) promises — a logged-in customer surface for **Invoices & Payments list, Accounts & Credit, Support Tickets, Documents, Profile**. No `/portal` route exists; `grep -i portal` finds only unrelated React portal shims. `CustomerDocument` model (schema:2569) exists but has no customer-facing UI. Customer support tickets (`SupportTicket`) exist but only via the back-office `support` surface.
- **Assessment:** genuine unbuilt feature. Storefront ≠ the account portal. Recommend confirming with owner whether the portal was descoped or is still pending.

### 17. Platform Admin — ✅ IMPLEMENTED
`app/powerbyte-admin/{page.tsx,[tenantId]/page.tsx}`; `platform` router (listTenants/getTenant/suspendTenant/reactivateTenant/**reassignTenantOwner**) + `plan` router; billing models Tenant/Plan/TenantSubscription/TenantInvoice/TenantPayment. DLQ replay is worker-side (notification digest worker + `/api/internal/schedule-digests`).

### 18. Invoice Payments (Phase 7) — ✅ IMPLEMENTED
`invoice` router (9), Xendit config per-tenant (`TenantXenditConfig`, `admin-xendit-config` router + `settings/xendit` UI), webhook handler `/api/webhooks/xendit/route.ts`, public payable invoice `/api/invoice/[publicToken]`.

### Roles + Permissions — ⚠️ SPEC-DIVERGENT (code ahead of spec)
**This is the RBAC area flagged for special attention. The recently-completed 3-tier RBAC IS reflected in code — but PRODUCT.md §756 was never updated to match.**

| PRODUCT.md §756 declares | Code actually implements |
|---|---|
| "Role is a single enum on `User.role`" | `User.roleId → Role` **relation** (schema:307–309); no role enum |
| "Role entity is reference table, read-only at runtime" | `Role` + `RolePermission` tables are **writable at runtime** via role-builder |
| "**Tenants cannot define custom roles**" | Full **custom role-builder** UI at `/settings/roles`; `role` router `create`/`update`/`delete`/`assign` = `superAdminProcedure` |
| Fixed named enum roles | Data-driven `FeatureKey` registry (23 keys) × strict CRUD `RolePermission` matrix; guardrails forbid `users`+`billing` in custom roles; custom ≤ Admin ceiling |
| (not in spec) | `is_tenant_owner` flag + one-owner-per-tenant; two-way succession (`user.transferOwnership` + `platform.reassignTenantOwner`) |

Seeded system roles (`packages/db/src/seed/roles.ts`) — Platform Owner, Tenant Super Admin, Admin, Accountant, HR Manager, Project Manager, Sales Staff, Purchasing Staff, Inventory Staff, Staff, Customer — match the spec's role *names*, so the intent is preserved; only the *mechanism* changed (enum → matrix) and custom roles were *added*. Tests: `role.router.test.ts`, `has-permission.test.ts`, `guardrails.test.ts`, `role-permissions.test.ts`, `features.test.ts`. **Action: back-port this to PRODUCT.md §756 (spec-divergence, not a code gap).**

### Reporting & Dashboards — ✅ IMPLEMENTED
`report` router (6), `reports/page.tsx`, tenant `dashboard/page.tsx`, per-project dashboard (`projects/[id]/page.tsx`), platform dashboard (`powerbyte-admin`). Coverage of the four spec dashboards is present; depth of individual module report widgets not line-verified.

### Mobile Needs — ✅ IMPLEMENTED (~90%)
`apps/mobile` = real Expo app (55 TS/TSX files). Screens: DTR clock-in (`use-location`/`gps.ts`), expenses (list+new), payslips, tasks (list+detail), auth/login. Offline-first via WatermelonDB models (`DtrEntry`, `Expense`, `Payslip`, `Task`, `SyncQueueItem`) + `sync/{auto-sync,queue}` + `notifications/push`. Matches the spec's "Mobile First" surfaces. Any spec-declared "Mobile Ready" web-responsive-only pages are served by web, per spec.

---

## Prioritized Gaps (Top MISSING / PARTIAL / DIVERGENT)

1. **🟡 Customer Portal account area (§703) — genuine unbuilt feature.** Storefront + public invoice link exist; the logged-in customer portal (invoices/payments list, credit account, support tickets, documents, profile) does not. *Confirm scope with owner.*
2. **⚠️ RBAC spec back-port (§756) — documentation, not code.** PRODUCT.md still says "enum / no custom roles"; code shipped the data-driven custom-role matrix + role-builder. Update §756 (and the `Role` note) to the 3-tier standard so spec = reality.
3. **🟡 Landing testimonials CMS (§146) — minor.** No CMS-management surface found for platform_owner-editable testimonials. Verify whether current testimonials are static placeholders (acceptable) or the editable tool is pending.
4. **🟡 Reporting depth (§2010 Tenant Module Reports) — verify.** The four dashboards exist; per-module report widget completeness was not line-by-line verified in this pass.

*No large module is entirely 🔴 MISSING.*

---

## Extras Not in Spec (➕ built beyond PRODUCT.md)

- ➕ **Custom role-builder + permission matrix** (`/settings/roles`, `RolePermission`, `FeatureKey`) — directly *contradicts* §756's "cannot define custom roles"; treat as the new intended state and re-spec.
- ➕ **Data-privacy / RA 10173 tooling beyond the spec bullets** — `dsr` router (9) + `DataSubjectRequest` model + `compliance` router (8) + `BreachRecord` model + `/settings/breach` breach register + `(app)/privacy` page. Spec has Data Sensitivity/Security *sections* but not this depth of self-service DSR + breach registry.
- ➕ **Notification center** — `notification` router + `Notification` model + SSE stream (`/api/sse`) + worker email-digest (`notification-email-digest.test.ts`, `/api/internal/schedule-digests`).
- ➕ **Settings sub-surfaces** — `settings/{departments,expense-categories,smtp,xendit,account,users,roles,breach}` (Department, ExpenseCategory, TenantSmtpConfig models) — granular admin config not enumerated as a spec module.
- ➕ **Ownership succession** — `is_tenant_owner` + `user.transferOwnership` + `platform.reassignTenantOwner` (two-way succession per tenant-RBAC standard).

---

## Notes / Confidence
- Router↔module mapping is high-confidence (root registration in `_app.ts` verified; 34 routers, all wired). Model coverage high-confidence (89 Prisma models; every declared entity family present).
- The Customer Portal "partial" verdict rests on absence of any `/portal` route and absence of a customer account UI beyond `/store` — high confidence it is not built, but the owner should confirm it was intended vs descoped.
- Per-field / per-validation completeness inside each module was **not** exhaustively verified (out of scope for a module-level coverage audit); this audit confirms feature *presence*, not per-field parity.

---

## Independent Verification (2026-07-18)

A second read-only pass independently re-checked every module against ground truth (schema.prisma, routers, pages, mobile, tests) and **confirms this audit is trustworthy at ≈93–94%.** All four spot-checked claims held: Customer Portal genuinely unbuilt (no `/portal` route/router/page), testimonials CMS absent, RBAC divergent-ahead-of-spec, and the four "100%" spot-checks (CRM/Accounting/Purchasing/Invoice-Payments) each have router+model+page.

**Two corrections to this draft:**
1. **Public Landing Page → effectively IMPLEMENTED (~95%), not PARTIAL.** Spec §146 itself descopes the testimonials CMS ("out of scope for v1 — use hardcoded seed testimonials"), so docking the module for it is too harsh.
2. **`FeatureKey` is a code-level registry, not a Prisma model** — it feeds `RolePermission.featureKey` (a string). Does not change the DIVERGENT verdict.

**Confirmed single genuine gap:** the authenticated **Customer Portal (§703, ~35%)** — logged-in customer account area (invoices/credit/tickets/documents/profile). The only large declared-but-unbuilt feature.

**Action items surfaced (owner [WHAT] — not auto-run):**
- Re-spec §756 (RBAC) to match the shipped data-driven matrix + role-builder (code is ahead).
- Decide Customer Portal (§703): build it, or mark descoped in PRODUCT.md.
