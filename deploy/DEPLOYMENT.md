# Orqafy — Deployment & Promotion Flow

Four environments, one Docker Hub image line per artifact (`bonitobonita24/orqafy` for
web, `bonitobonita24/orqafy-worker` for the worker). Every environment **pulls** a
pre-built image — no staging/prod/demo server ever builds from source.

This mirrors the fleet-proven FRMS / Marine-Guardian setup. See the global rules:
`~/.claude/rules/deploy-discipline.md` and `~/.claude/rules/staging-refresh-gate.md`.

## The 4-tier model

| Env | COMPOSE_PROJECT_NAME | Traefik host (`APP_DOMAIN`) | Default image tag | Storage backend | Trigger |
|-----|----------------------|----------------------------|-------------------|-----------------|---------|
| **dev**  | `orqafy_dev`     | localhost (no Traefik)          | built from source     | MinIO/S3 (dev) or Telegram dev channel | local commit + rebuild |
| **demo** | `orqafy_demo`    | `orqafy-demo.powerbyte.app`     | `demo-latest`         | **MinIO/S3** (`STORAGE_BACKEND=s3`) | manual push |
| **staging** | `orqafy_staging` | `orqafy-staging.powerbyte.app` | `staging-latest`   | **Telegram** (`STORAGE_BACKEND=telegram`) | auto on push to `main` → data-first gate |
| **prod** | `orqafy_prod`    | `orqafy.powerbyte.app`          | `latest`              | **Telegram** (`STORAGE_BACKEND=telegram`) | manual push (owner word only) |

`APP_DOMAIN` is set per env in that stack's `.env.<env>` (gitignored / SOPS). The compose
Traefik router rule is `Host(\`${APP_DOMAIN}\`)`, so the host above is what you must set.
`STORAGE_BACKEND` is pinned in each env's compose `environment:` block; the `TELEGRAM_BOT_TOKEN`
and `TELEGRAM_DEFAULT_CHANNEL_ID` values come from Server-Setups (SOPS+age) via `.env.<env>` —
never hardcoded. Prod/staging use a shared media channel; dev uses its own dedicated channel.

## Natural-language deploy contract

| You say | What happens |
|---------|--------------|
| "commit changes" / "save this" | 🟢 **LOCAL ONLY** — commit + rebuild the dev container. Never pushes. |
| "push to staging" | 🟡 push `main` → CI (`docker-publish.yml`) builds + pushes `latest` + `staging-latest` + `sha-<short>`. Then **validate staging** deploys it (see below). |
| "validate staging" / "refresh staging" | run `bash deploy/staging-refresh-and-deploy.sh` — the **data-first gate**. |
| "push to demo" | 🟣 `bash deploy/compose/push-to-demo.sh [SOURCE_TAG]` (default `latest`). |
| "push to production" / "go live" | 🔴 `bash deploy/compose/push-to-prod.sh [SOURCE_TAG]` (default `staging-latest`). Explicit word only. |

## CI (`.github/workflows/docker-publish.yml`)

On push to `main` it **builds + pushes only** (web + worker), tags `latest`, `staging-latest`,
`sha-<short>`, `<branch>`. It does **not** auto-deploy any environment. Keep the staging Komodo
stack's `auto_update` **OFF** — staging is deployed only through the data-first gate so the
prod→staging refresh always runs before the new image + migrations. `demo` and `prod` tags are
minted only by the manual promotion scripts. Production is never auto-deployed.

## Staging data-first gate — `deploy/staging-refresh-and-deploy.sh`

Fixed order, data BEFORE image:

1. Backup staging DB (rollback point).
2. Refresh staging data **FROM PROD** (prod is READ-ONLY `pg_dump`; staging wiped + reloaded).
   Skipped automatically until an `orqafy_prod` stack exists (first-run).
3. Pull candidate images (web + worker) from Docker Hub — **after** the refresh.
4. `pnpm --filter @orqafy/db db:migrate:deploy` (with drift-resolve fallback) over an SSH tunnel.
5. Bring staging up on the new images (`app` + `worker`).
6. Poll `https://orqafy-staging.powerbyte.app/api/health` until `200`.

## Manual promotion scripts

- **`deploy/compose/push-to-demo.sh [SOURCE_TAG]`** — backup demo DB → promote `SOURCE_TAG`→`demo-latest`
  (web + worker registry manifest) → redeploy demo `app`+`worker` → **migrate deploy (NEVER reseed)** →
  health-check. Default `SOURCE_TAG=latest`.
- **`deploy/compose/push-to-prod.sh [SOURCE_TAG]`** — backup prod DB FIRST → promote `SOURCE_TAG`→`latest`
  + `prod-sha-<sha>` (web + worker) → redeploy prod `app`+`worker` → **migrate deploy (NEVER reseed)** →
  health-check. Default `SOURCE_TAG=staging-latest` (the verified build).

Both use SSH key `~/.ssh/powerbyte_hostinger` to `root@72.62.74.203` and expect the Komodo stack
dirs `/etc/komodo/stacks/orqafy-<env>` on the VPS. Rollback: set `APP_IMAGE_TAG=<...>-sha-<prev>`
in the stack `.env` and re-run `docker compose ... up -d app worker`.

## HARD HOLD

Every artifact here lands as **local commits only**. No staging/prod/demo deploy — and no live
Komodo stack creation — happens without the owner's explicit word (`deploy-discipline.md`).
