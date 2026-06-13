# Wiring — Needs Spec

Controls/procedures that exist in the backend but cannot be wired by the swarm
because surfacing them is a **feature-build** (new forms, routes, fields, validation,
or UX decisions) rather than connecting an existing inert control. These require a
product/UX spec from a human before implementation. Logged per swarm WAVE POLICY.

## CRM (session W1)

The CRM tRPC-backed interactive surface is already fully wired (quotation
actions/builder, contact-log create/delete/filter). One safe nav fix was shipped
this session: `crm/customers/page.tsx` rows now link to `crm/customers/[id]`.

The following **8 crm router procedures are entirely unsurfaced** (no UI exists).
Surfacing each is a feature-build — needs field set, validation rules, modal-vs-page
decision, and route additions — so it is **not** in scope for "wire dead controls":

- `crm.customerCreate` — needs a customer create form + route (e.g. `customers/new`); field/validation/UX spec required (which fields required, tier default, primary-contact handling).
- `crm.customerUpdate` — needs a customer edit form + route (e.g. `customers/[id]/edit`); same field/UX spec as create.
- `crm.customerToggleActive` — needs an activate/deactivate control on the customer detail page; confirm-dialog + optimistic-state UX undecided.
- `crm.contactCreate` — needs a "add contact" form/modal on `customers/[id]`; field set + primary-contact selection UX undecided.
- `crm.contactUpdate` — needs a contact edit form/modal on `customers/[id]`; depends on contact-list UI that does not yet exist.
- `crm.contactDelete` — needs a contact delete control + confirm dialog on `customers/[id]`; depends on contact-list UI that does not yet exist.
- `crm.creditUpsert` — needs a credit-account config form on `customers/[id]`; currency, limit, terms fields + validation undecided.
- `crm.creditToggleActive` — needs an enable/disable credit control on `customers/[id]`; depends on credit-account UI that does not yet exist.

Combined these likely exceed the 500-line surface budget and span new routes, so they
should be planned as dedicated Phase 7 feature updates with a PRODUCT.md-backed spec.

## Invoicing (session W2)

Shipped this session: `clients/page.tsx` was an inert redirect stub → now a real
client list wired to the existing `client.list` query (rows link to the canonical
`crm/customers/[id]` detail). That was a genuine wire of an existing-but-unsurfaced
procedure.

`invoices/page.tsx` is a **read-only** server-rendered table with **zero existing
controls** (no buttons, no row actions). The `invoice` router exposes 5 mutations
that are entirely unsurfaced. Surfacing them is a feature-build — net-new action UI
plus UX decisions — so it is **not** in scope for "wire dead controls":

- `invoice.markSent` / `invoice.markPaid` / `invoice.void` — need row-action UI (inline buttons vs dropdown menu), confirm-dialog policy (void is semi-destructive), and optimistic-vs-refetch state UX. `markPaid` only sets full `paid`; the schema models `amountPaid`/`balance`/`partially_paid` but no partial-payment recording mutation exists — a product gap to resolve before wiring.
- `invoice.create` — needs a full invoice form + route (customer picker, due date, line-item editor with quantity/unitPrice rows); substantial form, undecided field/validation/UX.
- `invoice.update` — needs an edit form + route (draft-only); depends on the create form's line-item editor that does not yet exist.

These span new routes and a line-item editor, likely exceeding the 500-line surface
budget, so they should be planned as a dedicated Phase 7 feature update with a
PRODUCT.md-backed spec.

## POS (session W3)

Self-inventory of `pos/**` (4 tsx, 1014 LOC): `pos/page.tsx` (sessions list),
`pos/new-sale/page.tsx` + `pos/new-sale/cart-client.tsx` (POS terminal),
`pos/[id]/page.tsx` (session detail).

The POS interactive surface is **already fully wired**. `cart-client.tsx` is a
complete point-of-sale terminal wired to `pos.sale.create` (product search/picker,
cart quantity + unit-price editing, tax/discount inputs, payment method + live change
calc, notes, and a Complete Sale button gated on `validateCart` + `isPending`).
`pos/page.tsx` and `pos/[id]/page.tsx` are **read-only** server-rendered displays
whose only controls are working nav `Link`s (status filter tabs, New Sale, and
session-number → `pos/[id]` detail). **No dead/inert controls exist** — there were no
no-op buttons or unbound handlers to wire.

