#!/usr/bin/env bash
# Adapted from os-factory/har (Apache-2.0) — tree-hash-bound validation records.
# =============================================================================
# verify-record.sh — tree-hash-bound validation records (HAR harvest M1)
#
# A "validation record" binds a PASS verdict to the exact content of the
# working tree (its git tree-hash) rather than to a branch name, a commit
# message, or a human's say-so. Re-run the same tree unchanged → the record
# still applies. Change one byte → the hash changes → the old record no
# longer covers it. Graceful-degrade posture cloned from lint-deploy.sh: a
# missing git / missing runner / missing jq never hard-fails this script —
# it fails OPEN (prints nothing / warns / exits 0) everywhere except the
# one place correctness requires a real FAIL: `check` reporting "no record".
#
# Usage:
#   verify-record.sh hash [--worktree|--staged]
#   verify-record.sh write
#   verify-record.sh check [--worktree|--staged|<hash>]
#   verify-record.sh --self-test
#
# Exit codes:
#   hash   — always 0 (prints the hash, or nothing if it cannot be computed)
#   write  — always 0 (writes the record on a "pass" verdict, else warns)
#   check  — 0 = record found with status "pass" (or cannot-compute);
#            1 = no matching record found
# =============================================================================

set -euo pipefail

RECORDS_DIR="test-artifacts/validations"

# -----------------------------------------------------------------------------
# Git presence / repo detection
# -----------------------------------------------------------------------------
have_git() { command -v git >/dev/null 2>&1; }
is_git_repo() { have_git && git rev-parse --is-inside-work-tree >/dev/null 2>&1; }

# -----------------------------------------------------------------------------
# compute_hash MODE — MODE is "worktree" or "staged".
#
# Prints the tree hash on stdout and returns 0 on success. Returns 1 and
# prints nothing when the hash cannot be computed (not a git repo, or git
# itself is missing) — this is the fail-open "cannot-compute" branch every
# caller treats as benign, never a hard error.
# -----------------------------------------------------------------------------
compute_hash() {
  local mode="$1"

  if ! is_git_repo; then
    return 1
  fi

  if [[ "$mode" == "staged" ]]; then
    git write-tree
    return 0
  fi

  # worktree mode: hash the FULL working tree (tracked edits, untracked
  # files, deletions) without touching the real index — a temp
  # GIT_INDEX_FILE primed from HEAD (or the empty tree on an unborn HEAD),
  # then `git add -A .` (which respects .gitignore the same as any other
  # add), then write-tree on that temp index.
  local tmp_dir tmp_index
  tmp_dir="$(mktemp -d)"
  tmp_index="$tmp_dir/index"
  trap 'rm -rf "$tmp_dir"' RETURN

  if git rev-parse -q --verify 'HEAD^{tree}' >/dev/null 2>&1; then
    GIT_INDEX_FILE="$tmp_index" git read-tree HEAD
  else
    GIT_INDEX_FILE="$tmp_index" git read-tree --empty
  fi
  # Exclude our own output dir — a record written by a prior `write` is
  # untracked and would otherwise get folded into the NEXT worktree hash,
  # perturbing the very hash it was keyed on (the HAR reference guards the
  # same hazard via a committed .gitignore; a pathspec exclude needs no
  # repo cooperation).
  GIT_INDEX_FILE="$tmp_index" git add -A -- . ":(exclude)$RECORDS_DIR" ":(exclude)$RECORDS_DIR/**"
  GIT_INDEX_FILE="$tmp_index" git write-tree
}

# -----------------------------------------------------------------------------
# hash — print the requested tree hash, or nothing (exit 0 always)
# -----------------------------------------------------------------------------
cmd_hash() {
  local mode="worktree"
  case "${1:-}" in
    --worktree|"") mode="worktree" ;;
    --staged)      mode="staged" ;;
    *)
      echo "verify-record.sh hash: unknown option: $1" >&2
      exit 1
      ;;
  esac

  local h
  if h="$(compute_hash "$mode")"; then
    printf '%s\n' "$h"
  fi
  exit 0
}

