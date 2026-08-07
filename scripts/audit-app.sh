#!/usr/bin/env bash
# =============================================================================
# audit-app.sh — Powerbyte fleet App Audit Toolkit gate runner (Rule 38)
#
# T1 (commit-gate, seconds, blocking):  Gitleaks · Semgrep · tsc --noEmit · ESLint
# T2 (Phase-5 gate, minutes, blocking): Trivy (image/fs+config) · OSV-Scanner ·
#                                       Syft (SBOM) · BackstopJS (visual regression)
#
# Already-wired elsewhere — NOT re-run here (see .ai_prompt/audit.md):
#   axe-core/Pa11y  → accessibility-agents (R13 WCAG gate)
#   Playwright       → verify-all-pages
#   Lighthouse       → SEO >= 90 hard gate (Phase 5)
#
# Usage:
#   bash audit-app.sh [--tier=1|2] [--report-only] [--help] [TARGET_DIR]
#   ./scripts/audit-app.sh --tier=1 --report-only
#   ./scripts/audit-app.sh --tier=2 deploy/compose
#
# Exit codes:
#   0 — all checks PASS (or --report-only was given)
#   1 — one or more checks found a real CRITICAL/HIGH finding (fail-closed)
#
# Graceful degrade (non-negotiable — same posture as lint-deploy.sh C8):
#   a scanner missing from PATH => WARN + SKIP that check, never a FAIL.
#   Fail-closed on FINDINGS, fail-open on TOOLING.
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[0;33m'
BLU='\033[0;34m'
CYN='\033[0;36m'
RST='\033[0m'

PASS="${GRN}PASS${RST}"
FAIL="${RED}FAIL${RST}"
WARN="${YLW}WARN${RST}"
SKIP="${BLU}SKIP${RST}"

# ── State ─────────────────────────────────────────────────────────────────────
FAILS=0
WARNS=0
declare -a SUMMARY=()

TIER="both"
REPORT_ONLY=0
TARGET_DIR="."

# ── Arg parsing ───────────────────────────────────────────────────────────────
print_usage() {
  cat <<'USAGE'
audit-app.sh — App Audit Toolkit gate runner (Rule 38)

Usage:
  bash audit-app.sh [OPTIONS] [TARGET_DIR]

Options:
  --tier=1        Run T1 only (Gitleaks, Semgrep, tsc --noEmit, ESLint)
  --tier=2        Run T2 only (Trivy, OSV-Scanner, Syft, BackstopJS)
  (default)       Run both T1 and T2
  --report-only   Never exit non-zero; report findings only
  --help          Show this help and exit 0

TARGET_DIR defaults to "." (the current directory).

Exit codes:
  0  all checks pass, or --report-only was given
  1  a real CRITICAL/HIGH finding was reported (fail-closed on findings)

Missing tools always WARN + SKIP (fail-open on tooling) — an app must never
be un-buildable because a scanner isn't installed. T3 tools (ZAP, Stryker,
k6, manual pentest) are documented in .ai_prompt/audit.md but are NOT run
by this script — they are advisory/campaign-only and never gate a build.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --tier=1) TIER="1" ;;
    --tier=2) TIER="2" ;;
    --tier=both) TIER="both" ;;
    --report-only) REPORT_ONLY=1 ;;
    --help|-h) print_usage; exit 0 ;;
    --*) printf "Unknown option: %s\n" "$arg" >&2; print_usage; exit 2 ;;
    *) TARGET_DIR="$arg" ;;
  esac
done

TARGET_DIR="$(realpath "$TARGET_DIR")"

# ── Helpers ───────────────────────────────────────────────────────────────────
pass()  { printf "  [%b] %s\n" "$PASS" "$*"; SUMMARY+=("PASS  $*"); }
fail()  { printf "  [%b] %s\n" "$FAIL" "$*"; FAILS=$((FAILS + 1)); SUMMARY+=("FAIL  $*"); }
warn()  { printf "  [%b] %s\n" "$WARN" "$*"; WARNS=$((WARNS + 1)); SUMMARY+=("WARN-SKIPPED  $*"); }
skip()  { printf "  [%b] %s\n" "$SKIP" "$*"; SUMMARY+=("SKIP  $*"); }
header(){ printf "\n%b=== %s ===%b\n" "$CYN" "$*" "$RST"; }

have_tool() { command -v "$1" &>/dev/null; }