The following **3 pos router mutations are entirely unsurfaced** (no UI control
exists). Surfacing each is a feature-build — net-new action UI plus UX decisions — so
it is **not** in scope for "wire dead controls":

- `pos.session.open` (input `{ openingBalance, notes? }`) — needs an "Open Session" control + form on `pos/page.tsx`. The router already enforces one-open-session-per-user (returns CONFLICT otherwise). The new-sale screen even prompts "No open sessions. Open one in POS Sessions first," but no open-session UI exists yet. Modal-vs-route and openingBalance/notes field/validation UX undecided.
- `pos.session.close` (input `{ id, closingBalance, notes? }`) — needs a "Close Session" form on `pos/[id]/page.tsx` for open sessions (closingBalance input; the router computes expected balance + discrepancy from cash sales). Confirm-dialog policy and discrepancy-review UX undecided.
- `pos.sale.void` (input `{ id, reason }` — reason required) — needs a per-row "Void" action on the sales table in `pos/[id]/page.tsx`. Void is **semi-destructive**: it reverses the sale's inventory by writing offsetting `in` stock movements inside a transaction and flips the sale to `voided`. Needs a confirm dialog + reason-capture input, and an inline-button-vs-dropdown / optimistic-vs-refetch decision.

These add net-new forms/controls across the sessions list + detail and span
inventory-affecting / destructive actions, so they should be planned as a dedicated
Phase 7 feature update with a PRODUCT.md-backed spec.

---

## Inventory (W4)

Both inventory pages are **read-only server components** that query Prisma directly:
`inventory/page.tsx` (products list) and `inventory/stock-movements/page.tsx`
(movements ledger with type-tab + warehouse + product filters). The only dead control
found was the product-name link (it pointed at a non-existent `products/${id}` route);
W4 wired it to `inventory/stock-movements?productId=${id}` and completed the
product-filter chain (context banner, filter preservation across tabs/warehouse form,
clear-filter link). No further dead/inert controls exist on these two pages.

The following **12 `inventoryRouter` mutations are entirely unsurfaced** (no UI control
exists). Surfacing any of them is a feature-build — net-new forms, validation, pickers,
and confirm/UX decisions — so they are **not** in scope for "wire dead controls":

- `inventory.productCreate` / `productUpdate` / `productToggleActive` — need an "Add/Edit Product" form (name, sku, unit, baseCost, category picker, active toggle) on the products list. Modal-vs-route and field/validation UX undecided.
- `inventory.categoryCreate` / `categoryUpdate` / `categoryToggleActive` — need a category-management surface (none exists in the UI today).
- `inventory.warehouseCreate` / `warehouseUpdate` / `warehouseToggleActive` — need a warehouse-management surface (the stock-movements warehouse filter only reads `warehouseList`).
- `inventory.stockMovementCreate` — needs a "Record Movement" form (product picker, type, quantity, from/to warehouse, notes). The movements ledger is display-only today.
- `inventory.stockTransfer` — needs a "Transfer Stock" form (product, qty, from→to warehouse) with the router's transactional from/to validation surfaced as UX.
- `inventory.stockAdjustment` — needs an "Adjust Stock" form (product, warehouse, delta/target qty, reason); inventory-affecting, so confirm-dialog policy undecided.

These should be planned as a dedicated Phase 7 feature update with a PRODUCT.md-backed spec.

---

## Purchasing (W5)

All three purchasing pages are **read-only server components** that query Prisma
directly: `purchasing/page.tsx` (PO list), `purchasing/vendors/page.tsx` (vendor list),
and `purchasing/orders/[id]/page.tsx` (PO detail). Every interactive control is a
working nav element — status filter tabs, the "Vendors →" / "← Purchase Orders" links,
the PO-number → `purchasing/orders/[id]` row links, the vendor Active/All filter tabs,
and `mailto:` links. **No dead/inert controls exist** — there were no no-op buttons,
unbound handlers, or broken hrefs to wire.

