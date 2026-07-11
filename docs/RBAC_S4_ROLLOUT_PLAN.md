# RBAC §4 Rollout Plan — post-M9 remaining work

> **Status:** planned / NOT started. Written 2026-07-11 as the next-session handoff after M9
> (matrix INFRASTRUCTURE landed + verified green + committed `0f3f811`/`5e20614` on
> `feat/tenant-rbac-3tier`, LOCAL, HARD HOLD). This doc is the actionable continuation.
> **Scope:** un-gated `[HOW]` — dev-first, LOCAL commits only, NO staging/prod/demo push
> without explicit owner word. Reference: `~/.claude/rules/tenant-rbac-standard.md` §4;
> `docs/RBAC_ALIGNMENT.md`; framework `.ai_prompt/rbac.md` + Scenario 42.

## Progress — 2026-07-11 session (Track C)

**Router migration: 20 / 35 done, all LOCAL on `feat/tenant-rbac-3tier`, HARD HOLD.**
Every slice PM-ground-truth verified (typecheck 0 · full web vitest green · eslint
clean · lint-design PASS) before commit.

- Newly migrated this session (15 routers): `expense`, `report`, `employee`,
  `project`, `tasks`, `dtr`, `invoice`, `client`(crm), `support`, `job-order`,
  `pos`, `crm`, `inventory`, `banking`, `payroll`.
- Commits: `49d141c`, `e4e2469`, `0174790`, `8168a0d` (regression fix), `77c82b1`.

**KEY PRINCIPLE ESTABLISHED — the seed is the authoritative endpoint→action map.**
`packages/db/src/seed/role-permissions.ts` was ground-truthed as a behavioral
no-op. Naive name-based CRUD classification DIVERGES from it and ships regressions
that are INVISIBLE to the test suite (all matrix tests run under Platform-Owner
bypass). Anti-regression rule for any migration: an ungated/self-service write
maps to an action whose `internalStaff` grant is `true`; only a genuine
primary-entity hard-delete maps to `delete`, and only on a `delete:true` feature;
inline role gates that the seed reproduces may be REPLACED by the matrix (no-op),
otherwise KEEP them as additional gates. Two regressions were caught+fixed this
session (dtr clockOut/leaveRequestCancel → create; job-order removePart/
removeServiceLine → update) — see `8168a0d`.

### Deferred — needs an owner `[WHAT]`/policy decision (do NOT migrate blindly)

1. **`dsr`** — self-service endpoints are RA 10173 data-subject rights (should not
   be role-gated); admin surface stays `requireRole`. Matrix `dsr:update` (seeded
   false) would lock out Admin (adminUpdateStatus) + all staff (rectify). Reverted
   from the matrix pending a decision on how data-subject rights map to §4.
2. **`accounting`** — router gating is internally inconsistent: some writes are
   ungated-broad `writeProcedure` (chart-of-accounts CRUD, journal creates), others
   are `accountantWriteProcedure`-gated. Seed grants `accounting` write to
   accountant-only. Migrating the broad writes narrows them (regression). Needs a
   ruling: are those ungated writes a pre-existing gap to tighten, or genuinely broad?
