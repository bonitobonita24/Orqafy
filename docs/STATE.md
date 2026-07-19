# Project State — Orqafy

> Auto-maintained by Claude Code after each task. Do NOT edit manually.
> Last updated: 2026-07-19 by CLAUDE_CODE (Full-Auto — un-gated local [HOW] cleanup: staging-gate invariants 1-3 + CSP CF-beacon + compose-reconcile plan; commits 7ffbe9c, dc90d7f LOCAL/unpushed. Un-gated queue EXHAUSTED — only owner-gated [WHAT] remains.)

---

## ⭐ Full-Auto M4 — STAGING LIVE (2026-07-19)

**https://orqafy-staging.powerbyte.app** — health 200, login renders, Telegram media E2E proven.
Branch `feat/telegram-storage`, HEAD `e8fbb72` (unpushed, HARD HOLD). Manual Komodo-stack deploy
(mirrors demo pattern) — NOT pushed to GitHub main (that stays separately owner-gated).

- **Stack:** `/etc/komodo/stacks/orqafy-staging/` on 72.62.74.203 — postgres 5440 · valkey 6387 ·
  minio 9018/9019 · app (Traefik `orqafy_staging_app`, TLS) · worker. Network `orqafy_staging_network`.
  Image `bonitobonita24/orqafy{,-worker}:dev-sha-e8fbb72` (freshly built from HEAD incl. accounting
  migration `20260719000000`). No pgbouncer/pgadmin (mirrors demo).
- **Storage:** `STORAGE_BACKEND=telegram` (chat_id `-1004449537821`, "Orqafy - Assets"). Verified:
  app container reaches Telegram (`getMe` ok) + real `sendDocument` E2E ok (has_document, 47B).
  MinIO retained as fallback (seed attachments pushed there).
- **Creds:** `webmaster@orqafy.local` (workspace slug `demo`), password = vault `staging_prod`
  tenant_superadmin (`universal-login-credentials.enc.yaml`). Weak dev accounts NOT seeded (APP_ENV=staging).
  Full `.env` on server; secrets scratchpad `orqafy-staging-CREDENTIALS.txt`.
- **Verify:** migrate deploy = all applied; seed = all modules populated; ext health 200; /login renders;
  only benign console errors (CSP-blocked CF Insights beacon + favicon 404).
- **DIVERGENCE (record):** repo `deploy/compose/stage/*.yml` diverge from the deployed layout (same as
  demo — deployed stack copied the working demo compose + env_file `.env` + INTERNAL_* overrides +
  `orqafy_staging_app` Traefik names + `STORAGE_BACKEND: telegram` in app/worker `environment:`).
  Reconcile repo stage compose + `push.sh staging` to deployed layout = follow-up.
- **NEXT (owner-gated):** M7 prod (`orqafy.powerbyte.app`) — NOT authorized by the staging directive;
  needs explicit owner word (deploy-discipline: prod never automatic). Before prod promotion: patch
  `deploy/staging-refresh-and-deploy.sh` with robustness invariants 1–3; cut tag 0.11.0 (owner-declared).

---

## Current Verification (Rule 32 Verifiable-Done evidence)

Latest done-claim: RBAC §4 owner-transfer UI (two-way succession §2) on
`feat/tenant-rbac-3tier` (LOCAL, HARD HOLD, unpushed). Commit f89e689.
This closed the last un-gated [HOW] gap for the RBAC §4 goal.

evidence:
  contract: "web typecheck 0 errors; full web vitest suite green; eslint clean; design anti-slop lint PASS; live Rule-16 QA of owner + non-owner paths with 0 console errors"
  check_command: "pnpm --filter @orqafy/web typecheck && pnpm --filter @orqafy/web test && pnpm --filter @orqafy/web lint && bash scripts/lint-design.sh --report-only apps/web/src"
  captured_output: |
    > @orqafy/web@0.9.0 typecheck
    > tsc --noEmit
    (0 errors)

    Test Files  84 passed (84)
    Tests       1258 passed (1258)

    ✔ No ESLint warnings or errors

    DESIGN ANTI-SLOP SUMMARY  |  files scanned: 256
      Result : PASS  (no AI-slop tells found)

    Live Rule-16 QA (dev :42951, demo tenant):
      - owner (webmaster, is_tenant_owner): sees "Ownership" panel + "Owner"
        badge; dialog lists exactly the 2 eligible members (admin, user),
        confirm gated on selection.
      - non-owner (admin@mail.com, Tenant Super Admin): no panel; Owner badge
        still shown on webmaster row (data-driven). 0 console errors.

---

## Current Phase

**Phase 8 — Iterative Buildout (ongoing)**

All Epics 1–5 complete (confirmed via scout 2026-06-21). V32.9 Compliance & Data Privacy layer merged to main (commit 700e972). Values ratified by owner 2026-06-21 (commit 0e4624b).

---

## HEAD

Branch: `main`
Commit: `0e4624b` — docs(v329): ratify compliance product values (retention 7/5/3, DSR 15d, WCAG 2.2 AA)

---

## Framework Sync

Framework version: **V32.9** (synced 2026-06-20, commit f839050).
All 22 `.ai_prompt/` deliverables match AIEF `specdrivenprompt/` HEAD (diff-clean).
`CLAUDE.md` (app root) = `CLAUDE_v31_compact.md` HEAD. `deploy-v31.sh` present + current.
`.claude/agents/spec-executor.md` = framework HEAD. `.claude/settings.json` has Stop-hook + skill caps.
`scripts/lint-deploy.sh` + `scripts/design-stop-hook.sh` = framework HEAD.

