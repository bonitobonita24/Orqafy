#!/usr/bin/env bash
# ⚠ HARD HOLD — generated LOCALLY only. Running this against staging/prod is a deploy action
# gated by ~/.claude/rules/deploy-discipline.md — only run on the owner's explicit word.
#
# ⚙ GENERATED from Powerbyte-AIEF/cicd-gen/rollback.sh.template via `cicd-gen`.
# Prefer editing the template + re-running the generator over hand-patching this copy.
#
# rollback.sh — couples IMAGE + SCHEMA rollback (never image-only — that leaves a footgun:
# old code running against a newer, migrated schema). Standard: ~/.claude/rules/cicd-standard.md
# §"Rollback — MUST couple image + schema".
#
# Preference is ALWAYS fix-forward over rolling back. This script exists for the rare case
# a bad promotion must be undone immediately. It:
#   1. Locates the paired pre-promotion backup for the target sha
#      (naming convention: orqafy-<env>-backup-pre-promotion-<deploy-tag>-<timestamp>.sql.gz).
#      ORQ-24: for PROD, <deploy-tag> is the immutable `prod-sha-<SHA>` image tag — push-to-prod.sh
#      records the live one in .env as DEPLOYED_APP_SHA and names each pre-promotion backup with the
#      OUTGOING sha, so `rollback prod prod-sha-<OUTGOING>` restores the DB state that pairs with that
#      image. STAGING has no sha-pinned promotion (it deploys the moving staging-latest and is wiped+
#      refreshed from prod each run) → its coupled path won't find a paired dump and takes the safe
#      GUARDRAIL below. (Demo is not rollback-managed — it self-heals via demo-reset.sh.)
#   2. If found: re-tags the image back AND restores that dump, behind an explicit
#      interactive "this discards data written since promotion" confirmation.
#   3. If NOT found: refuses to touch the schema — falls back to the GUARDRAIL, i.e. it
#      checks `prisma migrate status`; if the live schema has advanced past what the
#      target image expects, it refuses the image-only rollback (that combination is the
#      exact "old code on new schema" footgun) and tells you to fix forward instead.
#
# Usage:  bash deploy/rollback.sh <staging|prod> <deploy-tag>   (prod deploy-tag = prod-sha-XXXXXXX)
# Prereq: run from the app repo root at (or near) the target commit, so the DB package + migrate script
#         below match what that sha expects. The SSH host/key are PER-ENV (ORQ-25): staging → EC2-Komodo
#         key ~/.ssh/powerbyte_ec2_komodo (ubuntu); prod → Hostinger key ~/.ssh/powerbyte_hostinger (root).
set -euo pipefail

ENVIRON="${1:?Usage: bash deploy/rollback.sh <staging|prod> <sha-XXXXXXX>}"
TARGET_SHA="${2:?Usage: bash deploy/rollback.sh <staging|prod> <sha-XXXXXXX>}"
# ORQ-25: host is PER-ENV. staging runs on EC2-Komodo (SSH user `ubuntu`, docker group + passwordless
# sudo; the stack .env is root-owned so .env WRITES go through $SUDO; backups live under /home/ubuntu).
# prod stays on Hostinger (SSH user root: $SUDO empty, backups under /root). docker compose / .env reads
# stay bare on BOTH (prod is root; staging .env is world-readable).
case "$ENVIRON" in
  staging) VPS="ubuntu@18.138.220.90"; KEY="$HOME/.ssh/powerbyte_ec2_komodo"; SUDO="sudo"; BACKUP_DIR="/home/ubuntu"
           STACK="/etc/komodo/stacks/orqafy-staging"; PROJ="orqafy_staging"; DOMAIN="staging.orqafy.com" ;;
  prod)    VPS="root@72.62.74.203";    KEY="$HOME/.ssh/powerbyte_hostinger"; SUDO="";     BACKUP_DIR="/root"
           STACK="/etc/komodo/stacks/orqafy-prod";     PROJ="orqafy_prod";    DOMAIN="orqafy.com" ;;
  *) echo "❌ Usage: bash deploy/rollback.sh <staging|prod> <sha-XXXXXXX>"; exit 1 ;;
