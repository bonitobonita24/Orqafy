# Project State — Orqafy

> Auto-maintained by Claude Code after each task. Do NOT edit manually.
> Last updated: 2026-08-08 by CLAUDE_CODE (Wave 0 ship: main PUSHED @ e528326 v0.12.2; staging+demo LIVE on orqafy.com; PROD pending owner inputs.)

---

## ⭐ SESSION 2026-08-08 (PM) — Wave 0 SHIP + domain migration to orqafy.com (owner-authorized)

Program: `docs/BUILD_PROGRAM_2026-08-08.md` (5 waves, one-at-a-time, swarm; ship-now-then-build; root+subdomains).

**✅ DONE:**
- **Pushed main → origin** (was 72 ahead, HARD HOLD lifted by owner "push and ship anything"). Releases:
  `v0.12.0` (AdminCN+SEO+mobile) → `v0.12.1` (fix: pin pnpm@10.11.0 in Dockerfiles — unpinned `npm i -g pnpm`
  floated to a breaking latest, failed `--frozen-lockfile` on @pnpm/exe) → `v0.12.2` (security: next-auth β32 +
  @auth/core 0.41.3 [critical Auth.js fail-open], next 15.5.23, toolchain floors; 2 unpatchable mobile-only
  image-size highs scoped-ignored via pnpm.auditConfig — REVISIT). CI green (Docker + audit) on **e528326**.
  Image `bonitobonita24/orqafy{,-worker}:sha-e528326`.
- **STAGING LIVE → https://staging.orqafy.com** (health+login 200; new image + migrations; Telegram storage).
- **DEMO LIVE → https://demo.orqafy.com** (health+login 200; curated data PRESERVED, reseed-never; 4 pending
  migrations applied via tunnel; MinIO storage).
- Cloudflare DNS (zone orqafy.com `6a6df5f…`, token has access): A `staging`/`demo`.orqafy.com → 72.62.74.203
  proxied. Server .env backed up (`.env.bak-2026-08-08`) per stack.
- **⚠ NEW REQUIRED ENV `MOBILE_JWT_SECRET` (z.string().min(48))** — mobile-auth feature added it; older stacks
  lacked it → app failed env-validation (404/unhealthy) until added. Added per-env (`openssl rand -hex 32`).
  **PROD .env must include it.**

**⏳ PROD (0.5) — RESUME HERE after laptop restart (owner paused to reboot 2026-08-08 ~19:35).**
Owner already said "stand up prod now" — irreversible first stand-up. NO orqafy-prod stack exists yet.
DECISIONS LOCKED by owner:
  • Seed = **owner account + empty tenant** (NO demo data).
  • Storage = **reuse staging's Telegram channel for now** (copy TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHANNEL_ID
    from staging .env).
  • First tenant = **slug `powerbyte`, name "Powerbyte IT Solutions"**.
PENDING DECISION (ask on resume, then proceed): prod super_admin identity — RECOMMEND fleet-canonical
  **`webmaster@powerbyteitsolutions.com`** (Server-Setups universal-login staging_prod tier; pw from vault
  `secrets/universal-login-credentials.enc.yaml`). Owner didn't answer (paused to restart).

⚠ SEED BLOCKER (must fix BEFORE prod seed — [HOW], also a good framework fix):
  `packages/db/src/seed/index.ts:229` calls `seedDemoShowcase()` **UNCONDITIONALLY** → would inject FULL demo
  data into prod (contradicts "empty tenant"). Also hardcodes `webmaster@orqafy.local` + tenant slug `demo`.
  FIX: gate `seedDemoShowcase` off when `APP_ENV=production`; parameterize super_admin email + tenant slug/name
  via env (defaults = current dev values, backward-compatible). TEST modified seed against a throwaway DB
  (verify prod path creates tenant+roles+role_perms+plans+super_admin ONLY, zero demo rows) before prod.

