# Deploy compose reconciliation — repo `deploy/compose/{stage,demo}` vs live VPS stacks

**Status:** ✅ RESOLVED — applied 2026-07-19. Deploy model = **(a)**: Komodo + the gate script
`deploy/staging-refresh-and-deploy.sh` deploy the hand-placed stack files under
`/etc/komodo/stacks/orqafy-{staging,demo}/` on the VPS. The repo's `deploy/compose/{stage,demo}`
files are a **reference mirror**, not the deploy source — this change touches no live deploy
behavior (nothing consumes the repo compose directly). See `docs/DECISIONS_LOG.md` for the
locked decision entry.

## How the divergence arose
The demo + staging stacks were stood up **manually** (mirroring the proven frms-demo layout) because the
repo compose **would not have deployed as-is** (relative `env_file` path to repo root, cross-file
`depends_on`, no internal DB URL override). The live stacks under `/etc/komodo/stacks/orqafy-{staging,demo}/`
were the **working reference**; the repo compose was the drifted/aspirational copy — now reconciled to match.

## Ground-truthed divergence (identical pattern in BOTH staging & demo) — now reconciled

| Aspect | REPO compose (BEFORE) | LIVE stack (`/etc/komodo/stacks/orqafy-*`) | Reconciled → |
|---|---|---|---|
| `env_file` | `../../../.env.{staging,demo}` (up to repo root) | `.env` (co-located in stack dir) | repo → `.env` ✅ |
| app/worker `DATABASE_URL`/`DIRECT_URL`/`REDIS_URL` | not overridden (relied on env_file alone) | explicit `DATABASE_URL: ${INTERNAL_DATABASE_URL}`, `DIRECT_URL: ${INTERNAL_DIRECT_URL}`, `REDIS_URL: ${INTERNAL_REDIS_URL}` | added override ✅ |
| app `AUTH_TRUST_HOST` | absent | `"true"` | added ✅ |
| pgbouncer | present in `db.yml` (+ volume) | **absent** | dropped from db.yml (service + volume) ✅ |
| pgadmin | present (`docker-compose.pgadmin.yml` + `pgadmin-servers.json`) | **absent** | files removed from stage+demo ✅ |
| Traefik router/service names | templated `${COMPOSE_PROJECT_NAME}_app` | **hardcoded** `orqafy_staging_app` / `orqafy_demo_app` | hardcoded in repo to match ✅ |
| Traefik network label | (none) | `traefik.docker.network=proxy` | added ✅ |
| `STORAGE_BACKEND` (app+worker env block) | list form `- STORAGE_BACKEND=telegram`, list-form `environment:` overall | map form, `TZ`/`NODE_ENV`/`PORT` as map entries | converted whole `environment:` block to map form ✅ |
| app/worker default image tag | `${APP_IMAGE_TAG:-staging-latest}` (stage) / `${APP_IMAGE_TAG:-demo-latest}` (demo) | staging now correctly defaults `staging-latest` (owner-fixed live 2026-07-19, was `demo-latest` footgun — see below); demo correctly `demo-latest` | repo already matched staging's *intended* default; no repo change needed here — the footgun was in the LIVE files only, now fixed live |
| worker `depends_on` (postgres/valkey healthy) + `healthcheck` | present | **absent** (live worker has neither) | removed from repo worker.yml (both envs) — **newly found divergence, not in the original table** |
| app `depends_on` (postgres/valkey healthy) | present | **absent** (live app relies on its own healthcheck + restart policy only) | removed from repo app.yml (both envs) — **newly found divergence, not in the original table** |

Storage backend value itself is correct per env: **staging = telegram**, **demo = s3** (matches the
fleet media-storage default: demo stays MinIO/S3, non-demo on Telegram). Unchanged by this reconciliation.

## ✅ Footgun already fixed live (before this reconciliation)
The **staging** stack's `docker-compose.{app,worker}.yml` was originally copied from the demo stack and its
`APP_IMAGE_TAG` default fallback was left at `:${APP_IMAGE_TAG:-demo-latest}`. The owner/PM fixed this live
on 2026-07-19 (`sed` on both files, confirmed staging now defaults to `staging-latest`) — verified during
this reconciliation's SSH ground-truth read. Recorded as global lesson
`deploy.compose.copied-stack-kept-source-default-image-tag`. The repo compose already had the correct
per-env default and required no change here.

## What changed in the repo (2026-07-19)
Applied to **both** `deploy/compose/stage/` and `deploy/compose/demo/`:
- `docker-compose.app.yml` — `env_file: .env`; `environment:` converted to map form with
  `TZ`, `NODE_ENV`, `PORT: "3000"`, `AUTH_TRUST_HOST: "true"`, `STORAGE_BACKEND`,
  `DATABASE_URL/DIRECT_URL/REDIS_URL` pointing at `INTERNAL_*`; dropped `depends_on`; hardcoded
  Traefik router/service names (`orqafy_staging_app` / `orqafy_demo_app`) + added
  `traefik.docker.network=proxy` label.
- `docker-compose.worker.yml` — same `env_file`/`environment` treatment; dropped `depends_on` and
  `healthcheck` (live worker has neither).
- `docker-compose.db.yml` — `env_file: .env`; removed the `pgbouncer` service + `pgbouncer_data` volume.
- `docker-compose.cache.yml`, `docker-compose.storage.yml` — `env_file: .env` only (rest already matched live).
- `docker-compose.pgadmin.yml` + `pgadmin-servers.json` — **removed** (not part of the deployed set).
- `deploy/compose/stage/MERGED.docker-compose.yml` — regenerated (single-file Komodo-UI-paste
  reference) to match the reconciled split files: no pgbouncer/pgadmin, `INTERNAL_*` URL overrides,
  hardcoded Traefik names, `traefik.docker.network` label. (Demo never had a MERGED variant.)
- `deploy/compose/start.sh` — guarded the `pgadmin.yml` include with a file-existence check, since
  `stage`/`demo` no longer ship that file (`dev`/`prod` are untouched and still have it).

**Out of scope (not touched):** `deploy/compose/dev/*` and `deploy/compose/prod/*` — dev is a
different deploy model entirely (local build), and prod has not yet had a live stack ground-truthed
(prod deploy is still owner-gated / pending). Reconcile those separately once prod is actually deployed.

## Verification performed
- Every edited compose file (stage + demo, `docker-compose.{db,cache,storage,app,worker}.yml`) validated
  with `docker compose config -q` against a dummy `.env` with placeholder values for all interpolated
  vars — all passed.
- `deploy/compose/stage/MERGED.docker-compose.yml` validated the same way — passed.
- No `.env` files were created or committed; the validation `.env` was written to each directory
  temporarily and deleted immediately after.
- `deploy/compose/start.sh` checked with `bash -n` (syntax only) — passed.

## The one [WHAT] this resolves
Deploy model is now locked as **(a)**: Komodo/the gate script keep deploying the hand-placed
`/etc/komodo/stacks/*` files; the repo compose stays a **verbatim mirror**, not a template/generator
input. No templating/generator system was introduced. See `docs/DECISIONS_LOG.md`.
