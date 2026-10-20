#!/usr/bin/env bash
# Adapted from os-factory/har (Apache-2.0) — readiness vs liveness smoke.
# =============================================================================
# readiness-smoke.sh — Powerbyte fleet readiness-vs-liveness smoke gate (HAR harvest M4)
#
# LIVENESS only answers "is the process up" (the app's /api/health route already
# covers that). READINESS answers the harder question a liveness probe can't:
# "can a real user actually log in, read their data, and see a rendered page."
# This script probes both against a framework-built app (Auth.js v5 credentials
# provider + tRPC + Next.js App Router), same graceful-degrade posture as
# lint-deploy.sh / dev-freshness-check.sh: a missing tool/URL/cred = SKIP, never
# a crash.
#
# Usage:
#   bash readiness-smoke.sh [--report-only] [--strict] [--url <base>]
#                            [--env-file <path>] [--self-test]
#
#   --report-only   force report-only (always exit 0) — this is also the DEFAULT
#   --strict        exit 1 if any check FAILs (overrides the report-only default)
#   --url <base>    app base URL (default: read APP_URL/NEXTAUTH_URL from --env-file)
#   --env-file <p>  KEY=VALUE file to source URL/credentials from (default: .env.dev)
#   --self-test     run against a spawned local stub server, assert expected
#                    PASS/FAIL/SKIP outcomes, then exit (no --report-only/--strict
#                    semantics apply to the --self-test result itself)
#
# Checks (each printed PASS/WARN/FAIL/SKIP):
#   L1  LIVENESS           GET <base>/api/health (fallback "/") → HTTP 200, <=10s
#   R1  READINESS-login    Auth.js v5 credentials flow: GET csrf → POST
#                          callback/credentials → session cookie set
#   R2  READINESS-data     GET a tRPC/data route with the session cookie → 200
#                          + non-empty JSON body
#   R3  READINESS-page     GET an authed page with the session cookie → 200 HTML
#                          containing a <main> tag (not redirected to login)
#
# Env vars (read from --env-file, else the process environment):
#   APP_URL / NEXTAUTH_URL   base URL (APP_URL wins if both set)
#   READINESS_EMAIL          login email   (default: webmaster@localhost.com —
#                            the framework's seeded super_admin; see
#                            .ai_prompt/templates.md + the universal-login vault)
#   READINESS_PASSWORD       login password — NEVER hardcoded; unset => R1 SKIPs
#   READINESS_DATA_PATH      data route     (default: /api/trpc/tenant.list)
#   READINESS_PAGE           authed page    (default: /dashboard)
#
# Exit codes:
#   0 — always, unless --strict AND a FAIL occurred (then 1)
#   (--self-test exits 0 on PASS — N/N, 1 on any assertion regression)
# =============================================================================

set -uo pipefail

REPORT_ONLY=1
STRICT=0
BASE_URL=""
ENV_FILE=".env.dev"
SELF_TEST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --report-only) REPORT_ONLY=1; STRICT=0 ;;
    --strict) STRICT=1; REPORT_ONLY=0 ;;
    --url) BASE_URL="${2:-}"; shift ;;
    --url=*) BASE_URL="${1#*=}" ;;
    --env-file) ENV_FILE="${2:-}"; shift ;;
    --env-file=*) ENV_FILE="${1#*=}" ;;
    --self-test) SELF_TEST=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

if [ -t 1 ]; then
  CYN=$'\033[0;36m'; GRN=$'\033[0;32m'; RED=$'\033[0;31m'; YLW=$'\033[0;33m'; BLU=$'\033[0;34m'; RST=$'\033[0m'
else
  CYN=""; GRN=""; RED=""; YLW=""; BLU=""; RST=""
fi

FAILS=0
WARNS=0
have() { command -v "$1" >/dev/null 2>&1; }
pass() { printf "  [%sPASS%s] %s\n" "$GRN" "$RST" "$*"; }
fail() { printf "  [%sFAIL%s] %s\n" "$RED" "$RST" "$*"; FAILS=$((FAILS + 1)); }
warn() { printf "  [%sWARN%s] %s\n" "$YLW" "$RST" "$*"; WARNS=$((WARNS + 1)); }
skip() { printf "  [%sSKIP%s] %s\n" "$BLU" "$RST" "$*"; }
header() { printf "\n%s=== %s ===%s\n" "$CYN" "$*" "$RST"; }

