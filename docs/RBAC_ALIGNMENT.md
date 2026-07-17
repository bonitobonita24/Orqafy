# Orqafy — RBAC 3-Tier Fleet-Standard Alignment (M2a Gap Analysis)

> Authored 2026-07-10 during the owner-triggered Full-Auto run (M2a). Compares Orqafy's CURRENT
> RBAC implementation against the fleet standard `~/.claude/rules/tenant-rbac-standard.md`
> + framework Scenario 42 + `.ai_prompt/rbac.md`. Dev-first, LOCAL only. HARD HOLD on any
> staging/prod/demo deploy and on any account RESEED (owner-gated). Branch `feat/tenant-rbac-3tier`.
>
> **Headline finding:** Orqafy does NOT use a `UserRole` enum. It uses a **data-driven, per-tenant
> `Role` table** (slug/name/permissions-JSON/isSystem, one set of rows per tenant). This is a
> materially different architecture than the standard/Scenario-42 assumption (a fixed `UserRole`
> enum with `ALTER TYPE … RENAME VALUE`). Therefore the Scenario-42 enum-rename mechanic **does not
> apply**; the alignment is a mix of (a) safe mechanical normalizations we execute now, and (b)
> architecturally-heavy / product-scoped items that carry real blast-radius and are flagged for an
> owner `[WHAT]` call before execution. The point of M2a is to draw that line honestly.

---

## 1. Current state (ground truth from code discovery)

| Area | Current Orqafy implementation | Ref |
|---|---|---|
| Role storage | **Data-driven** `Role` table, per-tenant rows. `slug`, `name`, `permissions` (JSON string array), `isSystem`, `sortOrder`. NO `UserRole` enum. | `packages/db/prisma/schema.prisma:364-384` |
| Seeded role set | 13 roles via `STANDARD_ROLES`: `platform_owner`, `tenant_super_admin`, `admin`, + 10 domain/customer roles. | `packages/db/src/seed/roles.ts:19-37` |
| User↔Role↔Tenant | `User.roleId` FK (single role/user, no join table). `User.tenantId` **NOT NULL**. `User.securityVersion` for token invalidation. | `schema.prisma:297-362` |
| Runtime authz key | Enforcement keys off **role display NAME** (`user.role.name` → `session.user.roles: string[]`), NOT slug. | `apps/web/src/server/auth/config.ts:94` |
| Platform gate | `platformProcedure` requires `ctx.roles.includes("Platform Owner")`. UI gate `powerbyte-admin/layout.tsx` same. Platform Owner is a **tenant-scoped role row**, not a `tenant_id NULL` user. | `trpc.ts:41-49`, `powerbyte-admin/layout.tsx:11-16` |
| tRPC role guard | `requireRole(...names)` factory exists; many routers instead **hardcode inline name allowlists**. | `middleware/rbac.ts`, `department.ts:15` et al. |
| Route middleware | Auth + tenant-slug guarding only; **no role gating** in `middleware.ts`. | `apps/web/src/middleware.ts` |
| Nav filtering | **None** — sidebar/nav is not permission-filtered. | (grep: no matches) |
| Permission matrix | `Role.permissions` JSON is **seeded but never read at runtime** (decorative). No `role_permissions` table, no feature registry, no `hasPermission`/`matrixProcedure`, no role-builder UI, no `role.ts` router. | discovery §7 |
| One-owner constraint | **None.** No partial unique index; nothing stops N users holding `tenant_super_admin` in one tenant. `migrations/` has dir entries but no owner-uniqueness SQL. | discovery §4 |
| Succession | **None.** `tenant-owner.ts` only *provisions* roles+owner at tenant creation; no transfer/reassign. | `packages/db/src/helpers/tenant-owner.ts` |

### Live bugs found during discovery (fix regardless of alignment)
- **B1 — dead role name `"Administrator"`:** 3 routers gate on `"Administrator"`, but the seeded role
  name is `"Admin"`. Those gates never match the intended admin → likely silently over-restrictive.
  Files: `admin-xendit-config.ts:13,16`, `smtp-config.ts:13,15`, `expense-category.ts:9`.
- **B2 — dual naming systems:** model/seed/shared-types key off **slugs**; runtime authz keys off
  **display names**. Any rename must keep both in lockstep or authz breaks silently.

---

## 2. Gap vs the fleet standard (`tenant-rbac-standard.md`)