---

## Security Posture

| Layer | Status | Evidence |
|-------|--------|----------|
| L1–L2 HTTPS / Auth.js v5 | ✅ Active | Auth.js v5 session; `securityVersion` in context |
| L3 RBAC | ✅ Active | `middleware/rbac.ts` → `requireRole()`; used in compliance, platform, breach, DSR routers |
| L4 Rate-limit | ✅ Active | `middleware/rate-limit.ts` present |
| L5 AuditLog | ✅ Active | `AuditLog` Prisma model (public schema); used in accounting, compliance, payroll, tasks, crm, project, client, inventory, invoice routers |
| L6 Prisma tenant guardrails | ✅ Active | `tenantId` in tRPC context (`ctx.tenantId`); 20+ routers scope by `tenantId`; tenant-parity tests cover project, client, purchasing, department, tasks, DTR |
| WCAG 2.2 AA gate | ✅ Partial | Quick-wins applied (V32.9 pass); remaining issues documented in `docs/V329_WCAG_REMAINING.md` — pre-existing neutral-dark-theme items (contrast ~5.2:1 AA-passing), sidebar nav landmark, focus trap (Radix handles). No blocking regressions. Gov/LGU gate met at AA level per current theme. |

### Known Tech-Debt: tenant_id migration drift

Multiple `tenant_id` columns were added incrementally via parity migrations (2026-05-31 through 2026-06-19). The guardrails are present in code (routers scope by `ctx.tenantId`) and migrations exist (`20260619000000_add_tenant_id_to_missing_tables`). Deploy-time risk: migration order must be respected on prod apply. **Not a code gap — a deploy sequencing note.** Owner-gated: verify migration history on prod before first deploy.

---

## V32.9 Compliance Layer Status

| Item | Status |
|------|--------|
| `DataSubjectRequest` Prisma model + migration | ✅ `20260620000000_add_compliance_privacy` |
| `BreachRecord` Prisma model + migration | ✅ Same migration |
| `dsrRouter` (dsr.inform/access/rectify/port/requestErasure/object + admin sub-router) | ✅ `apps/web/src/server/trpc/routers/dsr.ts` |
| `compliance.breach.*` router (admin-only, requireRole) | ✅ `apps/web/src/server/trpc/routers/compliance.ts` |
| Privacy notice page (`/privacy`) | ✅ `apps/web/src/app/privacy/page.tsx` |
| Tenant privacy page (`/[slug]/privacy`) | ✅ `apps/web/src/app/(tenant)/[slug]/(app)/privacy/` |
| Breach management UI (`/[slug]/settings/breach`) | ✅ `apps/web/src/app/(tenant)/[slug]/(app)/settings/breach/` |
| `.ai_prompt/privacy.md` cue | ✅ Present + matches framework HEAD |
| Owner-ratified values (retention 7/5/3, DSR 15d, lawful bases, erasure = review) | ✅ DECISIONS_LOG.md 2026-06-21 |

**Owner-gated (not buildable without owner decision):**
- DPO appointment: placeholder `bonitobonita24@gmail.com` in `dsr.inform`. Needs real DPO name/email.
- NPC registration / formal PIA artifact: pending owner confirm at Orqafy's processing scale.

---

## Governance Docs

| Doc | Status |
|-----|--------|
| `docs/PRODUCT.md` | ✅ Present |
| `docs/DECISIONS_LOG.md` | ✅ Current (last entry 2026-06-21, V32.9 ratification) |
| `docs/IMPLEMENTATION_MAP.md` | ✅ Current (Phase 8 Batch 4 complete) |
| `docs/CHANGELOG_AI.md` | ✅ Current (last entry W13 closeout) |
| `.ai_prompt/LESSONS_REGISTRY.md` | ✅ Present + matches framework HEAD |
| `docs/STATE.md` (this file) | ✅ Restored 2026-06-21 (was 0 bytes) |

---

## Test Baseline

```
Test Files  57 passed (57)
Tests       1029 passed (1029)
Duration    ~2.6s
Date        2026-06-21
```

Previous baseline: 845 tests (Phase 7 Epics 1–2), 1029 after V32.9 compliance tests added.

---

## Staging / Prod Deploy State

- **Demo**: LIVE — https://orqafy-demo.powerbyte.app (MinIO storage). Stack `orqafy-demo`.
- **Staging**: ✅ LIVE 2026-07-19 — https://orqafy-staging.powerbyte.app (Telegram storage). Stack
  `orqafy-staging`, image `dev-sha-e8fbb72`. First-ever staging stand-up (greenfield). See "Full-Auto M4"
  block at top for full detail + verification evidence.
- **Prod**: Never deployed (OWNER-GATED — the staging directive did NOT authorize prod). Target
  `orqafy.powerbyte.app`, Telegram storage. Needs explicit owner word + tag 0.11.0 + staging-refresh
  invariants patch. Staging-refresh data-first gate is moot for first prod stand-up (nothing to refresh from).

---

## Phase 8 Remaining (owner-gated)

- DPO appointment email in DSR privacy notice.
- NPC registration / PIA decision.
- WCAG remaining: sidebar nav aria-label + light-theme contrast recheck (if/when light theme added).
- Staging re-deploy with V32.9 migrations (owner-gated on Komodo).
- Browser-interactive Visual QA (gated on `/opt/google/chrome/chrome` install).
