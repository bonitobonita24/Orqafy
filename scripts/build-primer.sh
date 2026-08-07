#!/usr/bin/env bash
# =============================================================================
# build-primer.sh — Powerbyte fleet Capability-Primer regenerator (V32.40, deliverable #38)
#
# Rewrites ONLY the text between the AIEF:PRIMER markers in a target file
# (default: CLAUDE.md at project root), preserving everything else byte-for-
# byte. The FLAGS slice it renders is the always-on, loadout-deciding projection
# consumed by ~/.claude/rules/skill-loadout-card.md STEP 0 + analyze-confirm-gate.md
# HAND-2 — it makes the skill/plugin loadout PROJECT-aware instead of task-shape
# generic. Direct sibling of sync-context.sh (#27): same shebang/flag/exit-code
# shape, same marker-region-regenerator role. Format spec + slice contract:
# ~/.claude/templates/capability-primer.md.
#
# WHY a structured source (docs/primer.yml) and NOT docs/PRODUCT.md prose:
#   PRODUCT.md is free-form prose. Grepping loadout-deciding SEMANTICS out of
#   prose (is RBAC the 3-tier standard or a custom set? is mobile native or
#   responsive-web?) is exactly the fragile guessing the primer exists to
#   PREVENT — its proven value was CORRECTING wrong shape-only instincts. So the
#   agent authors those judgements ONCE into a flat KEY: value source (same grep
#   model as STATE.md), and this script mechanically + idempotently renders the
#   marker region from it. Semantic judgement lives in primer.yml; the machinery
#   here stays deterministic.
#
# Usage:
#   bash scripts/build-primer.sh                  # regenerate CLAUDE.md AIEF:PRIMER region (no-op if unchanged)
#   bash scripts/build-primer.sh --check          # dry-run: exit 0 if unchanged, exit 3 if it would change
#   bash scripts/build-primer.sh --file <relpath> # target a different project-relative file
#
# Exit codes:
#   0 — unchanged (idempotent no-op) OR successfully (re)written OR scaffolded a stub source
#   1 — usage / path-hardening error (bad --file, corrupt markers, etc.)
#   3 — (--check only) rendered block differs from what's on disk
#
# Source read (project-relative, best-effort):
#   docs/primer.yml   → flat KEY: value fields (see FIELDS below). A MISSING source
#                       is SCAFFOLDED as a `?`-filled stub (never guessed) and the
#                       region is rendered with `?` placeholders for the agent to fill.
#
# IDEMPOTENCY CONTRACT (mandatory — mirrors sync-context.sh):
#   The rendered block is a PURE FUNCTION of docs/primer.yml. NO timestamps, NO
#   `date`, NO git rev — the primer is a stable projection of the spec, not a
#   session clock. If the newly-rendered inner block is byte-identical to what is
#   already between the markers, the file is NOT touched (no write, no mtime
#   change, no .bak).
# =============================================================================

set -euo pipefail

# ── Args ─────────────────────────────────────────────────────────────────────
MODE="write"        # write | check
REL_FILE="CLAUDE.md"
while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE="check"; shift ;;
    --file)
      [ $# -ge 2 ] || { printf "Error: --file requires an argument\n" >&2; exit 1; }
      REL_FILE="$2"; shift 2 ;;
    -*) printf "Unknown flag: %s\n" "$1" >&2; exit 1 ;;
    *)  printf "Unexpected argument: %s\n" "$1" >&2; exit 1 ;;
  esac
done