One non-control was considered and rejected: the vendor-list rows are plain text (no
`vendors/[id]` route exists), so they **cannot** be row-linked the way W1 linked CRM
customers to an existing `customers/[id]` page. Building a vendor detail page — or
linking a vendor's PO-count to a `vendorId`-filtered PO list (the list page reads
Prisma directly and only honors a `status` searchParam today) — is a feature-build, not
a nav fix, so it is **not** in scope for "wire dead controls."

The following **11 `purchasingRouter` mutations are entirely unsurfaced** (no UI control
exists). Surfacing any of them is a feature-build — net-new forms, line-item / allocation
editors, status-transition actions, and confirm/UX decisions — so they are **not** in
scope for this wave:

- `purchasing.vendor.create` / `vendor.update` / `vendor.deactivate` — need an "Add/Edit Vendor" form (companyName, contact, email, phone, address, paymentTerms, platform fields) plus a deactivate confirm. The vendor list is display-only today.
- `purchasing.po.create` — needs a "New PO" builder: vendor picker + a multi-row line-item editor (product, qty, unit price) with optional per-item warehouse/dimension **allocations** (the router validates allocation sums + type-specific ID requirements). No create UI exists.
- `purchasing.po.update` — needs an edit form for draft POs (same builder as create), gated on PO status.
- `purchasing.po.submit` / `po.approve` / `po.markOrdered` / `po.cancel` — need status-transition action controls on `purchasing/orders/[id]/page.tsx` (a status action bar). Each is a state machine step (draft → pending_approval → approved → ordered → cancelled); approve/cancel are authority actions, so confirm-dialog + role-gating UX is undecided.
- `purchasing.goodsReceipt.create` — needs a "Receive Goods" form against an ordered PO (per-line quantityReceived / quantityRejected, GR notes). The PO detail page only **displays** existing goods receipts today; receiving is inventory-affecting (it increments stock), so confirm/UX policy is undecided.

These add net-new forms/controls across the vendor list, PO list, and PO detail and
span inventory-affecting / authority actions, so they should be planned as a dedicated
Phase 7 feature update with a PRODUCT.md-backed spec.

## Accounting + Banking (session W6)

All seven Accounting + Banking pages are **read-only server components** that query
Prisma / tRPC directly: `accounting/page.tsx` (chart of accounts list),
`accounting/journal-entries/page.tsx` (journal entry list), `banking/page.tsx`
(treasury dashboard), `banking/fund-sources/page.tsx` (fund source list),
`banking/transactions/page.tsx` (global ledger), and
`banking/[fundSourceId]/transactions/page.tsx` (per-source ledger). Every interactive
control is a working nav/query element — the chart-of-accounts ↔ journal-entries cross
links, the treasury "Manage sources" / "All transactions" / per-row "Transactions →"
links, and the fully-functional ledger **filter forms** (fund-source select, type
select, Filter submit, Clear) plus **pagination** Prev/Next links that preserve active
filters via searchParams. **No dead/inert controls exist** — there were no no-op
buttons, unbound handlers, disabled placeholders, or broken hrefs to wire, and there
are no client components in these directories.

One non-control was considered and rejected: the fund-source and account rows are plain
display rows (no `accounting/accounts/[id]`, `journal-entries/[id]`, or
`fund-sources/[id]` detail route exists), so they **cannot** be row-linked the way W1
linked CRM customers to an existing detail page. Building those detail pages is a
feature-build, not a nav fix, so it is **not** in scope for "wire dead controls."

The following **20 router mutations are entirely unsurfaced** (no UI control exists).
Surfacing any of them is a feature-build — net-new forms, line-item editors,
status-transition actions, and confirm/UX decisions — so they are **not** in scope for
this wave:

**accountingRouter (10):**
- `accounting.account.create` / `account.update` / `account.toggleActive` — need an
  "Add/Edit Account" form (code, name, type, subtype, parentId, description, isSystem)
  plus a toggle confirm. The chart-of-accounts list is display-only today.
- `accounting.journalEntry.create` — needs a journal-entry builder: header (date,
  description, fiscalYear) + a balanced multi-row debit/credit line editor (the router
  validates that debits equal credits). No create UI exists.
