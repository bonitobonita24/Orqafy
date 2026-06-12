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