| Standard requirement | Orqafy today | Gap | Class |
|---|---|---|---|
| **§1** 3 FIXED tiers `tenant_manager` / `tenant_superadmin` / `tenant_admin` | Has `platform_owner` (≈ manager, but tenant-scoped), `tenant_super_admin`, `admin`. Data-driven, not fixed-enum. | Naming + the platform tier is tenant-scoped, not `tenant_id NULL`. | Mixed |
| **§1** `tenant_manager` spans all tenants, `tenant_id = NULL` | `platform_owner` is a role row inside a tenant; `User.tenantId` NOT NULL | **Architectural** — needs nullable tenant on User (+ Role) or a documented equivalent. | 🟥 Heavy |
| **§1** enum renames data-preserving (`ALTER TYPE RENAME VALUE`) | No enum — roles are rows | Mechanic N/A; use a data migration `UPDATE roles SET slug=…` instead. | 🟩 Safe |
| **§1** one-owner-per-tenant partial unique index | Absent | Add index after normalizing ≤1 owner/tenant. Orqafy owner is `User.roleId → tenant_super_admin role`, so index is on `users(tenant_id) WHERE role_id = <superadmin role of that tenant>` — **not directly expressible** as a simple partial index because role is a per-tenant FK, not a global enum value. Needs an app-level guard or a composite approach. | 🟨 Medium |
| **§2** two-way succession (platform reassign + owner transfer) | Absent | Net-new functions + tests, index-safe swap. | 🟨 Medium |
| **§3** sub-role presets (Supervisor/Operator/Contributor/Viewer) | Has 10 domain roles (accountant, hr_manager, …) | Mapping/labelling only; no rename forced. | 🟩 Safe |
| **§4** custom-role permission-matrix (feature registry + `role_permissions` CRUD-split + 3-surface enforcement + role-builder UI) | `permissions` JSON exists but **decorative**; no matrix, no registry, no UI | Large net-new subsystem. Enforcing the existing JSON (let alone a full matrix + builder UI) is a **behavior change** across every gated route. | 🟥 Heavy / partly `[WHAT]` |
| **§4** guardrails (custom ≤ tenant_admin ceiling; never Billing/User-Mgmt; only superadmin edits roles) | N/A (no custom roles yet) | Comes with §4. | ties to §4 |
| **§5** vault-only creds, per-env canonical accounts | Seeds use env-gated dev creds | RESEED to `universal-login-credentials` is **owner-gated HARD HOLD**. | ⛔ Gated |

---

## 3. Sequenced change list

### Wave A — SAFE, mechanical, dev-first LOCAL (execute now, `[HOW]`)
Low blast-radius, no behavior change beyond fixing already-broken gates. These are the true
"alignment" wins that don't risk the tenant-isolation the app spent 30+ batches building.

- **A1 — Fix B1 dead `"Administrator"` gate** → use the real seeded name (`"Admin"`) plus
  `"Tenant Super Admin"` / `"Platform Owner"` as appropriate, matching sibling routers
  (`department.ts`, `compliance.ts`, `dsr.ts`). Add a test asserting an Admin passes those 3 routers.
- **A2 — Slug normalization** `tenant_super_admin` → `tenant_superadmin` (+ keep `admin` → the
  standard's `tenant_admin` shape by ensuring `admin` excludes Billing/User-Mgmt in its permission
  set and gate list). Update **all four** surfaces in lockstep (seed `roles.ts`, `TENANT_SUPER_ADMIN_SLUG`,
  `packages/shared/src/types/auth.ts` `RoleName`, `packages/shared/src/schemas/auth.ts`) + a
  data migration `UPDATE roles SET slug='tenant_superadmin' WHERE slug='tenant_super_admin'`.
  **Note:** runtime authz keys off NAME not slug, so display names (`"Tenant Super Admin"`, `"Admin"`,
  `"Platform Owner"`) are unaffected — the slug rename is DB/seed hygiene, zero authz behavior change.
- **A3 — Consolidate inline gates onto `requireRole`** where trivially equivalent (reduces the
  B1-class drift surface). Only where 1:1 equivalent; no scope change.
- **A4 — Tests** for A1–A3. `pnpm lint` + `typecheck` + `vitest` green before commit.

