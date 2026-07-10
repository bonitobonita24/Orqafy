# Orqafy — AIEF Governance/Policy Audit (M3)

> Full-Auto M3 audit, 2026-07-11. Three parallel read-only audits (security · design/a11y ·
> governance/process) against AIEF V32.18 surfaces: `Security_Checklist.md` §1–16 (114 items),
> `security.md`, `~/.claude/rules/{design-defaults,tenant-rbac-standard,versioning-standard,
> deploy-discipline}.md`, `.ai_prompt/{design-principles,motion,privacy}.md`, `ui-rules.md`,
> `scripts/lint-design.sh`. Branch `feat/tenant-rbac-3tier`. **HARD HOLD — all fixes LOCAL only.**
> Reconciled against existing docs (`V329_WCAG_REMAINING`, `DESIGN_DRIFT`, `V329_COMPLIANCE_PLAN`,
> `UI_BACKEND_GAPS`, `PENDING_DECISIONS`, `DECISIONS_LOG`) — net-new items only below.

## Headline
Strong posture overall. **0 governance P0, 0 design P0, 1 security P0 (FIXED this session).**
Deploy invariants intact, versioning consistent, V32.18 sync complete, privacy surface substantive,
shadcn-only + white-label + no-skeleton-twins all conformant. Remaining = a11y wiring, layout-container
discipline, rate-limit coverage, and a tenant-model cleanup.

---

## ✅ FIXED this session (commit 2a0e9ca)
- **[P0 SECURITY] `demo.reset` cross-tenant wipe** — `deleteMany({})` ran unscoped on the shared
  `public` schema, trusting an inactive schema-per-tenant `search_path`. Now scopes all 10 deletes by
  `ctx.tenantId` + null-guard. +3 regression tests (`demo-reset-tenant-scope.test.ts`).
- **[P2 SECURITY] cron secret timing side-channel** — `schedule-digests` now uses `timingSafeEqual`.
- **[P1/P2 a11y] WCAG 4.1.2 / 2.3.3** — aria-labels on attachment download/delete + file-upload remove
  buttons; `aria-label="Sidebar"` on nav; global `prefers-reduced-motion` block; footer contrast
  (dropped `/50` opacity on version + white-label link).
- Verified: web 1063/1063 · typecheck clean · lint clean · lint-design clean.
- **False positive corrected:** `notification-bell.tsx` already had an aria-label (audit line-drift) — not touched.

---

## 🔶 REMAINING — P1 (next dev-up session or focused dispatch)

### S-P1a — Login + authenticated tRPC rate limiting (SECURITY §9)
`server/auth/config.ts` `authorize()` has no throttle (credential-stuffing/brute-force);
`withApiRateLimit`/`withAuthRateLimit` middleware exists (`server/trpc/middleware/rate-limit.ts`) but is
**never composed** into `protectedProcedure`/`writeProcedure` — only a few public procedures inline it.
**Fix:** gate `authorize()`/`/login` behind `rateLimiters.auth`; chain `withApiRateLimit` into
`protectedProcedure`. *Needs integration testing against a running stack (lock-out risk) — defer to dev-up.*

### S-P1b — Zod `.strict()` sweep (SECURITY §4)
Only 3 of ~35 routers use `.strict()` on input objects; unknown fields accepted elsewhere. Mass-assignment
impact is limited by Prisma's explicit field mapping, but this is a standing §4 gap. **Fix:** add `.strict()`
to mutation input objects (batch, mechanical). Candidate for a single spec-executor sweep + typecheck.

### D-P1a — Entry-1 readable-content container (DESIGN design-defaults Entry 1)
`(tenant)/[slug]/(app)/layout.tsx` `<main class="flex-1 overflow-y-auto p-6">`; 0 of 89 app pages add a
max-width cap or the responsive gutter — dense tables/dashboards full-bleed on wide monitors.
**Fix:** wrap `{children}` in `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` (with per-page opt-out for
intentionally-immersive surfaces). *Visual-regression risk across 89 pages → apply with dev Visual QA, not blind.*

