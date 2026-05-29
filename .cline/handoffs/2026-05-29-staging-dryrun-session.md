# Handoff — Local staging deploy dry-run (paused for rest)
Date: 2026-05-29 ~21:50 GMT+8
Branch: `fix/web-transpile-workspace-packages`
Status: PAUSED mid-task — open scope decision required.

---

## TL;DR
Local staging compose stack is **running** with a fresh DB.
**12 deploy-gate migrations validated end-to-end.** Web app builds + boots + encryption-key check passes.
Worker is broken (deeper than expected — `@orqafy/jobs` package needs build pipeline).
Open question on commit scope. No commits yet on this branch.

---

## What was validated ✅

| Check | Result |
|---|---|
| 14 migrations apply on fresh staging DB via `prisma migrate deploy` | ✅ All clean — includes 11 deploy gates from Batches 21c, 22, 24, 26, 27, 28, 30, 31 |
| `APP_ENCRYPTION_KEY` length=44 in app container | ✅ |
| Batch 25 startup health check (encryption-key) | ✅ Logged "startup health check passed" |
| `/api/health` returns `{"status":"ok"}` | ✅ Verified via `docker exec` curl |
| Web image builds with staging-latest tag | ✅ After fix |
| Random ports for full local isolation | ✅ All in 47230-47236 range, no host collisions |
| `COMPOSE_PROJECT_NAME=orqafy_staging_dryrun` for volume isolation | ✅ Distinct from any future real `orqafy_staging_*` volumes |

## What's broken / unresolved ❌

| Issue | Notes |
|---|---|
| Worker can't run @orqafy/jobs at runtime | Node 22 type-stripper fails on `.ts` files under `node_modules/`. Root cause: `packages/jobs/package.json` `exports` points at `./src/*.ts` instead of built `./dist/*.js`. Real refactor required. |
| App Docker healthcheck shows "unhealthy" | Cosmetic — sticky from startup-race failures during boot. Live `/api/health` returns 200. Could be left alone or healthcheck interval/start_period adjusted. |
| pgAdmin not tested in dry-run | Skipped — `pgadmin-servers.json` has hardcoded postgres hostname `orqafy_staging_postgres` which won't match the dryrun project name. Not on critical path. |

---

## Files modified (uncommitted on branch `fix/web-transpile-workspace-packages`)

```
apps/web/next.config.ts      — added transpilePackages + webpack.resolve.extensionAlias
apps/worker/Dockerfile       — added pnpm --legacy --prod deploy /prod/worker pattern (helps but doesn't fully fix the worker)
.env.staging                  — DRY-RUN OVERLAY (NOT a real-staging value!)
                                  COMPOSE_PROJECT_NAME=orqafy_staging_dryrun
                                  Ports 5433→47230, 6433→47231, 6380→47232, 9010→47233, 9011→47234, 5051→47235
                                  Added: WORKER_IMAGE_NAME, WORKER_PORT=47236, AUTH_TRUST_HOST=true, APP_ENCRYPTION_KEY (throwaway)
.env.staging.realbackup       — UNTRACKED — original staging env. Restore from this before any real Komodo push.
```

`.env.staging` should be REVERTED before Komodo deploy. Real `APP_ENCRYPTION_KEY` for Komodo must be generated separately and never reused from this throwaway dry-run key.

---

## Open decision (the question that paused this session)

How to proceed on branch `fix/web-transpile-workspace-packages`?

**Option A — Stop here, commit web fix + worker Dockerfile improvement**
Commit the two file changes (next.config.ts + worker Dockerfile). Worker still broken at runtime, but pnpm-deploy pattern is correct and a STATE.md note documents the @orqafy/jobs build-pipeline blocker. Deploy gates can ship to Komodo (BullMQ already non-functional in current main, so no regression).

**Option B — Do the full @orqafy/jobs refactor on the same branch**
Add `tsconfig.build.json` + `build` script to `packages/jobs`, update exports to `./dist/*.js`, verify vitest + Next.js webpack + worker runtime all still work, rebuild worker image, verify boot. ~30-60 min, touches packages/jobs + all consumers (apps/web + apps/worker).

**Option C — Revert worker Dockerfile change, commit only web fix**
Keep the branch surgical: only `apps/web/next.config.ts`. Worker stays as it was. File two separate issues: worker pnpm layout + jobs build pipeline.

---

## Running state (Docker Desktop)

```
orqafy_staging_dryrun_postgres    — healthy on host port 47230
orqafy_staging_dryrun_pgbouncer   — running on host port 47231
orqafy_staging_dryrun_valkey      — healthy on host port 47232
orqafy_staging_dryrun_minio       — healthy on host port 47233-47234
orqafy_staging_dryrun_app         — running (Docker says unhealthy, but /api/health returns 200)
orqafy_staging_dryrun_worker      — stopped (was crash-looping)
```

Volume names (preserved on stack restart):
- `orqafy_staging_dryrun_postgres_data` — contains the 14 applied migrations + empty schema
- `orqafy_staging_dryrun_valkey_data`
- `orqafy_staging_dryrun_minio_data`
- `orqafy_staging_dryrun_pgbouncer_data`

