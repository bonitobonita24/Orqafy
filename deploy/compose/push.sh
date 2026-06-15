#!/bin/bash
# =============================================================
# Image promotion pipeline — manual, you decide when to push
# =============================================================
# Usage:
#   bash deploy/compose/push.sh dev       — build + tag + push dev image to Docker Hub
#   bash deploy/compose/push.sh staging   — re-tag last dev image as staging, push
#   bash deploy/compose/push.sh prod      — re-tag last staging image as prod, push
#
# Prerequisites:
#   docker login                          — run once before first push
#   DOCKERHUB_USERNAME in your shell env  — or update IMAGE_BASE below
#
# Requires: docker.publish: true in inputs.yml
# =============================================================

set -e

# ── Config ──
DOCKER_USER="${DOCKERHUB_USERNAME:-bonitobonita24}"
IMAGE_BASE="${DOCKER_USER}/orqafy"
WORKER_IMAGE_BASE="${DOCKER_USER}/orqafy-worker"
DOCKERFILE="apps/web/Dockerfile"
WORKER_DOCKERFILE="apps/worker/Dockerfile"
SHORT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M)

# ── Guard: docker.publish check ──
if ! grep -q "publish: true" inputs.yml 2>/dev/null; then
  echo "❌ docker.publish is not set to true in inputs.yml. Aborting."
  exit 1
fi

# ── Guard: docker login check ──
# NOTE: `docker info | grep Username` is a FALSE-NEGATIVE when logged in via
# `docker login --password-stdin` (it only populates Username for interactive
# logins). Treat as a warning, not a hard stop — the push will fail loudly
# anyway if creds are truly missing.
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "⚠  Could not confirm Docker Hub login via 'docker info' (this is a known"
  echo "   false-negative with --password-stdin). Continuing; push will fail if"
  echo "   credentials are actually missing."
fi

TARGET=${1:-dev}

case "$TARGET" in

  dev)
    echo "🔨 Building dev app image from source..."
    docker build \
      --file "$DOCKERFILE" \
      --tag "${IMAGE_BASE}:dev-latest" \
      --tag "${IMAGE_BASE}:dev-sha-${SHORT_SHA}" \
      --platform linux/amd64 \
      .

    echo "🔨 Building dev worker image from source..."
    docker build \
      --file "$WORKER_DOCKERFILE" \
      --tag "${WORKER_IMAGE_BASE}:dev-latest" \
      --tag "${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}" \
      --platform linux/amd64 \
      .

    echo "🧪 Running full-stack tests before push..."
    bash deploy/compose/start.sh dev up -d
    sleep 5
    docker compose -f deploy/compose/dev/docker-compose.app.yml \
      exec app pnpm test --passWithNoTests || {
        echo "❌ Tests failed. Aborting push. Fix tests before pushing."
        bash deploy/compose/start.sh dev down
        exit 1
      }
    bash deploy/compose/start.sh dev down

    echo "📤 Pushing dev images to Docker Hub..."
    docker push "${IMAGE_BASE}:dev-latest"
    docker push "${IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:dev-latest"
    docker push "${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}"

    echo "✅ Dev images pushed:"
    echo "   ${IMAGE_BASE}:dev-latest"
    echo "   ${IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    echo "   ${WORKER_IMAGE_BASE}:dev-latest"
    echo "   ${WORKER_IMAGE_BASE}:dev-sha-${SHORT_SHA}"
    echo ""
    echo "▶  To promote to staging: bash deploy/compose/push.sh staging"
    ;;

  staging)
    echo "🔁 Promoting dev images → staging..."
    docker pull "${IMAGE_BASE}:dev-latest"
    docker tag  "${IMAGE_BASE}:dev-latest" "${IMAGE_BASE}:staging-latest"
    docker tag  "${IMAGE_BASE}:dev-latest" "${IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    docker push "${IMAGE_BASE}:staging-latest"
    docker push "${IMAGE_BASE}:staging-sha-${SHORT_SHA}"

    docker pull "${WORKER_IMAGE_BASE}:dev-latest"
    docker tag  "${WORKER_IMAGE_BASE}:dev-latest" "${WORKER_IMAGE_BASE}:staging-latest"
    docker tag  "${WORKER_IMAGE_BASE}:dev-latest" "${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:staging-latest"
    docker push "${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"

    echo "✅ Staging images pushed:"
    echo "   ${IMAGE_BASE}:staging-latest"
    echo "   ${IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    echo "   ${WORKER_IMAGE_BASE}:staging-latest"
    echo "   ${WORKER_IMAGE_BASE}:staging-sha-${SHORT_SHA}"
    echo ""
    echo "📋 On your staging server, run:"
    echo "   docker compose -f deploy/compose/stage/docker-compose.app.yml pull"
    echo "   docker compose -f deploy/compose/stage/docker-compose.app.yml up -d"
    echo ""
    echo "▶  To promote to prod: bash deploy/compose/push.sh prod"
    ;;

  prod)
    echo "🚀 Promoting staging images → production..."
    docker pull "${IMAGE_BASE}:staging-latest"
    docker tag  "${IMAGE_BASE}:staging-latest" "${IMAGE_BASE}:latest"
    docker tag  "${IMAGE_BASE}:staging-latest" "${IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    docker push "${IMAGE_BASE}:latest"
    docker push "${IMAGE_BASE}:prod-sha-${SHORT_SHA}"

    docker pull "${WORKER_IMAGE_BASE}:staging-latest"
    docker tag  "${WORKER_IMAGE_BASE}:staging-latest" "${WORKER_IMAGE_BASE}:latest"
    docker tag  "${WORKER_IMAGE_BASE}:staging-latest" "${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    docker push "${WORKER_IMAGE_BASE}:latest"
    docker push "${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"

    echo "✅ Production images pushed:"
    echo "   ${IMAGE_BASE}:latest"
    echo "   ${IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    echo "   ${WORKER_IMAGE_BASE}:latest"
    echo "   ${WORKER_IMAGE_BASE}:prod-sha-${SHORT_SHA}"
    echo ""
    echo "📋 On your production server, run:"
    echo "   docker compose -f deploy/compose/prod/docker-compose.app.yml pull"
    echo "   docker compose -f deploy/compose/prod/docker-compose.app.yml up -d"
    echo ""
    echo "🔄 To rollback: edit docker-compose.app.yml image tag to a previous sha tag"
    echo "   e.g. image: ${IMAGE_BASE}:prod-sha-{previous-sha}"
    ;;

  *)
    echo "Usage: bash deploy/compose/push.sh [dev|staging|prod]"
    exit 1
    ;;
esac
