#!/usr/bin/env bash
# design-stop-hook.sh — Claude Code Stop hook (framework deliverable #21)
#
# PURPOSE:
#   Blocks a "done/fixed" claim whose evidence block is empty or missing
#   captured_output. Implements Rule 32 "Verifiable-Done" enforcement.
#
# DEPLOYED TO:
#   scripts/design-stop-hook.sh (chmod +x) in target app projects via deploy.sh
#
# HOW IT WORKS:
#   A Claude Code Stop hook receives the assistant's final response on stdin as JSON.
#   This script parses the response text, looks for a "done" or "fixed" claim in a
#   YAML evidence block, and BLOCKS when captured_output is absent or empty.
#
#   BLOCKING CONTRACT (code.claude.com/docs/en/hooks — "Decision control" / "Other exit
#   codes"): for the Stop event, exit 1 is a NON-BLOCKING error — Claude Code logs it but
#   lets the stop proceed. The only ways to actually block are exit 2 (reason read from
#   stderr) or printing `{"decision":"block","reason":"..."}` as JSON on stdout (any exit
#   code; this script uses exit 0 for that path, matching the official Stop-hook examples).
#   This script therefore prints the block JSON on stdout AND exits 0 on every block path
#   (plus echoes the message to stderr for a human reading the transcript). Every allow
#   path still exits 0 with empty stdout, same as before. Claude Code's own loop-protection
#   (the `stop_hook_active` input + an 8-consecutive-block cap) guards against this script
#   looping forever on a response that keeps failing the same check.
#
# EVIDENCE SCHEMA (from templates.md §V32.8):
#   evidence:
#     contract:        "human-readable acceptance criteria"
#     check_command:   "the exact command that was run"
#     captured_output: |
#       <real terminal output pasted here>
#
# SHELLCHECK-CLEAN: uses #!/usr/bin/env bash, set -euo pipefail, quoted expansions.

set -euo pipefail

# V32.67.3 FIX: this script uses relative paths throughout (docs/STATE.md,
# scripts/verify-record.sh, test-artifacts/validations) and a Claude Code hook's cwd is
# NOT guaranteed to be the project root — e.g. a session launched in a subdirectory fails
# every relative lookup here with "No such file or directory". $CLAUDE_PROJECT_DIR is the
# absolute project root Claude Code always sets for hook commands (code.claude.com/docs,
# via context7). cd into it before anything else; fail OPEN (allow the stop) if the cd
# itself fails rather than erroring out of a hook that is advisory by design. Tests that
# invoke this script directly with no CLAUDE_PROJECT_DIR set default to "." (today's
# behavior — cwd unchanged).
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# Canonical running-state file is docs/STATE.md (V32.33). A not-yet-migrated app
# (still on the legacy .cline/STATE.md, pre-V32.33) is read as an ADDITIVE FALLBACK
# so its Rule-32 gate is enforced correctly instead of failing open. docs-first
# ordering means a migrated app never consults the fallback. The fallback is retired
# per-app only after that app opts into migration (Scenario 46) — never globally.
STATE_FILE=""
for _state_cand in "docs/STATE.md" ".cline/STATE.md"; do
  if [[ -f "${_state_cand}" ]]; then STATE_FILE="${_state_cand}"; break; fi
done
BLOCK_MSG="Done-claim blocked: evidence field is empty or captured_output is missing.
Run the acceptance check, capture the real terminal output, and populate
evidence.contract + evidence.check_command + evidence.captured_output
before claiming done. See templates.md §V32.8 Verification.