- `accounting.journalEntry.post` / `journalEntry.reverse` — need status-transition
  action controls on a journal-entry detail page (draft → posted → reversed). Posting
  and reversing are ledger-affecting authority actions, so confirm-dialog + role-gating
  UX is undecided. No detail page exists yet either.
- `accounting.fiscalYear.create` — needs a "New Fiscal Year" form (name, start/end
  dates). No fiscal-year management UI exists.
- `accounting.taxRate.create` — needs an "Add Tax Rate" form (name, rate, type). No tax
  rate management UI exists.

**bankingRouter (10):**
- `banking.create` / `update` / `toggleActive` (fund sources) — need an "Add/Edit Fund
  Source" form (name, type, opening balance, account number) plus a toggle confirm. The
  fund-source list is display-only today.
- `banking.transaction.recordIncome` / `recordExpense` / `transfer` /
  `recordCreditCardCharge` / `payCreditCard` / `loanMoneyOutTo` / `loanMoneyIn` /
  `recordRefund` / `recordAdjustment` — each needs a dedicated money-movement form
  (amount, fund source(s), category, counterparty, notes). Several are
  balance-affecting and inter-account (transfer, payCreditCard, loanMoneyOutTo /
  loanMoneyIn move money between two sources), so amount/sign conventions, source
  selection, and confirm/UX policy are undecided. The ledgers only **display** existing
  transactions today; recording is balance-affecting.

These add net-new forms/controls across the accounts list, journal-entries surface,
fund-source list, and both ledgers, and span ledger-/balance-affecting authority
actions, so they should be planned as a dedicated Phase 7 feature update with a
PRODUCT.md-backed spec.

## HR — Employees + Payroll + DTR (session W7)

All five HR pages are **read-only server components** that query Prisma directly:
`employees/page.tsx` (employee list), `employees/[id]/page.tsx` (employee detail),
`payroll/page.tsx` (payroll-run list), `payroll/[id]/page.tsx` (payroll-run detail with
payslip table), and `dtr/page.tsx` (attendance + leave-request tables).

The HR surface is **already fully wired** for the controls that exist — there were no
dead/inert controls to connect this session:
- `employees/page.tsx` — rows already link to `employees/[id]`; the All/Active/Terminated
  filter tabs already work via the `?filter=` query param.
- `employees/[id]/page.tsx` — "← Back to Employees" link works; otherwise display-only.
- `payroll/page.tsx` — rows already link to `payroll/[id]`; the
  All/Draft/Processing/Approved/Paid tabs already work via the `?status=` query param.
- `payroll/[id]/page.tsx` — "← Back to Payroll" link works; payslip table is display-only.
- `dtr/page.tsx` — pure display: attendance (last 7 days) and leave-request tables with
  status badges, no interactive controls.

The following **14 router mutations are entirely unsurfaced** (no UI control exists).
Surfacing any of them is a feature-build — net-new forms, action bars, status-transition
controls, and confirm/UX + authority-gating decisions — so they are **not** in scope for
"wire dead controls":

**employeeRouter (3):**
- `employee.create` — needs an "Add Employee" form + route (e.g. `employees/new`): links a
  User, plus employmentType, dateHired, optional compensation (base/daily/hourly), gov IDs
  (SSS/PhilHealth/Pag-IBIG/TIN), banking, and emergency contact. Field/validation/UX spec
  required. No create UI exists.
- `employee.update` — needs an employee edit form + route (e.g. `employees/[id]/edit`);
  same field set as create. The detail page is display-only today.
- `employee.terminate` — needs a "Terminate" action control on the employee detail page;
  this is an HR authority action (sets dateTerminated), so confirm-dialog + role-gating UX
  is undecided.

**payrollRouter (4):**
- `payroll.create` — needs a "New Payroll Run" form (period start/end, currency, employee
  selection / payslip generation policy). No create UI exists.
- `payroll.process` / `payroll.approve` / `payroll.markPaid` — need a status-transition
  action bar on the payroll-run detail page (draft → processing → approved → paid). These
  are money-/ledger-affecting authority actions, so confirm-dialog + role-gating UX is
  undecided. The detail page only displays status + payslips today.

**dtrRouter (7):**
- `dtr.attendanceClockIn` / `attendanceClockOut` — need a time-clock UI (per-employee
  clock widget or kiosk); device/role/UX decisions undecided.
