# UI ↔ Backend Gaps — Phase 7 Backend Wave Input

> **What this file is.** A consolidated triage of every **unsurfaced backend procedure**
> and **product/UX gap** discovered during the `swarm/wire-dead-controls` wiring program
> (waves W0–W13). It is the single planning input for a future **Phase 7 backend feature
> wave**. Each entry below is a *feature-build* — net-new forms, routes, fields, validation,
> action UI, and product/UX decisions — **deliberately NOT built** during the wiring program
> per WAVE POLICY (wiring fixes dead/inert controls + broken nav only; it never authors new
> action surfaces).
>
> **Provenance.** The authoritative per-procedure breakdown lives in
> `docs/WIRING_NEEDS_SPEC.md` (per-wave sections W1–W12). This file is a roll-up + grouping
> layer over that log. When the two disagree on a procedure name or count, trust
> `WIRING_NEEDS_SPEC.md`. W0 (the audit-origin wave) itself blocked on context-thrash and
> never produced a single punch-list; the residuals were instead logged incrementally by
> each domain wave W1–W12.
>
> **How to use this for Phase 7.** Each domain below is a candidate Phase 7 feature epic.
> None can be built from this file alone — every one needs a `docs/PRODUCT.md`-backed spec
> resolving the open field/validation/UX questions noted inline. Sequence with the
> "Recommended Phase 7 grouping" section at the bottom.
>
> Last compiled: 2026-06-14 by CLAUDE_CODE (swarm W13 — closeout — branch `swarm/wire-dead-controls`).

---

## Summary

~**100+ unsurfaced router procedures** across 9 CRUD/ops domains, plus notification +
settings infrastructure, plus 2 platform-admin hardening items. Two **cross-cutting blockers**
(partial-payment recording; no RSC→tRPC server-caller pattern) gate multiple domains and
should be resolved first.

| # | Domain | Source wave | Unsurfaced (logged) | Gap class |
|---|--------|-------------|---------------------|-----------|
| 1 | CRM (customers, contacts, credit) | W1 | 8 | Forms + detail-page action UI |
| 2 | Invoicing | W2 | 5 + 1 product gap | Form + row-actions + **partial-payment gap** |
| 3 | POS (sessions, void) | W3 | 3 | Session lifecycle + void action UI |
| 4 | Inventory (products, categories, warehouses, movements) | W4 | 12 | Forms + management surfaces |
| 5 | Purchasing (vendors, POs, goods receipt) | W5 | 11 | PO builder + status state-machine UI |
| 6 | Accounting + Banking | W6 | 20 (10 + 10) | Journal builder + money-movement forms |
| 7 | HR (employees, payroll, DTR) | W7 | 14 (3 + 4 + 7) | Forms + time-clock + approval UI |
| 8 | Projects + Tasks | W8 | 21 (8 + 13) | Forms + kanban + milestone/todo editors |
| 9 | Service / Job Orders / Support | W9 | 8 (2 + 6) | Intake forms + ticket lifecycle UI |
| 10 | E-commerce / Storefront | W10 | 2 | Customer order-history + auth checkout |
| 11 | Dashboard / Reports / Settings | W11 | 2 areas | Notification surface + 5 settings sub-pages |
| 12 | Platform admin | W12 | 2 hardening | Router-routing for L5 audit + list filters |

---

## 1 — CRM (W1) — `WIRING_NEEDS_SPEC.md` §CRM

8 `crmRouter` procedures with no UI:

- `crm.customerCreate` — customer create form + route (`customers/new`); fields/validation/UX undecided (required fields, tier default, primary-contact handling).
- `crm.customerUpdate` — customer edit form + route (`customers/[id]/edit`); same spec as create.
- `crm.customerToggleActive` — activate/deactivate control on customer detail; confirm-dialog + optimistic-state UX undecided.
- `crm.contactCreate` — "add contact" form/modal on `customers/[id]`; field set + primary-contact selection UX undecided.
- `crm.contactUpdate` — contact edit form/modal; depends on a contact-list UI that does not exist.
- `crm.contactDelete` — delete control + confirm dialog; depends on the same contact-list UI.
- `crm.creditUpsert` — credit-account config form on `customers/[id]`; currency/limit/terms fields + validation undecided.
- `crm.creditToggleActive` — enable/disable credit control; depends on credit-account UI that does not exist.

## 2 — Invoicing (W2) — `WIRING_NEEDS_SPEC.md` §Invoicing

`invoices/page.tsx` is a read-only table with zero existing action UI.