# ── load env-file (KEY=VALUE, no shell expansion) ────────────────────────────
# SECURITY: only an explicit allowlist of keys this script actually reads is
# ever imported — never trust the whole file (a crafted .env.dev could
# otherwise set PATH/LD_PRELOAD/CURL_CA_BUNDLE/SSL_CERT_FILE etc. and hijack
# every curl call below). Everything else is skipped silently.
ENV_ALLOWLIST='^(READINESS_EMAIL|READINESS_PASSWORD|READINESS_DATA_PATH|READINESS_PAGE|READINESS_URL|APP_URL|NEXTAUTH_URL|BASE_URL)$'
load_env_file() {
  local f="$1"
  [ -n "$f" ] && [ -f "$f" ] || return 0
  while IFS='=' read -r k v; do
    case "$k" in ''|'#'*) continue ;; esac
    k="$(printf '%s' "$k" | tr -d '[:space:]')"
    [ -n "$k" ] || continue
    [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ "$k" =~ $ENV_ALLOWLIST ]] || continue
    v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    # only fill vars not already set in the real environment (env wins)
    if [ -z "${!k:-}" ]; then
      export "$k=$v"
    fi
  done < "$f"
}

run_smoke() {
  local base="$1"
  local email="${READINESS_EMAIL:-webmaster@localhost.com}"
  local password="${READINESS_PASSWORD:-}"
  local data_path="${READINESS_DATA_PATH:-/api/trpc/tenant.list}"
  local page_path="${READINESS_PAGE:-/dashboard}"

  if ! have curl; then
    header "L1  LIVENESS"; skip "curl not found"
    header "R1  READINESS-login"; skip "curl not found"
    header "R2  READINESS-data"; skip "curl not found"
    header "R3  READINESS-page"; skip "curl not found"
    return 0
  fi

  if [ -z "$base" ]; then
    header "L1  LIVENESS"; skip "no base URL (set --url or APP_URL/NEXTAUTH_URL)"
    header "R1  READINESS-login"; skip "no base URL"
    header "R2  READINESS-data"; skip "no base URL"
    header "R3  READINESS-page"; skip "no base URL"
    return 0
  fi

  base="${base%/}"

  # ── L1 LIVENESS ─────────────────────────────────────────────────────────
  header "L1  LIVENESS — ${base}/api/health"
  local l1_code
  l1_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${base}/api/health" 2>/dev/null || echo 000)"
  if [ "$l1_code" != "200" ]; then
    l1_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${base}/" 2>/dev/null || echo 000)"
  fi
  if [ "$l1_code" = "200" ]; then
    pass "process is up (HTTP 200 within 10s)"
  else
    fail "no 200 from /api/health or / (got HTTP ${l1_code})"
  fi

  # ── R1 READINESS-login ──────────────────────────────────────────────────
  header "R1  READINESS-login — Auth.js credentials flow"
  if [ -z "$password" ]; then
    skip "set READINESS_PASSWORD (vault: universal-login-credentials)"
    header "R2  READINESS-data — ${data_path}"
    skip "no session (R1 skipped)"
    header "R3  READINESS-page — ${page_path}"
    skip "no session (R1 skipped)"
    return 0
  fi

  # SECURITY: cookie jar + the password-bearing temp file are created 0600
  # (umask before mktemp, belt-and-suspenders chmod) and removed on EXIT —
  # not just RETURN, so an early `return` on any failure branch below still
  # cleans up. The trap string embeds the literal paths (double-quoted at
  # registration time) so it still works after this function's locals go
  # out of scope.
  local jar
  local _old_umask
  _old_umask="$(umask)"
  umask 077
  jar="$(mktemp)"
  umask "$_old_umask"
  # shellcheck disable=SC2064 # intentional: expand $jar NOW (literal path),
  # not at signal time — the local var is gone by then.
  trap "rm -f '$jar'" EXIT

  local csrf_body csrf_token
  csrf_body="$(curl -s -c "$jar" --max-time 10 "${base}/api/auth/csrf" 2>/dev/null || true)"
  csrf_token="$(printf '%s' "$csrf_body" | grep -oE '"csrfToken"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')"

  if [ -z "$csrf_token" ]; then
    fail "could not fetch /api/auth/csrf token"
    header "R2  READINESS-data — ${data_path}"
    skip "no session (R1 failed)"
    header "R3  READINESS-page — ${page_path}"
    skip "no session (R1 failed)"
    rm -f "$jar"
    trap - EXIT
    return 0
  fi

  # SECURITY: the password NEVER goes on curl's argv (visible to any local
  # user via `ps -o args`) — it is written to a 0600 temp file and curl
  # reads it via --data-urlencode "password@<file>" (curl's file-content
  # form, not a literal "name=value" pair).
  local pwfile
  umask 077
  pwfile="$(mktemp)"
  umask "$_old_umask"
  printf '%s' "$password" > "$pwfile"
  chmod 600 "$pwfile" 2>/dev/null || true
  # shellcheck disable=SC2064 # intentional: expand $jar/$pwfile NOW (literal
  # paths), not at signal time — the local vars are gone by then.
  trap "rm -f '$jar' '$pwfile'" EXIT

  curl -s -b "$jar" -c "$jar" --max-time 10 -o /dev/null \
    --data-urlencode "csrfToken=${csrf_token}" \
    --data-urlencode "email=${email}" \
    --data-urlencode "password@${pwfile}" \
    "${base}/api/auth/callback/credentials" 2>/dev/null

  rm -f "$pwfile"

  local has_session_cookie=0
  if grep -qE '(authjs\.session-token|__Secure-authjs\.session-token)' "$jar" 2>/dev/null; then
    has_session_cookie=1
  fi

  local session_body r1_ok=0
  if [ "$has_session_cookie" = "1" ]; then
    session_body="$(curl -s -b "$jar" --max-time 10 "${base}/api/auth/session" 2>/dev/null || true)"
    if printf '%s' "$session_body" | grep -q '"email"\|"user"'; then
      r1_ok=1
    fi
  fi

  if [ "$r1_ok" = "1" ]; then
    pass "session cookie set + /api/auth/session returns a user"
  else
    fail "no session cookie after credentials login, or /api/auth/session has no user"
  fi

  # ── R2 READINESS-data ────────────────────────────────────────────────────
  header "R2  READINESS-data — ${data_path}"
  if [ "$r1_ok" != "1" ]; then
    skip "no session (R1 failed)"
  else
    local r2_code r2_body r2_tmp
    r2_tmp="$(mktemp)"
    r2_code="$(curl -s -b "$jar" --max-time 10 -o "$r2_tmp" -w '%{http_code}' "${base}${data_path}" 2>/dev/null || echo 000)"
    r2_body="$(cat "$r2_tmp" 2>/dev/null)"
    rm -f "$r2_tmp"
    if [ "$r2_code" = "404" ]; then
      skip "${data_path} returned 404 — set READINESS_DATA_PATH"
    elif [ "$r2_code" = "200" ] && [ -n "$r2_body" ] && printf '%s' "$r2_body" | grep -qE '^\s*[\[{]'; then
      pass "200 + non-empty JSON body"
    else
      fail "expected 200 + non-empty JSON, got HTTP ${r2_code}"
    fi
  fi

  # ── R3 READINESS-page ─────────────────────────────────────────────────────
  header "R3  READINESS-page — ${page_path}"
  if [ "$r1_ok" != "1" ]; then
    skip "no session (R1 failed)"
  else
    local r3_tmp r3_code
    r3_tmp="$(mktemp)"
    r3_code="$(curl -s -b "$jar" --max-time 10 -o "$r3_tmp" -w '%{http_code}' "${base}${page_path}" 2>/dev/null || echo 000)"
    if [ "$r3_code" = "200" ] && grep -qi '<main' "$r3_tmp" 2>/dev/null; then
      pass "200 HTML with <main> (no redirect to login)"
    else
      fail "expected 200 HTML with <main>, got HTTP ${r3_code}"
    fi
    rm -f "$r3_tmp"
  fi

  rm -f "$jar"
  trap - EXIT
}