- `dtr.attendanceApprove` / `attendanceReject` — need approve/reject action controls on an
  attendance review surface; the DTR attendance table is display-only today.
- `dtr.leaveRequestCreate` — needs a "Request Leave" form (type, date range, reason). No
  create UI exists.
- `dtr.leaveRequestApprove` / `leaveRequestReject` — need approve/reject action controls on
  the leave-request list (supervisor authority actions); confirm/role-gating UX undecided.

These add net-new forms/controls across the employee list/detail, payroll-run detail, and
DTR attendance/leave surfaces, and span HR-/money-affecting authority actions, so they
should be planned as a dedicated Phase 7 feature update with a PRODUCT.md-backed spec.

## Projects + Tasks (session W8)

All four Projects/Tasks pages are **read-only server components** that query Prisma
directly: `projects/page.tsx` (project list), `projects/[id]/page.tsx` (project detail
with overview/tasks/expenses/milestones tabs), `projects/[id]/expenses/page.tsx`
(per-project expense ledger), and `tasks/page.tsx` (global kanban board).

The Projects/Tasks surface is **already fully wired** for the controls that exist —
there were **no dead/inert controls** to connect this session (no no-op buttons, unbound
handlers, disabled placeholders, or `href="#"`), and there are no client components in
these directories. Every interactive control is a working nav/query element:
- `projects/page.tsx` — status filter chips (`?status=`), pagination Prev/Next (filter-
  preserving), and project-name → `projects/[id]` row links all work.
- `projects/[id]/page.tsx` — the overview/tasks/expenses/milestones tab chips (`?tab=`),
  the "← Projects" back link, and the "View All Expenses →" link all work; every tab body
  is a display-only table/card grid.
- `projects/[id]/expenses/page.tsx` — the expense-type filter chips (`?type=`),
  pagination, and "← project" back link all work; the ledger is display-only.
- `tasks/page.tsx` — the Kanban/Calendar view toggle (`?view=`) works; the kanban columns
  render task cards as plain (non-interactive) `<div>`s.

Two non-controls were considered and **rejected** as out-of-scope feature-builds:
- The **"New Project"** button (and the "Create your first project →" empty-state link) on
  `projects/page.tsx` point at `/${slug}/projects/new`, **a route that does not exist**
  (only `projects/page.tsx`, `[id]/`, and `[id]/expenses/` exist — there is no
  `projects/new/`). This is a broken nav target, but "wiring" it means **building a project
  create form** (vendor/customer picker, manager, status, dates, budget) backed by
  `project.create` — a feature-build with undecided field/validation/UX, **not** a
  control-wiring or nav fix. Flagged here for a human; not silently left.
- The **task cards** on `tasks/page.tsx` are non-clickable `<div>`s — there is **no task
  detail route** to link them to, and the kanban has no drag-to-change-status, no
  "New Task" button, and a "Calendar view coming in Phase 2" placeholder. Each of these is
  a feature-build (new route / client interactivity / new form), not an inert control.

The following **router mutations are entirely unsurfaced** (no UI control exists).
Surfacing any of them is a feature-build — net-new forms, line-item / line-editor UI,
status-transition action bars, kanban drag interactivity, and confirm/authority-gating
UX decisions — so they are **not** in scope for "wire dead controls":

**projectRouter + sub-routers (8):**
- `project.create` / `project.update` — need a "New/Edit Project" form + routes (e.g.
  `projects/new`, `projects/[id]/edit`): name, customer picker, manager, description,
  status, dates, budget. Field/validation/modal-vs-route UX undecided. The list and detail
  pages are display-only today.
- `project.complete` / `project.archive` — need status/lifecycle action controls on the
  project detail page (the router enforces a status state machine:
  planning → active → on_hold/completed/cancelled); these are authority actions, so
  confirm-dialog + role-gating UX is undecided.
- `project.expense.recordProjectExpense` — needs a "Record Expense" form on the project
  expenses surface (description, amount, type, date); the expense ledger is display-only.
- `project.milestone.create` / `milestone.update` / `milestone.complete` — need a
  milestone-management surface (add/edit milestone, mark complete) on the milestones tab,
  which is display-only today.

