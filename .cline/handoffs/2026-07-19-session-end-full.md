[FOCUS: Orqafy] Long session — save + reboot. Everything below is DEV-FIRST / HARD HOLD on LOCAL `main` (26 commits ahead of origin, UNPUSHED). Nothing is deployed beyond the already-live staging from earlier. Open by re-surfacing the GATED QUEUE + OPEN ITEMS; execute only on the owner's explicit per-tier word.

════════════════════════════════════════════════════════════════════════════
ORQAFY — FULL SESSION HANDOFF (2026-07-19, end of a very long session)
════════════════════════════════════════════════════════════════════════════

## WHERE WE ARE
- `main` @ `bcb69a4`, clean tree, **26 commits ahead of origin/main (UNPUSHED — HARD HOLD)**.
- Tag `v0.11.0-rc.1` (staging RC) exists + pushed. Staging is LIVE from earlier: https://orqafy-staging.powerbyte.app on CI image `sha-6776198`.
- Web suite green: **1418 tests**; typecheck + lint clean across web/db/mobile.
- Separate UNMERGED local branch: `feat/rbac-slug-standardize` @ `6a9ec94` (RBAC slug retrofit, dev-verified, unpushed).
- Older stale branches (cicd-envs, d7-notifications, dept-rbac-and-fiscal-year) = prior sessions, ignore.

## ✅ DONE THIS SESSION (3 bodies of work, all on local main)
1. **Gated-queue ship (staging tier):** FF+pushed the 87-commit telegram-storage branch → `main` → origin; fixed a real RED CI (db lint + a latent worker ESM production bug — `ERR_MODULE_NOT_FOUND` on `await import('@orqafy/shared/rbac')`, fixed with real `.js` shims, commit 6776198); staging deployed + verified on CI image `sha-6776198` via the hardened data-first gate; tagged `v0.11.0-rc.1`; compose reconciliation (model-a mirror + live footgun fix demo-latest→staging-latest + DECISIONS_LOG deploy-model lock). Detail: memory `full_auto_gated_queue_ship_2026-07-19`.
2. **2-feature program (compression + mobile):** (A) client image compression + `FileUpload` Telegram-cutover (was silently MinIO!) + thumbnails — COMPLETE. (B) made the existing `apps/mobile` Expo app real: JWT auth backend + tRPC bearer + client wiring + biometric + shadcn token resync + Expo push (client+backend) + web soft-interstitial + camera receipt compression + EAS prep (v0.1.0). Detail: memory `feature_program_compression_mobile_2026-07-19`.
3. **Mobile sync endpoint (owner said "tackle it"):** full-stack PUSH-sync. Server: `POST /api/sync/{entityType}` (dtr/tasks/expenses, idempotent `MobileSyncOp` ledger, web-parity RBAC) + `GET /api/sync/expense-categories` + `POST /api/sync/expenses/[id]/receipt`. Mobile client: real payloads, serverId write-back, category picker, receipt sequencing. **Caught+fixed 2 serious pre-existing runtime bugs: WatermelonDB nested-writer deadlock (mobile sync was broken at runtime) + task status-flow impossible transition.** Detail: memory `feature_program_compression_mobile_2026-07-19` (updated).

## 🔴 GATED QUEUE — owner-gated [WHAT], execute IN ORDER on explicit word
1. **"push to staging"** — push local `main` (26 commits) → origin → CI (docker-publish + ci.yml) → then run `bash deploy/staging-refresh-and-deploy.sh sha-<newmerge>` (data-first gate, needs `dangerouslyDisableSandbox` for the SSH tunnel; VPS root@72.62.74.203, key ~/.ssh/powerbyte_hostinger). Watch Actions (foreground `gh run watch`; background watchers get culled). This ships compression+mobile+sync to staging.
2. **M7 PRODUCTION** — explicit "push to production"/"go live" ONLY, IRREVERSIBLE. No `orqafy_prod` stack on VPS yet (first-time stand-up; mirror the staging stack — postgres/valkey/minio + app + worker, NO pgbouncer/pgadmin, STORAGE_BACKEND=telegram, Traefik `orqafy_prod_app`, prod creds vault `staging_prod` tier). After verify: promote `v0.11.0-rc.1` → `v0.11.0` (drop -rc).
3. **RBAC slug retrofit promotion** — branch `feat/rbac-slug-standardize` (6a9ec94). FIRST rebase onto current main (inherits ESM fix → its worker tests run). ⚠ Its migration `20260719120000_rename_tenant_super_admin_slug` COLLIDES with main's `20260719120000_add_device_push_tokens` (same timestamp) — RENAME one before merging. Then owner-gated push→staging (data migration renames the slug in each env) → prod.

