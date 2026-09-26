#!/usr/bin/env bash
# =============================================================================
# push-to-prod.sh — MANUAL promote of a VERIFIED staging build to Orqafy
# PRODUCTION (orqafy.com). Tier 3: production is NEVER automatic —
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
# Prereq: SSH key ~/.ssh/powerbyte_ec2_komodo; THIS workstation logged in to Docker Hub with PUSH
#         scope (the latest/prod-sha retag runs here — EC2 is pull-only, ORQ-32); run from repo root at
#         (or after, deploy-tooling-only) the commit that built SOURCE_TAG (migrations run from this repo).
# Host:   ORQ-43 — prod migrated Hostinger → EC2-Komodo (ubuntu@18.138.220.90) on 2026-09-17. SSH user
#         `ubuntu` (docker group + passwordless sudo). The prod .env is ubuntu-owned mode 600, so .env
#         reads/writes and `docker compose` run bare. Backups → /home/ubuntu. The stopped Hostinger copy is
#         a cold standby only — never deploy to it. Host compose files are NOT copied by this script
#         (they carry certresolver=cloudflare + valkey --maxmemory; only APP_IMAGE_TAG/DEPLOYED_APP_SHA change).
# =============================================================================
set -euo pipefail

SRC="${1:-staging-latest}"
# ORQ-43: when SOURCE_TAG is an immutable CI tag (sha-XXXXXXX), pin prod-sha-* to THAT sha, so the
# ORQ-24 pairing key names the image actually shipped (HEAD may be a later deploy-tooling-only commit).
if [[ "$SRC" =~ ^sha-([0-9a-f]{7,40})$ ]]; then SHA="${BASH_REMATCH[1]}"; else SHA="$(git rev-parse --short HEAD)"; fi
VPS="ubuntu@18.138.220.90"; KEY="$HOME/.ssh/powerbyte_ec2_komodo"; BACKUP_DIR="/home/ubuntu"
HUB="bonitobonita24"; WEB="orqafy"; WRK="orqafy-worker"
STACK="/etc/komodo/stacks/orqafy-prod"; PROJ="orqafy_prod"
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }

echo "▶ 1/5 Backup prod DB (coupled-rollback point — ORQ-24)"
# ORQ-24: name the pre-promotion backup with the OUTGOING deployed sha so `rollback prod <that-tag>`
# (deploy/rollback.sh) can find and restore the DB state that pairs with the image it rolls back to.
# The outgoing sha is the prod-sha-* tag recorded in .env as DEPLOYED_APP_SHA by the PREVIOUS deploy
# (step 3 below writes it). First-ever deploy has none → 'bootstrap' (nothing earlier to roll back to).
OUTGOING_SHA="$(ssh_vps "grep -oP '(?<=^DEPLOYED_APP_SHA=).*' ${STACK}/.env 2>/dev/null || true")"
OUTGOING_SHA="${OUTGOING_SHA:-bootstrap}"
echo "  outgoing=${OUTGOING_SHA}  incoming=prod-sha-${SHA}  → backup tagged for the OUTGOING sha"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > ${BACKUP_DIR}/orqafy-prod-backup-pre-promotion-${OUTGOING_SHA}-\$(date -u +%Y%m%d-%H%M%S).sql.gz && \
  ls -1t ${BACKUP_DIR}/orqafy-prod-backup-pre-promotion-${OUTGOING_SHA}-*.sql.gz | head -1 && echo '  ok'"

echo "▶ 2/5 Promote ${SRC} → latest + prod-sha-${SHA} (registry manifest, web + worker) — retag runs LOCALLY"
# ORQ-32/43: imagetools create needs Docker Hub PUSH scope; EC2 is intentionally pull-only, so the
# retag runs on THIS workstation. EC2 only pulls (step 3).
retag_local(){  # $1 = repo name
  if ! docker buildx imagetools create -t "${HUB}/$1:latest" -t "${HUB}/$1:prod-sha-${SHA}" "${HUB}/$1:${SRC}"; then
    echo "  ✗ retag of ${HUB}/$1:${SRC} → :latest/:prod-sha-${SHA} failed from this workstation (docker login with"
    echo "     PUSH scope? does ${HUB}/$1:${SRC} exist?). Prod NOT touched beyond the step-1 backup. Do NOT move"
    echo "     this step onto EC2 — that box is pull-only."
    exit 1
  fi
}
retag_local "$WEB"
retag_local "$WRK"
echo "  ok (retagged from workstation; EC2 pull-only)"

echo "▶ 3/5 Redeploy prod stack (pull + recreate app + worker)"
# ORQ-24: also record the now-current deployed sha (prod-sha-${SHA}) in .env as DEPLOYED_APP_SHA so
# the NEXT deploy names its pre-promotion backup for THIS sha (the coupled-rollback pairing key).
# ORQ-43: pull FIRST and abort on failure, so DEPLOYED_APP_SHA is only rewritten once the new image is local.
ssh_vps "cd ${STACK}; sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=latest/' .env; \
  docker compose -p ${PROJ} --env-file .env ${CF} pull app worker >/dev/null 2>&1 || { echo '  ✗ pull failed — prod left on its running containers'; exit 1; }; \
  if grep -q '^DEPLOYED_APP_SHA=' .env; then sed -i 's/^DEPLOYED_APP_SHA=.*/DEPLOYED_APP_SHA=prod-sha-${SHA}/' .env; else echo 'DEPLOYED_APP_SHA=prod-sha-${SHA}' >> .env; fi; \
  docker compose -p ${PROJ} --env-file .env ${CF} up -d app worker && echo '  ok'"

echo "▶ 4/5 Migrate prod (deploy; resolve drift as applied — NEVER seed)"
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
DBURL_LOCAL=$(echo "$DBURL" | sed -E "s#@[^/]+/#@localhost:${LPORT}/#")
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db db:migrate:deploy; then
  echo "  ↳ migrate deploy failed; resolving pending as applied…"
  for M in $(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>/dev/null | grep -oE '[0-9]{14}_[a-zA-Z0-9_]+'); do
    DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate resolve --applied "$M" || true
  done
fi
kill $TUN 2>/dev/null || true

echo "▶ 5/5 Verify (poll prod health until 200 — a large deploy needs longer than a single check)"
HEALTH_URL="https://orqafy.com/api/health"
code=000
for i in $(seq 1 24); do              # up to 24×5s = 120s
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo 000)
  [ "$code" = "200" ] && { echo "  orqafy-prod health = 200 (healthy after $((i*5))s)"; break; }
  printf "  … attempt %d/24: health=%s — waiting 5s\n" "$i" "$code"
  sleep 5
done
if [ "$code" != "200" ]; then
  echo "  ⚠ orqafy-prod health = ${code} after 120s — NOT confirmed healthy."
  echo "     Inspect: ssh ${VPS} 'docker compose -p ${PROJ} logs --tail=80 app'"
fi
echo "✅ push-to-prod done (${SRC} → latest/prod-sha-${SHA}). Prod: https://orqafy.com"
