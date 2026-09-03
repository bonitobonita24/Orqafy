#!/usr/bin/env bash
# ⚠ HARD HOLD — generated LOCALLY only. Running this against the real demo stack captures a
# new baseline that demo-reset.sh will restore going forward — run it deliberately, only when
# the owner confirms the current demo state is the one to bless.
#
# ⚙ GENERATED from Powerbyte-AIEF/cicd-gen/demo-bless-golden.sh.template via `cicd-gen`.
# Prefer editing the template + re-running the generator over hand-patching this copy.
#
# demo-bless-golden.sh — captures the CURRENT demo DB + MinIO media bucket as the new
# "blessed golden" baseline at /root/golden/orqafy-demo. This is a DELIBERATE, owner-triggered action
# ("bless this as golden") — distinct from the automatic rolling backup demo-reset.sh takes
# before every reset. demo-reset.sh restores FROM this golden path, never from the rolling
# backup (a rolling backup could faithfully preserve an already-broken demo state).
#
# Usage:  bash deploy/demo-bless-golden.sh
# Prereq: SSH key $HOME/.ssh/powerbyte_hostinger; run from the app repo root, ONLY when the current demo state
#         (data + media) is exactly what future auto-resets should restore.
set -euo pipefail

VPS="root@72.62.74.203"; KEY="$HOME/.ssh/powerbyte_hostinger"
PROJ="orqafy_demo"
GOLDEN="/root/golden/orqafy-demo"
ssh_vps(){ ssh -o ConnectTimeout=20 -i "$KEY" "$VPS" "$@"; }

echo "▶ Blessing current demo state as GOLDEN → ${GOLDEN}"
read -r -p "  This REPLACES the previous golden baseline. Type 'yes-bless' to proceed: " CONFIRM
[ "$CONFIRM" = "yes-bless" ] || { echo "  aborted — no changes made."; exit 1; }

echo "▶ 1/3 Ensure golden dir exists (keep prior golden as a one-generation backup)"
ssh_vps "mkdir -p '${GOLDEN}'; \
  [ -f '${GOLDEN}/db.sql.gz' ] && mv '${GOLDEN}/db.sql.gz' '${GOLDEN}/db.sql.gz.prev' || true; \
  [ -d '${GOLDEN}/minio' ] && rm -rf '${GOLDEN}/minio.prev' && mv '${GOLDEN}/minio' '${GOLDEN}/minio.prev' || true"

echo "▶ 2/3 Dump demo DB → golden"
ssh_vps "U=\$(docker exec ${PROJ}_postgres printenv POSTGRES_USER); D=\$(docker exec ${PROJ}_postgres printenv POSTGRES_DB); \
  docker exec ${PROJ}_postgres pg_dump -U \$U -d \$D | gzip > '${GOLDEN}/db.sql.gz' && echo '  ok'"

echo "▶ 3/3 Mirror demo MinIO bucket → golden (media-storage-default.md: demo stays on MinIO)"
ssh_vps "mkdir -p '${GOLDEN}/minio'; \
  docker run --rm --network ${PROJ}_network \
    -v '${GOLDEN}/minio:/backup' \
    --entrypoint sh minio/mc:latest -c \
    \"mc alias set demo http://${PROJ}_minio:9000 \\\$(docker exec ${PROJ}_minio printenv MINIO_ROOT_USER) \\\$(docker exec ${PROJ}_minio printenv MINIO_ROOT_PASSWORD) >/dev/null && mc mirror --overwrite demo/orqafy /backup\" \
  && echo '  ok' || echo '  ⚠ MinIO mirror step failed/skipped — verify the demo bucket name (orqafy) and the minio/mc image is reachable on this host.'"

echo "✅ Golden baseline blessed at ${GOLDEN} (DB + MinIO media). demo-reset.sh will restore this going forward."
