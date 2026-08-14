#!/usr/bin/env bash
# =============================================================================
# ensure-dev-fresh.sh — Rule 39 (Dev-Freshness) coupling.
#
# Invoked at the END of every staging / prod / demo ship so local dev never
# serves staler code than a shipped environment. A dev stack serves a PREBUILT
# image with no source bind-mount, so code only appears on REBUILD; a ship
# recreates the target env but never touches dev — leaving dev silently stale
# while `main` is already current.
#
# Behaviour (ADVISORY, never blocks — mirrors ~/.claude/rules/deploy-discipline.md
# "Dev leads every environment" + Rule 39):
#   • dev not running OR already fresh  → no-op, report, exit 0
#   • dev code container BEHIND main    → rebuild dev APP *and* WORKER off source
#
# The app and worker are SEPARATE dev compose files; an app-only `--build`
# leaves the worker stale (the exact Rule 39 footgun), so both are rebuilt.
#
# Local-only. Never pushes, deploys, or touches a remote host. Always exits 0
# (a post-ship dev-rebuild hiccup must not falsely fail an already-done ship).
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0

ENV_FILE=.env.dev
BASE=deploy/compose/dev

echo ""
echo "── Rule 39: ensuring local dev is fresh after ship ──"

if [ ! -f "$ENV_FILE" ]; then
  echo "  ⚠ $ENV_FILE not found — skipping dev-freshness coupling (dev never set up here?)"
  exit 0
fi

# dev-freshness-check.sh: exit 0 = fresh OR no dev code container running; exit 2 = behind main.
if bash scripts/dev-freshness-check.sh . 2>&1 | sed 's/^/  /'; then
  echo "  ✓ local dev is fresh (or not running) — nothing to rebuild"
  exit 0
fi

echo "  ⚠ local dev is BEHIND main — rebuilding dev APP + WORKER off $(git rev-parse --short HEAD)…"
DC="docker compose --env-file $ENV_FILE"
if ! $DC -f "$BASE/docker-compose.app.yml" up --build -d; then
  echo "  ✗ dev APP rebuild failed — rebuild manually: bash deploy/compose/start.sh dev up -d"
  exit 0
fi
# The worker's depends_on names postgres + valkey, which are DEFINED in the db/cache
# compose files — so `-f docker-compose.worker.yml` alone is an invalid compose project
# ("undefined service valkey"). Include the defining files and target only `worker`
# with --no-deps (infra is already up whenever dev is BEHIND, i.e. running-but-stale).
WORKER_FILES=(-f "$BASE/docker-compose.db.yml" -f "$BASE/docker-compose.cache.yml" -f "$BASE/docker-compose.worker.yml")
if ! $DC "${WORKER_FILES[@]}" up --build -d --no-deps worker; then
  echo "  ✗ dev WORKER rebuild failed — rebuild manually:"
  echo "     docker compose --env-file $ENV_FILE ${WORKER_FILES[*]} up --build -d --no-deps worker"
  exit 0
fi
echo "  ✓ dev rebuilt (app + worker). Re-checking freshness:"
bash scripts/dev-freshness-check.sh --report-only . 2>&1 | sed 's/^/  /' || true
exit 0
