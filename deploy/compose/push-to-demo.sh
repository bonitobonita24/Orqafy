#!/usr/bin/env bash
# =============================================================================
# push-to-demo.sh — MANUAL promote of a chosen build to the Orqafy client DEMO
# stack (demo.orqafy.com). Model B: the demo is a deliberate-push
# environment, NOT auto-deploy.
#
#   Local dev  →  { demo (manual) · staging (auto on main) · production (manual) }
#
# HARD RULES:  migrations = YES (with drift-resolve fallback) · re-seed = NEVER
#              (curated demo data is preserved). Demo stays on MinIO/S3 storage.
#
# Promotes BOTH images (web + worker) so app and worker move together.
#
# Usage:  bash deploy/compose/push-to-demo.sh [SOURCE_TAG]   (default: latest — Hub)
# Prereq: SSH key ~/.ssh/powerbyte_hostinger; run from repo root at the commit
#         that built SOURCE_TAG (migrations are applied host-side from this repo).
# =============================================================================
set -euo pipefail

SRC="${1:-latest}"
VPS="root@72.62.74.203"; KEY="$HOME/.ssh/powerbyte_hostinger"
HUB="bonitobonita24"; WEB="orqafy"; WRK="orqafy-worker"
STACK="/etc/komodo/stacks/orqafy-demo"; PROJ="orqafy_demo"
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
ssh_vps(){ ssh -o ConnectTimeout=15 -i "$KEY" "$VPS" "$@"; }

echo "▶ 1/5 Backup demo DB"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > /root/orqafy-demo-backup-pre-pushtodemo-\$(date -u +%Y%m%d-%H%M%S).sql.gz && echo '  ok'"

echo "▶ 2/5 Promote ${SRC} → demo-latest (registry manifest, web + worker)"
ssh_vps "docker buildx imagetools create -t ${HUB}/${WEB}:demo-latest ${HUB}/${WEB}:${SRC} && \
         docker buildx imagetools create -t ${HUB}/${WRK}:demo-latest ${HUB}/${WRK}:${SRC} && echo '  ok'"

echo "▶ 3/5 Redeploy demo stack (pull + recreate app + worker)"
ssh_vps "cd ${STACK}; sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=demo-latest/' .env; \
  docker compose -p ${PROJ} --env-file .env ${CF} pull app worker >/dev/null 2>&1; \
  docker compose -p ${PROJ} --env-file .env ${CF} up -d app worker && echo '  ok'"

echo "▶ 4/5 Migrate (deploy; resolve drift as applied — NEVER seed)"
DBPORT=$(ssh_vps "grep -oP '(?<=^DB_PORT=)[0-9]+' ${STACK}/.env")
DBURL=$(ssh_vps "grep -oP '(?<=^DATABASE_URL=).*' ${STACK}/.env")
# ORQ-17: open the migration tunnel on a DEDICATED high LOCAL port, decoupled from
# the remote ${DBPORT}. Binding local==remote let a local container already
# publishing ${DBPORT} hijack the bind — ssh -N stayed alive, migrate hit the WRONG
# local DB, and the script still printed success (remote left un-migrated).
# ExitOnForwardFailure=yes makes a failed bind FATAL; we probe a small port range
# and abort loudly rather than ever migrate the wrong database.
TUN=""; LPORT=""
for CAND in 15439 15440 15441 15442 15443; do
  ssh -o ConnectTimeout=20 -o ExitOnForwardFailure=yes -i "$KEY" -N -L "${CAND}:localhost:${DBPORT}" "$VPS" &
  _pid=$!; sleep 3
  if kill -0 "$_pid" 2>/dev/null; then TUN=$_pid; LPORT=$CAND; break; fi
  wait "$_pid" 2>/dev/null || true
done
if [ -z "$TUN" ]; then
  echo "  ✗ ORQ-17: could not bind a local DB tunnel (tried 15439-15443). Aborting BEFORE migrate to avoid touching the wrong database."; exit 1
fi
echo "  ↳ tunnel up on localhost:${LPORT} → ${VPS}:${DBPORT}"
# Rewrite the host authority (single '@' — base64 pwd has no '@') to the tunnel; port-agnostic.
DBURL_LOCAL=$(echo "$DBURL" | sed -E "s#@[^/]+/#@localhost:${LPORT}/#")
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db db:migrate:deploy; then
  echo "  ↳ migrate failed (physical schema likely present); resolving pending as applied…"
  for M in $(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>/dev/null | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+'); do
    DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate resolve --applied "$M" || true
  done
fi
kill $TUN 2>/dev/null || true

echo "▶ 5/5 Verify (poll demo health until 200 — a fresh recreate needs longer than a single check; ORQ-22)"
HEALTH_URL="https://demo.orqafy.com/api/health"
code=000
for i in $(seq 1 24); do              # up to 24×5s = 120s
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo 000)
  [ "$code" = "200" ] && { echo "  orqafy-demo health = 200 (healthy after $((i*5))s)"; break; }
  printf "  … attempt %d/24: health=%s — waiting 5s\n" "$i" "$code"
  sleep 5
done
if [ "$code" != "200" ]; then
  echo "  ⚠ orqafy-demo health = ${code} after 120s — NOT confirmed healthy."
  echo "     Inspect: ssh ${VPS} 'docker compose -p ${PROJ} logs --tail=80 app'"
fi
echo "✅ push-to-demo done. Demo: https://demo.orqafy.com (admin@demo.com)"

# Rule 39 — keep local dev fresh after a demo ship (app + worker).
bash "$(dirname "$0")/ensure-dev-fresh.sh" || true