Stub network: `proxy` (created locally to satisfy Traefik external-network reference)

---

## Resume commands

### Pick up the worker debug

```bash
# Rebuild worker after any change
docker build --file apps/worker/Dockerfile --tag bonitobonita24/orqafy-worker:staging-latest .

# Restart just the worker
docker compose --env-file .env.staging \
  -f deploy/compose/stage/docker-compose.db.yml \
  -f deploy/compose/stage/docker-compose.cache.yml \
  -f deploy/compose/stage/docker-compose.storage.yml \
  -f deploy/compose/stage/docker-compose.app.yml \
  -f deploy/compose/stage/docker-compose.worker.yml \
  up -d --pull never --force-recreate worker

docker logs orqafy_staging_dryrun_worker | head -50
```

### Commit web fix only (Option A or C)

```bash
git status  # should show modified: apps/web/next.config.ts (and apps/worker/Dockerfile if Option A)
# Option C: revert worker dockerfile first
#   git checkout apps/worker/Dockerfile

git add apps/web/next.config.ts                          # always
git add apps/worker/Dockerfile                           # if Option A
git commit -m "fix(web,worker): unbreak Docker production builds

- next.config.ts: add transpilePackages + webpack.resolve.extensionAlias
  to resolve @orqafy/jobs and @orqafy/db workspace TS sources that use
  ESM-style .js extension imports
- apps/worker/Dockerfile (Option A only): use 'pnpm --legacy --prod
  deploy' to produce a flat node_modules dir; pnpm v10 default layout
  with .pnpm/ virtual store wasn't copied correctly to runner stage

Surfaced by local staging compose dry-run on 2026-05-29.
Worker still fails at runtime because @orqafy/jobs exports .ts source
rather than built .js — separate fix tracked in lessons.md."

git push origin fix/web-transpile-workspace-packages
```

### Full @orqafy/jobs refactor (Option B)

```bash
# Add tsconfig.build.json + build script to packages/jobs
# Update packages/jobs/package.json:
#   "main": "./dist/index.js"
#   "exports": { ".": "./dist/index.js", "./queues": "./dist/queues/index.js", ... }
#   "scripts": { "build": "tsc --project tsconfig.build.json", ... }
# Update apps/web/Dockerfile + apps/worker/Dockerfile to RUN pnpm --filter @orqafy/jobs build before downstream builds
# Verify:
pnpm --filter @orqafy/jobs build
pnpm --filter @orqafy/web test
pnpm --filter @orqafy/worker test
# Then rebuild Docker images and re-validate worker boot
```

### Full teardown + restore real .env.staging

```bash
# Tear down the dry-run stack (keeps volumes by default)
docker compose --env-file .env.staging \
  -f deploy/compose/stage/docker-compose.db.yml \
  -f deploy/compose/stage/docker-compose.cache.yml \
  -f deploy/compose/stage/docker-compose.storage.yml \
  -f deploy/compose/stage/docker-compose.app.yml \
  -f deploy/compose/stage/docker-compose.worker.yml \
  down

# Drop dry-run volumes (DB data is throwaway)
docker volume rm orqafy_staging_dryrun_postgres_data \
                 orqafy_staging_dryrun_valkey_data \
                 orqafy_staging_dryrun_minio_data \
                 orqafy_staging_dryrun_pgbouncer_data

# Restore the real .env.staging (overwrites dry-run values + throwaway encryption key)
mv .env.staging.realbackup .env.staging

# Confirm restore
grep '^COMPOSE_PROJECT_NAME=' .env.staging  # should show orqafy_staging (no _dryrun suffix)
grep -c '^APP_ENCRYPTION_KEY=' .env.staging # should show 0 — real key must come from Komodo
```

---

## Notes for the Komodo deploy procedure

The dry-run **proves**:
1. The 11 deploy-gate migrations are safe to apply via `prisma migrate deploy` on fresh staging DB. Order is correct, FK chains resolve, no surprises.
2. `APP_ENCRYPTION_KEY` env wiring works end-to-end — startup health check (Batch 25) catches missing/wrong-length keys.
3. The web image builds cleanly once `next.config.ts` has `transpilePackages` + `extensionAlias`.

The dry-run **does NOT yet prove**:
1. Worker can run jobs in staging (needs @orqafy/jobs build pipeline).
2. pgAdmin connects to postgres in staging (pgadmin-servers.json may need a tweak for the renamed host).
3. Real DNS + Traefik routing — Komodo handles this differently than local stub network.

Krytical for first real Komodo deploy:
- Confirm `APP_ENCRYPTION_KEY` is set in Komodo Stack env BEFORE first deploy (Batch 25 health check will fail the app if missing).
- Push `bonitobonita24/orqafy:staging-latest` to Docker Hub (currently only local).
- Run `prisma migrate deploy` from inside the running app container OR via a separate one-shot job; do NOT run from host on Komodo unless host has DB access.