# -----------------------------------------------------------------------------
# write — run the stages runner; on a "pass" verdict, persist a record keyed
# by the current worktree tree-hash. Anything short of a clean pass (runner
# absent/failing, unparseable output, non-pass status) WARNS and writes
# nothing — never a hard failure.
# -----------------------------------------------------------------------------
cmd_write() {
  local hash
  if ! hash="$(compute_hash worktree)"; then
    echo "verify-record.sh write: cannot compute tree hash (not a git repo or git missing) — no record written" >&2
    exit 0
  fi

  local run_cmd="${RUN_STAGES_CMD:-node scripts/run-stages.mjs --full}"
  local output rc
  set +e
  output="$(eval "$run_cmd")"
  rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    printf 'WARN: verify-record.sh write: stages runner failed (exit %d) — no record written\n' "$rc" >&2
    exit 0
  fi

  local status
  if command -v jq >/dev/null 2>&1; then
    status="$(printf '%s' "$output" | jq -r '.status // empty' 2>/dev/null || true)"
  else
    status="$(printf '%s' "$output" \
      | grep -o '"status"[[:space:]]*:[[:space:]]*"[A-Za-z_]*"' \
      | head -n1 \
      | sed -E 's/.*"([A-Za-z_]*)"$/\1/')"
  fi

  if [[ "$status" != "pass" ]]; then
    printf 'WARN: verify-record.sh write: stages status is "%s" (not "pass") — no record written\n' "${status:-<unparseable>}" >&2
    exit 0
  fi

  local stages_json
  if command -v jq >/dev/null 2>&1; then
    stages_json="$(printf '%s' "$output" | jq -c '.stages // .')"
  else
    stages_json="$output"
  fi

  local timestamp
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local git_sha gitsha_json
  git_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  if [[ -n "$git_sha" ]]; then
    gitsha_json="\"$git_sha\""
  else
    gitsha_json="null"
  fi

  mkdir -p "$RECORDS_DIR"
  cat > "$RECORDS_DIR/$hash.json" <<EOF
{
  "hash": "$hash",
  "status": "pass",
  "stages": $stages_json,
  "timestamp": "$timestamp",
  "gitSha": $gitsha_json
}
EOF

  printf '%s\n' "$hash"
  exit 0
}

# -----------------------------------------------------------------------------
# check — exit 0 iff a "pass" record exists for the resolved hash; exit 1 if
# no such record exists; exit 0 (distinguished message) only when the hash
# itself cannot be computed (git absent / not a repo).
# -----------------------------------------------------------------------------
cmd_check() {
  local arg="${1:---worktree}"
  local hash

  case "$arg" in
    --worktree)
      if ! hash="$(compute_hash worktree)"; then
        echo "CANNOT-COMPUTE: not a git repo or git missing — no hash to check" >&2
        exit 0
      fi
      ;;
    --staged)
      if ! hash="$(compute_hash staged)"; then
        echo "CANNOT-COMPUTE: not a git repo or git missing — no hash to check" >&2
        exit 0
      fi
      ;;
    *)
      hash="$arg"
      ;;
  esac

  if [[ -f "$RECORDS_DIR/$hash.json" ]] \
    && grep -q '"status"[[:space:]]*:[[:space:]]*"pass"' "$RECORDS_DIR/$hash.json"; then
    exit 0
  fi

  echo "NO RECORD for $hash" >&2
  exit 1
}

# =============================================================================
# --self-test
# =============================================================================
ST_TOTAL=0
ST_PASS=0

st_assert() {
  local desc="$1" rc="$2"
  ST_TOTAL=$((ST_TOTAL + 1))
  if [[ "$rc" -eq 0 ]]; then
    printf '  [PASS] %s\n' "$desc"
    ST_PASS=$((ST_PASS + 1))
  else
    printf '  [FAIL] %s\n' "$desc"
  fi
}