PROD STAND-UP STEPS (all [HOW] except the identity confirm above):
  1. Create `/etc/komodo/stacks/orqafy-prod/`; scp repo `deploy/compose/prod/*.yml` (db,cache,storage,app,worker
     — NOT pgadmin/MERGED). Prod app compose uses `${COMPOSE_PROJECT_NAME}_app` router (env-driven — good).
  2. Build prod `.env` from the staging .env template (49 keys — see staging). PROD-specific:
     COMPOSE_PROJECT_NAME=orqafy_prod · APP_DOMAIN=orqafy.com · NEXTAUTH_URL=https://orqafy.com ·
     APP_ENV=production · NODE_ENV=production · APP_IMAGE_TAG=latest · DB_USER/DB_NAME=orqafy_prod ·
     unique ports (staging=5440/6387/9018-19, demo=5439 → prod suggest DB 5441, redis 6388, minio 9020/9021).
     GENERATE fresh (server-side `openssl rand -hex 32`): DB_PASSWORD, REDIS_PASSWORD, AUTH_SECRET,
     APP_ENCRYPTION_KEY, MOBILE_JWT_SECRET (z.string().min(48) — REQUIRED or app 404s), STORAGE_ACCESS/SECRET_KEY.
     COPY from staging: TELEGRAM_BOT_TOKEN, TELEGRAM_DEFAULT_CHANNEL_ID, SMTP_*, TURNSTILE_* (⚠ Turnstile keys
     may be domain-bound to powerbyte.app — verify captcha on orqafy.com, may need a new Turnstile site for the
     domain), DOCKERHUB_USERNAME, IMAGE_NAME, WORKER_IMAGE_NAME, TRAEFIK_NETWORK. WEBMASTER_PASSWORD ← vault.
  3. DNS (Cloudflare zone orqafy.com=`6a6df5f83e8887ead8497a5d53014105`, token=Powerbyte-Hostinger cloudflare.enc):
     A `orqafy.com` + `www` → 72.62.74.203 proxied=true (mirror staging/demo which are DONE).
  4. `docker compose -p orqafy_prod --env-file .env <5 files> up -d postgres valkey minio` (fresh volumes).
  5. Promote image: `docker buildx imagetools create -t …/orqafy:latest -t …:prod-sha-e528326 …:sha-e528326`
     (+ worker). Then `up -d app worker`.
  6. Migrate fresh DB: SSH tunnel local→server prod DB_PORT (use a free local port e.g. 55441; push-to-prod.sh's
     own tunnel step is unreliable — do it manually like the demo migrate that WORKED this session), then
     `DATABASE_URL=<tunnel-url> pnpm --filter @orqafy/db db:migrate:deploy`; confirm "schema is up to date".
  7. SEED (the fixed seed): `APP_ENV=production WEBMASTER_PASSWORD=<vault> SEED_SUPERADMIN_EMAIL=<confirmed>
     SEED_TENANT_SLUG=powerbyte SEED_TENANT_NAME="Powerbyte IT Solutions" DATABASE_URL=<tunnel-url>
     pnpm --filter @orqafy/db db:seed` → creates tenant+roles+plans+super_admin ONLY.
  8. Verify https://orqafy.com/api/health=200, /login=200, login as super_admin; `www`→301.
  9. 0.6 cleanup: old *.powerbyte.app (staging/demo/prod) → 301 redirects; rebuild DEV off e528326 (Rule 39,
     app+worker); store all MOBILE_JWT_SECRET + prod secrets into Server-Setups vault.

DEPLOY MECHANICS PROVEN THIS SESSION (reuse): staging via `deploy/staging-refresh-and-deploy.sh <sha>`;
demo via `deploy/compose/push-to-demo.sh <sha>` (its tunnel-migrate step FAILED — migrate manually via tunnel);
stack is DOWN→bring up infra FIRST (`up -d postgres valkey minio`) then app+worker; add MOBILE_JWT_SECRET to
.env or app 404s; domain swap = sed APP_DOMAIN+NEXTAUTH_URL in .env then `up -d --force-recreate app worker`,
LE cert auto-issues (~40s), verify. CF proxied → browser sees Google-Trust edge cert (normal).

**⏳ 0.6 cleanup (after prod):** old `*.powerbyte.app` (staging/demo) now 404 (Traefik host rule changed) → add
301 redirects. Rebuild dev off e528326 (Rule 39). Store MOBILE_JWT_SECRET values into Server-Setups vault.

---

## ⭐ SESSION 2026-08-08 — resume + verify/ratify AdminCN & SEO, fix SEO middleware bug

**✅ DONE THIS SESSION:**
- **Owner RATIFIED** (post-hoc) the overnight full-auto work already merged to local main (`8cfa127`):
  AdminCN full-site adoption (23 authed modules + platform-admin D) + SEO Foundation (Rule 35). Logged
  in `docs/DECISIONS_LOG.md` (2026-08-08); PENDING_DECISIONS AdminCN + D-SEO items closed.
- **QA verify-all-pages gate run** (Rule 16/32): typecheck 0 · lint clean · prod build exit 0 ·
  **1439 web tests pass** (added 3). Live drive via `next start` + demo-login:
  - SEO: index posture correct per page (public=index, authed/utility=noindex). robots.txt/sitemap.xml/
    privacy now serve 200 with correct content-types.
  - AdminCN: dashboard + CRM/inventory/accounting/settings render the idiom (sidebar shell, PageHeader,
    Card/Table, KPI cards) with real data + `v0.9.0`/Powerbyte white-label footer. **0 console errors**
    (only cosmetic favicon 404). platform-admin correctly access-gated.