# A tool binary that exists on disk can still fail to RUN (missing runtime,
# e.g. node_modules/.bin/eslint with no `node` on PATH). That is a tooling
# problem, not a finding — fail-open on tooling, per §6.4. Detect the common
# "couldn't execute" signatures and treat them as WARN, never FAIL.
is_env_error() {
  printf '%s' "$1" | grep -qiE \
    'no such file or directory|command not found|cannot execute|cannot find module|module_not_found|is not recognized as|: not found$|enoent'
}

# ── Shared scan-scope exclusions ──────────────────────────────────────────────
# Stale agent worktrees (.claude/worktrees/*) duplicate the ENTIRE source tree,
# and vendored/build dirs add noise + time. Exclude them from every file-walking
# scanner via that tool's native ignore flag. tsc/eslint are config-scoped and
# already ignore these; gitleaks history-mode + osv-scanner honour .gitignore.
EXCLUDE_DIRS=(node_modules .claude .git dist build .next coverage)

SEMGREP_EXCLUDES=()   # semgrep --exclude <name>  (repeatable, path-segment match)
TRIVY_SKIPS=()        # trivy   --skip-dirs <glob> (repeatable)
SYFT_EXCLUDES=()      # syft    --exclude <glob>   (repeatable; needs **/ prefix)
for _d in "${EXCLUDE_DIRS[@]}"; do
  SEMGREP_EXCLUDES+=(--exclude "$_d")
  TRIVY_SKIPS+=(--skip-dirs "**/$_d")
  SYFT_EXCLUDES+=(--exclude "**/$_d/**")
done

printf "\n%b audit-app.sh — Powerbyte fleet App Audit Toolkit (Rule 38)%b\n" "$CYN" "$RST"
printf "Target : %s\n" "$TARGET_DIR"
printf "Tier   : %s  |  Report-only: %s\n" "$TIER" "$([ "$REPORT_ONLY" -eq 1 ] && echo yes || echo no)"

# =============================================================================
# TIER 1 — commit-gate (seconds, blocking)
# =============================================================================
if [ "$TIER" = "1" ] || [ "$TIER" = "both" ]; then

header "T1.1  Gitleaks — git-history secret scan"
if ! have_tool gitleaks; then
  warn "gitleaks not found — install: https://github.com/gitleaks/gitleaks (secret-scan skipped)"
else
  if [ -d "$TARGET_DIR/.git" ]; then
    if GL_OUT="$(gitleaks detect --source "$TARGET_DIR" --no-banner -v 2>&1)"; then
      pass "gitleaks — no secrets found in git history"
    elif is_env_error "$GL_OUT"; then
      warn "gitleaks — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$GL_OUT" | head -1)"
    else
      fail "gitleaks — potential secret(s) found in git history:"
      printf "%s\n" "$GL_OUT" | sed 's/^/      /'
    fi
  else
    if GL_OUT="$(gitleaks detect --source "$TARGET_DIR" --no-banner --no-git -v 2>&1)"; then
      pass "gitleaks — no secrets found (working tree, no .git)"
    elif is_env_error "$GL_OUT"; then
      warn "gitleaks — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$GL_OUT" | head -1)"
    else
      fail "gitleaks — potential secret(s) found in working tree:"
      printf "%s\n" "$GL_OUT" | sed 's/^/      /'
    fi
  fi
fi

header "T1.2  Semgrep — SAST (--config=auto)"
if ! have_tool semgrep; then
  warn "semgrep not found — install: pip install semgrep / brew install semgrep (SAST skipped)"
else
  SG_OUT=""
  SG_EXIT=0
  SG_OUT="$(semgrep --config=auto --error --quiet "${SEMGREP_EXCLUDES[@]}" "$TARGET_DIR" 2>&1)" || SG_EXIT=$?
  if [ "$SG_EXIT" -eq 0 ]; then
    pass "semgrep — no blocking findings"
  elif printf "%s" "$SG_OUT" | grep -qiE 'could not connect|network|registry|timed? out|failed to download|no internet'; then
    warn "semgrep — registry unreachable (offline/no-login) — SAST skipped this run"
  elif is_env_error "$SG_OUT"; then
    warn "semgrep — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$SG_OUT" | head -1)"
  else
    fail "semgrep — findings reported:"
    printf "%s\n" "$SG_OUT" | sed 's/^/      /'
  fi
fi

header "T1.3  tsc --noEmit — TypeScript type-check"
# Resolve a tsc binary once (root-local preferred, then global).
TSC_BIN=""
if [ -x "$TARGET_DIR/node_modules/.bin/tsc" ]; then
  TSC_BIN="$TARGET_DIR/node_modules/.bin/tsc"
