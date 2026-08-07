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
#   YAML evidence block, and exits non-zero (blocking) if captured_output is absent
#   or empty. Exit 0 = allow the stop; non-zero = block it with a message.
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
before claiming done. See templates.md §V32.8 Verification."

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
  echo "[design-stop-hook] BLOCKED: ${BLOCK_MSG}" >&2
  exit 1
fi

# ── 4. Check that evidence block exists at all in STATE.md ───────────────────
#   If there is a done-claim in the response but STATE.md has no evidence: section,
#   that is also a violation.
if ! grep -q 'evidence:' "${STATE_FILE}"; then
  echo "[design-stop-hook] BLOCKED: STATE.md has no evidence: block. ${BLOCK_MSG}" >&2
  exit 1
fi

# ── 5. All checks passed → allow the stop ────────────────────────────────────
exit 0