esac
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }
# Orqafy runs app + worker together (a mismatched old worker on a newer schema must fail loudly,
# never write silently) — both move in every stop/pull/up so a rollback can't strand the worker.
CF="-f docker-compose.db.yml -f docker-compose.cache.yml -f docker-compose.storage.yml -f docker-compose.app.yml -f docker-compose.worker.yml"
SERVICES="app worker"

echo "▶ Rollback target: ${ENVIRON} → ${TARGET_SHA}  (stack ${STACK}, project ${PROJ})"

echo "▶ 1/4 Locate paired pre-promotion backup for ${TARGET_SHA}"
# Naming convention: orqafy-<env>-backup-pre-promotion-<sha>-<timestamp>.sql.gz
PAIRED="$(ssh_vps "ls -1t ${BACKUP_DIR}/orqafy-${ENVIRON}-backup-pre-promotion-${TARGET_SHA}-*.sql.gz 2>/dev/null | head -1" || true)"
if [ -z "$PAIRED" ]; then
  echo "  ⚠ no paired dump found for ${TARGET_SHA} on ${ENVIRON}."
else
  echo "  found: $PAIRED"
fi

echo "▶ 2/4 Check current schema position (migrate status)"
DBPORT=$(ssh_vps "grep -oP '(?<=^DB_PORT=)[0-9]+' ${STACK}/.env")
# ORQ-17: bind the tunnel on a DEDICATED high LOCAL port, decoupled from the remote ${DBPORT},
# with ExitOnForwardFailure=yes so a hijacked bind is FATAL. A local container publishing ${DBPORT}
# could otherwise steal the bind and let us read the WRONG database's migrate status — handing back
# a false guardrail verdict and permitting an unsafe rollback.
TUN=""; LPORT=""
for CAND in 15439 15440 15441 15442 15443; do
  ssh -o ConnectTimeout=20 -o ExitOnForwardFailure=yes -i "$KEY" -N -L "${CAND}:localhost:${DBPORT}" "$VPS" &
  _pid=$!; sleep 3
  if kill -0 "$_pid" 2>/dev/null; then TUN=$_pid; LPORT=$CAND; break; fi
  wait "$_pid" 2>/dev/null || true
done
if [ -z "$TUN" ]; then
  echo "  ✗ ORQ-17: could not bind a local DB tunnel (tried 15439-15443) — aborting (nothing changed)."; exit 1
fi
DBURL_LOCAL=$(ssh_vps "grep -oP '(?<=^INTERNAL_DATABASE_URL=).*' ${STACK}/.env" | sed -E "s#@[^/]+/#@localhost:${LPORT}/#")
STATUS_OUT="$(DATABASE_URL="$DBURL_LOCAL" pnpm --filter @orqafy/db exec prisma migrate status 2>&1 || true)"
SCHEMA_UP_TO_DATE=0
echo "$STATUS_OUT" | grep -q "Database schema is up to date" && SCHEMA_UP_TO_DATE=1
kill $TUN 2>/dev/null || true

