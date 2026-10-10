#!/usr/bin/env bash
# dev-freshness-check.sh — is the running LOCAL DEV app/worker behind main?
# Global fleet helper (on PATH, every seat). Enforces the deploy-discipline invariant
# "a staging/prod/demo ship is NOT complete until local dev is rebuilt off the same
# main/sha" by detecting the silent STALE-DEV-IMAGE drift: a dev stack serves a
# PREBUILT image with NO source bind-mount, so code only appears on REBUILD — a ship
# can leave dev serving old code while main is already current.
# Governed by ~/.claude/rules/deploy-discipline.md (Invariants: "Dev leads every env").
#
# Usage:
#   dev-freshness-check.sh [--report-only] [--branch REF] [--project NAME]
#                          [--service NAME] [--all-services] [--container NAME] [TARGET_DIR]
#   --branch REF     git ref dev must not be behind (default: main; falls back to HEAD)
#   --project NAME   compose project (default: .env COMPOSE_PROJECT_NAME, else dir name)
#   --service NAME   check only this compose service
#   --all-services   check every running service (default: only code services app|worker|web|api|server|next|frontend|backend)
#   --container NAME check a container matched by name substring
#   --report-only    never exit non-zero; report only
#
# Only CODE services are checked by default — infra (postgres/valkey/minio/mailhog/
# pgbouncer/traefik…) is pulled, not our code, so its build date is irrelevant.
# Detection: prefer a stamped git-sha LABEL (git_sha / org.opencontainers.image.revision)
# for an exact match; else compare image BUILD TIME vs the ref commit time.
# Graceful degrade (fail-open on tooling): missing docker/git, unreachable daemon,
# non-repo, or dev-not-running => WARN/SKIP + exit 0. Exit 2 only when a running code
# container is STALE (unless --report-only).
set -uo pipefail

REPORT_ONLY=0; REF_BRANCH="main"; PROJECT=""; SERVICE=""; CONTAINER=""; ALL_SERVICES=0; TARGET_DIR="."
CODE_SVC_RE='^(app|worker|web|api|server|next|frontend|backend)$'
while [ $# -gt 0 ]; do
  case "$1" in
    --report-only) REPORT_ONLY=1 ;;
    --all-services) ALL_SERVICES=1 ;;
    --branch) REF_BRANCH="${2:-main}"; shift ;;   --branch=*) REF_BRANCH="${1#*=}" ;;
    --project) PROJECT="${2:-}"; shift ;;          --project=*) PROJECT="${1#*=}" ;;
    --service) SERVICE="${2:-}"; shift ;;          --service=*) SERVICE="${1#*=}" ;;
    --container) CONTAINER="${2:-}"; shift ;;      --container=*) CONTAINER="${1#*=}" ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) TARGET_DIR="$1" ;;
  esac
  shift
done

if [ -t 1 ]; then CYN=$'\033[0;36m'; GRN=$'\033[0;32m'; RED=$'\033[0;31m'; YLW=$'\033[0;33m'; BLU=$'\033[0;34m'; RST=$'\033[0m'
else CYN=""; GRN=""; RED=""; YLW=""; BLU=""; RST=""; fi
pass()  { printf "  [%sFRESH%s] %s\n" "$GRN" "$RST" "$*"; }
stale() { printf "  [%sSTALE%s] %s\n" "$RED" "$RST" "$*"; }
warn()  { printf "  [%sWARN%s]  %s\n" "$YLW" "$RST" "$*"; }
skip()  { printf "  [%sSKIP%s]  %s\n" "$BLU" "$RST" "$*"; }
have()  { command -v "$1" >/dev/null 2>&1; }

TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd)" || { warn "target dir not found — skipped"; exit 0; }
printf "\n%sdev-freshness-check%s — target: %s | ref: %s | report-only: %s\n" \
  "$CYN" "$RST" "$TARGET_DIR" "$REF_BRANCH" "$([ "$REPORT_ONLY" -eq 1 ] && echo yes || echo no)"

# ── 1. git reference ─────────────────────────────────────────────────────────
have git || { warn "git not found — cannot determine reference, skipped"; exit 0; }
git -C "$TARGET_DIR" rev-parse --git-dir >/dev/null 2>&1 || { warn "$TARGET_DIR is not a git repo — skipped"; exit 0; }
REF_SHA="$(git -C "$TARGET_DIR" rev-parse --verify --quiet "$REF_BRANCH" 2>/dev/null)"
[ -n "$REF_SHA" ] || REF_SHA="$(git -C "$TARGET_DIR" rev-parse --verify --quiet HEAD 2>/dev/null)"
[ -n "$REF_SHA" ] || { warn "cannot resolve ref '$REF_BRANCH' or HEAD — skipped"; exit 0; }
REF_SHORT="${REF_SHA:0:12}"
REF_TIME="$(git -C "$TARGET_DIR" show -s --format=%ct "$REF_SHA" 2>/dev/null || echo "")"
printf "  reference: %s @ %s (%s)\n" "$REF_BRANCH" "$REF_SHORT" \
  "$(git -C "$TARGET_DIR" show -s --format=%ci "$REF_SHA" 2>/dev/null)"

# ── 2. docker ────────────────────────────────────────────────────────────────
have docker || { warn "docker not found — cannot inspect dev container, skipped"; exit 0; }
docker info >/dev/null 2>&1 || { warn "docker daemon not reachable — skipped"; exit 0; }

