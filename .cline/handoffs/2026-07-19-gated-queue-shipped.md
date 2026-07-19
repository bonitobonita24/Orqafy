[FOCUS: Orqafy] Staging tier of the gated queue is SHIPPED + verified. Only owner-gated PROD (M7) and the RBAC-retrofit promotion remain — re-surface them first, execute ONLY on the owner's explicit per-tier word. PROD is IRREVERSIBLE (first-time stand-up) — confirm scope before "go live".

════════════════════════════════════════════════════════════════════════════
ORQAFY — NEXT-SESSION HANDOFF (2026-07-19, end of owner-driven gated-queue ship)
════════════════════════════════════════════════════════════════════════════

## WHERE WE ARE
- `main` @ `d3ad765` — GREEN (CI: governance+audit+typecheck+test+build+lint all ✓) and PUSHED to origin.
- Tag `v0.11.0-rc.1` on `6776198` pushed.
- STAGING LIVE + verified: https://orqafy-staging.powerbyte.app on CI-built `sha-6776198` (app healthy, worker clean, /health+/login 200, Telegram media backend).
- Local-only branch `feat/rbac-slug-standardize` @ `6a9ec94` (RBAC slug rename) — UNPUSHED (HARD HOLD).

## ✅ DONE THIS SESSION (staging tier)
1. FF+pushed `feat/telegram-storage` → `main` (87 commits — Telegram-default media milestone).
2. Fixed a REAL red CI on main (`6776198`): db lint (4) + **latent worker ESM production bug** (`ERR_MODULE_NOT_FOUND` on `await import('@orqafy/shared/rbac')` at worker runtime — real .js shims added). Global lesson logged.
3. Staging deployed on `sha-6776198` via hardened `deploy/staging-refresh-and-deploy.sh` (data-first gate) + verified.
4. Tagged `v0.11.0-rc.1`.
5. Compose reconciliation (`d3ad765`, model **a**): live staging footgun fixed (`demo-latest`→`staging-latest`), repo compose mirrored to live, DECISIONS_LOG deploy-model locked, reconciliation doc RESOLVED.
6. RBAC slug retrofit `tenant_super_admin`→`tenant_superadmin` dev-verified, LOCAL only (`6a9ec94`).

## 🔴 REMAINING GATED QUEUE — execute IN ORDER on owner's explicit word
1. **PROD (M7) — deploy production.** Trigger: explicit "push to production" / "go live" ONLY. IRREVERSIBLE.
   - No `orqafy_prod` stack on the VPS yet (root@72.62.74.203, key ~/.ssh/powerbyte_hostinger) — FIRST-TIME stand-up.
   - Mirror the staging stack build: postgres/valkey/minio + app + worker, NO pgbouncer/pgadmin (model-a layout under /etc/komodo/stacks/orqafy-prod/), STORAGE_BACKEND=telegram, Traefik host orqafy.powerbyte.app, hardcoded router names `orqafy_prod_app`, `traefik.docker.network=proxy`.
   - Prod creds from vault `Server-Setups/secrets/…` staging_prod tier. Deploy image `sha-6776198` (or promote via deploy/compose/push-to-prod.sh).
   - After prod verified green: promote tag `v0.11.0-rc.1` → **`v0.11.0`** (drop -rc per versioning-standard).
   - Once orqafy_prod exists, future `bash deploy/staging-refresh-and-deploy.sh` runs will ENGAGE the prod→staging data refresh automatically (no edits).
2. **RBAC retrofit promotion** (optional, owner-gated). `feat/rbac-slug-standardize`:
   - FIRST rebase it onto current `main` (inherits the ESM fix `6776198`) → the worker succession/tenant-provisioning tests (which couldn't run on the branch due to the now-fixed ESM defect) will run — verify green.
   - Then push→staging (the data-first gate applies migration `20260719120000` renaming the slug). The slug data migration MUST run in every env or auth breaks (code looks up `tenant_superadmin`).
   - Then prod (owner-gated).

## KEY FACTS / POINTERS
- CI is build+push-ONLY by design (staging-refresh-gate). Do NOT flip docker-publish.yml to Komodo auto-update. Staging Komodo auto_update stays OFF.
- Staging gate script needs `dangerouslyDisableSandbox` (backgrounded SSH tunnel). Foreground `gh run watch` works; background watchers get culled early.
- GH Actions secrets present: DOCKERHUB_USERNAME/TOKEN, NEXT_PUBLIC_TURNSTILE_SITE_KEY.
- Deploy model locked = (a): Komodo/gate-script consume hand-placed /etc/komodo/stacks/*; repo compose = reference mirror (docs/DEPLOY_COMPOSE_RECONCILIATION.md, DECISIONS_LOG).

## PACING
Only owner-gated [WHAT] remains (PROD + RBAC promotion). Nothing un-gated to advance. Reboot with --hold to pace and re-surface; do NOT auto-execute any prod deploy/push/promotion.
════════════════════════════════════════════════════════════════════════════