**tasksRouter (13):**
- `tasks.taskCreate` / `taskUpdate` — need a "New/Edit Task" form (title, project, status,
  priority, due date, milestone, assignees). No create/edit UI exists.
- `tasks.taskUpdateStatus` — the status state machine exists in the router
  (todo → in_progress/blocked, etc.), but surfacing it means **kanban drag-and-drop** (or
  a per-card status dropdown) — net-new client interactivity, not an inert control.
- `tasks.taskAssign` / `taskUnassign` — need an assignee picker on a task detail/card UI
  that does not exist (cards only show an assignee count).
- `tasks.taskAddStatusReport` — needs a status-report form on a task detail surface that
  does not exist.
- `tasks.todoCreate` / `todoUpdate` / `todoDelete` / `todoComplete` / `todoAddAttachment`
  — need a per-task checklist/todo UI (none exists in the Projects/Tasks pages today).

These add net-new forms/controls and client interactivity across the project list/detail,
expenses, milestones, and the kanban board, and span lifecycle/authority actions, so they
should be planned as a dedicated Phase 7 feature update with a PRODUCT.md-backed spec.

---

## Service + Job Orders + Support (W9)

Self-inventory of the W9 surface — `job-orders/page.tsx` (197 LOC list),
`job-orders/[id]/page.tsx` (359 LOC read-only ops detail), `service/job-orders/[id]/page.tsx`
(210 LOC interactive technician detail + 3 client components: status-actions,
line-items, signature-pad), `support/page.tsx` (177 LOC list), `support/[id]/page.tsx`
(247 LOC read-only detail). Routers: `jobOrderRouter` (list/byId/publicView + create,
updateStatus, assignTechnician, addPart, removePart, addServiceLine, removeServiceLine,
recordSignature), `supportRouter` (ticket.list/byId/create/update/assign/changeStatus/close,
comment.list/create, attachment.list).

### Wired this session (dead control fixed)
- **`service/job-orders/[id]/page.tsx` breadcrumb** — the "Job orders" breadcrumb pointed at
  `/${slug}/service/job-orders`, which has no `page.tsx` (only `[id]` exists) → it 404'd.
  Retargeted to the real job-orders list at `/${slug}/job-orders`. (Dead nav → existing route.)

### Already fully wired (no action needed)
- The `service/job-orders/[id]` detail page is already interactive: status-actions →
  `jobOrder.updateStatus` (state-machine-gated, signature-gated for completion), line-items →
  `jobOrder.addPart`/`removePart`/`addServiceLine`/`removeServiceLine`, signature-pad →
  `jobOrder.recordSignature`. All status/parts/service/signature mutations are surfaced.
- `job-orders/page.tsx` (status filter tabs + row→detail links), `job-orders/[id]/page.tsx`
  (read-only ops view, working back link), `support/page.tsx` (status tabs + row→detail links),
  `support/[id]/page.tsx` (read-only thread + external attachment links) — every interactive
  control is a working nav/query element. No dead/inert controls.

### Feature-builds — NOT built per WAVE POLICY (need new UI/UX spec)

**jobOrderRouter (2):**
- `jobOrder.create` — needs a "New Job Order" intake form (customer picker, device fields,
  reported issue, priority, estimated cost). No create UI exists on the job-orders list.
- `jobOrder.assignTechnician` — needs a technician picker on the detail surface; technician
  is display-only today.

**supportRouter (6):**
- `ticket.create` — needs a "New Ticket" form (title, description, priority, category). The
  support list has no create control.
- `ticket.update` — needs an edit form for ticket fields; detail is display-only.
- `ticket.assign` — needs an assignee picker (the detail shows raw `User {id.slice(0,8)}`,
  not even a resolved user lookup) — net-new picker + user-name resolution.
- `ticket.changeStatus` — the router enforces a status state machine
  (open → in_progress/waiting → resolved → closed); surfacing it means status-action buttons
  + confirm/authority UX on the detail page (none exist).
- `ticket.close` — a lifecycle action needing a confirm + (optional) resolution note UI.
- `comment.create` — needs an add-comment form (content + internal/public toggle) on the
  ticket thread, which is display-only today.