- `invoice.markSent` / `invoice.markPaid` / `invoice.void` — row-action UI (inline vs dropdown), confirm-dialog policy (void is semi-destructive), optimistic-vs-refetch UX.
- `invoice.create` — full invoice form + route (customer picker, due date, line-item editor); undecided field/validation/UX.
- `invoice.update` — edit form (draft-only); depends on the create form's line-item editor.

> **🔴 Product gap (resolve before wiring `markPaid`).** The schema models
> `amountPaid` / `balance` / `partially_paid`, but **no partial-payment recording mutation
> exists**. `markPaid` only sets full `paid`. A partial-payment flow must be specified
> (and likely a new mutation built) before the payment row-actions are wired.

## 3 — POS (W3) — `WIRING_NEEDS_SPEC.md` §POS

`pos/page.tsx` and `pos/[id]/page.tsx` are read-only displays. 3 mutations unsurfaced:

- `pos.session.open` (`{ openingBalance, notes? }`) — "Open Session" control/form on `pos/page.tsx`. Router enforces one-open-session-per-user (CONFLICT otherwise); the new-sale screen already prompts to open a session, but no open-session UI exists. Modal-vs-route + field/validation UX undecided.
- `pos.session.close` (`{ id, closingBalance, notes? }`) — "Close Session" form on `pos/[id]/page.tsx` (router computes expected balance + discrepancy). Confirm-dialog + discrepancy-review UX undecided.
- `pos.sale.void` (`{ id, reason }` — reason required) — per-row "Void" action. **Semi-destructive**: reverses inventory via offsetting `in` movements in a transaction, flips sale to `voided`. Needs confirm + reason capture + inline-vs-dropdown / optimistic-vs-refetch decision.

## 4 — Inventory (W4) — `WIRING_NEEDS_SPEC.md` §Inventory

12 `inventoryRouter` mutations unsurfaced:

- `productCreate` / `productUpdate` / `productToggleActive` — Add/Edit Product form (name, sku, unit, baseCost, category picker, active toggle) on the products list. Modal-vs-route + UX undecided.
- `categoryCreate` / `categoryUpdate` / `categoryToggleActive` — category-management surface (none exists today).
- `warehouseCreate` / `warehouseUpdate` / `warehouseToggleActive` — warehouse-management surface (stock-movements only reads `warehouseList`).
- `stockMovementCreate` — "Record Movement" form (product picker, type, qty, from/to warehouse, notes). Ledger is display-only.
- `stockTransfer` — "Transfer Stock" form (product, qty, from→to) surfacing the router's transactional validation.
- `stockAdjustment` — "Adjust Stock" form (product, warehouse, delta/target, reason); inventory-affecting → confirm-dialog policy undecided.

## 5 — Purchasing (W5) — `WIRING_NEEDS_SPEC.md` §Purchasing

11 `purchasingRouter` mutations unsurfaced (vendor list + PO pages are display-only; no
`vendors/[id]` route exists, so vendors cannot be row-linked):

- `vendor.create` / `vendor.update` / `vendor.deactivate` — Add/Edit Vendor form (companyName, contact, email, phone, address, paymentTerms, platform fields) + deactivate confirm.
- `po.create` — "New PO" builder: vendor picker + multi-row line-item editor (product, qty, unit price) with optional per-item warehouse/dimension **allocations** (router validates allocation sums + type-specific ID requirements).
- `po.update` — edit form for draft POs (same builder), gated on status.
- `po.submit` / `po.approve` / `po.markOrdered` / `po.cancel` — status-transition action bar on `purchasing/orders/[id]`. State machine (draft → pending_approval → approved → ordered → cancelled); approve/cancel are authority actions → confirm + role-gating UX undecided.
- `goodsReceipt.create` — "Receive Goods" form against an ordered PO (per-line quantityReceived/quantityRejected, notes). PO detail only displays existing receipts; receiving increments stock → confirm/UX policy undecided.

## 6 — Accounting + Banking (W6) — `WIRING_NEEDS_SPEC.md` §Accounting + Banking

20 mutations unsurfaced (every accounting/banking page is read-only; no `fund-sources/[id]`
detail route exists). See the W6 section for the authoritative per-procedure list.

**accountingRouter (10):**
- `account.create` / `account.update` / `account.toggleActive` — chart-of-accounts management surface.
- `journalEntry.create` — journal-entry builder (header date/ref + balanced multi-line debit/credit editor with account pickers).
- `journalEntry.post` / `journalEntry.reverse` — status-transition controls (authority actions).
- `fiscalYear.create` — "New Fiscal Year" form (name, start/end).
- `taxRate.create` — "Add Tax Rate" form (name, rate, type).

