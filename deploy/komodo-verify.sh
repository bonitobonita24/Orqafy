#!/usr/bin/env bash
# ⚠ HARD HOLD — this is a READ/AUDIT tool. It NEVER pushes, deploys, or mutates a Komodo
# resource; it only verifies registration and PRINTS a ResourceSync stanza for you to commit.
#
# ⚙ GENERATED from Powerbyte-AIEF/cicd-gen/komodo-verify.sh.template via `cicd-gen`.
# Prefer editing the template + re-running the generator over hand-patching this copy.
#
# Stack Registration Audit (cicd.md §8.1 · Rule 36). For each deployment environment —
# Production FIRST and loudest — confirm the on-host stack is a REGISTERED, Komodo-TRACKED
# resource, not a container hand-installed on the server (invisible to Komodo, un-promotable,
# silently drifting — the Marine-Guardian prod failure this catches).
#
# Verification order (fail-OPEN on tooling — a missing verifier WARNS, never blocks):
#   1. `km list stacks` (Komodo CLI; alias `km ls stacks`) if `km` is on PATH.
#   2. else the ListStacks read API, if KOMODO_HOST + KOMODO_API_KEY + KOMODO_API_SECRET are set.
#   3. else WARN "cannot verify" and exit 0 (advisory) — never fabricate a verdict.
# An on-host stack dir present but ABSENT from Komodo's list is a real finding: fail-CLOSED
# (non-zero exit) unless --report-only. Production findings are surfaced first.
#
# Usage: bash deploy/komodo-verify.sh [--report-only]
#   --report-only  advisory: report findings, always exit 0 (the Phase-6 backstop mode).
set -euo pipefail

REPORT_ONLY=0
[ "${1:-}" = "--report-only" ] && REPORT_ONLY=1

APP="orqafy"
# ORQ-25: SPLIT TOPOLOGY — prod runs on Hostinger, staging + demo on EC2-Komodo. The on-host
# stack-dir check (dir_exists) SSHes to the CORRECT box per env below. ⚠ CAVEAT: the Komodo
# tracked-list (`km`/ListStacks) is read from ONE configured Komodo instance — prod registration
# lives in Hostinger-Komodo, staging/demo in EC2-Komodo (kmd.powerbyte.app). So the tracked check
# is only authoritative for the env-set matching the Komodo your `km`/KOMODO_HOST points at; a full
# dual-Komodo audit is a follow-up (ORQ-26). dir_exists (the hand-install finding) is host-correct.
VPS_PROD="root@72.62.74.203";     KEY_PROD="$HOME/.ssh/powerbyte_hostinger"
VPS_EC2="ubuntu@18.138.220.90";   KEY_EC2="$HOME/.ssh/powerbyte_ec2_komodo"
# env → on-host stack dir (name = the Komodo Stack resource name = basename of the dir)
STACK_PROD="/etc/komodo/stacks/orqafy-prod"
STACK_STAGING="/etc/komodo/stacks/orqafy-staging"
STACK_DEMO="/etc/komodo/stacks/orqafy-demo"

warn(){ echo "   ⚠ $*" >&2; }
ok(){   echo "   ✓ $*"; }
bad(){  echo "   ✗ $*" >&2; }

# ── how will we read Komodo's tracked-stack list? (decided once, fail-open) ──────
KOMODO_STACKS=""        # newline-separated list of tracked stack names, or empty if unknown
VERIFY_MODE="none"
if command -v km >/dev/null 2>&1; then
  # Take km's REAL exit status — never `|| true`. A present-but-erroring `km` (auth/network)
  # would otherwise yield an empty list that reads as "0 tracked stacks", flagging every set-up
  # stack (prod included) as untracked and failing CLOSED — the opposite of the fail-OPEN posture
  # this tool documents. On km failure we fall through to VERIFY_MODE=none → advisory exit 0.
  if KOMODO_STACKS="$(km list stacks 2>/dev/null)" || KOMODO_STACKS="$(km ls stacks 2>/dev/null)"; then
    VERIFY_MODE="cli"
  else
    warn "\`km\` is on PATH but 'km list stacks' failed (auth/network?) — cannot verify; advisory."
  fi
elif [ -n "${KOMODO_HOST:-}" ] && [ -n "${KOMODO_API_KEY:-}" ] && [ -n "${KOMODO_API_SECRET:-}" ] \
     && command -v curl >/dev/null 2>&1; then
  # Komodo Core read API: POST /read {"type":"ListStacks","params":{}} with X-Api-Key/Secret.
  KOMODO_STACKS="$(curl -fsS -X POST "${KOMODO_HOST%/}/read" \
      -H "Content-Type: application/json" \
      -H "X-Api-Key: ${KOMODO_API_KEY}" \
      -H "X-Api-Secret: ${KOMODO_API_SECRET}" \
      -d '{"type":"ListStacks","params":{}}' 2>/dev/null || true)"
  [ -n "$KOMODO_STACKS" ] && VERIFY_MODE="api"