# ── 3. resolve compose project name ──────────────────────────────────────────
if [ -z "$PROJECT" ]; then
  for envf in "$TARGET_DIR"/.env "$TARGET_DIR"/.env.dev "$TARGET_DIR"/.env.local "$TARGET_DIR"/deploy/compose/.env.dev; do
    [ -f "$envf" ] || continue
    val="$(grep -E '^COMPOSE_PROJECT_NAME=' "$envf" 2>/dev/null | head -1 | cut -d= -f2-)"
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    [ -n "$val" ] && { PROJECT="$val"; break; }
  done
fi
[ -n "$PROJECT" ] || PROJECT="$(basename "$TARGET_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"
printf "  compose project: %s\n" "$PROJECT"

# ── 4. find running container(s) ─────────────────────────────────────────────
if [ -n "$CONTAINER" ]; then
  IDS="$(docker ps -q --filter "name=$CONTAINER" --filter "status=running" 2>/dev/null)"
else
  IDS="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "status=running" 2>/dev/null)"
fi
if [ -z "$IDS" ]; then
  skip "no running dev container for project '$PROJECT' (dev stack not up) — nothing to check"
  echo; exit 0
fi

# ── 5. per-container freshness (code services only, unless --all-services/--container) ──
STALE_N=0; CHECKED=0; INFRA=()
while IFS= read -r cid; do
  [ -n "$cid" ] || continue
  svc="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$cid" 2>/dev/null)"
  cname="$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##')"
  # scope filter
  if [ -z "$CONTAINER" ] && [ "$ALL_SERVICES" -eq 0 ]; then
    if [ -n "$SERVICE" ]; then
      [ "$svc" = "$SERVICE" ] || continue
    elif ! printf '%s' "$svc" | grep -qE "$CODE_SVC_RE"; then
      INFRA+=("${svc:-$cname}"); continue
    fi
  fi
  CHECKED=$((CHECKED + 1))
  img="$(docker inspect --format '{{.Image}}' "$cid" 2>/dev/null)"
  csha="$(docker inspect --format '{{ or (index .Config.Labels "git_sha") (index .Config.Labels "org.opencontainers.image.revision") "" }}' "$cid" 2>/dev/null)"
  if [ -n "$csha" ] && [ "$csha" != "<no value>" ]; then
    if [ "${csha:0:12}" = "$REF_SHORT" ]; then
      pass "$cname ($svc) — stamped sha ${csha:0:12} == $REF_BRANCH"
    else
      stale "$cname ($svc) — stamped sha ${csha:0:12} != $REF_BRANCH $REF_SHORT (rebuild dev)"
      STALE_N=$((STALE_N + 1))
    fi
    continue
  fi
  tsrc="image built"
  created="$(docker image inspect --format '{{.Created}}' "$img" 2>/dev/null)"
  if [ -z "$created" ]; then
    # running image id no longer exists (a newer build replaced the tag but this
    # container was never recreated) OR unreadable → fall back to container creation
    # time = the last time this container was (re)built/recreated. A gone image is
    # itself a strong staleness signal.
    created="$(docker inspect --format '{{.Created}}' "$cid" 2>/dev/null)"; tsrc="container recreated"
  fi
  ctime=""; [ -n "$created" ] && ctime="$(date -d "$created" +%s 2>/dev/null || echo "")"
  if [ -z "$ctime" ] || [ -z "$REF_TIME" ]; then
    warn "$cname ($svc) — cannot read build/recreate time — inconclusive"
    continue
  fi
  if [ "$ctime" -ge "$REF_TIME" ]; then
    pass "$cname ($svc) — $tsrc $(date -d "@$ctime" '+%Y-%m-%d %H:%M') ≥ $REF_BRANCH commit"
  else
    stale "$cname ($svc) — $tsrc $(date -d "@$ctime" '+%Y-%m-%d %H:%M') < $REF_BRANCH $REF_SHORT ($(date -d "@$REF_TIME" '+%Y-%m-%d %H:%M')) — dev is BEHIND"
    STALE_N=$((STALE_N + 1))
  fi
done <<< "$IDS"

[ "${#INFRA[@]}" -gt 0 ] && printf "  %s(skipped %d pulled/infra service(s): %s — use --all-services to include)%s\n" \
  "$BLU" "${#INFRA[@]}" "$(printf '%s ' "${INFRA[@]}" | sed 's/ $//')" "$RST"

# ── 6. verdict ───────────────────────────────────────────────────────────────
echo
if [ "$CHECKED" -eq 0 ]; then
  skip "no code service (app/worker/…) matched — nothing checked (try --service or --all-services)"
  echo; exit 0
fi
if [ "$STALE_N" -gt 0 ]; then
  printf "  %sRESULT: %d/%d code container(s) STALE%s — rebuild off %s (APP + worker):\n" \
    "$RED" "$STALE_N" "$CHECKED" "$RST" "$REF_BRANCH"
  printf "     e.g.  bash deploy/compose/start.sh dev up -d --build\n\n"
  [ "$REPORT_ONLY" -eq 1 ] && exit 0 || exit 2
fi
printf "  %sRESULT: all %d code container(s) FRESH%s (dev not behind %s)\n\n" \
  "$GRN" "$CHECKED" "$RST" "$REF_BRANCH"
exit 0
