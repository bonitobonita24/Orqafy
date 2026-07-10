# Orqafy — Full-Auto Milestone Plan

> PM orchestration doc for the owner-triggered Full-Auto run (2026-07-10). Source of truth for
> the milestone queue across reboots. Each milestone: do work → verify → save session (STATE.md +
> memory + this doc) → write `.sessions/slot-4/next-session` handoff → `close-session` (no --stop)
> → fresh session resumes at the next milestone. HARD HOLD: everything LOCAL only, no push /
> staging / prod / reseed without explicit owner word. `[WHAT]` gates → `PENDING_DECISIONS.md`.

## Scope = the deferred items + the owner's added audit task
1. Versioning + white-label sidebar footer (design-defaults Entry 3, versioning-standard).
2. RBAC 3-tier fleet-standard alignment (Orqafy already has a data-driven `Role` model + a
   `tenant_super_admin` slug + `tenant-owner.ts` — this is an ALIGNMENT, dev-first, LOCAL, NO reseed).
3. Full AIEF governance/policy audit + sync-gap TODO (owner-added).
4. Wrap: reconcile owner-gated items into `PENDING_DECISIONS.md`, final save.

## Owner-gated items DEFERRED (do NOT auto-run — log to PENDING_DECISIONS.md)
- Framework-sync push (2 unpushed governance commits on `main`) — needs "push to staging".
- Git-tag PUSH — local tag is fine; pushing it is a promotion signal.
- RBAC account RESEED to universal-login-credentials — owner-gated HARD HOLD (CLAUDE.md).
- Any staging/prod deploy — HARD HOLD (D-2-deploy, Turnstile LIVE keys, R2).
- Product-scope calls already open: D-1 Customer Portal, D-3 contacts page, D-4 public invoice view.

---

## MILESTONES (check off as completed)

### M1 — Versioning + white-label footer  ✅ DONE (2026-07-10, commit dbd3e0c + tag v0.9.0)
- [x] Reconcile versions to `0.9.0` (root + `apps/web` package.json).
- [x] Expose version to client (`NEXT_PUBLIC_APP_VERSION` in `apps/web/next.config.ts`).
- [x] `app-sidebar.tsx` footer: `v{version}` + whole-label link "Developed by Powerbyte IT Solutions"
      → https://www.powerbyteitsolutions.com/ (target=_blank rel=noopener noreferrer). Entry 3 ✔.
- [x] Cut LOCAL annotated tag `v0.9.0` on dbd3e0c (NOT pushed).
- [x] Verify: pnpm lint PASS, typecheck PASS, web build PASS. Committed dbd3e0c.
- Note: dev-container rebuild SKIPPED during full-auto (throughput); rebuild once at end / on owner word.

### M2 — RBAC 3-tier fleet-standard alignment (dev-first, LOCAL, NO reseed)
- [x] M2a — Gap analysis: map current `Role` model + slugs + `tenant-owner.ts` vs
      `~/.claude/rules/tenant-rbac-standard.md` (3 fixed tiers, one-owner partial-unique index,
      two-way succession, sub-role presets, custom-role matrix + role-builder UI, guardrails).
      Output `docs/RBAC_ALIGNMENT.md` + a concrete, sequenced change list. Branch `feat/tenant-rbac-3tier`.
- [x] M2b — Backbone (Wave B): slug `tenant_super_admin`→`tenant_superadmin`; ensure `tenant_admin`
      (from `admin`) excludes Billing/User-Mgmt; add platform `tenant_manager` (tenant_id NULL);
      data-preserving migration + normalize ≤1 owner/tenant BEFORE the
      `one_tenant_superadmin_per_tenant` partial-unique index. Rename code literals. Tests. DONE
      2026-07-11: one-owner `is_tenant_owner` + partial unique index + migration 20260710160000 (not
      yet applied). Slug rename A2 deferred; platform tenant_manager tenant_id-NULL = Wave C
      (owner-gated).