### Wave B — MEDIUM, data-touching but bounded (execute after Wave A verified, `[HOW]` with care)
- **B1 — One-owner-per-tenant guard.** Because Orqafy's owner is `User.roleId → the tenant's
  tenant_superadmin Role row` (not a global enum), a plain Postgres partial unique index isn't
  directly expressible. Two options (decide at execution): **(i)** application-level transactional
  guard in `provisionTenantRolesAndOwner` + any role-assignment path (assert 0 existing superadmin
  users before promoting); **(ii)** a generated/denormalized `users.is_tenant_owner boolean` +
  `CREATE UNIQUE INDEX … ON users(tenant_id) WHERE is_tenant_owner`. Normalize existing data to
  ≤1 owner/tenant FIRST. Recommend (ii) for DB-enforced integrity parity with the standard.
- **B2 — Two-way succession.** Extend `tenant-owner.ts` (or a new `succession.ts`):
  `transferTenantOwnership(fromUserId, toUserId)` (promote-then-demote in a txn, index-safe) and a
  platform `reassignTenantOwner(tenantId, newOwnerUserId)` guarded by the platform tier. Tests for
  both + the index invariant.

### Wave C — HEAVY / product-scoped — 🔧 IN PROGRESS (executing 2026-07-11)
These change the app's authorization model or add a tenant-facing feature. Scope below reflects the
CONFIRMED, owner-approved rulings — executed under the standing worker plan, not autonomous guesswork.
Full worker plan + PM rulings recorded 2026-07-11; see `docs/DECISIONS_LOG.md`.

- **C1 — KEEP tenant-scoped Platform Owner; document as equivalent (NOT migrating to `tenant_id
  NULL`).** Ruling: the standard's `tenant_manager` (`tenant_id NULL`) requirement is satisfied by
  documented equivalence, not schema migration. Orqafy's `Platform Owner` role row stays
  tenant-scoped, gated via `platformProcedure` + `powerbyte-admin/layout.tsx`. `User.tenantId`
  remains NOT NULL; the L6 tenant-guard Prisma extension and `middleware.ts` tenant-slug routing are
  unchanged. See appendix §"C1 — Platform-tier standard-equivalence" below for the full mapping.
- **C2 — ENFORCE the full permission matrix** (registry + `role_permissions` + `hasPermission` +
  3-surface enforcement — tRPC / route middleware / nav filtering). Ruling: build the real §4
  system now, not defer. Backfill from the existing `Role.permissions` JSON is a day-one no-op
  (current decorative values become the initial matrix rows — no behavior change on migration day;
  the behavior change is the enforcement wiring itself, tested surface-by-surface).
- **C3 — BUILD the role-builder UI now** (tenant_superadmin-only, shadcn Data Table + Checkbox
  matrix). Ruling: in scope for this wave, not deferred to a later Phase-7 product wave.
- **C4 — RESEED dev accounts** to `universal-login-credentials` `local_dev` per-env defaults.
  Scope note: this is the **dev-environment** reseed only — staging/prod/demo account rotation
  remains HARD HOLD per `~/.claude/CLAUDE.md` (never auto-rotate deployed/live app creds).

---

## 4. Recommendation (PM)

Execute **Wave A** now (pure hygiene + a real bug fix, zero authz behavior change, fully reversible).
Then **Wave B** (one-owner integrity + succession) as the substantive standards win that stays
dev-local and doesn't touch the live authz model. **Hold Wave C** for an owner `[WHAT]` call —
C1/C2 could regress the hard-won tenant isolation, and C3 is product scope. This delivers genuine
fleet-standard alignment (naming, integrity, succession) without betting the app's isolation on an
autonomous architectural rewrite.

Back-port target after execution: `docs/PRODUCT.md` (human back-port list) + `docs/DECISIONS_LOG.md`.

---

## C1 — Platform-tier standard-equivalence (documented, no migration)

Per the C1 ruling above, Orqafy does **not** migrate its platform tier to a `tenant_id NULL` user
model. Instead, the existing tenant-scoped `Platform Owner` role row is documented here as the
accepted fleet-standard equivalent of `tenant_manager`.

**Equivalence, not migration:**
- Orqafy's `Platform Owner` role row **is** the accepted `tenant_manager`-equivalent for this app.
  It is gated to `/powerbyte-admin` via `platformProcedure` (in
  `apps/web/src/server/trpc/trpc.ts`) and mirrored in the UI guard at
  `apps/web/src/app/powerbyte-admin/layout.tsx`.
- `User.tenantId` stays **NOT NULL** for every user, including Platform Owners. The L6 tenant-guard
  Prisma extension and `middleware.ts` tenant-slug routing (`/<slug>` subdirectory access) are
  **intentionally unchanged** — no schema or guard rewrite, no blast-radius on tenant isolation.
- This is a documented architectural equivalence, not a gap: the standard's intent (one
  platform-wide, cross-tenant break-glass role) is satisfied by a gated procedure + UI guard rather
  than a `tenant_id NULL` row.

**Display-name → vault-canon mapping** (per RULING Q-C1 = keep current display names, map to vault
canon rather than rename in code):

| Orqafy display name (unchanged) | Fleet vault-canon equivalent |
|---|---|
| `Platform Owner` | `tenant_manager` |
| `Tenant Super Admin` | `tenant_superadmin` |
| `Admin` | `tenant_admin` |

**Slug-audit finding:** runtime authorization keys off the role **display name**, not the slug —
`apps/web/src/server/auth/config.ts` derives `session.user.roles: string[]` from `user.role.name`.
Audit command: `grep -rn "\.slug ===\|role\.slug\|roleSlug" apps/web/src/server` — the only hit
(`tasks.ts:397`, `plan.slug === "free"`) is an unrelated subscription-plan slug check, not a Role
slug. **No slug-keyed RBAC enforcement exists** — slug hygiene/rename work (Wave A A2) therefore
carries zero authorization-behavior impact.
