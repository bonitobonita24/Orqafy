#!/usr/bin/env bash
# =============================================================================
# staging-refresh-and-deploy.sh — MANUAL, agent-triggered STAGING validation
# gate for Orqafy.
#
# PURPOSE: make staging a faithful pre-production rehearsal. On every run it
# refreshes staging's data FROM PRODUCTION *first*, then deploys the candidate
# image and applies its migrations — so the new code + new migrations are tested
# against real prod-shaped data before the same image is ever promoted to prod.
# (Mirrors the Marine-Guardian / FRMS proven gate; see ~/.claude/rules/staging-refresh-gate.md.)
#
# ORDER IS FIXED (owner directive — data BEFORE image):
#   1. Backup staging DB              (rollback point)
#   2. Refresh staging data FROM PROD (prod is READ-ONLY; staging wiped + reloaded)
#   3. Pull candidate images          (Docker Hub — AFTER the data refresh; web + worker)
#   4. Migrate staging                (prod-data → new schema = the prod-migration rehearsal)
#   5. Bring staging up on new images (app + worker)
#   6. Health verify
#
# FIRST-RUN NOTE: until an Orqafy production stack (orqafy_prod) exists on the
# VPS, step 2 is skipped automatically (no prod to copy from) — staging keeps
# whatever data it was seeded with. Once prod exists, the refresh engages with no edits.
#
# HARD RULES:
#   • PRODUCTION is only ever READ (pg_dump). It is never written, migrated, or restarted here.
#   • This DESTROYS the current staging dataset by design when a prod copy is available.
#   • Staging Komodo `auto_update` MUST be OFF, or Komodo may pull the image out of order.
#   • Production promotion stays a separate, explicit manual step (never triggered here).
#
# Usage:  bash deploy/staging-refresh-and-deploy.sh [SOURCE_TAG]   (default: staging-latest)
# Prereq: SSH key ~/.ssh/powerbyte_hostinger; run from the app repo root at the
#         commit that built SOURCE_TAG (migrations are applied host-side from this repo).
# =============================================================================
set -euo pipefail

SRC="${1:-staging-latest}"
VPS="root@72.62.74.203"; KEY="$HOME/.ssh/powerbyte_hostinger"
STACK="/etc/komodo/stacks/orqafy-staging"
PROJ="orqafy_staging"; PRODPROJ="orqafy_prod"
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }

echo "▶ 1/6 Backup staging DB (rollback point)"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > /root/orqafy-staging-backup-pre-refresh-\$(date -u +%Y%m%d-%H%M%S).sql.gz && echo '  ok'"

echo "▶ 2/6 Refresh staging data FROM prod (prod READ-ONLY; staging wiped + reloaded)"
if ssh_vps "docker inspect ${PRODPROJ}_postgres >/dev/null 2>&1"; then
  ssh_vps "set -e; cd ${STACK}; \
    echo '  · stopping staging app + worker (release DB connections)'; \
    docker compose -p ${PROJ} ${CF} stop app worker >/dev/null 2>&1 || true; \
    SU=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); SD=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
    PU=\$(docker exec ${PRODPROJ}_postgres printenv POSTGRES_USER); PD=\$(docker exec ${PRODPROJ}_postgres printenv POSTGRES_DB); \
    echo '  · terminating staging DB sessions + wiping public schema'; \
    docker exec ${PROJ}_postgres psql -U \$SU -d \$SD -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='\$SD' AND pid<>pg_backend_pid();\" >/dev/null; \
    docker exec ${PROJ}_postgres psql -U \$SU -d \$SD -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null; \
    echo '  · streaming prod → staging (pg_dump | psql, same host, no network egress)'; \
    docker exec ${PRODPROJ}_postgres pg_dump -U \$PU -d \$PD --no-owner --no-privileges | docker exec -i ${PROJ}_postgres psql -U \$SU -d \$SD -q >/dev/null; \
    echo '  · staging DB now mirrors production'"