- [x] M2c — Two-way succession (platform reassign + owner transfer, index-safe) + tests
      (extend `tenant-owner.ts` if partial). DONE 2026-07-11 as part of Wave B
      (transferTenantOwnership + reassignTenantOwner + platform/user wiring + tests).
- [~] M2d — Custom-role permission-matrix: confirm/upgrade feature registry + `role_permissions`
      CRUD-split enforcement (tRPC + route + nav) + role-builder UI (shadcn). Build only what's missing.
      → OWNER-GATED Wave C (D-RBAC-C2/C3 in PENDING_DECISIONS). Not auto-executed.
- [ ] Back-port to `PRODUCT.md` (list change for human) + `DECISIONS_LOG.md`. Dev Visual QA.

### M3 — AIEF governance/policy full audit + sync-gap  ✅ DONE (2026-07-11, commit 2a0e9ca)
- [x] 3 parallel read-only audits (security · design/a11y · governance) vs V32.18 surfaces.
- [x] `docs/AIEF_AUDIT_TODO.md` produced (P0/P1/P2, reconciled vs existing docs).
- [x] Applied small safe fixes: **P0 demo.reset cross-tenant wipe** (+3 tests), P2 cron
      timingSafeEqual, a11y aria-labels + global prefers-reduced-motion + footer contrast.
      web 1063/1063 · typecheck · lint · lint-design all green. Logged the rest (P1/P2).
- Net result: 1 security P0 (fixed) · remaining = P1 rate-limiting + `.strict()` sweep +
  Entry-1 container + mobile sidebar; P2 tenant-model dead-code cleanup + hardening.

### M4 — Wrap  ✅ DONE (2026-07-11)
- [x] Surfaced RA 10173 DPO/NPC/PIA into `PENDING_DECISIONS.md` (D-PRIV-1). All owner-gated items
      reconciled. STATE + memory + handoff saved.
- [x] Loop decision: un-gated `[HOW]` work still remains (M5/M6 below) → reboot (no --stop), next
      session advances M5. NOT --hold (real work queued, not idle-on-decision).

---

## FORWARD QUEUE (un-gated [HOW] — keeps the loop alive; from AIEF_AUDIT_TODO.md)

### M5 — Headless security hardening  ✅ DONE (2026-07-11; commits 4fcd10b · 3dd3fe0 · bb09e3f)
- [x] **S-P2a** tenant-model reconciliation: DELETED dormant schema-per-tenant runtime path
      (`createTenantPrisma` + `tenantGuardExtension` file w/ the `SET search_path` injection landmine —
      zero runtime callers, confirmed by scout) + 2 barrel exports + 1 test mock; added canonical
      single-`public`-schema+explicit-`tenantId` contract doc-comment. DONE 2026-07-11: @orqafy/db +
      web typecheck clean, web suite 1063/1063 green, grep = 0 non-comment refs. REMAINDER→M6: vestigial
      physical `t_<slug>` schema creation still has a live worker caller
      (`apps/worker/.../tenant-provisioning.ts`) → remove in the M6 worker-live session.
- [x] **S-P1b** Zod `.strict()` sweep — DONE 2026-07-11: 9 parallel spec-executor batches, 29 router
      files, ~130 mutation inputs now `.strict()` (base consts strict-ed once → propagate through
      create + `.partial().extend()` update). Kept `.passthrough()` (storefront addressSchema); skipped
      the 3 already-strict (smtp-config/admin-xendit/dsr.rectify) + all query/nested-child inputs.
      Verified: web typecheck clean · eslint clean · suite 1063/1063 green.
- [x] **D-P2** lint-design P1a — DONE 2026-07-11: `account-form.tsx` uppercase currency input +
      `tracking-widest`; `globals.css` `.heading-overline` co-located `letter-spacing`+`uppercase` on one
      line (linter is single-line). lint-design PASS, 0 P1a hits. (Uncommitted — bundle with M5 commits.)

