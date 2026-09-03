#!/usr/bin/env bash
# ⚠ HARD HOLD — generated LOCALLY only. This is an INFRA-LEVEL script — install it as a host
# cron job or a Komodo scheduled action per the README, do NOT wire it as an in-app scheduler.
# Do not install the cron/scheduled-action trigger without the owner's explicit word.
#
# ⚙ GENERATED from Powerbyte-AIEF/cicd-gen/demo-reset.sh.template via `cicd-gen`.
# Prefer editing the template + re-running the generator over hand-patching this copy.
#
# demo-reset.sh — DEMO SELF-HEAL. Runs on a schedule (host cron / Komodo scheduled action —
# NOT an in-app job, so it still runs even if the app itself is broken) to auto-restore a
# messed-up demo from a deliberately-BLESSED GOLDEN baseline (never the rolling operational
# backup, which could faithfully restore an already-broken state). Standard:
# ~/.claude/rules/cicd-standard.md §"Demo — deliberate-push env + SELF-HEAL".
#
# Steps: (a) skip if a pause flag is present (e.g. before a scheduled client demo) →
# (b) back up current state first (rolling backup, rollback point only) →
# (c) restore the BLESSED GOLDEN snapshot — DB + MinIO media bucket (demo-bless-golden.sh
#     is what creates that golden baseline; media-storage-default.md: demo stays on MinIO) →
# (d) `prisma migrate deploy` + drift-resolve (an older golden landing on a newer schema is
#     expected — NEVER reseed) → (e) health-check the demo stack ONLY.
#
# Usage:  bash deploy/demo-reset.sh          (intended to be invoked by cron/Komodo, not by hand)
# Prereq: SSH key $HOME/.ssh/powerbyte_hostinger; run from the app repo root (so the DB package/migrate script match
#         the golden's expected schema baseline as closely as possible).
set -euo pipefail

VPS="root@72.62.74.203"; KEY="$HOME/.ssh/powerbyte_hostinger"
STACK="/etc/komodo/stacks/orqafy-demo"; PROJ="orqafy_demo"
# Orqafy runs app + worker together — both stop before the golden restore and come back after.
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
SERVICES="app worker"
GOLDEN="/root/golden/orqafy-demo"
PAUSE_FLAG="${STACK}/.pause-reset"
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }

echo "▶ 0/5 Check pause flag (${PAUSE_FLAG})"
if ssh_vps "[ -f '${PAUSE_FLAG}' ]"; then
  echo "  ⏸ pause flag present — skipping this reset cycle (create/remove it with:"
  echo "    ssh -i ${KEY} ${VPS} \"touch ${PAUSE_FLAG}\"   # pause"
  echo "    ssh -i ${KEY} ${VPS} \"rm -f ${PAUSE_FLAG}\"    # resume)"
  exit 0
fi

echo "▶ 1/5 Back up current demo state first (rolling backup — rollback point, NOT golden)"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > /root/orqafy-demo-rolling-backup-\$(date -u +%Y%m%d-%H%M%S).sql.gz && echo '  ok'"

echo "▶ 2/5 Restore BLESSED GOLDEN snapshot (DB + MinIO) from ${GOLDEN}"
if ! ssh_vps "[ -f '${GOLDEN}/db.sql.gz' ]"; then
  echo "  ✗ no golden DB snapshot at ${GOLDEN}/db.sql.gz — has demo-bless-golden.sh ever run?"
  echo "    aborting reset (demo left untouched)."
  exit 1
fi
echo "  · stopping ${SERVICES}"
ssh_vps "cd ${STACK}; docker compose -p ${PROJ} ${CF} stop ${SERVICES} >/dev/null 2>&1 || true"
echo "  · restoring golden DB"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres psql -U \$U -d \$D -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='\$D' AND pid<>pg_backend_pid();\" >/dev/null; \
  docker exec ${PROJ}_postgres psql -U \$U -d \$D -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null; \
  gunzip -c '${GOLDEN}/db.sql.gz' | docker exec -i ${PROJ}_postgres psql -U \$U -d \$D -q >/dev/null && echo '  ok'"