### Structural note (UX decision — not a dead control)
- Two job-order detail routes coexist: `job-orders/[id]` (read-only ops view, where the
  job-orders list links) and `service/job-orders/[id]` (interactive technician view, reachable
  only by direct URL — nothing links to it, and `service/job-orders` has no list page).
  Whether the list should link to the interactive view, whether the read-only view should be
  retired, and whether a `service/job-orders` list route should exist are product/IA decisions —
  out of scope for a wiring pass. Flagged for a dedicated Phase 7 spec.

These add net-new forms/controls and lifecycle/authority interactions across the job-order
intake, technician assignment, and the full support-ticket surface, so they should be planned
as a dedicated Phase 7 feature update with a PRODUCT.md-backed spec.

## W10 — E-commerce + Storefront (2026-06-14)

The e-commerce + storefront surface is otherwise fully wired (storefront list/detail,
add-to-cart, checkout→placeOrderAsCustomer+Turnstile, guest order tracking, admin order
detail with updateOrderStatus/updateFulfillment/createXenditInvoice). Nav fix shipped:
`store/orders/track` was a functional but orphan page (nothing linked to it) — added a
"Track order" link to the store header. The following storefront procedures remain
unsurfaced and need a dedicated Phase 7 spec (net-new pages + product/UX decisions):

- `storefront.listMyOrders` — needs a customer-facing "My orders" history page
  (authenticated customer order list). No such route exists; requires deciding the
  customer account area IA and how authenticated storefront customers are modeled.
- `storefront.placeOrder` — authenticated (writeProcedure) order creation, distinct from
  the public `placeOrderAsCustomer` used by checkout. Surfacing it means a net-new
  admin/staff "create order on behalf of customer" form (customer picker + line-item
  builder) — a feature-build, not a dead control.

### Redundant-but-covered (no action needed)
- `storefront.browseProducts` and `storefront.listAllOrders` are unused by the UI because
  the storefront product list and the admin `ecommerce/orders` list query Prisma directly
  in their server components. Functionality is present; the tRPC procedures are simply not
  the path the pages take. No wiring gap — flagged only to avoid a future "dead procedure" hunt.

---

## W11 — Dashboard + Reports + Settings (2026-06-14, branch swarm/wire-dead-controls)

Self-inventory of the dashboard / reports / settings surfaces.

### Shipped this session (in wiring scope)
- **Reports page tenant isolation (🔴 security fix).** `reports/page.tsx` was a server
  component running cross-module Prisma aggregates (invoice/expense/jobOrder/customer/
  project/employee/payroll) with **no tenant scoping** — it leaked aggregates across ALL
  tenants and didn't even resolve a tenant. Rewired every query to scope by the signed-in
  user's `tenantId` (resolved via `auth()`, mirroring `reportRouter`'s `ctx.tenantId`
  scoping exactly). Added a `notFound()` guard when there is no valid session/tenant.
  This is the "reports against reportRouter" punch-list item: the page now applies the
  same tenant-safe query logic the router exposes.
- **Settings dead-link cleanup.** Four "Coming soon" cards (Users, Departments, Expense
  Categories, SMTP) carried `href`s pointing to settings sub-pages that do not exist
  (would 404). Nulled those hrefs to match the already-null `account` card so the data is
  honest. The "Coming soon" badge is left intact because those areas genuinely are not
  built. Only `settings/xendit` exists and stays Live + linked.

### Feature-builds — NOT built per WAVE POLICY (need product/UX spec + backend)
- **Notification surface (dashboard + global header bell).** `notificationRouter` is a
  STUB: `list`/`unreadCount`/`markRead`/`markAllRead` return empty/0 with a comment that
  there is no persistent Notification model and Valkey integration is not wired. The
  header bell (`components/layout/app-header.tsx`) is a dead `<Button>` (no handler,
  comment "wired to notification.list in Phase 8"). Surfacing notifications needs: (a) the
  Valkey-backed (or Prisma) notification backend implemented, and (b) net-new popover/
  dropdown UX (list rendering, mark-read interactions, empty state, badge). Both ends are
  unbuilt → feature-build, deferred.