### M6 — Dev-up session (IN PROGRESS — dev stack UP via deliberate rebuild off branch)
- [x] Bring dev stack up + fresh DB (wiped stale postgres volume → removed accumulated QA cruft);
      applied migration `20260710160000` (D-RBAC-B-APPLY) to dev; worker succession test 4/4 green.
- [x] **S-P2a REMAINDER** (commit 5422479): removed physical per-tenant schema machinery. EXPOSED +
      FIXED two latent multi-tenant prod bugs the hack masked: (a) demo seed data written to invisible
      `t_demo` schema → now Prisma-into-public; (b) stale single-column `UNIQUE(code)` on
      warehouses/accounts/tax_rates/expense_categories (the 20260616120000 migration's DROP CONSTRAINT
      was a no-op on Prisma single-col @unique indexes) → new migration
      `20260711010000_drop_stale_single_col_code_uniques` (correct DROP INDEX), applied to dev. Verified:
      fresh seed puts demo data in public, worker 15/15, web 1063/1063, typecheck/eslint/lint-design green.
      Logged 2 global footgun lessons. ⚠ Applying BOTH dev migrations to staging/prod = owner-gated.
- [x] **S-P1a** rate-limiting (M6.3, commit 0e1e45f): authorize() 10/min/IP gate + protectedProcedure
      120/min/user on MUTATIONS only (reads unthrottled by design — sidesteps read-fanout lock-out, so
      no live lock-out test needed; env-guarded off under test). Inlined `rateLimiters` in trpc.ts (no
      circular import). +3 lib tests, web 1066/1066, live /login 200.
- [x] **D-P1a** Entry-1 container (M6.4, commit 89f0fa2) + **D-P1b** mobile off-canvas sidebar (M6.5,
      commit d2e59e6). Live Visual QA 1920/1440/375px — capped centering, /pos/new-sale opt-out,
      off-canvas hamburger nav all confirmed.
- [x] **M6.6** RBAC Visual QA (Rule 16 PASS — Users page renders post-migration, 0 console errors) +
      back-port M5/M6 [HOW] decisions to DECISIONS_LOG + CHANGELOG (commit 7381088); PRODUCT.md
      candidates → PENDING_DECISIONS (human-owned). Owner-gated staging/prod remains HARD HOLD.

### M7 — P2 security + a11y hardening (un-gated [HOW], LOCAL; from AIEF_AUDIT_TODO §S-P2b/§D-P2)
- [ ] **M7.1** Zod bypass tighten: `payroll.ts:594` `config: z.record(z.string(), z.unknown())` → typed;
      grep siblings (z.unknown()/z.any() on mutation inputs).
- [ ] **M7.2** nested-`include` tenant re-check on user-settable FKs (security.md DB-rule-7) — audit +
      harden where a FK is user-editable (e.g. invoice → customer/project). Low risk; verify.
- [ ] **M7.3** storage upload validation audit (packages/storage): MIME whitelist + size cap + magic-byte
      sniff (security.md §6); confirm no user-URL outbound fetch (SSRF §).
- [ ] **M7.4** loading states: install shadcn `skeleton`; replace ad-hoc `animate-spin` in the 11
      loading.tsx on content >300px per ui-rules Rule 11 (no skeleton twins).
- DEFER (owner-gated): Valkey shared rate-limiter store (only matters for multi-instance prod).