## ⚠ OPEN ITEMS / FOLLOW-UPS (technical, discovered this session)
- **Mobile TASK sync is unreachable until PULL/DOWN-SYNC is built** — the mobile `tasks` table is never populated from the server (no pull mechanism anywhere). DTR + Expenses work (phone-created); tasks need pull. General down-sync (web changes → phone, e.g. approvals) is also absent. Owner deferred down-sync ("push only for now"). This is the natural next big feature if mobile is a priority.
- **Mobile tRPC client typed `AnyRouter`** not real `AppRouter` (cross-pkg type errors) — needs a shared types package for e2e type-safety; the 4 modules still use the `apiFetch` path.
- **Migration timestamp collision** (RBAC branch vs device_push_tokens, both 20260719120000) — reconcile at RBAC integration (above).
- Pre-existing web-router `z.string().url()` dead-code on Expense.receiptUrl (we store storage KEY) — flagged, not touched.

## DECISIONS MADE THIS SESSION (owner, via AskUserQuestion)
- Mobile approach = **phased full-native Expo/RN**; **Play + App Store first (Huawei later)**; **soft interstitial + continue-in-browser**; **dev/simulator builds only** (no Apple/Play spend yet); **stay Expo SDK 52** for v1.
- Uploads: **cut FileUpload over to Telegram + compression + thumbnails** (client compression + thumbnails).
- Mobile auth backend = **YES build**. Sync = **push-only** (down-sync deferred); expense categories = **pull the tenant list (picker)**.
- Deploy model locked = **(a)** hand-placed Komodo stacks; repo compose = reference mirror (DECISIONS_LOG).
- Tag policy: staging=`-rc.N`, prod=clean (v0.11.0 reserved for prod promotion).

## 🖐️ MANUAL OWNER STEPS (can't be done headless)
- Mobile simulator E2E: start `apps/web` dev → point Expo `extra.apiUrl` at it → run simulator → login → clock-in/out, expense+category+receipt → verify server-side rows.
- `npx expo login` (free) → `eas init` (real projectId) → `eas build --profile development`.
- Apple ($99/yr) + Google Play ($25) accounts + fill `eas.json` REPLACE_WITH_* + set `NEXT_PUBLIC_ANDROID/IOS_APP_URL` — when ready to publish.

## KEY FACTS / FOOTGUNS
- **Harness auto-worktree isolation bases off a STALE commit** — it caused a duplicate-auth defect (W1). MITIGATION: run dependent workers WITHOUT `isolation:"worktree"` (on the primary tree = true current main), or verify base==HEAD. Global lesson recorded: `harness.agent-worktree-isolation.stale-base-commit`.
- CI is build+push-ONLY by design (staging-refresh-gate); do NOT flip docker-publish.yml to Komodo auto-update. Komodo staging auto_update stays OFF.
- GH Actions secrets present: DOCKERHUB_USERNAME/TOKEN, NEXT_PUBLIC_TURNSTILE_SITE_KEY.
- New env var `MOBILE_JWT_SECRET` in `.env.dev`/`.env.example` only — staging/prod vault secret is OWNER-GATED (add at promotion, Server-Setups SOPS+age).
- `.claude/worktrees/` now gitignored. One harness-locked worktree (`agent-a058a6af`) persists harmlessly.

## PACING
Only owner-gated [WHAT] + deferred follow-ups remain — nothing un-gated to advance. Reboot with `--hold` to pace + re-surface the gated queue; do NOT auto-push/deploy/promote. Memories: `feature_program_compression_mobile_2026-07-19`, `full_auto_gated_queue_ship_2026-07-19`.
════════════════════════════════════════════════════════════════════════════