if [ -n "$PAIRED" ]; then
  echo "▶ 3/4 Paired dump available — coupled rollback (image + schema)"
  echo "  ⚠ This DISCARDS every row written to ${ENVIRON} since the promotion to ${TARGET_SHA}'s"
  echo "    successor. The paired dump ($PAIRED) will REPLACE the current database."
  read -r -p "  Type 'yes-discard-data' to proceed, anything else aborts: " CONFIRM
  if [ "$CONFIRM" != "yes-discard-data" ]; then
    echo "  aborted — no changes made. (Fix-forward is the preferred path — see cicd-standard.md.)"
    exit 1
  fi
  echo "  · stopping ${SERVICES}"
  ssh_vps "cd ${STACK}; docker compose -p ${PROJ} ${CF} stop ${SERVICES} >/dev/null 2>&1 || true"
  echo "  · restoring paired dump"
  ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
    docker exec ${PROJ}_postgres psql -U \$U -d \$D -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='\$D' AND pid<>pg_backend_pid();\" >/dev/null; \
    docker exec ${PROJ}_postgres psql -U \$U -d \$D -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null; \
    gunzip -c '$PAIRED' | docker exec -i ${PROJ}_postgres psql -U \$U -d \$D -q >/dev/null && echo '  ok'"
  echo "  · re-tagging image → ${TARGET_SHA} (+ DEPLOYED_APP_SHA so the next promotion pairs correctly — ORQ-24)"
  ssh_vps "cd ${STACK}; ${SUDO} sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${TARGET_SHA}/' .env; \
    if grep -q '^DEPLOYED_APP_SHA=' .env; then ${SUDO} sed -i 's/^DEPLOYED_APP_SHA=.*/DEPLOYED_APP_SHA=${TARGET_SHA}/' .env; else echo 'DEPLOYED_APP_SHA=${TARGET_SHA}' | ${SUDO} tee -a .env >/dev/null; fi"
  echo "  · bringing ${ENVIRON} back up on ${TARGET_SHA}"
  ssh_vps "cd ${STACK}; docker compose -p ${PROJ} --env-file .env ${CF} pull ${SERVICES} >/dev/null 2>&1; docker compose -p ${PROJ} --env-file .env ${CF} up -d ${SERVICES}"
else
  echo "▶ 3/4 No paired dump — GUARDRAIL path (image-only rollback is refused if unsafe)"
  if [ "$SCHEMA_UP_TO_DATE" != "1" ]; then
    echo "  ✗ REFUSING rollback: no paired dump AND \`prisma migrate status\` does not report"
    echo "    a clean, known state for ${TARGET_SHA}'s schema. Rolling the image back here risks"
    echo "    old code running against a schema shape it doesn't understand (silent corruption"
    echo "    risk). FIX FORWARD instead — ship a hotfix on top of the current schema."
    exit 1
  fi
  echo "  ⚠ schema currently reports up to date, but this is an IMAGE-ONLY rollback (no DB"
  echo "    change). If the live schema has migrated PAST what ${TARGET_SHA} expects, the"
  echo "    old worker/app may fail loudly against newer constraints (by design — see"
  echo "    docs/PROD_PROMOTION_READY.md 'Rollback' note). Prefer fixing forward."
  read -r -p "  Type 'yes-image-only-rollback' to proceed, anything else aborts: " CONFIRM
  if [ "$CONFIRM" != "yes-image-only-rollback" ]; then
    echo "  aborted — no changes made."
    exit 1
  fi
  ssh_vps "cd ${STACK}; ${SUDO} sed -i 's/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${TARGET_SHA}/' .env; \
    if grep -q '^DEPLOYED_APP_SHA=' .env; then ${SUDO} sed -i 's/^DEPLOYED_APP_SHA=.*/DEPLOYED_APP_SHA=${TARGET_SHA}/' .env; else echo 'DEPLOYED_APP_SHA=${TARGET_SHA}' | ${SUDO} tee -a .env >/dev/null; fi; \
    docker compose -p ${PROJ} --env-file .env ${CF} pull ${SERVICES} >/dev/null 2>&1; \
    docker compose -p ${PROJ} --env-file .env ${CF} up -d ${SERVICES}"
fi

echo "▶ 4/4 Verify (poll health until 200 — a recreate needs longer than a single check; ORQ-22)"
CODE=000
for i in $(seq 1 24); do              # up to 24×5s = 120s
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/api/health" || echo 000)
  [ "$CODE" = "200" ] && { echo "  ${DOMAIN}/api/health = 200 (healthy after $((i*5))s)"; break; }
  printf "  … attempt %d/24: health=%s — waiting 5s\n" "$i" "$CODE"
  sleep 5
done
[ "$CODE" = "200" ] && echo "✅ rollback complete — ${ENVIRON} is on ${TARGET_SHA}." \
  || { echo "⚠ ${ENVIRON} came up but health = ${CODE} after 120s — check 'docker logs ${PROJ}_app'."; exit 1; }