## Log
- 2026-07-10 — Plan authored. Running under claude-loop slot-4. Starting M1.
- 2026-07-10 — M2a DONE: docs/RBAC_ALIGNMENT.md written (Wave A/B/C split). Wave A1 bug fix committed 9fdf95f (green). A2 deferred (cosmetic). Wave C → PENDING_DECISIONS.md. Next: M2b Wave B (one-owner + succession).
- 2026-07-11 — M2b/M2c DONE (Wave B): one-owner-per-tenant integrity (is_tenant_owner + partial unique index, migration 20260710160000 authored/not-applied) + two-way succession (succession.ts + platform/user tRPC wiring + 5 web unit tests + worker integration test). Web 1060/1060 green. M2d + platform-NULL remain owner-gated Wave C. M2 [HOW]-scope complete → next M3 (AIEF audit).
- 2026-07-11 — M3 + M4 DONE (commit 2a0e9ca). 3 parallel audits → docs/AIEF_AUDIT_TODO.md. Applied P0 fix (demo.reset cross-tenant deleteMany wipe → tenant-scoped, +3 tests), P2 cron timingSafeEqual, a11y (aria-labels + prefers-reduced-motion + footer contrast). web 1063/1063 · typecheck · lint · lint-design green. D-PRIV-1 surfaced to PENDING_DECISIONS. Un-gated [HOW] remains (M5 headless hardening / M6 dev-up) → reboot to advance M5, NOT --stop/--hold.
- 2026-07-11 — M6 PARTIAL (dev-up). Brought up local dev stack (deliberate rebuild off branch) + fresh DB. M6.1: applied migration 20260710160000 to dev, worker succession 4/4 green. M6.2 (S-P2a remainder, commit 5422479): removed physical per-tenant schema path; this UNCOVERED + FIXED two latent multi-tenant prod bugs the hack masked — (a) demo seed data landing in an invisible t_demo schema (rewrote to Prisma→public), (b) stale single-column UNIQUE(code) indexes on 4 finance/inventory tables (DROP CONSTRAINT no-op bug) → new migration 20260711010000 (DROP INDEX), applied to dev. Verified green end-to-end (worker 15/15, web 1063/1063). 2 global lessons logged. Applying both dev migrations to staging/prod = owner-gated (surfaced in PENDING_DECISIONS as D-MIG-APPLY). Remainder M6.3 (rate-limiting) + M6.4/5/6 (Visual QA) → milestone-barrier reboot (dev stack left UP for fast resume). NOT --stop (un-gated work queued).
- 2026-07-11 — M5 DONE (all headless, LOCAL, verified green each step). D-P2 (4fcd10b): lint-design P1a all-caps tracking. S-P2a (3dd3fe0): deleted dormant schema-per-tenant runtime path incl. the `SET search_path` injection landmine (tenant-guard.ts) + createTenantPrisma + barrel/mocks; documented single-public-schema+tenantId contract; zero-runtime-caller (scout-confirmed). S-P1b (bb09e3f): Zod .strict() sweep on ~130 mutation inputs / 29 routers (9 parallel spec-executors; base-const propagation; kept storefront passthrough). Verify each: web typecheck + eslint + lint-design + suite 1063/1063 green. Remainder→M6: vestigial physical t_<slug> schema creation (live worker caller). Next milestone M6 (dev-up) NEEDS local dev stack + browser Visual QA → milestone-barrier reboot (no --stop) so fresh session runs M6.
- 2026-07-11 — M6 COMPLETE (M6.3–M6.6, all LOCAL, verified live each step; dev stack left UP). M6.3 rate-limiting (0e1e45f): authorize 10/min IP + protectedProcedure mutation 120/min user (reads unthrottled by design → no live lock-out test needed), +3 tests, web 1066/1066, /login 200. M6.4 Entry-1 container (89f0fa2) + M6.5 mobile off-canvas sidebar (d2e59e6): browser Visual QA at 1920/1440/375px confirmed capped-centering, POS-register full-width opt-out, and off-canvas hamburger nav. M6.6 (7381088): RBAC Users-page Visual QA Rule-16 PASS (renders post-migration, 0 console errors; two Super-Admin ROLE holders correct vs single is_tenant_owner FLAG) + back-ported M5/M6 decisions to DECISIONS_LOG/CHANGELOG + PRODUCT.md candidates to PENDING_DECISIONS. Un-gated [HOW] work still queued (M7 P2 hardening from AIEF_AUDIT_TODO §S-P2b/§D-P2) → milestone-barrier reboot (no --stop) so a fresh lean session runs M7. NOT --hold (real un-gated work, not idle-on-decision).
