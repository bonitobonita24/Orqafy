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
- [ ] M2a — Gap analysis: map current `Role` model + slugs + `tenant-owner.ts` vs
      `~/.claude/rules/tenant-rbac-standard.md` (3 fixed tiers, one-owner partial-unique index,
      two-way succession, sub-role presets, custom-role matrix + role-builder UI, guardrails).
      Output `docs/RBAC_ALIGNMENT.md` + a concrete, sequenced change list. Branch `feat/tenant-rbac-3tier`.
- [ ] M2b — Backbone: slug `tenant_super_admin`→`tenant_superadmin`; ensure `tenant_admin`
      (from `admin`) excludes Billing/User-Mgmt; add platform `tenant_manager` (tenant_id NULL);
      data-preserving migration + normalize ≤1 owner/tenant BEFORE the
      `one_tenant_superadmin_per_tenant` partial-unique index. Rename code literals. Tests.
- [ ] M2c — Two-way succession (platform reassign + owner transfer, index-safe) + tests
      (extend `tenant-owner.ts` if partial).
- [ ] M2d — Custom-role permission-matrix: confirm/upgrade feature registry + `role_permissions`
      CRUD-split enforcement (tRPC + route + nav) + role-builder UI (shadcn). Build only what's missing.
- [ ] Back-port to `PRODUCT.md` (list change for human) + `DECISIONS_LOG.md`. Dev Visual QA.

### M3 — AIEF governance/policy full audit + sync-gap
- [ ] Confirm framework at V32.18 (just synced). Scan app vs AIEF governance surfaces:
      Security_Checklist §1–§16 (114 items), WCAG gov gate, RBAC standard, design-defaults,
      versioning, deploy discipline, motion layer, lint-design (D1–D7), privacy.md (RA 10173).
- [ ] Produce `docs/AIEF_AUDIT_TODO.md` (prioritized P0/P1/P2). Apply small safe fixes; log the rest.

### M4 — Wrap
- [ ] Reconcile all owner-gated items into `PENDING_DECISIONS.md`; final STATE + memory save.
- [ ] Loop decision: only owner-gated `[WHAT]` left → reboot + `--hold` pace (never --stop while
      open decisions exist).

## Log
- 2026-07-10 — Plan authored. Running under claude-loop slot-4. Starting M1.