STATE.md needs a YAML \`evidence:\` block in this exact shape (a Markdown
\"## EVIDENCE\" heading or prose section does NOT satisfy this gate):

evidence:
  contract: \"<what was claimed done>\"
  check_command: \"<exact command run>\"
  captured_output: |
    <real terminal output, indented>"

# json_escape — turn a (possibly multi-line) string into a JSON string literal body
# (no surrounding quotes) without a jq/python dependency, matching this script's existing
# grep/sed/awk-only design (see the "avoid a jq dependency" note above step 2). Escapes
# backslash and double-quote, maps newline/tab/CR to their JSON escapes.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

# block — print the Stop-hook JSON decision on stdout (exit 0, per the blocking contract
# above) AND echo the human-readable message to stderr, then exit 0.
block() {
  local msg="$1"
  echo "[design-stop-hook] BLOCKED: ${msg}" >&2
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "[design-stop-hook] BLOCKED: ${msg}")"
  exit 0
}

# ── 0. Guard: no STATE.md (neither docs/ nor .cline/) → nothing to check, allow ──
if [[ -z "${STATE_FILE}" ]]; then
  exit 0
fi

# ── 1. Read assistant response from stdin (JSON: {"stop_reason":…,"message":…}) ──
#   We only need the text content; extract it with grep/sed to avoid a jq dependency.
#   If stdin is empty or unparseable we allow (fail-open, hook is advisory).
response_text=""
if read -r -t 2 first_line 2>/dev/null; then
  # Collect the rest of stdin (may be multi-line JSON)
  response_text="${first_line}"
  while IFS= read -r -t 2 line 2>/dev/null; do
    response_text="${response_text}
${line}"
  done || true
fi

# ── 2. Does the response contain a done/fixed claim? ─────────────────────────
#   Matches phrases like "done", "fixed", "complete", "✅ done", "task complete".
#   Case-insensitive, bounded to avoid false-positives on random prose.
done_pattern='(done|fixed|complete|completed|✅)'
if ! echo "${response_text}" | grep -qiE "${done_pattern}"; then
  # No done-claim in this response → not subject to the evidence gate
  exit 0
fi

# ── 2b. Scope the gate to FRAMEWORK PHASE/BUILD work only ─────────────────────
#   The Verifiable-Done gate (Rule 32 / V32.8) is meant for phase/build done-claims
#   that SHOULD be recorded in STATE.md — not for ops/chat/deploy/credential sessions
#   that merely happen to say "done" or "✅". Require a framework-work keyword so the
#   gate stops nagging on non-phase sessions while still enforcing real phase closes.
phase_context='(phase [0-9]|part [0-9]|batch|scaffold|feature update|feature rollback|migration|acceptance|contract|evidence|STATE\.md)'
if ! echo "${response_text}" | grep -qiE "${phase_context}"; then
  # Done-word but no phase/build context → ops/chat session, not evidence-gated.
  exit 0
fi

# ── 2c. Gate on an ACTUAL STATE.md change (git-dirty check) ──────────────────
#   ROOT CAUSE of the false-positive block: done_pattern + phase_context match
#   plain chat/planning prose too — e.g. "...before Phase 4...Done thinking —
#   want me to propose the edit?" — which never touches STATE.md at all. A
#   real phase close WRITES evidence into STATE.md; a chat answer does not.
#   If git sees STATE_FILE clean (no uncommitted change, not untracked) this is
#   not a real done-claim to gate -> allow before even looking at its content.
#   Fail-open (continue to the checks below unchanged) when this isn't a git
#   repo — same posture as the rest of this advisory hook.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -z "$(git status --porcelain -- "${STATE_FILE}" 2>/dev/null)" ]]; then
    exit 0
  fi
fi

# ── 3. Check STATE.md for a done-claim with an empty evidence block ───────────
#   A populated evidence block MUST have a non-empty captured_output value.
#   We look for the pattern:
#     captured_output: (empty, |, null, {}, or ~)
#   which indicates the field was not actually filled in.

#   captured_output is EMPTY only if: the inline value is blank / null / {} / ~, OR it
#   uses a YAML block scalar (| or >) with NO indented content following. A block scalar
#   WITH indented content is FILLED — the prior single-line regex wrongly matched the
#   documented `captured_output: |` block form (its own schema, line 21) as empty and
#   false-positive-blocked correct done-claims (V32.33.1 fix). BLOCK if ANY block is empty.
if ! awk '
  function indent_of(s,   i){ i=0; while (substr(s,i+1,1)==" ") i++; return i }
  $0 ~ /captured_output:/ {
    if (in_block && !filled) empty=1
    in_block=0
    key_indent=indent_of($0)
    rest=$0; sub(/^.*captured_output:[ \t]*/,"",rest); gsub(/[ \t\r]+$/,"",rest)
    if (rest=="|"||rest=="|-"||rest=="|+"||rest==">"||rest==">-"||rest==">+"){ in_block=1; filled=0; next }
    if (rest==""||rest=="null"||rest=="~"||rest=="{}") empty=1
    next
  }
  in_block {
    if ($0 ~ /[^ \t\r]/){
      if (indent_of($0) > key_indent) filled=1
      else { if(!filled) empty=1; in_block=0 }
    }
    next
  }
  END { if (in_block && !filled) empty=1; exit (empty?1:0) }
' "${STATE_FILE}"; then
  block "${BLOCK_MSG}"
fi

# ── 4. ADOPTION GATE — require the YAML evidence: key only from apps that use it ──
#   An app's STATE.md may legitimately record evidence a different way — e.g. a Markdown
#   "## EVIDENCE"/"## SESSION N" heading with a prose summary (observed live: Marine-Guardian)
#   instead of the YAML `evidence:` key this hook otherwise enforces. STATE.md having NO
#   `evidence:` key ANYWHERE means that app has never adopted the V32.8 schema at all — so
#   there is nothing here for THIS STEP to check, same posture as steps 0/2/2b/2c failing
#   open for a session this gate doesn't apply to. Adoption is opt-in: a project adopts the
#   gate by adding the YAML `evidence:` block per templates.md §V32.8 — once it exists
#   (even once, anywhere in STATE.md), step 3 above enforces it is never left empty.
#
#   HARDENING (v32.67.5 security review finding): adoption is judged from the COMMITTED
#   STATE_FILE (`git show HEAD:...`), NEVER the working copy alone. Two bugs the old
#   working-copy-only check had:
#     (1) its early `exit 0` on "not adopted" also skipped step 5 (the record gate) — an
#         app that adopted validation records but not the YAML evidence key lost the
#         record gate entirely. Fixed: "not adopted" now skips ONLY this step's own check
#         and always falls through to step 5 below — it never exits early.
#     (2) reading the working copy let an agent delete the `evidence:` key from a dirty
#         STATE.md to silently bypass this whole gate. Fixed: once HEAD shows the key was
#         committed (adopted), removing it from the working copy is treated as evidence
#         tampering and BLOCKS, instead of silently falling back to "not adopted".
#   Fallback to the working copy (the pre-hardening behavior) applies ONLY when there is no
#   committed copy to judge from at all — not a git repo, or STATE_FILE was never committed
#   (new/untracked file) — `git show HEAD:...` fails in both cases.
head_state=""
head_available=0
# "HEAD:./<path>" resolves relative to the CURRENT directory (the app dir after the cd
# above), so an app living in a subdirectory of a larger repo still finds its own file.
# Fail CLOSED if git says the file is tracked but its committed copy can't be read.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if head_state="$(git show "HEAD:./${STATE_FILE}" 2>/dev/null)"; then
    head_available=1
  elif git ls-files --error-unmatch -- "${STATE_FILE}" >/dev/null 2>&1 \
       && git rev-parse --verify -q HEAD >/dev/null 2>&1; then
    block "Cannot read the committed copy of ${STATE_FILE} to check evidence adoption."
  fi
fi

# Two patterns (security review 2026-10-19):
#  - ADOPTION (judged from the committed copy) is deliberately LOOSE: any line that starts
#    with the key, e.g. `evidence:`, `evidence:   # comment`, `evidence: {...}`. A strict
#    pattern here would let a committed `evidence:  # note` look "not adopted" and make
#    deleting it un-blockable. Prose like "Notes — evidence: see below" still doesn't
#    count because the key must start the line.
#  - SATISFIED (judged from the working copy) stays STRICT: the key alone on its line,
#    optionally followed by a `# comment`, so "evidence: moved elsewhere" does not pass.
EVIDENCE_ADOPT_RE='^[[:space:]]*evidence:([[:space:]]|$)'
EVIDENCE_KEY_RE='^[[:space:]]*evidence:[[:space:]]*(#.*)?$'