3. **`purchasing`** — `approve` is a dead-gate (all role names non-existent → 403 for
   everyone incl. bypass). Matrix can't reproduce 403-for-all. Seed `TODO(D-RBAC-
   DEADGATE-5)`. Reads + vendor/PO create/update are safely migratable; `reactivate`
   → `purchasing:delete` (admin/purchasing_staff override) reproduces its gate exactly.
4. **`storefront`** — `requireAdmin` = {"Administrator"(dead), "Platform Owner"} → only
   PO passes today; matrix `update:false` widens to Tenant Super Admin. Policy call on
   whether TSA-exclusion is a bug to fix or behavior to preserve. Public catalog +
   placeOrder(create) + customer self-service reads are safely migratable.

### Still NOT started (separate features)
- **Track A** — sidebar nav filtering by matrix `view` (needs a `me.permissions` query).
- **Track B** — `tenant_superadmin`-only role-builder UI.
- **Track D** — seed backfill parity: already largely satisfied (seed is exhaustive +
  ground-truthed), but the accounting/purchasing/storefront rulings above may require
  seed edits.

---

## What M9 already delivered (do NOT rebuild)
- `packages/db` `role_permissions` table + migration `20260711000414` (APPLIED to dev),
  `hasPermission(prisma,{tenantId,roleId,feature,action})` resolver, guardrails, seed helper.
- `packages/shared/src/rbac` feature registry (~22 features) + `PermissionMatrix` types +
  actions (view/create/update/delete).
- Enforcement primitives: tRPC `matrixMiddleware`/`matrixProcedure` (`middleware/matrix.ts`),
  route `guardPage` (`server/rbac/guard-page.ts`), `roleId` in auth session/JWT/context.
- `role.ts` router (backend CRUD for custom roles + their matrix rows).
- **First router slice migrated (5/35):** `admin-xendit-config`, `compliance`, `department`,
  `expense-category`, `smtp-config` (writes → `matrixProcedure`/`writeProcedure.use(matrixMiddleware)`).

## Remaining work (3 tracks + 1 guardrail task)

### Track A — Surface 3: sidebar nav filtering by matrix `view` (NOT wired)
Components: `apps/web/src/components/layout/{app-sidebar,sidebar-nav,mobile-nav}.tsx` — currently
render menu items with NO permission check.
- Add a server-resolved permission source the client can read: a `me.permissions` tRPC query (or
  embed a resolved feature→{view,…} map in the session) so the nav can filter without N calls.
  System roles (`Platform Owner`/`Tenant Super Admin`) see everything (bypass); `Admin` + custom
  roles see only features whose `view` is granted in `role_permissions`.
- Filter each nav item by its `FeatureKey`'s `view`. Keep deny-by-default (hide if unknown/false).
- Verify (Rule 16 Visual QA): log in as each role tier; confirm the menu reflects grants.

### Track B — Role-builder UI (NOT built) — `tenant_superadmin`-only
- New screen (e.g. `settings/roles`): list custom roles + a feature×action checkbox matrix
  (features down, view/create/update/delete across). shadcn/ui ONLY (Data Table / Checkbox / Form).
- Reads the feature registry (`@orqafy/shared/rbac`) + current `role_permissions`; save writes via
  the existing `role.ts` router. Gate the page with `guardPage` for `tenant_superadmin`
  (+ `Platform Owner`).
- HARD guardrails (enforce in `role.ts`, not just UI): custom roles are tenant-scoped, strictly
  ≤ the `tenant_admin` ceiling, and may **NEVER** grant Billing (`billing`) or User Management
  (`users`) — those stay exclusive to `tenant_superadmin`/`Platform Owner`. Never trust client role.
- Pair with `accessibility-agents` (WCAG) + `ui-rules.md` + `lint-design.sh --report-only`.

### Track C — Migrate remaining ~30 routers to `matrixProcedure` (5/35 done)
For each matrix-eligible router, key its reads to `matrixProcedure(feature,"view")` where
appropriate and its writes to `matrixProcedure(feature,<create|update|delete>)`
(or `writeProcedure.use(matrixMiddleware(...))` to keep the demo-tenant write guard). Map each
router to its `FeatureKey` (registry: accounting, banking, billing, crm, dashboard, dsr, dtr,
employees, expenses, inventory, invoices, job_orders, payroll, pos, projects, purchasing, reports,
storefront, support, tasks, users, settings). Watch the Task-5.1 nuance already applied in
smtp/compliance: a masked-secret or admin-only READ deliberately stays on the inline `requireRole`
gate when routing it through `matrixProcedure(feature,"view")` would WIDEN access (view is seeded
broad). Decide per router; document the choice.
- Do it in small dev-first slices (a few routers per commit), each: migrate → update that router's
  tests to the matrix model (canonical pattern: `server/trpc/__tests__/matrix-procedure.test.ts` —
  `roleId` in ctx + real `hasPermission` with mocked `role.findFirst`/`rolePermission.findUnique`)
  → `pnpm --filter web typecheck && test && lint` green → commit.

### Track D — Seed backfill parity (guardrail as routers migrate)
As routers migrate, ensure `packages/db/src/seed/role-permissions.ts` grants the **`Admin`** role the
matrix rows that preserve its current (pre-matrix) access for each newly-gated feature — otherwise
migrating a router silently locks Admin out (Admin is NOT a bypass role). Keep bypass limited to
`Platform Owner` + `Tenant Super Admin`.

## Verification gate for every slice (PM ground-truth — never trust self-reports)
`pnpm --filter web typecheck` (0) · `pnpm --filter web test` (full suite green) ·
`pnpm --filter web lint` (clean) · `bash scripts/lint-design.sh --report-only apps/web/src` (PASS) ·
`pnpm --filter @orqafy/db test` + `@orqafy/shared test`. Rule 16 Visual QA for A + B. All LOCAL.

## Known footgun (already logged globally)
tRPC middleware `next({ ctx })` erases base-procedure context narrowing → use
`next({ ctx: { <narrowed fields> } })`. See `~/.claude/LESSONS_GLOBAL.md`
(`trpc.middleware.next-with-ctx-erases-base-procedure-narrowing`).

## Do NOT (out of scope for this rollout)
- Do NOT re-audit IDOR (M8 closed the 33/33 surface).
- Do NOT re-run the P1/P2 hardening queue (exhausted: M5/M6/M7).
- Do NOT push, deploy, re-seed live, or apply migrations to staging/prod — all owner-gated
  (`docs/PENDING_DECISIONS.md`).
