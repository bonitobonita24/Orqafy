# Deploy compose reconciliation — repo `deploy/compose/{stage,demo}` vs live VPS stacks

**Status:** decision-ready (plan only — NOT yet applied). Authored 2026-07-19 during the Full-Auto run.
**Why not applied yet:** a repo-compose rewrite is **unverifiable without an actual deploy** (HARD HOLD),
and its correct target shape depends on an owner deploy-model decision (see "The one [WHAT]" below).
This file records the exact, ground-truthed divergence so the rewrite becomes a well-scoped, owner-visible change.

## How the divergence arose
The demo + staging stacks were stood up **manually** (mirroring the proven frms-demo layout) because the
repo compose **would not have deployed as-is** (relative `env_file` path to repo root, cross-file
`depends_on`, no internal DB URL override). The live stacks under `/etc/komodo/stacks/orqafy-{staging,demo}/`
are therefore the **working reference**; the repo compose is the drifted/aspirational copy.

## Ground-truthed divergence (identical pattern in BOTH staging & demo)

| Aspect | REPO compose (`deploy/compose/{stage,demo}`) | LIVE stack (`/etc/komodo/stacks/orqafy-*`) | Reconcile → |
|---|---|---|---|
| `env_file` | `../../../.env.{staging,demo}` (up to repo root) | `.env` (co-located in stack dir) | repo → `.env` |
| app/worker `DATABASE_URL` | not overridden (relies on env_file) | explicit `DATABASE_URL: ${INTERNAL_DATABASE_URL}` | add override |
| pgbouncer | present in `db.yml` (+ volume) | **absent** | drop from db.yml |
| pgadmin | present (`docker-compose.pgadmin.yml`) | **absent** | drop file from deployed set |
| Traefik router names | templated `${COMPOSE_PROJECT_NAME}_app` | **hardcoded** `orqafy_staging_app` / `orqafy_demo_app` | see caveat below |
| Traefik network label | (none) | `traefik.docker.network=proxy` | add label |
| `STORAGE_BACKEND` | list form `- STORAGE_BACKEND=telegram` | map form `STORAGE_BACKEND: telegram` | cosmetic (both valid) |
| app/worker default image tag | `${APP_IMAGE_TAG:-staging-latest}` (stage) | ⚠ `${APP_IMAGE_TAG:-demo-latest}` in the **staging** stack | fix live stack, see finding |

Storage backend value itself is correct per env: **staging = telegram**, **demo = s3** (matches the
fleet media-storage default: demo stays MinIO/S3, non-demo on Telegram).

## ⚠ Finding — latent default-tag footgun (live staging stack)
The **staging** stack's `docker-compose.{app,worker}.yml` was copied from the demo stack and its
`APP_IMAGE_TAG` **default fallback was never changed** — it still reads `:${APP_IMAGE_TAG:-demo-latest}`.
It is harmless today only because `orqafy-staging/.env` sets `APP_IMAGE_TAG` explicitly (verified: the
correct `dev-sha-e8fbb72` images are running). But if that env var were ever unset/blanked, staging would
silently pull **demo-latest** — a wrong-environment image. Fix in the live stack files (owner-gated edit):
`sed -i 's/APP_IMAGE_TAG:-demo-latest/APP_IMAGE_TAG:-staging-latest/'` on both files, then re-`up`.
(Recorded as global lesson `deploy.compose.copied-stack-kept-source-default-image-tag`.)

## The one [WHAT] (owner decision — blocks the repo rewrite direction)
When CI/auto-staging is eventually wired, **what consumes the compose?**
- **(a)** Komodo keeps deploying the hand-placed `/etc/komodo/stacks/*` files → repo compose should become a
  **verbatim mirror** of the live layout (hardcoded traefik names, co-located `.env`, no pgbouncer/pgadmin).
- **(b)** A deploy script/CI **materializes** the stack files from the repo compose → repo compose should be
  the **canonical templated** version and the generator handles env_file placement + label interpolation.
The correct target for the Traefik router names (templated vs hardcoded) depends on this: the live stack
hardcoded them, likely because `COMPOSE_PROJECT_NAME` did not interpolate reliably in labels — **untested here**.

## Caveat — why not just rewrite now
Every item above changes **how a real deploy behaves**, and none can be exercised under HARD HOLD (no deploy).
Reintroducing templated Traefik router names could re-break the exact thing the manual layout worked around.
Apply this reconciliation as a deliberate, owner-approved change alongside the CI-wiring decision — not blind.