working_has_evidence=1
if grep -qE "${EVIDENCE_KEY_RE}" "${STATE_FILE}"; then
  working_has_evidence=0
fi

if [[ "${head_available}" -eq 1 ]]; then
  head_has_evidence=1
  if printf '%s\n' "${head_state}" | grep -qE "${EVIDENCE_ADOPT_RE}"; then
    head_has_evidence=0
  fi

  if [[ "${head_has_evidence}" -eq 0 && "${working_has_evidence}" -ne 0 ]]; then
    block "This app adopted the YAML \`evidence:\` schema (committed in ${STATE_FILE}) but the working copy no longer has the \`evidence:\` key. Evidence appears to have been removed — restore the evidence: block (see templates.md §V32.8) before claiming done."
  fi
  if [[ "${head_has_evidence}" -eq 0 ]] && ! grep -q 'captured_output:' "${STATE_FILE}"; then
    block "This app adopted the YAML \`evidence:\` schema but the working copy's evidence block has no \`captured_output:\`. Restore it with the real command output (see templates.md §V32.8) before claiming done."
  fi
  # head_has_evidence == 1 (not adopted in HEAD): nothing more for THIS step to
  # check — fall through to step 5 unconditionally (never exit 0 here).
  # head_has_evidence == 0 && working_has_evidence == 0 (adopted + still present):
  # also falls through — step 3 above already enforced it isn't left empty.
