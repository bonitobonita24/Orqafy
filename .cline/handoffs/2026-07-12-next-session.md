# [FOCUS: Orqafy] Next-session handover — 2026-07-12

> Written at owner's request before resting the PC. Read `.cline/STATE.md` (phase-position
> source of truth) + git log FIRST — they override this note if they disagree.

## Where things stand
- Branch **feat/tenant-rbac-3tier**, HEAD **5bb6cb6**, tree clean, **UNPUSHED (HARD HOLD)**.
- **RBAC §4 goal is DONE. The un-gated [HOW] queue is GENUINELY EXHAUSTED.** Nothing left to
  build autonomously without an owner decision.
- Last session (Full Auto) built the final un-gated piece: the **owner-transfer UI**
  (§2 two-way succession) — commits **f89e689** (feat) + **5bb6cb6** (docs). Before that:
  role.delete (0270086), users+payroll hardening (cb0c783).

## ✅ DONE this session
- Owner-transfer UI on `settings/users` (owner-only "Ownership" panel + Transfer dialog +
  data-driven "Owner" badge; `user` router now exposes `isTenantOwner`). PM-verified:
  web typecheck 0 · vitest 1258/1258 · eslint 0 · lint-design PASS · live Rule-16 QA of
  owner + non-owner paths, 0 console errors. Screenshot in `screenshots/` (gitignored).
- Deliberately NOT built: platform break-glass `reassignTenantOwner` console (no platform
  UI area in this app; break-glass stays API/ops-only — not worth speculative scope).

## ▶ What the next session should do
**DO NOT re-audit IDOR (33/33, M8) or re-run P1/P2 (M5/6/7). Do NOT re-build the RBAC §4 goal.**

There is **no un-gated [HOW] work left**. Everything below is **owner-gated [WHAT]** — surface
it and wait for the owner's explicit, per-target word before touching any of it
(full list in `docs/PENDING_DECISIONS.md`):
1. Reseed live / staging / prod (RBAC `role_permissions` matrix).
2. Apply migrations `20260710160000` + `20260711010000` to staging/prod.
3. Framework-sync push · git-tag (next = MINOR **0.11.0**).
4. Deploy — staging / prod / demo (owner must name the tier: "push to staging" etc.).
5. D-PRIV-1 (RA 10173 data-subject rights) · D-NUM-1 — product/scope calls.

If the owner opens the session with one of these ("push to staging", "cut 0.11.0", "reseed dev"),
proceed on THAT target only. Otherwise: re-surface the list and hold — do not infer a deploy.

## Dev / QA quick-facts
- Dev stack UP: app **:42951** (hot-reload) · db :42941 · redis :42943. Tenant URL `/demo/...`.
- Host-side DB queries: `docker exec orqafy_dev_postgres psql -U "$DB_USER" -d "$DB_NAME"`
  (source `.env.dev` for DB_USER/DB_NAME; `.env.dev` uses `${..}` Prisma won't resolve).
- Demo logins: `admin@mail.com`/`admin` (Tenant Super Admin, NOT owner) · `user@mail.com`/`user`
  (Staff) · `webmaster@orqafy.local` (the tenant owner, `is_tenant_owner=t`; pw in CREDENTIALS.md
  — don't read it). To QA owner-only UI: temporarily point webmaster's dev `password_hash` at
  admin's, then RESTORE the saved original after (reversible, dev-only, never read CREDENTIALS.md).
- Anti-regression standing rule: `packages/db/src/seed/role-permissions.ts` is the AUTHORITATIVE
  endpoint→action map. Matrix tests run under Platform-Owner bypass → they do NOT catch mis-gating;
  diff each endpoint→action against the seed + add a non-bypass allow/deny test when migrating.

## Owner status
Owner is resting the PC. No loop kept alive; no scheduled wakeup. Resume on the owner's next prompt.
