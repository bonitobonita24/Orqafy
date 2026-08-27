# Customer Portal (D-1) — MVP Implementation Plan

Architect-produced 2026-08-27 (Full-Auto B). Locked scope: **Dashboard + Invoices + Online Orders +
Repairs/Job Orders**, **invite-only** auth. Deferred to v2: Proposals/Quotations, Projects, Subscriptions,
Payments/Credit. Dev-first, HARD HOLD (local only). Reference: PENDING_DECISIONS.md D-1.

## Keystone — customer auth design
Add a **second Credentials provider (`id:"portal"`)** to the existing single Auth.js v5 instance
(`apps/web/src/server/auth/config.ts`), authenticating against `Customer.portalEmail` +
`Customer.portalPasswordHash` (scoped by `tenantSlug`). JWT/session stamped with a **`principalType`
discriminator** (`"customer"` vs default `"staff"`).
- Customer token: `principalType:"customer"`, `customerId`, `tenantId`, `tenantSlug`,
  `customerSecurityVersion`, **empty roles/roleId, userId=null**.
- `jwt()`/`session()` callbacks branch on `principalType`: customer path re-validates
  `Customer.isActive && portalEnabled && customerSecurityVersion` (version bump on reset/disable
  invalidates live sessions — same staleness contract as staff `User.securityVersion`).
- New `portalProcedure` (mirrors `protectedProcedure`): requires `principalType==="customer"` &&
  `customerId!=null`, **rejects staff**. Staff procedures already reject customers (no roleId →
  matrix deny-by-default; userId=null fails protectedProcedure).
- **Invite-only:** staff `customerPortal.invite` → raw token, store **hash+expiry** on new
  `CustomerPortalInvite`; email link `/{slug}/portal/accept?token=…` (public); customer sets password →
  bcrypt → `portalPasswordHash`, `portalEnabled=true`, invite consumed. Reset/disable bump
  `customerSecurityVersion`.

## Security invariants (reviewer MUST check)
1. Customer JWT has no roles/roleId, userId=null → cannot pass protected/matrix procedures.
   portalProcedure requires customer principal and rejects staff.
2. Every portal query filters **both** `tenantId===ctx.tenantId` AND `customerId===ctx.customerId`;
   `customerId` ONLY from ctx, never from router input.
3. Middleware: `/{slug}/portal/*` requires a customer on that tenant; staff on `/portal/*` → redirect to
   `/{slug}/dashboard`; customer on any non-portal authed route → redirect to `/{slug}/portal`;
   cross-tenant slug rejected.
4. Login only when `portalEnabled && portalPasswordHash!=null && Customer.isActive && tenant.isActive`;
   generic enumeration-resistant error; rate-limit login + invite-accept via existing `rateLimiters`.
5. Invite tokens single-use, hashed at rest, expiring, tenant+customer scoped.
6. Portal `byId` returns NOT_FOUND (not FORBIDDEN) on cross-customer/cross-tenant mismatch.
- ⚠ Do NOT reuse staff `storefront.listMyOrders`/`getOrderById` — they trust `input.customerId`
  (tenant-only scoping). Portal must derive customerId from ctx.

## Migration
`add_customer_portal_session_and_invites`: `Customer.customerSecurityVersion Int @default(1)`; new model
`CustomerPortalInvite` (id, tenantId, customerId, tokenHash @unique, email, expiresAt, consumedAt?,
createdById, timestamps; @@index tenantId, @@index customerId, @@schema("public")). portalEnabled/
portalEmail/portalPasswordHash already exist — no migration.

## Waves
- **W1 — Auth foundation** (T1.1 schema+migration → keystone T1.2 verifier+provider+session-branch+types &
  T1.3 context+portalProcedure → T1.4 middleware+public-paths & T1.5 invite/accept/reset router+_app reg).
- **W2 — Shell + auth UI** (T2.1 portal route group/layout/login/accept pages; T2.2 staff invite control on
  client detail).
- **W3 — Sections** (T3.1 Invoices [reuses D-4 view] · T3.2 Online Orders · T3.3 Repairs — parallel; then
  T3.4 Dashboard summary). Add portal-isolation tests mirroring `*-tenant-parity.test.ts`.

Route home: new segment `(tenant)/[slug]/portal/*` (sibling of `store` and `(app)`).

## [WHAT] defaults taken (Full Auto — recorded, not asked; revisit anytime)
- Staff invite gating: add a `customer_portal` matrix feature (or reuse `clients.update`) — MVP: reuse
  clients update permission.
- One login per Customer (on `portalEmail`); per-contact logins → v2.
- Invite delivery = emailed invite → set-password (magic-link → v2).
- Single Auth.js instance + `principalType` discriminator (separate cookie/instance → v2 hardening).
- `portalEmail` uniqueness: partial unique `(tenantId, portalEmail)` where portalEnabled — confirm in T1.1.

## Progress
- [ ] W1  - [ ] W2  - [ ] W3