**bankingRouter (10):**
- `banking.create` / `update` / `toggleActive` (fund sources) — Add/Edit Fund Source form.
- `transaction.recordIncome` / `recordExpense` / `transfer` / `recordCreditCardCharge` / `payCreditCard` / `loanMoneyOutTo` / `loanMoneyIn` / `recordRefund` / `recordAdjustment` — each needs a dedicated money-movement form. (Money-affecting; confirm + authority UX per type.)

## 7 — HR: Employees + Payroll + DTR (W7) — `WIRING_NEEDS_SPEC.md` §HR

14 mutations unsurfaced (employee/payroll/DTR pages are read-only):

**employeeRouter (3):**
- `employee.create` — "Add Employee" form + route (`employees/new`); links a user, role/department fields.
- `employee.update` — employee edit form + route (`employees/[id]/edit`).
- `employee.terminate` — "Terminate" action on the detail page; authority + confirm UX.

**payrollRouter (4):**
- `payroll.create` — "New Payroll Run" form (period start/end, currency, employee selection).
- `payroll.process` / `payroll.approve` / `payroll.markPaid` — status-transition action bar (draft → processing → approved → paid); money-affecting authority UX.

**dtrRouter (7):**
- `dtr.attendanceClockIn` / `attendanceClockOut` — per-employee time-clock UI.
- `dtr.attendanceApprove` / `attendanceReject` — approve/reject action controls on an attendance review surface.
- `dtr.leaveRequestCreate` — "Request Leave" form (type, date range, reason).
- `dtr.leaveRequestApprove` / `leaveRequestReject` — approve/reject action controls on a leave review surface.

## 8 — Projects + Tasks (W8) — `WIRING_NEEDS_SPEC.md` §Projects + Tasks

21 mutations unsurfaced. Two broken/inert non-controls were flagged but **rejected** as
out-of-scope feature-builds: the **"New Project"** button → `projects/new` (route absent →
404; wiring = building the create form), and the non-clickable task `<div>` cards (no task
detail route, no drag-to-status).

**projectRouter + sub-routers (8):**
- `project.create` / `project.update` — New/Edit Project form + routes (`projects/new`, `projects/[id]/edit`): name, customer picker, manager, description, etc.
- `project.complete` / `project.archive` — status/lifecycle action controls.
- `project.expense.recordProjectExpense` — "Record Expense" form on the project detail.
- `project.milestone.create` / `milestone.update` / `milestone.complete` — milestone editor.

**tasksRouter (13):**
- `tasks.taskCreate` / `taskUpdate` — New/Edit Task form (title, project, status, assignee, etc.).
- `tasks.taskUpdateStatus` — kanban drag-to-status / status control (state machine exists in router).
- `tasks.taskAssign` / `taskUnassign` — assignee picker on a task detail/card UI.
- `tasks.taskAddStatusReport` — status-report form on a task detail surface (does not exist).
- `tasks.todoCreate` / `todoUpdate` / `todoDelete` / `todoComplete` / `todoAddAttachment` — checklist/todo editor.

## 9 — Service / Job Orders / Support (W9) — `WIRING_NEEDS_SPEC.md` §Service

Note: the `service/job-orders/[id]` detail page is **already fully interactive** (status,
parts/service lines, signature pad all surfaced). Two job-order detail routes coexist —
`job-orders/[id]` (read-only ops view) and `service/job-orders/[id]` (interactive) — see
the Structural Decisions section. 8 mutations remain unsurfaced:

**jobOrderRouter (2):**
- `jobOrder.create` — "New Job Order" intake form (customer picker, device fields, etc.).
- `jobOrder.assignTechnician` — technician picker on the detail surface.

**supportRouter (6):**
- `ticket.create` — "New Ticket" form (title, description, priority, category).
- `ticket.update` — edit form for ticket fields (detail is display-only).
- `ticket.assign` — assignee picker (detail currently shows raw `User {id.slice(0,8)}`).
- `ticket.changeStatus` — status state-machine control.
- `ticket.close` — lifecycle action + confirm + optional resolution note.
- `comment.create` — add-comment form (content + internal/public toggle) on the thread.

## 10 — E-commerce / Storefront (W10) — `WIRING_NEEDS_SPEC.md` §W10

2 feature-builds (W10 also shipped one dead-nav fix: a "Track order" link to the orphan
guest-tracking page — already done, not a gap):

- `storefront.listMyOrders` — customer-facing "My orders" history page (authenticated order history).
- `storefront.placeOrder` — authenticated (`writeProcedure`) order creation, distinct from the public guest checkout that already exists. Needs an authenticated checkout/order-placement UX.

