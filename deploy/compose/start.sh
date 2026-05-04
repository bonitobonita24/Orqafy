#!/bin/bash
# Usage: bash deploy/compose/start.sh [dev|stage|prod] [up -d|down|restart]
# Dev: rebuilds the app image from source on every up (--build flag applied to app only)
# Stage/Prod: pulls pre-built image from Docker Hub — never builds from source

ENV=${1:-dev}
CMD=${@:2}
BASE=deploy/compose/$ENV

docker compose -f $BASE/docker-compose.db.yml $CMD
docker compose -f $BASE/docker-compose.cache.yml $CMD
docker compose -f $BASE/docker-compose.storage.yml $CMD
docker compose -f $BASE/docker-compose.pgadmin.yml $CMD
if [ "$ENV" = "dev" ]; then
  docker compose -f $BASE/docker-compose.infra.yml $CMD
fi
# Dev: --build forces rebuild from source every time
if [ "$ENV" = "dev" ] && [[ "$CMD" == *"up"* ]]; then
  docker compose -f $BASE/docker-compose.app.yml up --build -d
else
  docker compose -f $BASE/docker-compose.app.yml $CMD
fi
