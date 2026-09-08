# Tenant RBAC Standard — On-Demand Authority (V32.25 — Rule 34; extended V32.50 — Rule 41 Parts E+F)

> Loaded contextually (read-on-demand, NOT auto-loaded — same posture as `security.md` / `privacy.md`).
> This file is the sole authority for the **tenant RBAC standard** every tenant-based framework app
> inherits (Rule 34): the fixed 3-tier system-role backbone AND the tenant-scoped custom-role
> permission-matrix builder. Governs HOW a framework-generated app (Next.js · tRPC · Prisma ·
> Auth.js v5 · PostgreSQL · shadcn/ui) models roles, enforces permissions, and lets a tenant owner
> build their own sub-roles. Technical security controls live in `security.md` (L1–L6); this file
> references them (esp. **L3 RBAC**), it does not duplicate them.
>
> ⚠️ **DESIGN / REFERENCE, not running app code.** The 3-tier backbone is a scaffold DEFAULT
> (Phase 0/4) and has a proven retrofit playbook (Scenario 42). The **custom-role matrix layer**
> below is authored ONCE at framework level as the standard DESIGN so every app inherits the same
> builder — it is implemented **per app at scaffold or next substantial touch**, under the deploy
> HARD HOLD (LOCAL commits only; no staging/prod without the owner's explicit word). Do not build
> running matrix code into any app from this file alone.

---

## When to read

Read this file when:
- Any build phase generates or touches **auth, roles, RBAC, user management, or tenant onboarding**.
- `docs/PRODUCT.md` **Roles & Permissions** section (§5) is populated and you are deriving the schema.
- A **role-builder / custom-role** feature is being designed or wired (tenant_superadmin screen).
- You are **retrofitting** the 3-tier backbone onto an existing tenant-based app → follow **Scenario 42**.
- You reach a phase that seeds accounts (Phase 4 Part 3 seed) or wires route/nav/tRPC authorization.

Reference impl (3-tier backbone, proven, data-preserving): Marine-Guardian branch
`feat/tenant-rbac-3tier` (enum RENAME + partial-unique index + succession + user-mgmt widening + tests).

---

## Part A — The 3-tier system-role backbone (FIXED, enum-based)

Every tenant-based app ships exactly three **fixed system tiers** at the top of its `UserRole` enum.
These are enum values (not matrix-driven) — they are the framework constant. Below them sit the app's
own **domain roles** (coordinator/operator/viewer or whatever the app calls them), which is where the
custom-role matrix (Part B) applies.

### Capability matrix (verbatim owner spec + MG-proven enum names)

| Capability | `tenant_manager` (platform) | `tenant_superadmin` (tenant owner, 1/tenant) | `tenant_admin` (delegated) | domain roles (coordinator/operator/viewer/custom) |
|---|:--:|:--:|:--:|:--:|
| Create / manage / impersonate tenants | ✅ | — | — | — |
| Billing (when the app has it) | platform | ✅ own tenant | ❌ | ❌ |
| User Management (create admins + assign roles + build custom roles) | ✅ any tenant | ✅ own tenant | ❌ | ❌ |
| All app features (read/write) | ✅ | ✅ | ✅ | scoped by the role_permissions matrix |

- **`tenant_manager`** — the platform operator. `tenant_id = NULL` (cross-tenant). Creates/manages
  tenants, break-glass reassigns a tenant's owner. Multiple platform managers are allowed.
- **`tenant_superadmin`** — the tenant's owner. **Exactly ONE per tenant**, enforced at the DB layer
  by a partial-unique index (below). The tenant's first/main admin; the only in-tenant role that may
  do Billing + User Management + **build/assign custom roles**.
- **`tenant_admin`** — the first delegated admin created by the owner. All app features EXCEPT Billing
  and User Management (deliberately excluded from `userManagementProcedure`).
- **domain roles** — everything below `tenant_admin`. These are where custom roles live and where the
  `role_permissions` matrix governs access (Part B).

### Enum + one-owner-per-tenant constraint (the proven, data-preserving mechanic)

```prisma
enum UserRole {
  tenant_manager      // platform operator (tenant_id NULL)
  tenant_superadmin   // tenant owner — exactly ONE per tenant (partial-unique index)
  tenant_admin        // delegated admin — all features EXCEPT Billing + User Management
  // ── app domain roles below (rename freely; these are examples) ──
  coordinator
  operator
  viewer
}
```

```sql
-- Exactly one owner per tenant. The platform manager (tenant_id NULL) is exempt,
-- so multiple platform managers remain allowed.
CREATE UNIQUE INDEX "one_tenant_superadmin_per_tenant"
  ON users (tenant_id)
  WHERE role = 'tenant_superadmin' AND tenant_id IS NOT NULL;
```

For an **existing** app, NEVER DROP/CREATE the enum (that loses every user's role). Rename in place with
`ALTER TYPE "UserRole" RENAME VALUE '<old>' TO '<tier>'` (data-preserving) — full executable steps in
**Scenario 42**.

### User-management gate

`userManagementProcedure` = `tenant_manager` + `tenant_superadmin` ONLY. `tenant_admin` is
**deliberately never added to it**. `/users` and `/settings` routes gate to those same two tiers.

### Succession contract (MANDATORY, both directions — the one-owner index is never violated mid-transfer)

1. **Break-glass reassign (platform):** a `tenant_manager` reassigns a tenant's `tenant_superadmin`
   (e.g. a lost/departed owner) — reassigns the account, **audited** (L5). Rejects a non-existent tenant
   → `NOT_FOUND`. Lives in a separate platform router (`platformUser.updateRole`).
2. **Owner transfer:** the current owner promotes another user to `tenant_superadmin` and demotes self.
   Because the partial-unique index forbids two owners at once, the swap is **mediated —
   promote-then-demote inside one transaction** (or demote-then-promote), never a naive double-write that
   would trip the index. Both directions are covered by unit tests in the auth scaffold.

---

## Part B — The custom-role permission-matrix (tenant-scoped, data-driven, DESIGN)

The 3 top tiers are fixed. Everything at `tenant_admin`-and-below is governed by a **data-driven
permission matrix** so a tenant owner can build sub-roles as narrow or as broad as the tenant needs —
without a code change. This is the framework's ONE custom-role builder, inherited identically by every app.

### B1 — The Feature Registry (each app declares its gatable modules)

Every app declares an **enumerable list of gatable features/modules** — the vocabulary both the matrix and
the role-builder UI read. Two valid forms; pick per app:
- **Compile-time enum / typed const** (`FEATURE_KEYS = ['patrols','reports','events',…] as const`) — simplest,
  type-safe, best when the module set is stable and app-owned.
- **`feature_registry` table** — when features are dynamic/tenant-configurable:

```prisma
model FeatureRegistry {
  id       String  @id @default(cuid())
  key      String  @unique          // stable machine key, e.g. "patrols"
  label    String                   // human label for the role-builder UI
  category String?                  // optional grouping for the matrix UI
  isActive Boolean @default(true)
}
```

Rule: a feature the matrix references MUST exist in the registry, and the role-builder UI renders its rows
**from the registry** (never a hardcoded list). This keeps matrix, enforcement, and UI in lockstep.

### B2 — The `role_permissions` matrix table (STRICT CRUD split)

```prisma
model CustomRole {
  id        String   @id @default(cuid())
  tenantId  String                       // tenant-scoped — L6 guardrails
  name      String                       // owner-chosen, mapped onto a preset (B5)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  @@unique([tenantId, name])
  @@index([tenantId])
}

model RolePermission {
  id         String  @id @default(cuid())
  tenantId   String                      // tenant-scoped — L6 guardrails
  roleId     String                      // → CustomRole.id
  featureKey String                      // → FeatureRegistry.key
  view       Boolean @default(false)     // can see / read
  write      Boolean @default(false)     // CREATE only (add new records)
  update     Boolean @default(false)     // EDIT only (modify existing)
  delete     Boolean @default(false)     // remove records
  @@unique([tenantId, roleId, featureKey])
  @@index([tenantId, roleId])
}
```

- **4 permissions, STRICT CRUD split:** `view` · `write` (create-only) · `update` (edit-only) · `delete`
  are **separate columns**. Write ≠ Update on purpose — a role can create records but not edit existing
  ones, or edit but never create. **Deny-by-default:** absent row / all-false = no access.
- A custom role can be as narrow as **View-only on one feature**.
- Every row carries `tenantId` (custom roles never leak across tenants — L6). `CustomRole.name` is
  owner-chosen; the app maps it onto a preset (B5) for a sensible starting matrix, never a forced rename.

### B3 — Matrix-driven enforcement (one resolver, three surfaces — mirrors MG's proven 3-surface pattern)

A single resolver reads the matrix; wire it identically at all three enforcement surfaces. **Deny-by-default**
everywhere. The 3 fixed tiers short-circuit to allow (they are not matrix-governed); everything at
`tenant_admin`-and-below resolves through the matrix.

```ts
// Pseudocode — the ONE authority both server and UI consult.
async function hasPermission(ctx, featureKey, action /* 'view'|'write'|'update'|'delete' */) {
  if (ctx.role === 'tenant_manager' || ctx.role === 'tenant_superadmin' || ctx.role === 'tenant_admin')
    return true;                                   // fixed tiers — full app access
  const perm = await db.rolePermission.findUnique({
    where: { tenantId_roleId_featureKey: { tenantId: ctx.tenantId, roleId: ctx.roleId, featureKey } },
  });
  return Boolean(perm?.[action]);                  // deny-by-default: no row → false
}
```

1. **tRPC procedures** — a `matrixProcedure(featureKey, action)` factory (a `protectedProcedure` +
   the resolver) gates every mutation/query. Never trust a role/permission from client input — derive
   `role`/`roleId`/`tenantId` from the session (L3 + L1).
2. **Route middleware** — deny-by-default prefixes: a route maps to `(featureKey, 'view')`; no view → redirect.
3. **Sidebar nav** — menu items filtered by `hasPermission(feature, 'view')`. Nav is **rendered from the
   matrix**, never a hardcoded enum switch (see `ui-rules.md` pointer).

The three surfaces read the SAME resolver so nav can never show what tRPC would forbid, and vice-versa.

### B4 — Role-builder UI spec (tenant_superadmin-only)

A screen where the tenant owner builds sub-roles:
- **Checklist matrix:** features (from the Feature Registry) down the side; the **4 permissions
  (View · Write · Update · Delete) across the top**; a checkbox per cell. Save writes `role_permissions`.
- Create/rename a role, clone from a **preset** (B5) as a starting matrix, then tighten/loosen per feature.
- **shadcn/ui only** (Data Table / Checkbox / Form + React Hook Form + Zod). Read cue paired with
  `accessibility-agents` (WCAG 2.2 AA — hard gate for gov/LGU) + `ui-rules.md`. See `ui-rules.md` pointer.

### B5 — Sub-role presets (capability templates — NEVER a forced rename)

Ship four presets as **starting matrices** the owner clones and maps onto the app's own domain names.
Presets are conveniences, not fixed roles — an app keeps its domain vocabulary (e.g. MG keeps
`field_coordinator` / `operator` / `viewer`) and maps a preset onto each:

| Preset | Typical matrix shape | Maps onto (example) |
|---|---|---|
| **Supervisor** | view + write + update across most features; delete on some; no User-Mgmt/Billing | team lead / field_coordinator |
| **Operator** | view + write + update on operational features; no delete | day-to-day staff / operator |
| **Contributor** | view + write (create-only) on assigned features; no update/delete | data-entry / enumerator |
| **Viewer** | view-only, read-only across granted features | read-only / viewer |

---

## Part C — Guardrails (custom roles can never escalate)

Non-negotiable — enforce in the role-builder AND server-side:
- **Tenant-scoped.** Every `CustomRole` / `RolePermission` carries `tenantId`; a custom role is invisible
  and inapplicable outside its tenant (L6 guardrails guarantee it structurally).
- **Below the `tenant_admin` ceiling.** A custom role can never grant more than `tenant_admin` holds.
  It is always strictly a subset of app-feature access — never a system tier.
- **NEVER Billing or User Management.** Those are exclusive to `tenant_superadmin` (own tenant) and
  `tenant_manager` (platform). The role-builder must not even expose them as gatable features; the server
  rejects any attempt to grant them.
- **Only tenant_superadmin (+ platform tenant_manager) build/edit/assign custom roles.** `tenant_admin`
  and below can neither create roles nor assign them (that is User Management, which they lack).
- **Deny-by-default, server-enforced.** Absent matrix row = no access. Enforcement is server-side from the
  matrix; the UI filter is convenience, never the security boundary.

---

## Part D — Credential model (reference the vault — never paste values)

The 3-tier default login accounts follow the canonical, already-vaulted scheme. **`tenant_manager` is a
single universal platform account across all envs; `tenant_superadmin` + `tenant_admin` are per-environment
defaults.** Values live ONLY in the vault — never in a repo, never in this file:

**Sole source:** `Server-Setups/secrets/universal-login-credentials.enc.yaml` (SOPS+age; nested, keyed
role × env). Describe the model in prose and point here; do not duplicate the table as an authority.

| Env | tenant_manager (universal) | tenant_billing (universal, NEW V32.50) | tenant_tech (universal, NEW V32.50) | tenant_superadmin | tenant_admin |
|---|---|---|---|---|---|
| local_dev | platform account | platform account | platform account | dev owner account | dev admin account |
| staging_prod | platform account | platform account | platform account | prod owner account | prod admin account |
| demo | platform account (no `/tm` reachable — F3) | n/a (no `/tm` on demo) | n/a (no `/tm` on demo) | demo owner account | demo admin account (NEW V32.50 — was "none" pre-Rule-41) |

Operational footnote: the vault schema is **nested 3 levels** (`["local_dev"]["tenant_superadmin"]["username"]`).
Some `sops` versions error on a 3-level `--extract` → **decrypt-whole + parse** instead. Passwords are set via
bcrypt (feed plaintext via file/stdin, never shell argv — special chars) and mirrored to the vault. Seed reads
passwords from env (`.env.{env}`) — never hardcoded (see `templates.md` seed + `.env` cred-key templates).
**NEW V32.50:** `tenant_billing`/`tenant_tech` are universal platform accounts (like `tenant_manager`) —
they exist ONLY where a `/tm` is reachable (never on demo, per F3). Demo now ALSO seeds a `tenant_admin`
account (was previously "none") to match the client-tenant shape (F1/Part A) exactly, on every real
environment AND demo. Rolling either change out to an ALREADY-DEPLOYED app is owner-gated — see
`~/.claude/CLAUDE.md` "Universal login credentials" rollout-gate policy.

---

## Part E — Platform-scope roles (data-driven) (NEW V32.50 — Rule 41)

The platform tier (`tenant_manager`, `tenant_id = NULL`) gains the SAME "data-driven, matrix-backed"
treatment Part B already gives tenant-scoped custom roles — applied to the PLATFORM scope. This is a
NEW layer alongside the fixed 3-tier backbone (Part A), never a redefinition of it.

### E1 — `tenant_manager` stays the FIXED default ADMIN ceiling

`tenant_manager` (label: **ADMIN**) remains the platform's fixed, framework-constant default role —
Part A's guarantee is UNCHANGED. What's new: the platform site now ALSO seeds two curated sub-roles
and supports creating more, in-frontend, by a `tenant_manager`:

| Role | Label | Seeded by default | Curated permission set |
|---|---|:--:|---|
| `tenant_manager` | ADMIN (default, fixed) | ✅ | Full platform access (unchanged from Part A) |
| `tenant_billing` | BILLING | ✅ | Subscription/billing management + tenant billing overrides; **no destructive tech ops** |
| `tenant_tech` | TECH SUPPORT | ✅ | Data overrides / technical support ops; **no billing** |
| *(more)* | owner-named | frontend-created | Built by `tenant_manager` from the platform permission matrix (E3) |

### E2 — `scope` discriminator on the existing custom-role tables (additive)

Reuse Part B's `CustomRole` / `RolePermission` shape rather than inventing a parallel schema — add a
**`scope`** discriminator column (additive migration, `DEFAULT 'tenant'` so every existing row is
unaffected) and make `tenantId` nullable so a platform-scope row can carry `tenant_id = NULL`:

```prisma
enum RoleScope { tenant  platform }              // additive enum — 'tenant' is the pre-existing default

model CustomRole {
  id        String    @id @default(cuid())
  scope     RoleScope @default(tenant)            // NEW — discriminator
  tenantId  String?                                // NOW NULLABLE — platform rows carry NULL
  name      String
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  @@unique([tenantId, name])                        // unchanged for tenant scope (tenant_id NOT NULL)
  @@unique([id, scope])                             // composite target for the platform-scope FK (E3 / B1)
  @@index([tenantId])
}
```

```sql
-- Additive: ADD COLUMN with a default backfills every existing row as 'tenant' (zero data loss).
ALTER TABLE "CustomRole" ADD COLUMN "scope" "RoleScope" NOT NULL DEFAULT 'tenant';
ALTER TABLE "CustomRole" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- The anti-escalation guarantee, enforced at the DB layer — a row can never be BOTH
-- tenant-scoped-with-no-tenant NOR platform-scoped-with-a-tenant.
ALTER TABLE "CustomRole" ADD CONSTRAINT "scope_tenant_consistency"
  CHECK ((scope = 'tenant' AND tenant_id IS NOT NULL) OR (scope = 'platform' AND tenant_id IS NULL));

-- Platform role names must be unique WITHIN the platform scope. Because tenant_id IS NULL on platform
-- rows and SQL treats NULLs as distinct, @@unique([tenantId, name]) does NOT stop a duplicate (or a
-- second shadow 'ADMIN') platform role — a partial unique index does (mirrors the one-owner-per-tenant
-- partial index in Part A).
CREATE UNIQUE INDEX "customrole_platform_name_key" ON "CustomRole" (name) WHERE scope = 'platform';

-- Pin every PlatformRolePermission structurally to a PLATFORM-scoped CustomRole: the composite FK
-- (roleId, roleScope) -> CustomRole(id, scope) plus this CHECK make it impossible for a platform grant
-- to attach to a scope='tenant' role, closing the residual join path through the shared CustomRole table.
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "platformrole_scope_pinned" CHECK (role_scope = 'platform');
```

### E3 — A DISTINCT platform permission vocabulary (never the tenant `FeatureKey` table)

**The core anti-escalation guarantee is namespace separation, not just a `scope` flag.** Reusing
`FeatureKey` for platform permissions would let a bug (or a careless query) resolve a platform grant
against a tenant role. Instead, platform permissions live in their OWN, physically separate tables:

```prisma
model PlatformFeatureRegistry {
  id       String  @id @default(cuid())
  key      String  @unique          // e.g. "billing.subscriptions", "tech.data-override"
  label    String
  category String?                  // "Billing" | "Tech Support" | …
  isActive Boolean @default(true)
}

model PlatformRolePermission {
  id                 String     @id @default(cuid())
  roleId             String
  roleScope          RoleScope  @default(platform)  // pinned to 'platform' — composite FK below (B1)
  role               CustomRole @relation(fields: [roleId, roleScope], references: [id, scope])
  platformFeatureKey String                      // → PlatformFeatureRegistry.key
  view               Boolean @default(false)
  write              Boolean @default(false)     // create-only
  update             Boolean @default(false)     // edit-only
  delete             Boolean @default(false)
  @@unique([roleId, platformFeatureKey])
  @@index([roleId])
}
```

`PlatformRolePermission` NEVER references `FeatureKey`/`RolePermission` (Part B) and vice-versa —
two vocabularies, two tables, no shared enum, no cross-reference. The resolver for a platform role
reads ONLY `PlatformRolePermission`; the resolver for a tenant role reads ONLY `RolePermission` (Part
B3). This is what makes the CHECK constraint (E2) a structural guarantee rather than an
application-layer promise. The two vocabularies DO share one table — `CustomRole` holds both scopes —
so `PlatformRolePermission.roleId` is pinned to a platform-scoped role by a **composite FK**
`(roleId, roleScope) → CustomRole(id, scope)` with `roleScope` fixed to `'platform'` (the
`platformrole_scope_pinned` CHECK, E2). That closes the only residual join path: a platform grant
cannot attach to a `scope='tenant'` role even under a resolver or query bug.

### E4 — Guardrails (restated for the platform scope — mirrors Part C)

- **Only `tenant_manager` creates/edits/assigns platform roles** (the platform-scope equivalent of Part
  C's "only `tenant_superadmin` (+platform `tenant_manager`)" — here there is no higher tier above
  `tenant_manager`, so it alone holds this power).
- **`tenant_billing` and `tenant_tech` are curated, NOT full-ADMIN** — the seed matrix grants each ONLY
  its named domain (billing OR tech-support), never both, never destructive ops outside its domain.
- **Platform permissions are NEVER grantable to a tenant-scoped `CustomRole`, and tenant permissions
  are NEVER grantable to a platform-scope role.** The server rejects any attempt to write a
  cross-scope grant — this is enforced by BOTH the CHECK constraint (structural) AND the
  resolver-level separation (E3, no shared vocabulary to even attempt a cross-grant against).
- **A never-grantable platform-permission set — the platform-scope ceiling.** Just as tenant custom
  roles can NEVER be granted Billing or User-Management (Part C), a seeded or frontend-created platform
  sub-role can NEVER be granted the platform's own governance keys — **platform role-management**
  (create/edit/assign roles), **tenant lifecycle** (create/suspend/delete a tenant), and
  **platform-account/manager creation**. Those stay exclusive to the fixed `tenant_manager` (ADMIN).
  Without this, a `tenant_billing`/`tenant_tech` or new sub-role granted a key like
  `platform.roles.manage` / `tenant.create` would silently escalate to full ADMIN. Enforce it in the
  platform role-builder matrix (those keys are never offered) AND server-side.
- **Cross-scope ASSIGNMENT is refused structurally, not only in app code.** The user↔role assignment
  join carries a constraint tying the assigned role's `scope` to the account's context (a platform
  account may hold ONLY `scope='platform'` roles; a tenant user ONLY `scope='tenant'` roles) — a
  DB-level check on the assignment table mirroring the permission side, so a direct-API assignment
  cannot cross scopes.
- **Deny-by-default, server-enforced**, identical posture to Part B3 — an absent
  `PlatformRolePermission` row = no access.
- **Roles are ALWAYS server-derived**, never trusted from client input (inherits AGENT PROHIBITION #1,
  same as Part C).

## Part F — Site-access URL topology (NEW V32.50 — Rule 41)

The routing shape every tenant-based app exposes, identical in every real environment (Local Dev,
Staging, Production). Companion to Parts A–E (roles) — this Part defines WHERE each tier lands.

### F1 — The 3-layer model

```
/tm                        Tenant Management Site — the SaaS platform/server owner (Powerbyte)
   ├─ ADMIN    tenant_manager   (Part E1, fixed default)
   ├─ BILLING  tenant_billing   (Part E1, seeded)
   └─ TECH     tenant_tech      (Part E1, seeded)

/{client-slug}              Client Tenant — the subscriber's own space
   ├─ /{slug}/  → OPTIONAL public marketing/landing page (per-app flag; public, before login — F2a)
   ├─ tenant_superadmin / tenant_admin → login /{slug}/login → post-auth landing /{slug}/admin
   ├─ (app-design RBAC roles below tenant_admin — Part B)
   └─ regular users → login /{slug}/login → land in-app

/demo (optional)          Demo Tenant — separate subdomain stack; NO /tm layer (F3)
```

### F2 — Client tenant: ONE role-routed login, never two forms

A client tenant exposes exactly **ONE** login form: `/{slug}/login`. Post-login the landing is
**role-routed server-side** (never a client-supplied redirect):
- Admin-tier (`tenant_superadmin`, `tenant_admin`) → `/{slug}/admin`
- Every other app role → `/{slug}/login` (its own home)

A pre-existing global `/admin` route is **dropped** in favor of the per-tenant `/{slug}/admin` — a
global, un-scoped `/admin` is ambiguous about which tenant it belongs to.

**Guard-layer requirement — grant the public exception in BOTH places, exact match only.** `/{slug}/login`
must be reachable pre-auth. Grant this EXACT-match exception (`pathname === '/{slug}/login'`, **NEVER**
`startsWith('/{slug}/login')` — a `startsWith` match would leak a sibling authed route that happens to
share the prefix) in **BOTH**:
1. `middleware.ts` (the edge guard), AND
2. the `[tenant]/layout.tsx` server-side auth check.

Missing either layer fail-closes into an **infinite redirect bounce** (middleware allows through, layout
bounces back to login, middleware allows through again…) — this is the single most common site-access
retrofit defect; verify both layers explicitly (Scenario 50 step 5 + verification).

### F2a — Optional public per-tenant landing page (`/{slug}/`)

A per-app-project **option** (a flag, e.g. `tenantLandingEnabled`): a client tenant MAY expose a public
marketing/landing page at its slug root `/{slug}/`, shown **before** login. FerryBook is the reference
case (`www.<app>.com/{slug}/` marketing page per client); an internal/LGU app (e.g. FRMS) typically
leaves it OFF.
- **Enabled** → `/{slug}/` is **public/unauthenticated**; it joins `/{slug}/login` as a public path and
  MUST be granted by the SAME exact-match public exception (F2), in BOTH guard layers.
- **Disabled** → `/{slug}/` redirects to `/{slug}/login` (or the dashboard if already authenticated).
- The flag is app/tenant configuration, never hard-coded; it changes ONLY which paths are public, never
  the role/permission model.

### F3 — Demo: separate subdomain, NO `/tm` layer, ever

A demo deployment is always a **separate deployment/stack** (never a tenant merged into prod), reached
via a subdomain: `demo.<domain>.com` or `{app}-demo.powerbyte.app`. Because it is single-tenant and
client-facing, it has **NO Tenant Management Site at all** — no `/tm` route is registered or reachable
on a demo deployment (not gated-and-hidden — genuinely absent from the demo build/routing table).
Demo accounts follow the standard client-tenant shape: `tenant_superadmin` + `tenant_admin`, credentials
from the vault's demo cred slot (Part D). Because a demo is single-tenant, its admin-tier landing MAY be
served at a bare `/admin` — this does NOT violate the "global `/admin` dropped" rule (F2), which targets
the MULTI-tenant ambiguity of an un-scoped `/admin`; a single-tenant demo has exactly one tenant, so
`/admin` is unambiguous there.

### F4 — `/platform` → `/tm` rename + reserved slugs

Where an app already has a management surface at the pre-standard `/platform/*` convention, rename to
`/tm/*` with a **redirect shim** (`/platform/:path* → /tm/:path*`) so existing bookmarks, OAuth
`callbackUrl`s, and Traefik/Komodo path-matching don't 404 mid-cutover. Removing the shim / flipping
default routing is an owner-gated cutover (`deploy-discipline.md`), same as any promotion.

**Reserved slugs** — a tenant-slug creation flow MUST reject (case-insensitively — normalize to
lowercase first) any of: `tm`, `demo`, `platform`, `admin`, `login`, `api`. `platform` is reserved
while the `/platform`→`/tm` redirect shim is live, so a `platform` tenant can't collide with it. Enforce
this **server-side** at tenant creation — never only in the client form — so a direct-API create cannot
bypass it. This guarantees no future tenant can ever collide with a platform/system route.

### F5 — Retrofit

An existing tenant-based app adopts Parts E+F via **Scenario 50** (dev-first, LOCAL-only, HARD HOLD —
mirrors Scenario 42's posture). Security verification: `Security_Checklist.md` **Section 22**.

---

## Framework inheritance

- **Rule 34** (`Master_Prompt.md` / `CLAUDE_compact.md`) references this file, exactly as Rule 33 references
  `privacy.md`.
- **Scenario 42** (`scenarios.md`) is the executable retrofit playbook for an existing app.
- **`security.md` L3 (RBAC)** carries the enforcement summary + guardrails.
- **`Security_Checklist.md` §21** verifies the standard (one-owner index, matrix deny-by-default, no
  Billing/User-Mgmt in custom roles, succession).
- **`phases.md` Phase 0/4** seed the backbone by default; **`templates.md`** carries the seed + `.env` templates.
- **`LESSONS_REGISTRY.md`** (`framework.rbac.tenant-3tier-and-custom-role-matrix`) keeps the standard from regressing.
- **Rule 41** (`Master_Prompt.md` / `CLAUDE_compact.md`, NEW V32.50) references Parts E+F of this file for
  the site-access topology + platform-scope role mechanics, exactly as Rule 34 references Parts A–D.
- **Scenario 50** (`scenarios.md`) is the executable retrofit playbook for Parts E+F on an existing app.
- **`Security_Checklist.md` §22** verifies the standard (CHECK constraint, scope enforcement, `/tm` gating,
  distinct vocab, `/{slug}/login` guard-layer parity, role-routed login).
- **`LESSONS_REGISTRY.md`** (`framework.site-access.tm-platform-roles-and-role-routed-urls`) keeps the
  site-access standard from regressing.
</content>
</invoke>
