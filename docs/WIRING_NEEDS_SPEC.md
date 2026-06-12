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