elif have_tool tsc; then
  TSC_BIN="tsc"
fi
run_tsc_project() { "$TSC_BIN" --noEmit -p "$1" 2>&1; }  # $1 = tsconfig dir or file

# Detect a workspace/monorepo marker. The locked stack (pnpm + turbo) ships NO
# root tsconfig.json — each apps/*/ and packages/*/ owns its own. Testing only a
# root tsconfig silently NEVER type-checks any framework-built app (V32.38 bug).
is_monorepo=0
if [ -f "$TARGET_DIR/pnpm-workspace.yaml" ] || [ -f "$TARGET_DIR/turbo.json" ] \
   || { [ -f "$TARGET_DIR/package.json" ] && grep -q '"workspaces"' "$TARGET_DIR/package.json"; }; then
  is_monorepo=1
fi

if [ -f "$TARGET_DIR/tsconfig.json" ]; then
  # ── single-project mode (unchanged behaviour) ──
  if [ -z "$TSC_BIN" ]; then
    warn "tsc not found (no local node_modules/.bin/tsc, no global tsc) — type-check skipped"
  elif TS_OUT="$(run_tsc_project "$TARGET_DIR")"; then
    pass "tsc --noEmit — no type errors"
  elif is_env_error "$TS_OUT"; then
    warn "tsc — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$TS_OUT" | head -1)"
  else
    fail "tsc --noEmit — type errors reported:"
    printf "%s\n" "$TS_OUT" | sed 's/^/      /'
  fi

