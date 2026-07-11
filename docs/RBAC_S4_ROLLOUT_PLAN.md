# RBAC §4 Rollout Plan — post-M9 remaining work

> **Status:** planned / NOT started. Written 2026-07-11 as the next-session handoff after M9
> (matrix INFRASTRUCTURE landed + verified green + committed `0f3f811`/`5e20614` on
> `feat/tenant-rbac-3tier`, LOCAL, HARD HOLD). This doc is the actionable continuation.
> **Scope:** un-gated `[HOW]` — dev-first, LOCAL commits only, NO staging/prod/demo push
> without explicit owner word. Reference: `~/.claude/rules/tenant-rbac-standard.md` §4;
> `docs/RBAC_ALIGNMENT.md`; framework `.ai_prompt/rbac.md` + Scenario 42.

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
