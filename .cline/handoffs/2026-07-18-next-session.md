# [FOCUS: Orqafy] NEXT-SESSION HANDOFF — 2026-07-18 (Full-Auto, paused)

> Comprehensive handoff of ALL pending tasks + decisions. Read `.cline/STATE.md` + `docs/FULL_AUTO_PLAN.md`
> FIRST (they + this file are the resume source of truth). Branch **feat/telegram-storage**, HEAD **1e0f1f4**,
> UNPUSHED (HARD HOLD). Tree clean (only stale `.cline/handoffs/2026-07-12-*.md` untracked — ignore/delete).

## Origin of this run
Owner (2026-07-18) said **"full auto mode, do all tasks one at a time, reboot per milestone"** with this list:
Telegram media go-live (priority) · mobile-first UI/UX plan · full PRODUCT.md coverage review ·
Cloudflare DNS (demo/staging/prod) · CI/CD for the 3 envs · use default creds per env · **full-featured
demo seed** so all features are visible. Deploy targets (demo/staging/prod) are OWNER-AUTHORIZED by that
directive — overrides the standing HARD HOLD for THESE named targets only. Verify green before each ship.

## ✅ DONE THIS SESSION (all committed, local)
1. Resumed the PC-hang-interrupted Telegram-storage session; verified green (web tc 0 · 1265/1265) + wrote
   its governance wrap-up (CHANGELOG/STATE). Secured @orqafy_bot token to vault.
2. **M1** — mobile-UX plan (`docs/MOBILE_UX_PLAN.md`) + PRODUCT.md coverage audit (`docs/PRODUCT_COVERAGE_AUDIT.md`),
   independently verified ≈**93–94%** (17/18 modules built).
3. **M2 (unblock)** — Telegram `chat_id = -1004449537821` resolved, stored in vault, bot write proven.
4. **M3** — Cloudflare DNS: all 3 subdomains already exist (→ 72.62.74.203, proxied). Nothing to create.
5. **D1** — full demo showcase seed `packages/db/src/seed/demo-showcase.ts` (all ~11 empty modules), idempotent,
   live-verified (299 role_permissions rows + all modules).
6. **D2** — images built + pushed: `bonitobonita24/orqafy{,-worker}:dev-latest` + `:dev-sha-923feb6`, after
   fixing TWO real first-build breakages (see Decisions D-BUILD-1/2).

## ⏭ PENDING TASKS (resume in this order — all un-gated / owner-authorized)
- **D3** (next) — FIRST-TIME create `/etc/komodo/stacks/orqafy-demo` on VPS (root@72.62.74.203, key
  ~/.ssh/powerbyte_hostinger). `push-to-demo.sh` is UPDATE-only — do NOT use it for the first deploy.
  Steps: copy repo `deploy/compose/demo/*.yml` + `pgadmin-servers.json` into the stack dir; write `.env.demo`
  (generate fresh DB/redis/pgbouncer/MinIO/AUTH_SECRET/APP_ENCRYPTION_KEY/pgAdmin secrets; demo super_admin
  from vault `demo.tenant_superadmin` = admin@demo.com; DEMO_TENANT_SLUG=demo; STORAGE_BACKEND=s3 (MinIO);
  APP_DOMAIN=orqafy-demo.powerbyte.app; TRAEFIK_NETWORK=proxy; COMPOSE_PROJECT_NAME=orqafy_demo;
  APP_IMAGE_TAG=dev-sha-923feb6 OR promote dev-latest→demo-latest via `docker buildx imagetools create`).
  **Free VPS ports (verified 2026-07-18):** DB **5439** · pgbouncer **6439** · redis **6386** · MinIO **9016/9017**
  · pgAdmin **5451** · app = Traefik-routed (no host port; `proxy` net exists).
- **D4** — up db/cache/storage → `prisma migrate deploy` (worker image, orqafy_demo_network) → seed
  (first-time seed OK; runbook has the exact docker run cmds) → up app+worker.