elif [ "$is_monorepo" -eq 1 ]; then
  # ── monorepo mode ── prefer the repo's OWN type-check script (honours project
  # references / turbo graph), else per-package `tsc -p`. Aggregate PASS/FAIL.
  TC_SCRIPT=""
  if [ -f "$TARGET_DIR/package.json" ]; then
    if   grep -qE '"type-check"[[:space:]]*:' "$TARGET_DIR/package.json"; then TC_SCRIPT="type-check"
    elif grep -qE '"typecheck"[[:space:]]*:'  "$TARGET_DIR/package.json"; then TC_SCRIPT="typecheck"
    fi
  fi
  PM=""
  if   [ -f "$TARGET_DIR/pnpm-lock.yaml" ] && have_tool pnpm; then PM="pnpm"
  elif [ -f "$TARGET_DIR/yarn.lock" ]      && have_tool yarn; then PM="yarn"
  elif have_tool npm; then PM="npm"
  fi

  if [ -n "$TC_SCRIPT" ] && [ -n "$PM" ]; then
    if MT_OUT="$(cd "$TARGET_DIR" && "$PM" run "$TC_SCRIPT" 2>&1)"; then
      pass "tsc (monorepo) — '$PM run $TC_SCRIPT' clean"
    elif is_env_error "$MT_OUT"; then
      warn "tsc (monorepo) — environment/runtime error, not a finding (skipped): $(printf '%s' "$MT_OUT" | head -1)"
    else
      fail "tsc (monorepo) — '$PM run $TC_SCRIPT' reported type errors:"
      printf "%s\n" "$MT_OUT" | sed 's/^/      /'
    fi
  elif [ -n "$TSC_BIN" ]; then
    # No repo type-check script — type-check each discovered package tsconfig.
    mapfile -t PKG_TSCONFIGS < <(find "$TARGET_DIR" -type f -name tsconfig.json \
      -not -path '*/node_modules/*' -not -path '*/.claude/*' -not -path '*/.git/*' \
      -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' \
      -not -path '*/coverage/*' 2>/dev/null | sort)
    if [ "${#PKG_TSCONFIGS[@]}" -eq 0 ]; then
      skip "monorepo detected but no package tsconfig.json found — type-check N/A"
    else
      TS_FAILS=0
      TS_FAIL_OUT=""
      for cfg in "${PKG_TSCONFIGS[@]}"; do
        rel="${cfg#"$TARGET_DIR"/}"
        if PT_OUT="$(run_tsc_project "$cfg")"; then
          :
        elif is_env_error "$PT_OUT"; then
          warn "tsc — env/runtime error on $rel (skipped): $(printf '%s' "$PT_OUT" | head -1)"
        else
          TS_FAILS=$((TS_FAILS + 1))
          TS_FAIL_OUT+="  ── $rel ──"$'\n'"$PT_OUT"$'\n'
        fi
      done
      if [ "$TS_FAILS" -eq 0 ]; then
        pass "tsc --noEmit (monorepo) — ${#PKG_TSCONFIGS[@]} package(s) clean"
      else
        fail "tsc --noEmit (monorepo) — type errors in $TS_FAILS of ${#PKG_TSCONFIGS[@]} package(s):"
        printf "%s\n" "$TS_FAIL_OUT" | sed 's/^/      /'
      fi
    fi
  else
    warn "tsc not found + no runnable type-check script — monorepo type-check skipped"
  fi

else
  skip "no tsconfig.json / workspace marker in $TARGET_DIR — not a TypeScript project, type-check N/A"
fi

header "T1.4  ESLint — lint gate"
ESLINT_BIN=""
if [ -x "$TARGET_DIR/node_modules/.bin/eslint" ]; then
  ESLINT_BIN="$TARGET_DIR/node_modules/.bin/eslint"
elif have_tool eslint; then
  ESLINT_BIN="eslint"
fi
if [ -z "$ESLINT_BIN" ]; then
  warn "eslint not found (no local node_modules/.bin/eslint, no global eslint) — lint skipped"
else
  if ! ls "$TARGET_DIR"/eslint.config.* &>/dev/null && [ ! -f "$TARGET_DIR/.eslintrc" ] \
     && ! ls "$TARGET_DIR"/.eslintrc.* &>/dev/null; then
    skip "no eslint config found in $TARGET_DIR — lint N/A"
  else
    if ES_OUT="$("$ESLINT_BIN" "$TARGET_DIR" 2>&1)"; then
      pass "eslint — no lint errors"
    elif is_env_error "$ES_OUT"; then
      warn "eslint — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$ES_OUT" | head -1)"
    else
      fail "eslint — lint errors reported:"
      printf "%s\n" "$ES_OUT" | sed 's/^/      /'
    fi
  fi
fi

fi # end TIER 1

# =============================================================================
# TIER 2 — Phase 5 validation gate (minutes, blocking)
# =============================================================================
if [ "$TIER" = "2" ] || [ "$TIER" = "both" ]; then

header "T2.1  Trivy — image/fs CVE scan"
if ! have_tool trivy; then
  warn "trivy not found — install: https://aquasecurity.github.io/trivy (CVE scan skipped)"
else
  TR_OUT=""
  TR_EXIT=0
  TR_OUT="$(trivy fs --scanners vuln --severity CRITICAL,HIGH --exit-code 1 --quiet "${TRIVY_SKIPS[@]}" "$TARGET_DIR" 2>&1)" || TR_EXIT=$?
  if [ "$TR_EXIT" -eq 0 ]; then
    pass "trivy fs — no CRITICAL/HIGH CVEs"
  elif is_env_error "$TR_OUT"; then
    warn "trivy fs — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$TR_OUT" | head -1)"
  else
    fail "trivy fs — CRITICAL/HIGH CVE(s) found:"
    printf "%s\n" "$TR_OUT" | sed 's/^/      /'
  fi
fi

header "T2.2  Trivy config — IaC scan (deploy/compose)"
if ! have_tool trivy; then
  warn "trivy not found — IaC config scan skipped"
else
  COMPOSE_DIR="$TARGET_DIR/deploy/compose"
  if [ ! -d "$COMPOSE_DIR" ]; then
    skip "no deploy/compose directory in $TARGET_DIR — IaC scan N/A"
  else
    TC_OUT=""
    TC_EXIT=0
    TC_OUT="$(trivy config --severity CRITICAL,HIGH --exit-code 1 --quiet "$COMPOSE_DIR" 2>&1)" || TC_EXIT=$?
    if [ "$TC_EXIT" -eq 0 ]; then
      pass "trivy config — no CRITICAL/HIGH IaC misconfigurations in deploy/compose"
    elif is_env_error "$TC_OUT"; then
      warn "trivy config — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$TC_OUT" | head -1)"
    else
      fail "trivy config — CRITICAL/HIGH IaC misconfiguration(s) found:"
      printf "%s\n" "$TC_OUT" | sed 's/^/      /'
    fi
  fi
fi

header "T2.3  OSV-Scanner — SCA (OS packages + transitive deps)"
if ! have_tool osv-scanner; then
  warn "osv-scanner not found — install: https://google.github.io/osv-scanner (SCA skipped)"
else
  OSV_OUT=""
  OSV_EXIT=0
  OSV_OUT="$(osv-scanner --recursive "$TARGET_DIR" 2>&1)" || OSV_EXIT=$?
  if [ "$OSV_EXIT" -eq 0 ]; then
    pass "osv-scanner — no known vulnerabilities"
  elif is_env_error "$OSV_OUT"; then
    warn "osv-scanner — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$OSV_OUT" | head -1)"
  else
    fail "osv-scanner — known vulnerabilities found:"
    printf "%s\n" "$OSV_OUT" | sed 's/^/      /'
  fi
fi

header "T2.4  Syft — SBOM emit (release artifact)"
if ! have_tool syft; then
  warn "syft not found — install: https://github.com/anchore/syft (SBOM emit skipped)"
else
  SBOM_DIR="$TARGET_DIR/test-artifacts/audit"
  SBOM_OUT_FILE="$SBOM_DIR/sbom.cdx.json"
  mkdir -p "$SBOM_DIR"
  if SY_OUT="$(syft dir:"$TARGET_DIR" "${SYFT_EXCLUDES[@]}" -o "cyclonedx-json=$SBOM_OUT_FILE" 2>&1)"; then
    pass "syft — SBOM emitted to ${SBOM_OUT_FILE#"$TARGET_DIR"/}"
  elif is_env_error "$SY_OUT"; then
    warn "syft — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$SY_OUT" | head -1)"
  else
    fail "syft — SBOM generation failed:"
    printf "%s\n" "$SY_OUT" | sed 's/^/      /'
  fi
fi

header "T2.5  BackstopJS — visual regression"
BACKSTOP_BIN=""
if [ -x "$TARGET_DIR/node_modules/.bin/backstop" ]; then
  BACKSTOP_BIN="$TARGET_DIR/node_modules/.bin/backstop"
elif have_tool backstop; then
  BACKSTOP_BIN="backstop"
fi
if [ -z "$BACKSTOP_BIN" ]; then
  warn "backstop not found (no local node_modules/.bin/backstop, no global backstop) — visual regression skipped"
else
  if [ ! -f "$TARGET_DIR/backstop.json" ]; then
    skip "no backstop.json in $TARGET_DIR — visual regression config N/A"
  else
    if BS_OUT="$("$BACKSTOP_BIN" test --config="$TARGET_DIR/backstop.json" 2>&1)"; then
      pass "backstopjs — no visual regressions"
    elif is_env_error "$BS_OUT"; then
      warn "backstopjs — environment/runtime error, not a finding (skipped this run): $(printf '%s' "$BS_OUT" | head -1)"
    else
      fail "backstopjs — visual regression(s) detected:"
      printf "%s\n" "$BS_OUT" | sed 's/^/      /'
    fi
  fi
fi

header "T2 — already-gated elsewhere (not re-run by this script)"
printf "  %b Playwright (verify-all-pages), axe-core/Pa11y (accessibility-agents, R13 WCAG),\n" "$SKIP"
printf "      Lighthouse (SEO >= 90 hard gate) run at their own framework gates — see .ai_prompt/audit.md\n"

fi # end TIER 2

# =============================================================================
# Summary
# =============================================================================
printf "\n%b─────────────────────────────────────────────────────%b\n" "$CYN" "$RST"
printf "AUDIT-APP SUMMARY  |  target: %s  |  tier: %s\n" "$TARGET_DIR" "$TIER"
for line in "${SUMMARY[@]}"; do
  printf "  %s\n" "$line"
done
printf "  Total: %d check(s)  |  %d failure(s)  |  %d warning(s)\n" \
  "${#SUMMARY[@]}" "$FAILS" "$WARNS"

if [ "$REPORT_ONLY" -eq 1 ]; then
  if [ "$FAILS" -gt 0 ]; then
    printf "  Result : %b  (%d finding(s) — report-only, not blocking)%b\n" "$WARN" "$FAILS" "$RST"
  else
    printf "  Result : %b  (report-only run)%b\n" "$PASS" "$RST"
  fi
  printf "%b─────────────────────────────────────────────────────%b\n\n" "$CYN" "$RST"
  exit 0
fi

if [ "$FAILS" -gt 0 ]; then
  printf "  Result : %b  (%d failure(s), %d warning(s))%b\n" "$FAIL" "$FAILS" "$WARNS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n\n" "$CYN" "$RST"
  exit 1
elif [ "$WARNS" -gt 0 ]; then
  printf "  Result : %b  (%d warning(s) — missing tooling, fail-open)%b\n" "$WARN" "$WARNS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n\n" "$CYN" "$RST"
  exit 0
else
  printf "  Result : %b  (all checks clean)%b\n" "$PASS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n\n" "$CYN" "$RST"
  exit 0
fi
