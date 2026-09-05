# Task Queue — Orqafy

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.
Mirrored to the PROD Squirlnote board (project **Orqafy**, prefix `ORQ`) per `project_squirlnote_use_obligation`.

## 🔴 / 🟡 Open

> Owner-queued order: ORQ-25 ✅ · demo-cron code ✅ · ORQ-24 ✅ · **ORQ-23/24/25 FF-merged → local `main` `fcd6025` (11 ahead of origin, HARD HOLD) 2026-09-05** · gov-sync PLANNED (D-GOVSYNC, BLOCKED on AIEF whitelist fix) → **ORQ-27 (cross-host residuals, has [WHAT]s).**

- 🔴 **[BLOCKED — DEFERRED by owner 2026-09-05] Framework gov-sync V32.45.1 → V32.54.0** `[D-GOVSYNC]` — plan
  ready; **apply DEFERRED** pending the cross-seat AIEF prerequisite. Target **v32.54.0**. ⚠ BLOCKER: AIEF
  `sync-to-project.sh` whitelist-lag skips the 5 newest deliverables (review-scope/audit-scope/content-voice) →
  the AIEF SEAT must add them to `AI_PROMPT_FILES` first (NOT an Orqafy edit). Re-open once AIEF is fixed. Plan +
  steps in `PENDING_DECISIONS.md` D-GOVSYNC (answered: DEFER). Global lesson logged. `source: agent-found 2026-09-05`