- **D5** — verify `https://orqafy-demo.powerbyte.app/api/health` = 200 + login admin@demo.com; browser Visual QA.
- **M4** — Komodo stacks + Traefik for **staging + prod** (demo proves the pattern). Gate CI staging
  auto-deploy per `~/.claude/rules/staging-refresh-gate.md`.
- **M5** — seed each env's accounts from `Server-Setups/secrets/universal-login-credentials.enc.yaml`
  (staging_prod tier → staging+prod; demo tier → demo). Reference vault only.
- **M7** — deploy staging → prod. Wire `STORAGE_BACKEND=telegram` + `TELEGRAM_BOT_TOKEN` +
  `TELEGRAM_DEFAULT_CHANNEL_ID` (=-1004449537821) into staging/prod `.env` from the vault (demo stays MinIO).
- **Staging data-first gate (when staging is stood up):** the app has `deploy/staging-refresh-and-deploy.sh`
  (Jul-17). `~/.claude/rules/staging-refresh-gate.md` was updated 2026-07-18 with **robustness invariants 1–3**
  (ephemeral tunnel port, verify-tunnel-up, schema-status HARD GATE). **Regenerate/patch the Orqafy script to
  inherit them** before trusting a staging→prod promotion. Lesson: `deploy.staging-gate.tunnel-port-collision-swallows-migrate-failure`.

## 🔷 DECISIONS
### Made this session ([HOW] — mine, recorded)
- **D-SEQ** Demo-first sequencing: demo (MinIO, unblocked) before staging/prod (Telegram-pinned).
- **D-DEVCH** Dev Telegram channel: **dev stays MinIO** by default (architect note; "Orqafy - Assets" is the
  shared staging/prod channel). ← owner may override (see below).
- **D-BUILD-1** shared ESM/Node16 vs webpack `.js`-extension conflict → **Approach B (config-only)**: keep
  source-only packages, add `.js` to shared barrels + `next.config` `transpilePackages` + webpack
  `extensionAlias`. (Commit 24a618c.) Chosen over giving shared a dist build (repo pattern is source-only).
- **D-BUILD-2** worker Dockerfile deps layer missing `@orqafy/shared` → added the COPY (commit 923feb6).

### PENDING owner [WHAT] (surface at resume; do NOT auto-decide)
- **D-DEVCH-CONFIRM** — keep dev on MinIO, or provision a dedicated dev Telegram channel? (default = MinIO.)
- **D-RBAC-SPEC** — PRODUCT.md §756 (Roles & Permissions) is STALE; code is ahead (data-driven matrix +
  role-builder + is_tenant_owner). Re-spec §756 to match shipped code. (PRODUCT.md is human-owned — owner edits.)
- **D-PORTAL** — Customer Portal §703 (~35%, the only genuinely-unbuilt feature): BUILD it, or mark descoped
  in PRODUCT.md?
- **D-TAG** — versioning: after v0.10.0 tag, a demo/staging/prod ship likely warrants the next tag (MINOR
  **0.11.0**?). Owner-declared. Not cut yet.
- **D-PRIV-1** (RA 10173 data-subject rights) · **D-NUM-1** — carried from prior `docs/PENDING_DECISIONS.md`.
- **Push to GitHub / staging / prod** — still owner's explicit word per tier (the Full-Auto directive
  authorized the demo/staging/prod *deploy targets*, but confirm before the first push-to-main if unsure).

## Environment quick-facts
- Local dev DB UP :42941 (seeded) — harmless; `docker compose -f deploy/compose/dev/*.yml down` to stop.
- VPS root@72.62.74.203 key ~/.ssh/powerbyte_hostinger; Komodo kmd.powerbyte.app; Traefik `proxy` net.
- Vault (SOPS+age): orqafy-telegram.enc.yaml (token+chat_id), universal-login-credentials.enc.yaml,
  deploy-api.enc.yaml (dockerhub bonitobonita24 + CF token), cloudflare.enc.yaml, orqafy-turnstile.enc.yaml.
- Deploy runbook: `Server-Setups/Powerbyte-Hostinger/runbooks/deploy-orqafy.md` (migrate/seed exact cmds).
- Nothing running (no loop/monitor). Resume: **"resume full auto"** / "continue the demo deploy".