> `storefront.browseProducts` and `storefront.listAllOrders` are redundant-but-covered
> (the UI reads Prisma/other procedures directly) — **not** gaps.

## 11 — Dashboard / Reports / Settings (W11) — `WIRING_NEEDS_SPEC.md` §W11

W11 shipped the reports tenant-isolation 🔴 fix and a settings dead-link cleanup. Two
feature-build areas remain:

- **Notification surface (dashboard widget + global header bell).** `notificationRouter`
  is a **stub** (returns empty list / 0 count) and the header bell is a dead button.
  Surfacing notifications needs: (a) the notification **backend wired to Valkey** (or
  equivalent), and (b) a popover/inbox UX. Both unbuilt.
- **5 Settings sub-pages** — `settings/users`, `settings/departments`,
  `settings/expense-categories`, `settings/smtp`, `settings/account` have no page (the dead
  "Coming soon" hrefs were nulled in W11). Each is a net-new CRUD/config surface.
  (`settings/xendit` is already live and wired — not a gap.)

## 12 — Platform admin (W12) — `WIRING_NEEDS_SPEC.md` §W12

The powerbyte-admin list + `[tenantId]` detail and landing pricing are already fully wired.
Two **hardening** items (behavior-changing, not dead-control fixes):

- **Route admin Server Actions through `platformRouter`** (`listTenants` / `getTenant` /
  `suspendTenant` / `reactivateTenant`) to gain L5 audit logging
  (`PLATFORM:SUSPEND_TENANT` / `PLATFORM:REACTIVATE_TENANT` to `tenantAuditLog`) + centralized
  auth. **Blocked on two unbuilt pieces** (see Cross-cutting blockers): no RSC→tRPC
  server-caller pattern, and the router's required `reason: z.string().min(1)` needs an
  unspecified suspension/reactivation reason-capture UX (modal? textarea? prompt?).
- **Surface `listTenants` search/status/pagination filters** — the procedure accepts
  `search` / `status` / pagination, but the admin list renders an unfiltered table.

---

## Cross-cutting blockers (resolve first — they gate multiple domains)

1. **🔴 No RSC→tRPC server-caller pattern exists in the app.** `createCallerFactory` is used
   only in tests; every RSC page / Server Action reads Prisma directly. Any "route this page
   through a router to get L5 audit logging + centralized auth" hardening (W12 platform admin,
   and any future audit-on-mutation requirement) is blocked until a server-caller helper is
   built. **Foundational infra — build once, unblocks many.**

2. **🔴 Invoicing partial-payment recording is unmodeled at the mutation layer.** Schema has
   `amountPaid` / `balance` / `partially_paid` but no mutation records a partial payment.
   Resolve the product flow before wiring invoice payment actions (§2).

---

## Structural / UX decisions (not procedures — product calls needed)

- **Duplicate job-order detail routes.** `job-orders/[id]` (read-only ops view) and
  `service/job-orders/[id]` (interactive — status/parts/signature) coexist. A consolidation
  decision is needed (which is canonical; redirect/merge the other) before building the
  `jobOrder.create` intake flow (§9).

---

## Recommended Phase 7 grouping

Sequence to maximize unblocking and keep each epic spec-able:

1. **Foundations first.** (a) RSC→tRPC server-caller helper (unblocks audit-on-mutation +
   W12 hardening). (b) Invoicing partial-payment product flow + mutation.
2. **High-frequency CRUD epics** (each its own Phase 7 feature update with a PRODUCT.md spec):
   CRM (§1), Inventory (§4), HR (§7) — these are mostly form-driven and share patterns
   (create/edit form + toggle/lifecycle action bar), so spec one well and reuse.
3. **Workflow/state-machine epics:** Purchasing PO lifecycle (§5), Accounting journal +
   posting (§6), Payroll run lifecycle (§7), Tasks kanban + status (§8), Support ticket
   lifecycle (§9). These carry authority/confirm UX and benefit from a shared
   status-transition-action-bar component.
4. **Money-movement epic:** Banking transaction forms (§6) + POS session lifecycle/void (§3)
   + Invoicing payment actions (§2, after blocker #2). Group for consistent
   confirm/authority UX on money-affecting actions.
5. **Customer-facing + platform epics:** Storefront authenticated checkout + order history
   (§10); Notification surface + Settings sub-pages (§11); Platform-admin hardening (§12,
   after foundation #1).

> Every group above still requires a `docs/PRODUCT.md`-backed spec resolving the inline
> open questions before any code is written. This file scopes **what** is missing; PRODUCT.md
> must decide **how** each behaves.