self_test() {
  set +e

  local self
  self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  # Keep git's upward repo-search from escaping the sandbox and finding a
  # real ancestor repo (e.g. this framework checkout) during the non-git
  # assertions below.
  local ceiling
  ceiling="$(dirname "$tmp")"
  export GIT_CEILING_DIRECTORIES="$ceiling"

  # --- fixtures --------------------------------------------------------------
  local repo="$tmp/repo"
  mkdir -p "$repo"
  (
    cd "$repo" || exit 1
    git init -q
    git config user.email test@example.com
    git config user.name test
    echo "hello" > a.txt
    git add a.txt
    git commit -q -m init
  )

  local stub_pass="$tmp/stub-pass.sh"
  cat > "$stub_pass" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' '{"status":"pass","stages":["a","b"]}'
EOF
  chmod +x "$stub_pass"

  local stub_fail="$tmp/stub-fail.sh"
  cat > "$stub_fail" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' '{"status":"fail","stages":["a"]}'
exit 1
EOF
  chmod +x "$stub_fail"

  # --- 1. hash is deterministic -----------------------------------------------
  local h1 h2
  h1="$(cd "$repo" && "$self" hash --worktree)"
  h2="$(cd "$repo" && "$self" hash --worktree)"
  if [[ -n "$h1" && "$h1" == "$h2" ]]; then rc=0; else rc=1; fi
  st_assert "hash is deterministic across two calls" "$rc"

  # --- 2. hash changes after editing a file -----------------------------------
  echo "changed" > "$repo/a.txt"
  local h3
  h3="$(cd "$repo" && "$self" hash --worktree)"
  if [[ -n "$h3" && "$h3" != "$h1" ]]; then rc=0; else rc=1; fi
  st_assert "hash changes after editing a file" "$rc"

  # --- 3. --staged differs from --worktree when a change is unstaged ---------
  local staged_hash worktree_hash
  staged_hash="$(cd "$repo" && "$self" hash --staged)"
  worktree_hash="$(cd "$repo" && "$self" hash --worktree)"
  if [[ -n "$staged_hash" && "$staged_hash" != "$worktree_hash" ]]; then rc=0; else rc=1; fi
  st_assert "--staged differs from --worktree when a change is unstaged" "$rc"

  # back to a clean worktree for the write/check tests below
  (cd "$repo" && git checkout -q -- a.txt)
  local clean_hash
  clean_hash="$(cd "$repo" && "$self" hash --worktree)"

  # --- 4. check misses before write -------------------------------------------
  (cd "$repo" && "$self" check --worktree) >/dev/null 2>&1
  rc=$?
  if [[ $rc -eq 1 ]]; then assert_rc=0; else assert_rc=1; fi
  st_assert "check misses before any record is written" "$assert_rc"

  # --- 5. write creates the record on pass ------------------------------------
  (cd "$repo" && RUN_STAGES_CMD="$stub_pass" "$self" write) >/dev/null 2>&1
  if [[ -f "$repo/$RECORDS_DIR/$clean_hash.json" ]]; then rc=0; else rc=1; fi
  st_assert "write creates the record on a pass verdict" "$rc"

  # --- 6. check hits after write -----------------------------------------------
  (cd "$repo" && "$self" check --worktree) >/dev/null 2>&1
  st_assert "check hits after write" "$?"

  # --- 7. write does NOT create a record on fail -------------------------------
  echo "more" >> "$repo/a.txt"
  local fail_hash
  fail_hash="$(cd "$repo" && "$self" hash --worktree)"
  (cd "$repo" && RUN_STAGES_CMD="$stub_fail" "$self" write) >/dev/null 2>&1
  if [[ ! -f "$repo/$RECORDS_DIR/$fail_hash.json" ]]; then rc=0; else rc=1; fi
  st_assert "write does NOT create a record on a fail verdict" "$rc"
  (cd "$repo" && "$self" check --worktree) >/dev/null 2>&1
  rc=$?
  if [[ $rc -eq 1 ]]; then assert_rc=0; else assert_rc=1; fi
  st_assert "check still misses the fail-verdict hash" "$assert_rc"
  (cd "$repo" && git checkout -q -- a.txt)

  # --- 8. non-git dir: hash exits 0 with empty output ---------------------------
  local nongit="$tmp/nongit"
  mkdir -p "$nongit"
  local out
  out="$(cd "$nongit" && "$self" hash --worktree)"
  rc=$?
  if [[ $rc -eq 0 && -z "$out" ]]; then rc=0; else rc=1; fi
  st_assert "non-git dir: hash exits 0 with empty output" "$rc"

  # --- 9. non-git dir: check exits 0 (cannot-compute) ---------------------------
  (cd "$nongit" && "$self" check --worktree) >/dev/null 2>&1
  st_assert "non-git dir: check exits 0 (cannot-compute)" "$?"

  printf '\nPASS — %d/%d\n' "$ST_PASS" "$ST_TOTAL"
  if [[ "$ST_PASS" -eq "$ST_TOTAL" ]]; then
    exit 0
  else
    exit 1
  fi
}

# =============================================================================
# main
# =============================================================================
main() {
  local sub="${1:-}"
  case "$sub" in
    hash)        shift; cmd_hash "$@" ;;
    write)       shift; cmd_write "$@" ;;
    check)       shift; cmd_check "$@" ;;
    --self-test) self_test ;;
    *)
      echo "Usage: verify-record.sh {hash [--worktree|--staged] | write | check [--worktree|--staged|<hash>] | --self-test}" >&2
      exit 1
      ;;
  esac
}

main "$@"