else
  # Fallback: not a git repo, or STATE_FILE was never committed to HEAD — judge
  # adoption from the working copy. Not adopted → skip ONLY this step; step 5
  # (record gate) still runs, same as the HEAD branch above.
  :
fi

# ── 5. RECORD GATE — bind the done-claim to a passing validation record ──────
#   Record gate adapted from os-factory/har (Apache-2.0).
#   A done-claim surviving steps 1-4 still only proves STATE.md's evidence block
#   is non-empty — not that the CURRENT tree actually passes. If the literal
#   token VERIFY-OK is present, the claim is a documented human exception and
#   the gate is skipped. Otherwise, when scripts/verify-record.sh exists and is
#   executable, require a passing record for the current worktree tree-hash —
#   but ONLY once the app has ever written a FIRST record. An app still in
#   planning (test-artifacts/validations/ absent or empty) has no record store
#   yet; gating "no record" there is the same false-positive the 2c check above
#   fixes, just one step later — this app hasn't adopted the record gate yet.
#   Fail-open: no verify-record.sh, not executable, no record store, no git, or
#   cannot-compute → allow unchanged (verify-record.sh itself exits 0 on
#   cannot-compute).
RECORD_SCRIPT="scripts/verify-record.sh"
RECORDS_DIR="test-artifacts/validations"
if ! echo "${response_text}" | grep -q 'VERIFY-OK'; then
  if [[ -f "${RECORD_SCRIPT}" && -x "${RECORD_SCRIPT}" ]]; then
    if [[ -d "${RECORDS_DIR}" ]] \
      && find "${RECORDS_DIR}" -maxdepth 1 -type f -name '*.json' -print -quit 2>/dev/null | grep -q .; then
      if ! bash "${RECORD_SCRIPT}" check --worktree >/dev/null 2>&1; then
        block "Done-claim has no passing validation record for the current tree hash. Run \`node scripts/run-stages.mjs --full\` then \`bash scripts/verify-record.sh write\`, or add \`VERIFY-OK <reason>\` to the evidence line for a documented exception."
      fi
    fi
  fi
fi

# ── 6. All checks passed → allow the stop ────────────────────────────────────
exit 0
