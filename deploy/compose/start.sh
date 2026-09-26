#!/bin/bash
# Usage: bash deploy/compose/start.sh [dev|stage|prod] [up -d|down|restart]
# Dev: rebuilds the app image from source on every up (--build flag applied to app only)
# Stage/Prod: pulls pre-built image from Docker Hub — never builds from source

ENV=${1:-dev}
CMD="${*:2}"
BASE=deploy/compose/$ENV

case "$ENV" in
  dev)     ENV_FILE=.env.dev ;;
  stage)   ENV_FILE=.env.staging ;;
  prod)    ENV_FILE=.env.prod ;;
  *)       ENV_FILE=.env.dev ;;
esac

DC="docker compose --env-file $ENV_FILE"

$DC -f $BASE/docker-compose.db.yml $CMD
$DC -f $BASE/docker-compose.cache.yml $CMD
$DC -f $BASE/docker-compose.storage.yml $CMD
# pgadmin is not part of the staging/demo deployed set (matches live — see
# docs/DEPLOY_COMPOSE_RECONCILIATION.md); only present under dev/prod.
if [ -f "$BASE/docker-compose.pgadmin.yml" ]; then
  $DC -f $BASE/docker-compose.pgadmin.yml $CMD
fi
if [ "$ENV" = "dev" ]; then
  $DC -f $BASE/docker-compose.infra.yml $CMD
fi
# Dev: --build forces rebuild from source every time
if [ "$ENV" = "dev" ] && [[ "$CMD" == *"up"* ]]; then
  $DC -f $BASE/docker-compose.app.yml up --build -d
else
  $DC -f $BASE/docker-compose.app.yml $CMD
fi

# Dev worker (Rule 39: dev leads every env). The worker's depends_on names postgres +
# valkey, which are DEFINED in the db/cache compose files — so `-f docker-compose.worker.yml`
# alone is an invalid compose project ("undefined service valkey"). Include the defining
# files and target only `worker` with --no-deps (infra is brought up by the blocks above).
# Stage/prod ship the worker via their MERGED compose, so this dev-only block leaves them
# untouched.
if [ "$ENV" = "dev" ]; then
  if [[ "$CMD" == *"up"* ]]; then
    $DC -f $BASE/docker-compose.db.yml -f $BASE/docker-compose.cache.yml -f $BASE/docker-compose.worker.yml up --build -d --no-deps worker
  else
    $DC -f $BASE/docker-compose.db.yml -f $BASE/docker-compose.cache.yml -f $BASE/docker-compose.worker.yml $CMD
  fi
fi