- **Settings sub-pages** — `settings/users`, `settings/departments`,
  `settings/expense-categories`, `settings/smtp`, and `settings/account` have no page.
  Each is a net-new management surface (CRUD UI + product/UX decisions; e.g. user/role
  management, department tree, expense-category editor, SMTP config form, account/plan/
  billing). Only `settings/xendit` is built. These are feature-builds, not dead controls.

### Already fully wired (no action needed)
- **Dashboard** (`dashboard/page.tsx`) is tenant-scoped (resolves tenant by slug, every
  query filtered by `tenantId`) and fully wired: 4 KPI cards link to invoices/expenses/
  crm, "Recent invoices"/"Recent expenses" panels render live data with working "View all"
  links. No dead controls. (It computes its own report-style data directly; it does not
  call reportRouter/notificationRouter — surfacing notifications is the feature-build above.)
- **Settings → Xendit** (`settings/xendit`) is live and wired (config-form island).

## W12 — Platform admin (powerbyte-admin) + landing pricing (2026-06-14, branch swarm/wire-dead-controls)

Self-inventory result: **the W12 domain is already fully wired — zero dead/inert controls,
zero broken nav.** No functional code changed. Detail below.

### Already fully wired (no action needed)
- **Landing pricing** (`app/page.tsx`). The page already loads active plans
  (`prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder } })`) and
  renders a full pricing grid with per-plan price/users/storage/features and a working
  `Get started → /register?plan={slug}` CTA. The "Pricing plans coming soon." line
  (page.tsx:109) is the **empty-state fallback** for `plans.length === 0` — correct
  behavior, not a dead control. It disappears automatically once Plan rows are seeded; it
  is a data/seed concern, not a wiring concern. (Scope referenced `planRouter.list` — the
  actual method is `planRouter.listActive`; it is **redundant-but-covered**: the RSC reads
  Prisma directly and returns the identical result set, matching the W10/W11 convention
  that an RSC reading Prisma directly counts as already-wired.)
- **Platform admin list** (`powerbyte-admin/page.tsx`). Server component lists all tenants
  (`prisma.tenant.findMany`) with status chips, plan, created date, and a working
  `Manage → /powerbyte-admin/{id}` link. Access-gated by `powerbyte-admin/layout.tsx`
  (redirects non-`Platform Owner`). No dead controls.
- **Platform admin tenant detail** (`powerbyte-admin/[tenantId]/page.tsx`). Server
  component with working Suspend / Reactivate **Server Actions** (Prisma `tenant.update`
  + `redirect`), `notFound()` guard, breadcrumb back to `/powerbyte-admin` (exists),
  details panel, workspace URL. All controls functional.

### Feature-builds / hardening — NOT built per WAVE POLICY (need new infra + product/UX spec)
- **Route admin pages through `platformRouter` (hardening, not a dead-control fix).**
  `platformRouter` (`listTenants` / `getTenant` / `suspendTenant` / `reactivateTenant`)
  already exists and is mounted, and its mutations add what the page Server Actions lack:
  (a) `platformProcedure` auth at the data layer, and (b) **L5 audit logging** to
  `tenantAuditLog` with `PLATFORM:SUSPEND_TENANT` / `PLATFORM:REACTIVATE_TENANT`
  (security.md superadmin rule: "ALL superadmin operations MUST be logged to AuditLog with
  prefix PLATFORM:"). Wiring the RSC pages/Server Actions onto the router is a
  **behavior-changing refactor**, not a dead-control wire, and is blocked on two unbuilt
  pieces: (1) there is **no RSC→tRPC server-caller pattern** in the app today
  (`createCallerFactory` is used only in tests; every RSC page reads Prisma directly), so a
  server-caller helper would have to be introduced; and (2) the router mutations require
  `reason: z.string().min(1)` — capturing a suspension/reactivation reason is
  **unspecified UX** (modal? textarea? prompt?). Deferred: needs the server-caller helper +
  the reason-capture UX decision. Recommended as the canonical fix for the admin
  audit-logging gap.
- **Surface `listTenants` search/status filters.** `platformRouter.listTenants` accepts
  `search` / `status` / pagination, but the admin list page renders an unfiltered,
  unpaginated table. A search box + status filter + pagination is net-new UI (and would
  ride on the server-caller helper above). Feature-build, deferred.