# ── Colour helpers (mirrors sync-context.sh) ─────────────────────────────────
if [ -t 1 ]; then
  RST=$'\033[0m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; CYN=$'\033[36m'
else RST=""; RED=""; GRN=""; YLW=""; CYN=""; fi

# ── PATH HARDENING (identical posture to sync-context.sh) ────────────────────
case "$REL_FILE" in
  /*) printf "%bError:%b --file must be project-relative, not absolute: %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1 ;;
esac
case "$REL_FILE" in
  *..*) printf "%bError:%b --file must not contain '..': %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1 ;;
esac

PROJECT_ROOT="$(pwd -P)"
TARGET="$PROJECT_ROOT/$REL_FILE"

if [ -e "$TARGET" ]; then
  RESOLVED_DIR="$(cd "$(dirname "$TARGET")" 2>/dev/null && pwd -P)" || {
    printf "%bError:%b cannot resolve directory of --file target: %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1; }
  RESOLVED="$RESOLVED_DIR/$(basename "$TARGET")"
  if [ -L "$TARGET" ]; then
    LINK_REAL="$(readlink -f "$TARGET" 2>/dev/null || true)"
    case "$LINK_REAL" in
      "$PROJECT_ROOT"/*) : ;;
      *) printf "%bError:%b --file is a symlink escaping project root: %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1 ;;
    esac
  fi
else
  PARENT_DIR="$(dirname "$TARGET")"
  mkdir -p "$PARENT_DIR" 2>/dev/null || true
  RESOLVED_DIR="$(cd "$PARENT_DIR" 2>/dev/null && pwd -P)" || {
    printf "%bError:%b cannot resolve parent directory for --file target: %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1; }
  RESOLVED="$RESOLVED_DIR/$(basename "$TARGET")"
fi
case "$RESOLVED_DIR" in
  "$PROJECT_ROOT"|"$PROJECT_ROOT"/*) : ;;
  *) printf "%bError:%b resolved target escapes project root: %s\n" "$RED" "$RST" "$REL_FILE" >&2; exit 1 ;;
esac

START_MARKER="<!-- AIEF:PRIMER START -->"
END_MARKER="<!-- AIEF:PRIMER END -->"

PRIMER_SRC="$PROJECT_ROOT/docs/primer.yml"
DETAIL_DOC="$PROJECT_ROOT/docs/CAPABILITY_PRIMER.md"

# ── Scaffold a `?`-filled source stub if docs/primer.yml is absent ───────────
# NEVER guesses a value — an un-authored primer is all `?` until the agent fills
# it from docs/PRODUCT.md. In --check mode we do NOT create files (dry-run).
scaffold_primer_src() {
  [ "$MODE" = "check" ] && return 0
  mkdir -p "$PROJECT_ROOT/docs" 2>/dev/null || true
  cat > "$PRIMER_SRC" <<'STUB'
# docs/primer.yml — Capability Primer source (agent-authored from docs/PRODUCT.md).
# Flat KEY: value. Unknown/uncertain = ?  (NEVER guess — an unknown stays `?`).
# scripts/build-primer.sh renders the AIEF:PRIMER region of CLAUDE.md from these.
# Field contract + rationale: ~/.claude/templates/capability-primer.md (SLICE 1).
STACK: ?          # deviations from the locked stack, or "locked-stack"
REALTIME: ?       # SSE | WS | none
JOBS: ?           # BullMQ | none  (+ what they run)
TENANCY: ?        # single | multi
TENANCY_MODEL: ?  # subdomain | subdirectory | separate-schema | -  (- if single)
RBAC: ?           # 3-tier | custom-roles | none
GOV_LGU: ?        # yes | no
PUBLIC_FACING: ?  # yes | no
MOBILE: ?         # none | responsive-web | native-expo
A11Y_GATE: ?      # WCAG | standard
PII: ?            # yes | no
FINANCIAL: ?      # yes | no
COMPLIANCE: ?     # PH-DPA | BIR-7yr | GDPR | none  (comma-join if several)
INTEGRATIONS: ?   # comma list of the ones that pull a specific skill/SDK (Xendit, Stripe, Resend, Turnstile) or -
MODULES: ?        # N surfaces (detail lives in docs/CAPABILITY_PRIMER.md)
SECURITY: ?       # L-levels active (e.g. L1-L6) or none
STUB
  printf "%b build-primer:%b scaffolded stub %s — fill it from docs/PRODUCT.md (unknowns stay '?')\n" "$YLW" "$RST" "docs/primer.yml"
}

# ── Scaffold the DETAIL slice doc if absent (on-demand, hand-authored prose) ─
scaffold_detail_doc() {
  [ "$MODE" = "check" ] && return 0
  [ -f "$DETAIL_DOC" ] && return 0
  mkdir -p "$PROJECT_ROOT/docs" 2>/dev/null || true
  cat > "$DETAIL_DOC" <<'STUB'
# <App> — Capability Primer (detail)
> Projection of docs/PRODUCT.md · read at the weight-gated loadout step for a real task · not a spec, a routing digest.
> Hand-authored (prose). The always-on FLAGS slice lives in CLAUDE.md (AIEF:PRIMER) and is regenerated by scripts/build-primer.sh.

## Module / feature map  (§Modules & Features)
- <Module> — <one line: what it is + any tier/role gate + the skill/brain it implies>

## Standing flags & why they change the loadout  (§Compliance · §Tenancy · §Non-functional)
- Tenancy: <mode> → <skill/brain implied>
- gov/LGU: <yes/no> → <WCAG gate on/off>
- Data sensitivity: <PII/financial/compliance> → <secure-code-guardian / privacy.md / audit>

## Integrations → skills/SDKs  (§Integrations)
- <Integration> → <context7 target / skill / security note>

## Out of scope / v1 limits  (§Out of Scope + v1 caveats)
- <explicit exclusion> — do NOT propose/build it

## Gotchas / project-specific traps  (from STATE/lessons, hand-curated)
- <trap> — <how to avoid>
STUB
  printf "%b build-primer:%b scaffolded stub %s — hand-author the detail slice\n" "$YLW" "$RST" "docs/CAPABILITY_PRIMER.md"
}

if [ ! -f "$PRIMER_SRC" ]; then
  scaffold_primer_src
  scaffold_detail_doc
fi

# ── Read a flat KEY: value field from docs/primer.yml (best-effort) ──────────
# Missing file OR missing key OR literal "?" → empty, so render_block prints "?".
read_primer_field() { # read_primer_field <KEY>
  local key="$1" val=""
  [ -f "$PRIMER_SRC" ] || return 0
  # First non-comment "KEY: value" line; strip an inline "# comment" and trailing ws.
  val="$(grep -m1 -E "^[[:space:]]*${key}:" "$PRIMER_SRC" 2>/dev/null \
    | sed -E "s/^[[:space:]]*${key}:[[:space:]]*//" \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/[[:space:]]+$//' || true)"
  [ "$val" = "?" ] && val=""
  printf '%s' "$val"
}