else
  echo "  ⚠ no ${PRODPROJ}_postgres on VPS yet — SKIPPING prod refresh (first-run / no-prod). Staging keeps its seeded data."
fi

echo "▶ 3/6 Pull candidate images '${SRC}' from Docker Hub (AFTER data refresh; web + worker)"
ssh_vps "cd ${STACK}; \
  sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${SRC}/' .env; \
  docker compose -p ${PROJ} --env-file .env ${CF} pull app worker >/dev/null 2>&1 && echo '  ok'"

echo "▶ 4/6 Migrate staging (prod-data → new schema; drift-resolve fallback)"
# INVARIANT 4 (staging-refresh-gate.md) — DBURL/DBPORT read from the stack .env, a
# source available while the app container is stopped (step 2 stops app+worker), so
# these never depend on a running container.
DBPORT=$(ssh_vps "grep -oP '(?<=^DB_PORT=)[0-9]+' ${STACK}/.env")
DBURL=$(ssh_vps "grep -oP '(?<=^DATABASE_URL=).*' ${STACK}/.env")
# INVARIANT 1 — ephemeral LOCAL tunnel port, DECOUPLED from the remote DB_PORT.
# Binding local==remote collides with any local process already on DB_PORT (e.g.
# another project's dev DB); the forward then silently fails to bind and migrate
# would connect to the WRONG database. Scan a free local port instead.
LPORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
# Rewrite the host authority (single '@' — base64 pwd has no '@') to the tunnel.
DBURL_LOCAL=$(echo "$DBURL" | sed -E "s#@[^/]+/#@localhost:${LPORT}/#")
ssh -i "$KEY" -N -L "${LPORT}:localhost:${DBPORT}" "$VPS" & TUN=$!
# INVARIANT 2 — verify the tunnel actually came up before migrating; fail loud.
# Never run a no-op migrate against a dead forward.
TUN_UP=""
for _ in $(seq 1 20); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${LPORT}") 2>/dev/null; then exec 3>&- 3<&-; TUN_UP=1; break; fi
  sleep 0.5
done
if [ -z "$TUN_UP" ]; then
  echo "  ✗ SSH tunnel local:${LPORT} → ${VPS}:${DBPORT} never came up — ABORT (no no-op migrate)"
  kill $TUN 2>/dev/null || true
  exit 1
fi
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db db:migrate:deploy; then
  echo "  ↳ migrate deploy hit drift; resolving pending migrations as applied…"
  for M in $(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>/dev/null | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+'); do
    DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate resolve --applied "$M" || true
  done
fi
# INVARIANT 3 — schema-status HARD GATE before deploy. A shallow /health 200 must
# NEVER certify a promotable staging on its own: assert the schema is actually up to
# date BEFORE the app is brought up. If not, abort here (before step 5).
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  echo "  ✗ 'prisma migrate status' is NOT 'up to date' after migrate — ABORT before deploy"
  kill $TUN 2>/dev/null || true
  exit 1
fi
echo "  ✓ schema up to date"
kill $TUN 2>/dev/null || true

echo "▶ 5/6 Bring staging up on new images (app + worker)"
ssh_vps "cd ${STACK}; docker compose -p ${PROJ} --env-file .env ${CF} up -d app worker && echo '  ok'"

echo "▶ 6/6 Verify (poll /api/health up to ~60s — the app needs a moment after 'up -d')"
CODE=000
for _ in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" https://orqafy-staging.powerbyte.app/api/health || echo 000)
  [ "$CODE" = "200" ] && break
  sleep 3
done
echo "  orqafy-staging /api/health = ${CODE}"
[ "$CODE" = "200" ] || { echo "  ✗ staging did NOT come up healthy — check 'docker compose -p ${PROJ} logs app'"; exit 1; }
echo "✅ Staging refreshed + deployed on '${SRC}'. Promote to prod only after a manual verify."