echo "  · restoring golden MinIO media (media-storage-default.md: demo stays on MinIO)"
ssh_vps "if [ -d '${GOLDEN}/minio' ]; then \
    docker run --rm --network ${PROJ}_network -v '${GOLDEN}/minio:/backup' --entrypoint sh minio/mc:latest -c \
      \"mc alias set demo http://${PROJ}_minio:9000 \\\$(docker exec ${PROJ}_minio printenv MINIO_ROOT_USER) \\\$(docker exec ${PROJ}_minio printenv MINIO_ROOT_PASSWORD) >/dev/null && mc mirror --overwrite --remove /backup demo/orqafy\" \
    && echo '  ok'; \
  else echo '  ⚠ no golden MinIO dir — skipping media restore (DB-only reset)'; fi"

echo "▶ 3/5 Bring demo back up (pre-migrate, so migrate can run against a live DB container)"
ssh_vps "cd ${STACK}; docker compose -p ${PROJ} --env-file .env ${CF} up -d postgres"
sleep 5

echo "▶ 4/5 Migrate (deploy; resolve drift as applied — NEVER reseed; golden may be older than HEAD's schema)"
DBPORT=$(ssh_vps "grep -oP '(?<=^DB_PORT=)[0-9]+' ${STACK}/.env")
# ORQ-17: dedicated high LOCAL port, decoupled from remote ${DBPORT}, ExitOnForwardFailure=yes fatal —
# never migrate the WRONG database because a local container hijacked the bind (migrate would print
# success while the demo stayed un-migrated).
TUN=""; LPORT=""
for CAND in 15439 15440 15441 15442 15443; do
  ssh -o ConnectTimeout=20 -o ExitOnForwardFailure=yes -i "$KEY" -N -L "${CAND}:localhost:${DBPORT}" "$VPS" &
  _pid=$!; sleep 3
  if kill -0 "$_pid" 2>/dev/null; then TUN=$_pid; LPORT=$CAND; break; fi
  wait "$_pid" 2>/dev/null || true
done
if [ -z "$TUN" ]; then
  echo "  ✗ ORQ-17: could not bind a local DB tunnel (tried 15439-15443) — aborting (demo DB restored but NOT migrated/up)."; exit 1
fi
DBURL_LOCAL=$(ssh_vps "grep -oP '(?<=^INTERNAL_DATABASE_URL=).*' ${STACK}/.env" | sed -E "s#@[^/]+/#@localhost:${LPORT}/#")
if ! DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db db:migrate:deploy; then
  echo "  ↳ migrate hit drift; resolving pending migrations as applied…"
  for M in $(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>/dev/null | grep -oE '[0-9]{14}_[a-z_]+'); do
    DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate resolve --applied "$M" || true
  done
fi
kill $TUN 2>/dev/null || true

echo "▶ 5/5 Bring the rest of the demo stack up + health-check (demo stack ONLY)"
ssh_vps "cd ${STACK}; docker compose -p ${PROJ} --env-file .env ${CF} up -d ${SERVICES}"
HEALTH_URL="https://demo.orqafy.com/api/health"
CODE=000
for i in $(seq 1 24); do              # up to 24×5s = 120s (ORQ-22)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || echo 000)
  [ "$CODE" = "200" ] && { echo "  demo.orqafy.com/api/health = 200 (healthy after $((i*5))s)"; break; }
  printf "  … attempt %d/24: health=%s — waiting 5s\n" "$i" "$CODE"
  sleep 5
done
[ "$CODE" = "200" ] && echo "✅ demo-reset complete — restored from golden, HEALTHY." \
  || { echo "⚠ demo came up but health = ${CODE} after 120s — check 'docker logs ${PROJ}_app'."; exit 1; }