# =============================================================================
# --self-test — spawn a tiny stub, assert PASS/FAIL/SKIP outcomes
# =============================================================================
self_test() {
  if ! have python3; then
    printf 'self-test needs python3 — not found\n' >&2
    exit 1
  fi

  local stub_py
  stub_py="$(mktemp --suffix=.py)"
  cat > "$stub_py" <<'PYEOF'
import http.server, sys, json

PORT = int(sys.argv[1])
MODE = sys.argv[2] if len(sys.argv) > 2 else "good"  # good | nocookie

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _has_cookie(self):
        return "authjs.session-token=sess123" in self.headers.get("Cookie", "")

    def do_GET(self):
        if self.path == "/api/health":
            self._send(200, b"ok")
        elif self.path == "/api/auth/csrf":
            self._send(200, json.dumps({"csrfToken": "TESTCSRFTOKEN"}).encode())
        elif self.path == "/api/auth/session":
            if self._has_cookie():
                self._send(200, json.dumps({"user": {"email": "webmaster@localhost.com"}}).encode())
            else:
                self._send(200, b"{}")
        elif self.path == "/api/trpc/tenant.list":
            if self._has_cookie():
                self._send(200, b"[1]")
            else:
                self._send(401, b"{}")
        elif self.path == "/dashboard":
            if self._has_cookie():
                self._send(200, b"<html><body><main>dash</main></body></html>")
            else:
                self.send_response(302)
                self.send_header("Location", "/login")
                self.end_headers()
        else:
            self._send(404, b"not found")

    def do_POST(self):
        if self.path == "/api/auth/callback/credentials":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode()
            if MODE == "good" and "csrfToken=TESTCSRFTOKEN" in body:
                self.send_response(200)
                self.send_header("Set-Cookie", "authjs.session-token=sess123; Path=/")
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"{}")
            else:
                self._send(200, b"{}")
        else:
            self._send(404, b"not found")

    def _send(self, code, body):
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
PYEOF

  local port pid total=0 ok=0

  wait_up() {
    local p="$1" tries=0
    while [ $tries -lt 50 ]; do
      curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${p}/api/health" 2>/dev/null && return 0
      sleep 0.1
      tries=$((tries + 1))
    done
    return 1
  }

  check() {
    local label="$1" expect="$2" actual="$3"
    total=$((total + 1))
    if [ "$expect" = "$actual" ]; then
      ok=$((ok + 1))
      printf '  [%sOK%s]   %s (expected %s, got %s)\n' "$GRN" "$RST" "$label" "$expect" "$actual"
    else
      printf '  [%sMISS%s] %s (expected %s, got %s)\n' "$RED" "$RST" "$label" "$expect" "$actual"
    fi
  }

  count_status() {
    # count() → "<status> N" where status in PASS/FAIL/SKIP, counted from a
    # captured run_smoke transcript, for the given check header label.
    local transcript="$1" section="$2"
    printf '%s\n' "$transcript" | awk -v s="$section" '
      $0 ~ "=== "s { grab=1; next }
      grab && /^===/ { grab=0 }
      grab && /\[PASS\]/ { print "PASS"; exit }
      grab && /\[FAIL\]/ { print "FAIL"; exit }
      grab && /\[SKIP\]/ { print "SKIP"; exit }
      grab && /\[WARN\]/ { print "WARN"; exit }
    '
  }

  # strip ANSI for reliable matching
  strip_ansi() { sed -E 's/\x1B\[[0-9;]*[a-zA-Z]//g'; }

  printf '\n%sscenario 1 — good stub (full readiness)%s\n' "$CYN" "$RST"
  port=$(( (RANDOM % 5000) + 20000 ))
  python3 "$stub_py" "$port" good &
  pid=$!
  if wait_up "$port"; then
    READINESS_PASSWORD="testpass" READINESS_EMAIL="webmaster@localhost.com" \
      transcript="$(run_smoke "http://127.0.0.1:${port}" 2>&1 | strip_ansi)"
    check "L1 liveness"   "PASS" "$(count_status "$transcript" "L1  LIVENESS")"
    check "R1 login"      "PASS" "$(count_status "$transcript" "R1  READINESS-login")"
    check "R2 data"       "PASS" "$(count_status "$transcript" "R2  READINESS-data")"
    check "R3 page"       "PASS" "$(count_status "$transcript" "R3  READINESS-page")"
  else
    check "good stub came up" "PASS" "FAIL"
  fi
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null

  printf '\n%sscenario 2 — stub missing session cookie%s\n' "$CYN" "$RST"
  port=$(( (RANDOM % 5000) + 25000 ))
  python3 "$stub_py" "$port" nocookie &
  pid=$!
  if wait_up "$port"; then
    READINESS_PASSWORD="testpass" READINESS_EMAIL="webmaster@localhost.com" \
      transcript="$(run_smoke "http://127.0.0.1:${port}" 2>&1 | strip_ansi)"
    check "R1 login FAILs without cookie" "FAIL" "$(count_status "$transcript" "R1  READINESS-login")"

    ( set -uo pipefail
      READINESS_PASSWORD="testpass" READINESS_EMAIL="webmaster@localhost.com" \
        exec bash "$0" --strict --url "http://127.0.0.1:${port}" >/dev/null 2>&1
    )
    check "--strict exits 1 on FAIL" "1" "$?"

    ( set -uo pipefail
      READINESS_PASSWORD="testpass" READINESS_EMAIL="webmaster@localhost.com" \
        exec bash "$0" --report-only --url "http://127.0.0.1:${port}" >/dev/null 2>&1
    )
    check "--report-only exits 0 on FAIL" "0" "$?"
  else
    check "nocookie stub came up" "PASS" "FAIL"
  fi
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null

  printf '\n%sscenario 3 — no URL%s\n' "$CYN" "$RST"
  transcript="$(run_smoke "" 2>&1 | strip_ansi)"
  check "L1 SKIPs with no URL" "SKIP" "$(count_status "$transcript" "L1  LIVENESS")"
  ( exec bash "$0" >/dev/null 2>&1 )
  check "no-URL default run exits 0" "0" "$?"

  printf '\n%sscenario 4 — security hardening%s\n' "$CYN" "$RST"

  # (a) env-file allowlist must block PATH/LD_PRELOAD/etc injection — only
  # the explicit allowlisted keys this script reads may be imported.
  local sec_envfile sec_result sec_orig_path
  sec_envfile="$(mktemp)"
  cat > "$sec_envfile" <<SECEOF