- **🐞 REAL BUG found + fixed** (`fix(seo)` `775e6ce`, FF-merged to main): `/robots.txt` + `/sitemap.xml`
  were 307-redirecting crawlers to `/login` — auth middleware allow-list (`isPublic`/`PUBLIC_PATHS`) omitted
  them, silently defeating the whole SEO retrofit. Added `/robots.txt`,`/sitemap.xml`,`/privacy` to
  `apps/web/src/lib/public-paths.ts` + 3 unit tests. Global lesson `nextjs.seo.robots-sitemap-blocked-by-auth-middleware`.

**⏳ OPEN [WHAT] (owner-gated — surfaced, not blocking):**
- **Storefront `/[slug]/store/products` is index:true but auth-gated** (307→login) — deferred D-SEO
  tenant-store nuance AND a "is the public shop actually public?" question. Not fixed unilaterally.
- **D-1 Customer Portal** MVP scope (biggest net-new feature, unbuilt).
- **Storefront restyle** (AdminCN has no shop scaffold) + **E design re-baseline** sign-off (DESIGN.md/MOCKUP, Rule 31).
- **Deploy gate:** 71 commits ahead of origin/main, HARD HOLD. PROD M7 first-time stand-up + RBAC slug
  promotion still gated on explicit owner word. Also standing: 3-tier RBAC retrofit offer; notifications/
  Valkey SSE realtime bug (pre-existing, separate triage).

**NEXT UN-GATED WORK** if resuming: none pressing — verify complete, tree clean. Await owner decision on the
[WHAT] items above. ⚠ Restart Claude Code for V32.45.1 hooks.

---

## ⭐ Gated-queue ship — STAGING TIER COMPLETE, main GREEN+PUSHED (2026-07-19)

**https://orqafy-staging.powerbyte.app** — health 200, login 200, Telegram media backend. Now on the
**CI-built** image (not dev-built) after the first real push→main.

- **`main` @ `d3ad765`** — GREEN (CI all ✓) + PUSHED. Tag `v0.11.0-rc.1` on `6776198` pushed.
  (FF-merged `feat/telegram-storage` 87 commits → main; then CI-fix `6776198`; then reconciliation `d3ad765`.)
- **Fixed a real RED CI on main** (`6776198`): 4 db lint errors + a **latent worker ESM production bug**
  (`ERR_MODULE_NOT_FOUND` on `await import('@orqafy/shared/rbac')` at worker runtime — real .js shim files).
  Global lesson `esm.source-only-shared-pkg.js-reexport-unresolved-at-runtime`.
- **Stack:** `/etc/komodo/stacks/orqafy-staging/` on 72.62.74.203 — postgres 5440 · valkey 6387 ·
  minio 9018/9019 · app (Traefik `orqafy_staging_app`, TLS) · worker. No pgbouncer/pgadmin.
  Image now `bonitobonita24/orqafy{,-worker}:sha-6776198` (deployed via hardened
  `deploy/staging-refresh-and-deploy.sh sha-6776198`, data-first gate; prod-refresh auto-skipped — no prod).
  Live footgun fixed: app+worker compose default `${APP_IMAGE_TAG:-demo-latest}`→`staging-latest`.
- **Storage:** `STORAGE_BACKEND=telegram` (chat_id `-1004449537821`). Creds `webmaster@orqafy.local`
  (slug `demo`), vault `staging_prod` tier. Verify: app healthy, worker logs clean (no ESM crash), /health+/login 200.
- **Compose reconciliation RESOLVED (model a):** repo `deploy/compose/{stage,demo}` mirrored to the live
  hand-placed layout; DECISIONS_LOG locks deploy-model (a) (Komodo/gate-script consume hand-placed stacks;
  repo compose = reference mirror). `docs/DEPLOY_COMPOSE_RECONCILIATION.md` → ✅ RESOLVED.
- **RBAC slug retrofit** `feat/rbac-slug-standardize` @ `6a9ec94` (tenant_super_admin→tenant_superadmin) —
  dev-verified, LOCAL only (unpushed). Rebase on main before promoting (inherits the ESM fix → unblocks worker tests).
- **REMAINING GATED (owner word only):** (1) PROD M7 (`orqafy.powerbyte.app`) — first-time stand-up,
  IRREVERSIBLE, then promote `v0.11.0-rc.1`→`v0.11.0`; (2) RBAC retrofit promotion. See handoff
  `.cline/handoffs/2026-07-19-gated-queue-shipped.md`.

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