f() { local v; v="$(read_primer_field "$1")"; printf '%s' "${v:-?}"; }

STACK="$(f STACK)"
REALTIME="$(f REALTIME)"
JOBS="$(f JOBS)"
TENANCY="$(f TENANCY)"
TENANCY_MODEL="$(f TENANCY_MODEL)"
RBAC="$(f RBAC)"
GOV_LGU="$(f GOV_LGU)"
PUBLIC_FACING="$(f PUBLIC_FACING)"
MOBILE="$(f MOBILE)"
A11Y_GATE="$(f A11Y_GATE)"
PII="$(f PII)"
FINANCIAL="$(f FINANCIAL)"
COMPLIANCE="$(f COMPLIANCE)"
INTEGRATIONS="$(f INTEGRATIONS)"
MODULES="$(f MODULES)"
SECURITY="$(f SECURITY)"

# ── Render the managed FLAGS block (pure function of docs/primer.yml) ────────
# Layout MUST match ~/.claude/templates/capability-primer.md SLICE 1 exactly.
render_block() {
  printf '%s\n' "$START_MARKER"
  printf '%s\n' "<!-- Auto-generated by scripts/build-primer.sh from docs/primer.yml — do not edit between markers. Everything else is human-owned. -->"
  printf '%s\n' "Stack:     ${STACK} · realtime: ${REALTIME} · jobs: ${JOBS}"
  printf '%s\n' "Tenancy:   ${TENANCY} · ${TENANCY_MODEL} · RBAC: ${RBAC}"
  printf '%s\n' "Flags:     gov/LGU=${GOV_LGU} · public-facing=${PUBLIC_FACING} · mobile=${MOBILE} · a11y-gate=${A11Y_GATE}"
  printf '%s\n' "Data:      PII=${PII} · financial=${FINANCIAL} · compliance=${COMPLIANCE}"
  printf '%s\n' "Integrations: ${INTEGRATIONS}"
  printf '%s\n' "Modules:   ${MODULES} · security=${SECURITY}"
  printf '%s\n' "$END_MARKER"
}