PATH=/evil
LD_PRELOAD=/evil.so
CURL_CA_BUNDLE=/evil-ca.pem
READINESS_EMAIL=injtest@example.com
SECEOF
  sec_orig_path="$PATH"
  sec_result="$(
    unset LD_PRELOAD CURL_CA_BUNDLE READINESS_EMAIL
    load_env_file "$sec_envfile"
    if [ "$PATH" = "$sec_orig_path" ] && [ -z "${LD_PRELOAD:-}" ] && [ -z "${CURL_CA_BUNDLE:-}" ] \
      && [ "${READINESS_EMAIL:-}" = "injtest@example.com" ]; then
      echo OK
    else
      echo "BAD PATH=$PATH LD_PRELOAD=${LD_PRELOAD:-} CURL_CA_BUNDLE=${CURL_CA_BUNDLE:-} EMAIL=${READINESS_EMAIL:-}"
    fi
  )"
  check "env-file allowlist blocks PATH/LD_PRELOAD/CURL_CA_BUNDLE" "OK" "$sec_result"
  rm -f "$sec_envfile"

  # (b) the password must never be passed as a literal curl argv value
  # (visible to any local user via `ps -o args`) — assert the source has no
  # "password=${password}"-style argv usage left.
  local sec_argv_hits
  sec_argv_hits="$(grep -c -- '-urlencode "password=\${password}"' "$0" 2>/dev/null || true)"
  check "no --data-urlencode password=\${password} argv usage in source" "0" "${sec_argv_hits:-0}"

  # (c) the same umask-then-mktemp-then-chmod pattern the password temp
  # file uses must actually yield 0600 permissions.
  local sec_old_umask sec_probe sec_perm
  sec_old_umask="$(umask)"
  umask 077
  sec_probe="$(mktemp)"
  umask "$sec_old_umask"
  chmod 600 "$sec_probe" 2>/dev/null || true
  sec_perm="$(stat -c '%a' "$sec_probe" 2>/dev/null || stat -f '%Lp' "$sec_probe" 2>/dev/null)"
  rm -f "$sec_probe"
  check "password temp-file created 0600" "600" "$sec_perm"

  rm -f "$stub_py"

  printf '\n'
  if [ "$ok" = "$total" ]; then
    printf '%sPASS — %d/%d%s\n' "$GRN" "$ok" "$total" "$RST"
    exit 0
  else
    printf '%sFAIL — %d/%d%s\n' "$RED" "$ok" "$total" "$RST"
    exit 1
  fi
}

# =============================================================================
# main
# =============================================================================
if [ "$SELF_TEST" = "1" ]; then
  self_test
  exit $?
fi

load_env_file "$ENV_FILE"

if [ -z "$BASE_URL" ]; then
  BASE_URL="${APP_URL:-${NEXTAUTH_URL:-}}"
fi

printf '\n%sreadiness-smoke.sh%s — base: %s | report-only: %s | strict: %s\n' \
  "$CYN" "$RST" "${BASE_URL:-<none>}" "$([ "$REPORT_ONLY" = "1" ] && echo yes || echo no)" "$([ "$STRICT" = "1" ] && echo yes || echo no)"

run_smoke "$BASE_URL"

printf '\n'
if [ "$FAILS" -gt 0 ]; then
  RESULT="${RED}FAIL${RST}"
elif [ "$WARNS" -gt 0 ]; then
  RESULT="${YLW}WARN${RST}"
else
  RESULT="${GRN}PASS${RST}"
fi
printf 'Result : %b (%d fail, %d warn)\n' "$RESULT" "$FAILS" "$WARNS"

if [ "$STRICT" = "1" ] && [ "$FAILS" -gt 0 ]; then
  exit 1
fi
exit 0
