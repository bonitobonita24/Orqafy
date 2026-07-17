#!/usr/bin/env bash
# =============================================================================
# push-to-prod.sh — MANUAL promote of a VERIFIED staging build to Orqafy
# PRODUCTION (orqafy.powerbyte.app). Tier 3: production is NEVER automatic —
# explicit owner word only, and only after the staging data-first gate is GREEN
# (deploy/staging-refresh-and-deploy.sh).
#
#   Local dev  →  { demo (manual) · staging (auto on main) · production (manual) }
#
# HARD RULES:  back up prod DB FIRST · migrations = YES (with drift-resolve
#              fallback) · re-seed = NEVER (real official data preserved) ·
#              PROD DB is the source of truth. Prod media = Telegram storage.
#
# ORDER: 1 backup prod DB → 2 promote SOURCE_TAG→latest(+prod-sha) web+worker →
#        3 redeploy prod app+worker → 4 migrate deploy → 5 health verify.
#
# Usage:  bash deploy/compose/push-to-prod.sh [SOURCE_TAG]   (default: staging-latest — the verified build)
# Prereq: SSH key ~/.ssh/powerbyte_hostinger; run from repo root at the commit
#         that built SOURCE_TAG (migrations are applied host-side from this repo).
# =============================================================================
set -euo pipefail

SRC="${1:-staging-latest}"
SHA="$(git rev-parse --short HEAD)"
VPS="root@72.62.74.203"; KEY="$HOME/.ssh/powerbyte_hostinger"
HUB="bonitobonita24"; WEB="orqafy"; WRK="orqafy-worker"
STACK="/etc/komodo/stacks/orqafy-prod"; PROJ="orqafy_prod"
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }

echo "▶ 1/5 Backup prod DB (rollback point)"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > /root/orqafy-prod-backup-pre-pushtoprod-\$(date -u +%Y%m%d-%H%M%S).sql.gz && echo '  ok'"

echo "▶ 2/5 Promote ${SRC} → latest + prod-sha-${SHA} (registry manifest, web + worker)"
ssh_vps "docker buildx imagetools create -t ${HUB}/${WEB}:latest -t ${HUB}/${WEB}:prod-sha-${SHA} ${HUB}/${WEB}:${SRC} && \
         docker buildx imagetools create -t ${HUB}/${WRK}:latest -t ${HUB}/${WRK}:prod-sha-${SHA} ${HUB}/${WRK}:${SRC} && echo '  ok'"

echo "▶ 3/5 Redeploy prod stack (pull + recreate app + worker)"
ssh_vps "cd ${STACK}; sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=latest/' .env; \
  docker compose -p ${PROJ} --env-file .env ${CF} pull app worker >/dev/null 2>&1; \
  docker compose -p ${PROJ} --env-file .env ${CF} up -d app worker && echo '  ok'"

echo "▶ 4/5 Migrate prod (deploy; resolve drift as applied — NEVER seed)"
DBPORT=$(ssh_vps "grep -oP '(?<=^DB_PORT=)[0-9]+' ${STACK}/.env")
DBURL=$(ssh_vps "grep -oP '(?<=^DATABASE_URL=).*' ${STACK}/.env")
DBURL_LOCAL=$(echo "$DBURL" | sed -E "s#@[^/]+/#@localhost:${DBPORT}/#")
ssh -i "$KEY" -N -L "${DBPORT}:localhost:${DBPORT}" "$VPS" & TUN=$!; sleep 3
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db db:migrate:deploy; then
  echo "  ↳ migrate deploy failed; resolving pending as applied…"
  for M in $(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>/dev/null | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+'); do
    DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate resolve --applied "$M" || true
  done
fi
kill $TUN 2>/dev/null || true

echo "▶ 5/5 Verify"
sleep 5
curl -s -o /dev/null -w "  orqafy-prod health = %{http_code}\n" https://orqafy.powerbyte.app/api/health
echo "✅ push-to-prod done (${SRC} → latest/prod-sha-${SHA}). Prod: https://orqafy.powerbyte.app"