NEW_BLOCK="$(render_block)"

# ── Read existing file + locate markers ──────────────────────────────────────
EXISTING=""
if [ -f "$RESOLVED" ]; then
  EXISTING="$(cat "$RESOLVED")"
fi

HAS_START=0; HAS_END=0
if printf '%s' "$EXISTING" | grep -qF "$START_MARKER"; then HAS_START=1; fi
if printf '%s' "$EXISTING" | grep -qF "$END_MARKER"; then HAS_END=1; fi

if [ "$HAS_START" -eq 1 ] && [ "$HAS_END" -eq 0 ]; then
  printf "%bError:%b found START marker without END marker in %s — corrupt file, aborting without writing.\n" "$RED" "$RST" "$REL_FILE" >&2
  exit 1
fi
if [ "$HAS_START" -eq 0 ] && [ "$HAS_END" -eq 1 ]; then
  printf "%bError:%b found END marker without START marker in %s — corrupt file, aborting without writing.\n" "$RED" "$RST" "$REL_FILE" >&2
  exit 1
fi

# ── Compose the rendered full-file content ───────────────────────────────────
if [ "$HAS_START" -eq 1 ] && [ "$HAS_END" -eq 1 ]; then
  RENDERED="$(awk -v start="$START_MARKER" -v end="$END_MARKER" -v block="$NEW_BLOCK" '
    BEGIN { in_block = 0 }
    {
      if (index($0, start) > 0 && in_block == 0) {
        print block
        in_block = 1
        next
      }
      if (in_block == 1) {
        if (index($0, end) > 0) { in_block = 0 }
        next
      }
      print
    }
  ' <<<"$EXISTING")"
else
  # No markers present: append the region at EOF.
  if [ -n "$EXISTING" ]; then
    RENDERED="$(printf '%s\n\n%s\n' "$EXISTING" "$NEW_BLOCK")"
  else
    RENDERED="$(printf '%s\n' "$NEW_BLOCK")"
  fi
fi

# ── Idempotency check: compare rendered output to what's on disk ────────────
if [ -f "$RESOLVED" ] && [ "$RENDERED" = "$EXISTING" ]; then
  printf "%b build-primer:%b %s AIEF:PRIMER region unchanged (idempotent no-op)\n" "$GRN" "$RST" "$REL_FILE"
  exit 0
fi

if [ "$MODE" = "check" ]; then
  printf "%b build-primer --check:%b %s AIEF:PRIMER region would change\n" "$YLW" "$RST" "$REL_FILE"
  exit 3
fi

# ── Write atomically: temp file + mv ─────────────────────────────────────────
TMP="$(mktemp "${RESOLVED}.tmp.XXXXXX")"
printf '%s\n' "$RENDERED" > "$TMP"
mv -f "$TMP" "$RESOLVED"
printf "%b build-primer:%b %s AIEF:PRIMER region regenerated from docs/primer.yml\n" "$CYN" "$RST" "$REL_FILE"
exit 0
