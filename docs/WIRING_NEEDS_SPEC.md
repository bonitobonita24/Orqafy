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