- 🔴 **[HELD by owner 2026-09-05] Cross-host deploy residuals from the EC2 split** `[ORQ-27]` — surfaced by ORQ-25.
  (a) `staging-refresh-and-deploy.sh` prod→staging is same-host `pg_dump|psql`, but prod=Hostinger / staging=EC2 →
  step 2 auto-skips (gate degraded to deploy+migrate only). **Owner decision 2026-09-05: LEAVE THE GATE DEGRADED**
  (don't build a cross-host prod-read pipe — safer; revisit if staging must validate against real prod data).
  (b) demo self-heal cron can't go live until on-box migrate + self-SSH/SG topology resolved. **Owner decision
  2026-09-05: HOLD** (installer written+inert; enable live only when ready to touch the EC2 box). `source: agent-found 2026-09-05`

## ✅ Done recently

- ✅ **FF-merge ORQ-23/24/25 → local `main`** `[ORQ-merge]` — owner authorized merging the held deploy work.
  `feat/orq-25-ec2-retarget` already subsumed `feat/cicd-standard-backfill` (merge-base confirmed) and both
  were 0-behind `main` → one clean fast-forward landed ORQ-23 (CI/CD standard) + ORQ-24 (coupled rollback) +
  ORQ-25 (EC2 retarget). Pre-merge verify PASS: 8 deploy scripts `bash -n`+shellcheck clean, no `apps/`/
  `packages/` source touched, tree clean. main @ `fcd6025`, **11 ahead of origin, HARD HOLD** (no push/deploy).
  `source: owner 2026-09-05`
- ✅ **Make coupled rollback's paired-dump pairing real** `[ORQ-24]` — root nuance: prod runs a moving
  `APP_IMAGE_TAG=latest`; the immutable per-deploy identity is the `prod-sha-<SHA>` tag. Introduced a
  `DEPLOYED_APP_SHA` marker in the prod `.env`: `push-to-prod.sh` names the pre-promotion backup with the
  OUTGOING sha (`orqafy-prod-backup-pre-promotion-<OUTGOING>-<ts>.sql.gz`) + records the incoming sha for
  next time; `rollback.sh` (search already matched) now also updates `DEPLOYED_APP_SHA` at both re-tag points
  so the next promotion pairs correctly. `rollback prod prod-sha-<OUTGOING>` now finds its paired dump →
  coupled image+schema restore fires. Staging keeps the guardrail (moving tag, wiped/refreshed); demo self-heals.
  Commit `480f327`, `bash -n`+shellcheck clean. HARD HOLD (local only). `source: agent-found 2026-09-03`
- ✅ **Retarget demo + staging deploy scripts to EC2-Komodo** `[ORQ-25]` — retargeted every demo/staging deploy
  path off the dead Hostinger host to EC2 `ubuntu@18.138.220.90`, verified against the live box: SSH user
  `ubuntu` (docker group + passwordless sudo), demo `.env` mode 600 → sudo for `.env` reads + all `docker
  compose` from the stack dir; staging `.env` world-readable → only `.env` writes need sudo; `/root`→`/home/ubuntu`
  for backups+golden. `rollback.sh`+`komodo-verify.sh` made per-env two-host aware (staging/demo=EC2, prod=Hostinger);
  `push-to-prod.sh` untouched. Plus `demo-reset-cron-install.sh` (D-DEMO-CRON Option 1: inert, pre-flight-checked,
  owner-gated). Commit `44eb63b` on `feat/orq-25-ec2-retarget`, `bash -n`+shellcheck clean. HARD HOLD (local only).
  `source: owner-queued 2026-09-05`
- ✅ **Adopted fleet CI/CD standard — closed the 4-item gap** `[ORQ-23]` — generated the net-new pipeline
  scripts via `cicd-gen` and kept only what Orqafy lacked, reinstating the proven `ci.yml` /
  `docker-publish.yml` / `push.sh` / `start.sh` / `staging-refresh-and-deploy.sh` from HEAD (the generator
  had clobbered them). Net-new: `deploy/rollback.sh` (coupled image+schema rollback / guardrail),
  `deploy/demo-reset.sh` (6h golden self-heal), `deploy/demo-bless-golden.sh` (capture golden),
  `deploy/komodo-verify.sh` (§8.1 stack-registration audit). `.ai_prompt/cicd.md` already present (prior sync).
  Reconciled the generator's stale bakes to Orqafy's live reality: **app+worker** (not app-only),
  **orqafy.com / staging.orqafy.com / demo.orqafy.com** (not `*.powerbyte.app`), prod stack `orqafy-prod`,
  **ORQ-17** hardened migration tunnel + **ORQ-22** bounded health poll in rollback & demo-reset. `bash -n` +
  shellcheck clean. HARD HOLD — LOCAL only, nothing wired/deployed; cron + `demo-bless-golden.sh` one-time +
  paired pre-promotion backup remain owner-gated wiring. `source: owner 2026-09-03`
- ✅ **Hardened push-to-demo.sh health check (bounded poll)** `[ORQ-22]` — replaced the single `sleep 5` + one
  curl with the same 24×5s bounded poll `push-to-prod.sh` uses (breaks on first 200, warns after 120s). Fixes
  the false `404` seen on the v0.19.0 demo promote. `bash -n` + shellcheck clean. `ef2b6f8` → main, pushed. (2026-09-02)
- ✅ **Promoted v0.19.0 → PROD + DEMO (Full Auto)** `[ORQ-deploy]` — both live envs moved v0.18.3 → **v0.19.0**
  (sha-89737aa / image a3b74a700190); prod+demo DBs backed up, migrate no-op (no new migrations), reseed never,
  dev rebuilt FRESH (Rule 39). Verified: both health 200 + sitemap 200, running digest = v0.19.0. (2026-09-02 pm)

- ✅ **D-SEO closed: dynamic demo/flagship storefront sitemap** `[ORQ-20]` — the last open D-SEO piece (a
  `TODO(seo)` in `app/sitemap.ts`). Owner call: enumerate the **demo/flagship store ONLY**, not every tenant.
  `sitemap.ts` now emits the demo store landing + product list + every public product (`isActive &&
  ecommerceVisible`, URL `ecommerceSlug ?? id`, lastmod `updatedAt`) beside the 3 marketing routes; fail-open,
  5000 cap, hourly revalidate, slug via `SITEMAP_STORE_TENANT_SLUG`. Verified: `tsc` clean; dev-DB → demo active
  + 24 public products, well-formed URLs. `e28e816` on `feat/orq-seo-tenant-store-sitemap`, HARD HOLD local.
  (2026-09-01)
- ✅ **RBAC fleet-naming reconcile = KEEP ratified names (no-op)** `[ORQ-21]` — owner declined renaming
  `tenant_super_admin`/`platform_owner` → fleet `tenant_superadmin`/`tenant_manager`. Divergence already ratified
  2026-08-09; roles are a data-driven `roles` table (string slug), not an enum. No code/DB change. SessionStart
  RBAC-retrofit offer is STALE. See DECISIONS_LOG 2026-09-01. (2026-09-01)

- ✅ **Real Cloudflare Turnstile LIVE on prod** `[ORQ-19]` — owner said "push to prod". Shipped v0.18.3 through the
  full build-once→promote path AND fixed the runtime-secret gap a prior session left. Baked the real
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` by updating the **GitHub Actions secret** (was still test key from 2026-06-16) →
  CI rebuilt `sha-ed87a4e` (byte-verified: real sitekey in client+server bundles, ZERO test-key). Promoted to prod
  (`push-to-prod.sh sha-ed87a4e`; DB backup, no pending migrations, health 200). **Caught + fixed:** the live VPS
  `orqafy-prod/.env` still held TEST keys — the prior session's vault commit (`9083be7`) was never applied to the
  host; the test `TURNSTILE_SECRET_KEY` always-passes → bot protection was silently OFF. Sed'd the real secret+sitekey
  into the live `.env` (backup taken) + recreated app. Verified LIVE: forged token → **403** "Invalid bot protection
  token"; running prod container serves the real sitekey (digest `sha256:e231de84`). Dev rebuilt fresh (Rule 39).
  v0.18.3 tag `ed87a4e` on origin/main. Lesson logged (`deploy.env.nextpublic-baked-vs-runtime-secret-vs-vault-not-live`). (2026-08-31)


- ✅ **Cut v0.18.2 release** `[ORQ-18]` — FF-merged `fix/orq-13-orq-10-compose-favicon` (ORQ-13+ORQ-10) → main,
  ran `gen-release-notes --apply` (CHANGELOG + 10-pkg version-sync + sidebar footer + annotated tag), pushed
  `main`+tag to origin. origin/main @ `a16507d`, **v0.18.2**. Live envs still on v0.18.0 (Model B, no auto-deploy). (2026-08-31)

- ✅ **`favicon.ico` 404 → add app icon** `[ORQ-10]` — browsers probed `/favicon.ico` and got 404 (console noise on
  first load). Added `apps/web/src/app/icon.svg` (Orqafy brand mark) via the Next.js metadata-file convention →
  Next injects `<link rel="icon" href="/icon.svg" type="image/svg+xml">`, so modern browsers use it and stop
  probing `/favicon.ico`. Cross-scope: also allow-listed `/icon.svg` in `lib/public-paths.ts` (middleware) — else
  the auth middleware 307'd the icon to `/login` (same omission class as robots/sitemap). Verified on rebuilt dev
  runtime: `/icon.svg` 200 `image/svg+xml`, rel=icon injected, tests 30/30. Residual: bare `/favicon.ico` still
  404s for non-link-honoring clients (no ICO rasterizer on this box). `31eefdf` on `fix/orq-13-orq-10-compose-favicon`,
  HARD HOLD local. (2026-08-31)
- ✅ **Regenerate stale `prod/MERGED.docker-compose.yml`** `[ORQ-13]` — the committed prod MERGED (gen 2026-06-16)
  had drifted from the per-service source: declared "No MinIO — uses R2", omitted the MinIO service + `minio_data`
  volume, and app+worker were missing `STORAGE_BACKEND=telegram` + `TELEGRAM_*` env. A Komodo redeploy from it
  would have dropped the MinIO scratch/fallback container and run app+worker without the Telegram storage backend.
  Faithfully re-merged from the current db/cache/storage/pgadmin/worker/app files (stage MERGED was already
  correct → prod now at parity); header note corrected. Validated with `docker compose config` (exit 0). `2bbce18`
  on `fix/orq-13-orq-10-compose-favicon`, HARD HOLD local. (2026-08-31)
- ✅ **Harden `push-to-demo.sh` / `push-to-prod.sh` migration tunnel** `[ORQ-17]` — both opened the DB tunnel on a
  LOCAL bind port equal to the remote `DB_PORT`; when another local container published that port (hit live:
  `onepostman-postgres` on `:5439` vs demo `DB_PORT=5439`) the bind failed silently, `ssh -N` stayed alive, prisma
  migrated the WRONG local DB, and the script still printed "✅ done" (false success — remote DB left un-migrated).
  Fixed: dedicated high local tunnel port decoupled from `DB_PORT` (probe 15439–15443), `ExitOnForwardFailure=yes`
  makes a failed bind FATAL, `kill -0` liveness check, abort loudly BEFORE migrate. Brings both scripts to parity
  with `staging-refresh-and-deploy.sh` (already decoupled). Lesson: `bash.deploy.tunnel-port-collides-with-local-db-container-false-success`.
  `347e900` on `fix/orq-17-deploy-tunnel-port`, HARD HOLD local. (2026-08-30)

- ✅ **Promote v0.18.0 Customer Portal to PRODUCTION** `[ORQ-14]` — owner-approved. `push-to-prod.sh sha-0e7ba0f`:
  prod DB backed up, image promoted (web+worker), stack recreated, 2 migrations applied, health polled to 200.
  Verified orqafy.com/api/health 200, prod app revision `0e7ba0f`, `/{slug}/portal` 307→login. (2026-08-30)
- ✅ **Deploy v0.18.0 portal to DEMO** `[ORQ-15]` — owner-approved. `push-to-demo.sh sha-0e7ba0f`; demo DB backed
  up, image promoted → demo-latest, migration applied (had to re-run via a 15439 tunnel — see ORQ-17). Verified
  demo.orqafy.com/api/health 200, `/demo/portal/login` 200, demo app revision `0e7ba0f`. (2026-08-30)
- ✅ **Merge `fix/orq-11-compose-mem-limits` → main** `[ORQ-16]` — FF-merge (compose mem/cpu limits + session docs).
  main @ `376ee38`, 6 ahead of origin (HARD HOLD — not pushed; push=release moment). (2026-08-30)

- ✅ **Compose resource limits (mem/cpu) — outage hardening** `[ORQ-11]` — added top-level `mem_limit`/
  `memswap_limit`/`mem_reservation`/`cpus` (V32.10) to all prod/staging/demo services (dev exempt); applied
  live to all 15 running containers via `docker update` (non-disruptive, no repull/restart) AND committed
  durably to compose files. Modeled on ferrybook + real usage on the tight 2-vCPU/7.8G box. `3ac1210` on
  `fix/orq-11-compose-mem-limits`, HARD HOLD local. (2026-08-28)
- ✅ **Uptime monitoring + alerts for Orqafy** `[ORQ-12]` — added 3 HTTP monitors (orqafy.com /
  staging.orqafy.com / demo.orqafy.com → `/api/health`, 60s) to the existing shared Uptime-Kuma with the
  Telegram (Hermes) notification attached. All UP/200 verified. Closes the blind spot behind the silent
  4-day outage. (Kuma DB change — shared infra, not in-repo.) (2026-08-28)
- ✅ **D-1 Customer Portal MVP (invite-only)** `[ORQ-1]` — 2nd Auth.js portal provider + principalType +
  portalProcedure; Dashboard/Invoices/Orders/Repairs (customer-scoped) + staff invite card. E2E-verified;
  6 defects caught in verification. Released **v0.18.0**, merged+pushed, deployed to staging. (2026-08-28)
- ✅ **Deploy v0.18.0 portal to staging (data-first gate)** `[ORQ-3]` — refreshed staging from prod, migration
  applied, schema HARD gate up-to-date, portal verified on staging.orqafy.com. Prod promote = separate owner
  step. (`sha-0e7ba0f`, 2026-08-28)
- ✅ **Production outage recovery** `[ORQ-4]` — prod/staging/demo down ~4 days after a VPS reboot; restored via
  `docker start` (not compose up); orqafy.com back to 200, all stacks healthy. (2026-08-28)
- ✅ **CI Turbo lint green** `[ORQ-5]` — cleared portal/D-4 ESLint errors (behavior-preserving); lint+typecheck+
  suite green. `0e7ba0f`. (dep-audit CI job stays red — pre-existing.) (2026-08-28)
- ✅ **D-4 public invoice view + Copy-share-link** `[ORQ-2]` — public `/invoice/[token]` page (noindex, notFound on bad
  token), shared sanitized fetch, allow-list flip, staff "Copy share link" button. Verified live (200/404/no
  field leak) + full suite 1491/1491. Released **v0.17.0** (local, HARD HOLD). (`353aeba`, 2026-08-27)
- ✅ **Demo invoices `publicToken` backfill** — seeded customer invoices now get a token so D-4 is demoable.
  (`6fb4e28`, 2026-08-27)
- ✅ **AdminCN Phase E re-baseline (authed admin fidelity gate)** — `design-fidelity.mjs` gained authed
  capture (login once, reuse storageState for `auth:true` entries); `data-fdl` landmark anchors on the
  AdminCN shell + dashboard; `/demo/dashboard` baseline captured. Gate now 8/8 PASS (was 7 public-only).
  Closes STATE.md authed-fidelity TODO + the AdminCN adoption's last PENDING item. Owner sign-off on the
  baseline deferred → PENDING_DECISIONS "D-ADMINCN-E". (`5a299b0`+`7b442df`+`fcdd765`, branch
  `feat/admincn-e-rebaseline`, HARD HOLD, 2026-08-27)
- ✅ **AdminCN adoption (decision #1)** — confirmed ALREADY built+merged+ratified 2026-08-08 (not re-done;
  stale "open" tracking corrected). `agent-found` reconcile, 2026-08-27.
- ✅ **POS grid product images blank** — root cause was NOT 404s/wrong source (POS resolves `imageUrl`
  from `ecommerceImageUrls[0]`, identical to the storefront catalog — always correct). Real cause: an
  opacity-0 **onLoad race** — a cached `<img>` reaches `complete` before React attaches `onLoad`, so the
  tile stays invisible/skeleton-stuck forever. Fixed with a ref callback flipping `imgLoaded` on the
  already-complete case. Verified on dev: 24/24 tiles visible, 0 stuck, 0 broken. (`1435c96`,
  branch `fix/pos-image-onload-race`, 2026-08-26)
- ✅ **Storefront demo seed coherence** — rethemed 24 demo products so name/brand/specs/category match
  each Shopix photo; 6 coherent categories; `onSale` gate (11/24 on sale); `ageDays` backdate (7/24 New);
  2 out-of-stock; idempotent reseed (UPDATE re-asserts name/createdAt/stock + slug pre-clear). Verified
  on dev + fidelity 7/7 + tests green. (`79b43b3`, 2026-08-25)
- ✅ **Public storefront rate limiter 10→60/min** — one page fans out to ~5-6 public checks; 10 locked
  out browsing (live catalog 500 + false fidelity fail). Bumped in rate-limit.ts + inputs.yml. (`7470a27`, 2026-08-25)
- ✅ **Overnight-hang recovery verification** — confirmed template-alignment P1–P4 all committed + clean
  handoff (nothing lost); re-ran tests 1479/1479, typecheck clean, fidelity 7/7 (proved the 1 "fail" a
  rate-limit false-negative), screenshotted storefront + POS. (2026-08-25)