### D-P1b — Mobile off-canvas sidebar (DESIGN design-defaults Entry 2)
`app-sidebar.tsx` is a hand-rolled fixed-224px `<aside>` with no `SidebarTrigger`/off-canvas/`hidden md:flex`;
on a 360px phone it permanently eats 224px. Gov/LGU app → mobile matters. **Fix:** adopt shadcn `Sidebar`
(`SidebarProvider`+`Sidebar collapsible`+`SidebarTrigger`+`SidebarInset`) or a `Sheet`-based off-canvas.
*Sizeable refactor → own focused task w/ Visual QA.*

---

## 🔷 REMAINING — P2 (hardening / housekeeping)

### S-P2a — Tenant-model reconciliation (SECURITY — root cause of the P0)
The codebase ships **two contradictory isolation models**: dormant schema-per-tenant machinery
(`createTenantPrisma`, `tenantGuardExtension`, `t_<slug>` schemas — **zero runtime callers**, confirmed by
the comment in `packages/db/src/helpers/tenant-financials.ts`) and the actual runtime model (single `public`
schema + explicit `tenantId` filters). One router already trusted the wrong one (the P0). **Fix:** delete the
dead schema-per-tenant path (or activate it deliberately) so there is ONE documented isolation contract;
`tenantGuardExtension` also interpolates `SET search_path TO "${schemaName}"` with **no regex guard** (latent
injection landmine, currently unreachable). High-value cleanup; prevents the next P0 of this class.

### S-P2b — misc security hardening
- Nested Prisma `include` (e.g. `invoice.loadInvoiceForTenant` → `customer`/`project`) not re-checked for
  tenant on user-settable FKs (security.md DB-rule-7; low risk given within-tenant FK integrity).
- `payroll.ts:594` `config: z.record(z.string(), z.unknown())` bypasses validation for that field.
- In-memory LRU rate limiter is per-instance — needs a shared Valkey store for multi-instance prod.
- **Not deeply audited this pass** (focused follow-up): `storage.ts` upload MIME/size/magic-byte validation
  (§6) and SSRF on outbound fetch (§SSRF) — no user-URL outbound fetch surfaced in scans, but confirm.

### D-P2 — design/a11y housekeeping
- Loading states: 11 `loading.tsx` use ad-hoc `animate-spin` divs; no shadcn `Skeleton` installed. Install
  `skeleton` and use it on content areas >300px (ui-rules Rule 11 dual-path). *(no hard-rule violation — no twins.)*
- `lint-design.sh` P1a: all-caps without tracking at `settings/account/account-form.tsx:105` +
  `globals.css:116` — add `letter-spacing: 0.06–0.1em` (design-principles Pillar 4).
- Sidebar footer contrast at 10px — spot-check measured ratio post-fix; drop size floor if still <4.5:1.

### G-P2 — governance housekeeping
- **DPO/NPC/PIA (RA 10173)** owner-pending items live only in `DECISIONS_LOG.md` prose → surface into
  `PENDING_DECISIONS.md` (`D-PRIV-1`) so they resurface each loop before prod. *(actioned in M4 wrap.)*
- **Staging data-first gate** not yet generated (`deploy/staging-refresh-and-deploy.sh` absent) — owner-gated,
  generate via `staging-refresh-setup --repo Orqafy` when staging is activated.
- **Next release = MINOR bump to `0.10.0`** — RBAC Wave B (additive feature set) landed after tag `v0.9.0`;
  cut `0.10.0` at the next release moment (owner-gated per versioning-standard + promotion gate).

---

## Already tracked / owner-gated (NOT re-opened — see `PENDING_DECISIONS.md`)
RBAC Wave C (D-RBAC-C1 platform `tenant_id NULL` · C2 permission-matrix enforcement · C3 role-builder UI ·
C4 account reseed) · D-RBAC-B-APPLY (migration `20260710160000` authored-not-applied) · A2 slug rename
deferred · framework-sync push · git-tag push · staging+prod deploy HARD HOLD · D-1/D-3/D-4 product scope ·
DESIGN_DRIFT reskin (intentional) · V329_WCAG_REMAINING landing/login items. Orqafy's data-driven `Role`
table correctly diverges from the enum-based Scenario-42 mechanic (logged & locked in DECISIONS_LOG).

## Audit tallies (net-new, pre-fix)
Security 1×P0 · 3×P1 · ~6×P2 · Design 0×P0 · 4×P1 · 3×P2 · Governance 0×P0 · 0×P1 · 3×P2.
P0 fixed this session; P1/P2 above.
