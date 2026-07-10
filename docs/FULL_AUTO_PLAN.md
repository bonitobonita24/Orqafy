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

### M5 — Headless security hardening (no running stack needed; verify via typecheck + 1063 suite)
- [ ] **S-P2a** tenant-model reconciliation: remove/neutralize the dormant schema-per-tenant machinery
      (`createTenantPrisma`, `tenantGuardExtension` `SET search_path` path — zero runtime callers; root
      cause of the M3 P0) OR guard `schemaName` interpolation; document the single `public`-schema +
      explicit-`tenantId` isolation contract. Clean up any test-only references. Full suite must stay green.
- [ ] **S-P1b** Zod `.strict()` sweep across ~32 routers (spec-executor dispatch; typecheck + suite).
- [ ] **D-P2** lint-design P1a: add letter-spacing tracking to the 2 all-caps sites.

### M6 — Dev-up session (needs LOCAL dev stack — owner word or deliberate rebuild)
- [ ] Bring dev stack up + rebuild off branch; apply migration `20260710160000` (D-RBAC-B-APPLY);
      run `apps/worker` succession integration test.
- [ ] Visual QA (Rule 16): M2 RBAC flows + **D-P1a** Entry-1 max-width container (apply w/ QA across
      89 pages) + **D-P1b** mobile off-canvas sidebar + **S-P1a** login/protected rate-limiting.
- [ ] Then back-port to PRODUCT.md/DECISIONS_LOG; owner-gated staging/prod remains HARD HOLD.

## Log
- 2026-07-10 — Plan authored. Running under claude-loop slot-4. Starting M1.
- 2026-07-10 — M2a DONE: docs/RBAC_ALIGNMENT.md written (Wave A/B/C split). Wave A1 bug fix committed 9fdf95f (green). A2 deferred (cosmetic). Wave C → PENDING_DECISIONS.md. Next: M2b Wave B (one-owner + succession).
- 2026-07-11 — M2b/M2c DONE (Wave B): one-owner-per-tenant integrity (is_tenant_owner + partial unique index, migration 20260710160000 authored/not-applied) + two-way succession (succession.ts + platform/user tRPC wiring + 5 web unit tests + worker integration test). Web 1060/1060 green. M2d + platform-NULL remain owner-gated Wave C. M2 [HOW]-scope complete → next M3 (AIEF audit).
- 2026-07-11 — M3 + M4 DONE (commit 2a0e9ca). 3 parallel audits → docs/AIEF_AUDIT_TODO.md. Applied P0 fix (demo.reset cross-tenant deleteMany wipe → tenant-scoped, +3 tests), P2 cron timingSafeEqual, a11y (aria-labels + prefers-reduced-motion + footer contrast). web 1063/1063 · typecheck · lint · lint-design green. D-PRIV-1 surfaced to PENDING_DECISIONS. Un-gated [HOW] remains (M5 headless hardening / M6 dev-up) → reboot to advance M5, NOT --stop/--hold.