fi

if [ "$VERIFY_MODE" = "none" ]; then
  warn "cannot verify Komodo stack registration: no \`km\` CLI on PATH and no KOMODO_HOST/"
  warn "KOMODO_API_KEY/KOMODO_API_SECRET set. Install the Komodo CLI or export those, then re-run."
  warn "(advisory — exiting 0; a hand-installed stack CANNOT be detected without a verifier.)"
  exit 0
fi
echo "── Komodo Stack Registration Audit (${APP}) — verify via ${VERIFY_MODE} ──────────"

is_tracked(){ # is_tracked <stack-name> — true only on an EXACT, standalone stack-name match.
  # The boundary class DELIBERATELY includes '-' and '_' as name characters. A plain `grep -w`
  # treats '-' as a word boundary, so a hyphenated prod name (default `${APP}`) would FALSE-MATCH
  # a tracked `${APP}-staging`/`${APP}-demo` entry and silently pass an UNREGISTERED production
  # stack — the exact Marine-Guardian failure this audit exists to catch. Format-agnostic: works
  # for the CLI list (whitespace-delimited) and the raw ListStacks JSON (quote/brace-delimited).
  local re; re="$(printf '%s' "$1" | sed -E 's/[][(){}.^$*+?|\\/]/\\&/g')"
  printf '%s\n' "$KOMODO_STACKS" | grep -qiE "(^|[^[:alnum:]_-])${re}([^[:alnum:]_-]|\$)"
}
dir_exists(){ ssh -o ConnectTimeout=15 -i "$2" "$1" "[ -d '$3' ]" 2>/dev/null; } # dir_exists <host> <key> <dir>

emit_resource_sync(){ # emit_resource_sync <stack-name> <stack-dir>
  local name="$1" dir="$2" repo
  repo="$(git remote get-url origin 2>/dev/null | sed -E 's#(git@|https://)([^:/]+)[:/]##; s#\.git$##' || echo '<org>/<repo>')"
  cat <<TOML
     ── scripted register: add to your ResourceSync TOML (commit + \`km\` sync) ──
     [[stack]]
     name = "${name}"
     [stack.config]
     server = "<komodo-server-name>"        # the Komodo Server this stack runs on
     files_on_host = true                    # stack files live at ${dir}
     repo = "${repo}"                        # or files_on_host only; adjust to your setup
     ── fallback: Komodo UI → Stacks → New Stack (Scenario 32 Part C) ──
TOML
}

FINDINGS=0
PROD_FINDING=0
audit_env(){ # audit_env <label> <stack-dir> <is-prod 0/1> <ssh-host> <ssh-key>
  local label="$1" dir="$2" is_prod="$3" host="$4" key="$5" name; name="$(basename "$dir")"
  if is_tracked "$name"; then
    ok "${label}: '${name}' is a Komodo-tracked Stack."
    return
  fi
  if dir_exists "$host" "$key" "$dir"; then
    bad "${label}: '${name}' EXISTS on host (${host}:${dir}) but is NOT tracked by Komodo — HAND-INSTALLED."
    emit_resource_sync "$name" "$dir"
    FINDINGS=$((FINDINGS+1)); [ "$is_prod" = "1" ] && PROD_FINDING=1
  else
    echo "   • ${label}: '${name}' not set up on ${host} yet (no ${dir}) — nothing to register."
  fi
}

# Production FIRST and loudest, then staging, then demo. ORQ-25: prod on Hostinger, staging+demo on EC2.
audit_env "PRODUCTION" "$STACK_PROD"    1 "$VPS_PROD" "$KEY_PROD"
audit_env "staging"    "$STACK_STAGING" 0 "$VPS_EC2"  "$KEY_EC2"
audit_env "demo"       "$STACK_DEMO"    0 "$VPS_EC2"  "$KEY_EC2"

echo "──────────────────────────────────────────────────────────────────────────"
if [ "$FINDINGS" -eq 0 ]; then
  ok "all set-up environments are Komodo-tracked Stacks."
  exit 0
fi
bad "${FINDINGS} untracked stack(s) found${PROD_FINDING:+ (INCLUDING PRODUCTION)}."
echo "   Register each via the ResourceSync stanza above (or Scenario 32 UI), then re-run."
# fail-open on tooling / fail-closed on a real finding — but --report-only stays advisory.
if [ "$REPORT_ONLY" = "1" ]; then exit 0; fi
if [ "$PROD_FINDING" = "1" ]; then exit 2; fi
exit 1
