#!/usr/bin/env bash
# =============================================================================
# lint-design.sh — Powerbyte fleet design anti-slop gate (V32.19, deliverable #26)
#
# Static "AI-slop" linter for emitted UI. Catches the 7 cardinal sins that mark
# default-LLM output BEFORE a design phase closes. Mirrors lint-deploy.sh (#20):
# same colour/state/summary/exit-code shape, same role — a cheap, deterministic
# pre-gate that reports findings to the agent for self-correction.
#
# Origin: the "seven cardinal sins" from nexu-io/open-design craft/anti-ai-slop.md
# (Apache-2.0), itself adapted from referodesign/refero_skill (MIT). Tightened to
# the Spec-Driven stack (shadcn/ui + Tailwind + var(--*) tokens from docs/DESIGN.md).
# V32.19 extends the catalogue with tells harvested (concept-only) from
# Pythoughts-labs/designer-skill (MIT).
#
# Usage:
#   bash scripts/lint-design.sh [TARGET_DIR]     # defaults to apps/web/src (or .)
#   bash scripts/lint-design.sh --report-only    # surface findings, never fail (Phase 3.3)
#   bash scripts/lint-design.sh --strict         # any P0 hit → exit 1 (Phase 5 gate)
#
# Exit codes:
#   0 — clean, OR findings surfaced in --report-only mode
#   1 — one or more P0 sins found in --strict mode (Phase 5 hard gate)
#
# P0 sins checked (auto-enforced — failing one is a regression, not a preference):
#   D1  Tailwind default indigo as accent  (#6366f1 … #a855f7 → use var(--accent))
#   D2  Two-stop "trust" hero gradient     (purple→blue / blue→cyan / indigo→pink)
#   D3  Emoji as feature icons             (✨🚀🎯⚡🔥💡 in h*/button/li/.icon → monoline SVG)
#   D4  Hardcoded sans on display text     (Inter/Roboto/system-ui on h1/h2 → var(--font-display))
#   D5  AI dashboard tile                  (rounded card + coloured left-border accent)
#   D6  Invented metrics                   ("10× faster", "99.9% uptime", "3× more")
#   D7  Filler copy                        (lorem ipsum, "feature one/two/three", placeholder)
#   D8  Gradient / clip-to-text fill       (bg-clip-text+text-transparent / background-clip:text)
#
# P1 guidance (reported as warnings, never fail) — statically detectable subset:
#   P1a ALL-CAPS without letter-spacing    (text-transform:uppercase / uppercase class w/o tracking)
#   P1b Italic serif display headline      (italic + Fraunces/Playfair/Recoleta/Newsreader)
#   P1c Marketing buzzwords                (streamline/empower/supercharge/world-class/enterprise-grade/…)
#   P1d Repeating-gradient stripes         (repeating-linear/radial/conic-gradient surface decoration)
#   P1e Layout-property transition         (transition on width/height/margin/padding → see motion.md transform+opacity rule)
#   P1f Bounce / elastic easing            (cubic-bezier overshoot / ease-*-back / spring bounce)
#   P1g Justified body text                (text-align:justify / text-justify — rivers of white)
#   P1h Image hover transform              (<img> hover:scale-/hover:rotate-)
#   P1i Crushed / negative letter-spacing  (tracking-tighter / letter-spacing:-0.0x)
#   P1j Flat / shadowless primary button   (shadow-none on Button / ghost|link as a submit action → needs shadow-xs emboss)
#   P1k Version-label decorative eyebrow    (BETA / ALPHA / EARLY ACCESS / v0.6 used as a hero eyebrow)
#   P1l Numbered-section eyebrow            (00 / 01 / 00·INDEX / 001·Capabilities decorative section numbers)
#   P1m "· No. 01" sub-eyebrow meta-line    (Brand · No. 01 decorative catalogue-number strip)
#   P1n Locale/time/weather HUD strip       (18°C-style temperature chip as decorative HUD)
#   P1o Scroll-cue indicator copy           ("scroll" / "scroll down" hero indicator text)
#   P1p Decorative status dots everywhere   (tiny rounded-full + animate-pulse used as ornament)
#   P1q Middot separator strip              (2+ "·" on one line — the universal AI meta-line glue)
#   P1r Em-dash density in copy             (2+ "—" on one line — AI copy affectation; also flagged by impeccable)
#   P1s Decorative glow / halo / spotlight  (blur-2xl/3xl or glow/halo/spotlight class as a hero backdrop)
#   P1t Codex grid-line background          (linear-gradient 1px grid / bg-grid decorative pattern)
#   P1u Premium beige/brass luxury palette  (canned cream/brass/clay/oxblood default-luxury hexes)
# P1k–P1u harvested (advisory) from taste-skill (MIT, leonxlnx) §9.F + impeccable
# (Apache-2.0, pbakaus) rule registry — 2026-08-10. SKIPPED (not reliably line-greppable —
# would flood false positives): nested-cards (Card-in-Card nesting spans lines; a line-based
# grep can't reliably detect it) and monotonous-spacing (needs cross-element spacing-distribution
# analysis, not a cheap static grep).
# Behavioural craft rules (five-states, animation timing) are NOT grep-checkable —
# they live in design-principles.md / motion.md as agent+reviewer guidance.
# =============================================================================

set -uo pipefail

# ── Args ─────────────────────────────────────────────────────────────────────
MODE="default"   # default | report-only | strict
TARGET_DIR=""
for arg in "$@"; do
  case "$arg" in
    --report-only) MODE="report-only" ;;
    --strict)      MODE="strict" ;;
    -*)            printf "Unknown flag: %s\n" "$arg" >&2; exit 2 ;;
    *)             TARGET_DIR="$arg" ;;
  esac
done
if [ -z "$TARGET_DIR" ]; then
  if   [ -d "apps/web/src" ]; then TARGET_DIR="apps/web/src"
  elif [ -d "src" ];         then TARGET_DIR="src"
  else TARGET_DIR="."; fi
fi

# ── Colour helpers ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RST=$'\033[0m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; CYN=$'\033[36m'
else RST=""; RED=""; GRN=""; YLW=""; CYN=""; fi
FAIL="${RED}FAIL${RST}"; PASS="${GRN}PASS${RST}"; WARN="${YLW}WARN${RST}"

# ── State ────────────────────────────────────────────────────────────────────
FAILS=0; WARNS=0

# ── Enumerate UI files (the surfaces an agent emits) ─────────────────────────
mapfile -t UI_FILES < <(
  find "$TARGET_DIR" \
    \( -path '*/node_modules/*' -o -path '*/.next/*' -o -path '*/dist/*' -o -path '*/build/*' \) -prune -o \
    -type f \( -name '*.html' -o -name '*.htm' -o -name '*.jsx' -o -name '*.tsx' -o -name '*.css' \) -print 2>/dev/null
)
if [ "${#UI_FILES[@]}" -eq 0 ]; then
  printf "%b No UI files (.html/.jsx/.tsx/.css) under %s — nothing to lint.%b\n" "$YLW" "$TARGET_DIR" "$RST"
  exit 0
fi

# ── Helper: report a finding ─────────────────────────────────────────────────
# report <P0|P1> <check-id> <message> <grep-output>
report() {
  local sev="$1" id="$2" msg="$3" hits="$4"
  if [ "$sev" = "P0" ]; then
    printf "  %b [%s] %s\n" "$FAIL" "$id" "$msg"; FAILS=$((FAILS+1))
  else
    printf "  %b [%s] %s\n" "$WARN" "$id" "$msg"; WARNS=$((WARNS+1))
  fi
  printf "%s\n" "$hits" | sed 's/^/        /' | head -6
}

scan() { # scan <regex> over UI files, return "file:line:match" hits (case-insensitive)
  grep -rniE "$1" "${UI_FILES[@]}" 2>/dev/null
}

printf "%b── DESIGN ANTI-SLOP LINT  |  target: %s  |  mode: %s ──%b\n" "$CYN" "$TARGET_DIR" "$MODE" "$RST"

# ── D1 — Tailwind default indigo as accent ───────────────────────────────────
H="$(scan '#(6366f1|4f46e5|4338ca|3730a3|8b5cf6|7c3aed|a855f7)\b|\b(bg|text|border|from|to|via)-(indigo|violet)-(500|600|700|800)\b')"
[ -n "$H" ] && report P0 D1 "Default Tailwind indigo/violet accent — use var(--accent) from docs/DESIGN.md." "$H"

# ── D2 — Two-stop 'trust' hero gradient ──────────────────────────────────────
H="$(scan 'linear-gradient\([^)]*(purple|violet|indigo|blue|cyan|pink|fuchsia)[^)]*(blue|cyan|pink|purple|violet|indigo)|bg-gradient-to-[a-z]+ +from-(purple|violet|indigo|blue)-[0-9]+ +to-(blue|cyan|pink|fuchsia)-[0-9]+')"
[ -n "$H" ] && report P0 D2 "Two-stop purple/blue/cyan 'trust' gradient — prefer a flat token surface + intentional type." "$H"

# ── D3 — Emoji as feature icons ──────────────────────────────────────────────
# Emoji inside an <h*>, <button>, <li>, or className containing 'icon'
H="$(scan '<(h[1-6]|button|li)[^>]*>[^<]*(✨|🚀|🎯|⚡|🔥|💡|📈|🎨|🔒|⭐)|class(Name)?="[^"]*icon[^"]*"[^>]*>\s*(✨|🚀|🎯|⚡|🔥|💡)')"
[ -n "$H" ] && report P0 D3 "Emoji used as a feature/UI icon — use a 1.6–1.8px monoline SVG with currentColor (lucide-react)." "$H"

# ── D4 — Hardcoded sans on display text (HTML style="…" AND JSX style={{…}}) ──
H="$(scan '<(h1|h2)[^>]*(font-family|fontFamily):\s*["'"'"']?(Inter|Roboto|system-ui|Arial|Helvetica)')"
[ -n "$H" ] && report P0 D4 "Display heading binds a hardcoded sans — use var(--font-display) so the seed's type binding wins." "$H"

# ── D5 — AI dashboard tile (rounded card + coloured left-border) ─────────────
H="$(scan '(border-l-[0-9]|border-left:\s*[0-9].*solid).*(rounded|border-radius)|(rounded|border-radius).*(border-l-[0-9]|border-left:\s*[0-9].*solid)')"
[ -n "$H" ] && report P0 D5 "Rounded card + coloured left-border = the canonical 'AI tile' — drop either the radius or the left border." "$H"

# ── D6 — Invented metrics ────────────────────────────────────────────────────
H="$(scan '[0-9]+(\.[0-9]+)?\s*(×|x)\s*(faster|more|better|productive)|99\.9+%\s*uptime|[0-9]+%\s*(faster|fewer|more)')"
[ -n "$H" ] && report P0 D6 "Invented metric — cite a real source or use a labelled {{placeholder}}." "$H"

# ── D7 — Filler copy ─────────────────────────────────────────────────────────
H="$(scan 'lorem ipsum|feature (one|two|three)\b|placeholder text|sample content|your (headline|text) here')"
[ -n "$H" ] && report P0 D7 "Filler copy — an empty section is a composition problem, not a words-invention problem." "$H"

# ── D8 — Gradient / clip-to-text fill ────────────────────────────────────────
H="$(scan 'bg-clip-text[^"]*text-transparent|text-transparent[^"]*bg-clip-text|(-webkit-)?background-clip:\s*text')"
[ -n "$H" ] && report P0 D8 "Gradient/clip-to-text fill — a decorative AI tell on headings & metrics; use a solid var(--*) colour." "$H"

# ── P1a — ALL CAPS without letter-spacing (two-pass; ERE has no lookahead) ───
# Pass 1: lines that set uppercase (CSS text-transform OR camelCase JSX OR a `uppercase` class).
# Pass 2: drop any that also carry tracking on the same line.
H="$(scan 'text-transform:\s*uppercase|textTransform:\s*["'"'"']uppercase|class(Name)?="[^"]*\buppercase\b' \
     | grep -viE 'letter-spacing|tracking-')"
[ -n "$H" ] && report P1 P1a "ALL-CAPS without tracking — uppercase needs 0.06–0.1em letter-spacing (see design-principles.md Pillar 4)." "$H"

# ── P1b — Italic serif display headline ──────────────────────────────────────
H="$(scan '\bitalic\b[^"]*\b(Fraunces|Playfair|Recoleta|Newsreader)\b|\b(Fraunces|Playfair|Recoleta|Newsreader)\b[^"]*\bitalic\b')"
[ -n "$H" ] && report P1 P1b "Italic serif display headline — a universal AI hero tell; choose an intentional display face (per docs/DESIGN.md)." "$H"

# ── P1c — Marketing buzzwords ────────────────────────────────────────────────
H="$(scan '\b(streamline|empower|supercharge|world-class|enterprise-grade|next-generation|cutting-edge|seamlessly|game-chang|revolutioniz)\b')"
[ -n "$H" ] && report P1 P1c "Marketing buzzword — generic SaaS filler; say the specific thing the product does." "$H"

# ── P1d — Repeating-gradient stripes ─────────────────────────────────────────
H="$(scan 'repeating-(linear|radial|conic)-gradient')"
[ -n "$H" ] && report P1 P1d "Repeating-gradient stripes as surface decoration — a generated-UI signature; prefer a deliberate texture or plain surface." "$H"

# ── P1e — Layout-property transition (motion.md: animate transform/opacity only) ──
H="$(scan 'transition(-property)?:\s*[^;{]*(width|height|margin|padding|top|left|right|bottom)\b|transition-\[(width|height|margin|padding|top|left|right|bottom)')"
[ -n "$H" ] && report P1 P1e "Animating a layout property (width/height/margin/padding) — causes layout thrash; animate transform/opacity (see motion.md)." "$H"

# ── P1f — Bounce / elastic easing ────────────────────────────────────────────
H="$(scan 'cubic-bezier\([^)]*,-?[0-9]*\.?[0-9]+\s*,[^)]*-[0-9]|ease-[a-z-]*back\b|\b(easeInOutBack|backOut|elastic|bounce)\b[^a-z]')"
[ -n "$H" ] && report P1 P1f "Bounce / elastic easing — dated & tacky; real objects decelerate smoothly (ease-out-quart/quint/expo)." "$H"

# ── P1g — Justified body text ────────────────────────────────────────────────
H="$(scan 'text-align:\s*justify|\btext-justify\b')"
[ -n "$H" ] && report P1 P1g "Justified text without hyphenation — rivers of white; use text-align:left for body." "$H"

# ── P1h — Image hover transform ──────────────────────────────────────────────
H="$(scan '<img[^>]*\bhover:(scale|rotate)-|<img[^>]*\bgroup-hover:(scale|rotate)-')"
[ -n "$H" ] && report P1 P1h "Image scale/rotate on hover — a generated-UI signature; let imagery sit still or use a subtler interaction." "$H"

# ── P1i — Crushed / negative letter-spacing ──────────────────────────────────
H="$(scan '\btracking-tighter\b|letter-spacing:\s*-0?\.0[3-9]|letter-spacing:\s*-[1-9]')"
[ -n "$H" ] && report P1 P1i "Crushed/negative letter-spacing — costs legibility; tighten display type optically, not destructively." "$H"

# ── P1j — Flat / shadowless primary button (fleet button-affordance standard) ──
# Tells: shadow-none on a Button, OR a ghost/link variant used as a submit (primary) action.
H="$(scan '<[Bb]utton[^>]*\bshadow-none\b|variant=["'"'"']?(ghost|link)["'"'"']?[^>]*type=["'"'"']?submit|type=["'"'"']?submit["'"'"']?[^>]*variant=["'"'"']?(ghost|link)')"
[ -n "$H" ] && report P1 P1j "Flat/shadowless primary button — give primary/secondary/CTA buttons a small shadow-xs/shadow-sm (or outline border) so they read as buttons; reserve ghost/link for tertiary/inline actions (see ui-rules.md Rule 3 + design-principles.md)." "$H"

# ============================================================================
# P1k–P1u — content/microcopy "production-test tells" + static AI antipatterns
# Harvested (advisory, reimplemented) from taste-skill (MIT, leonxlnx) §9.F +
# impeccable (Apache-2.0, pbakaus) rule registry — 2026-08-10. All ADVISORY:
# report-only, never fail. Tight patterns to keep the false-positive floor low.
# SKIPPED deliberately (not reliably line-greppable → would flood false positives):
#   • nested-cards       — a <Card> inside another <Card> spans multiple lines; a
#                          line-based grep cannot reliably detect cross-line nesting.
#   • monotonous-spacing — needs cross-element spacing-distribution analysis, not a
#                          cheap static grep.
# ============================================================================

# ── P1k — Version-label decorative eyebrow (BETA / ALPHA / EARLY ACCESS / v0.6) ──
# Match only as element text (>…<) so it fires on decorative eyebrows, not code identifiers.
H="$(scan '>\s*(beta|alpha|early[ -]access|coming soon)\s*<|>\s*v[0-9]+\.[0-9]+(\.[0-9]+)?\s*<')"
[ -n "$H" ] && report P1 P1k "Version-label decorative eyebrow (BETA/ALPHA/EARLY ACCESS/v0.6) — a stock 'production-test' hero tell; drop it or make it a real, meaningful badge." "$H"

# ── P1l — Numbered-section eyebrow (00 / 01 / 00·INDEX / 001·Capabilities) ────
# Leading-zero section numbers used as decorative eyebrows (element text, or before a ·//).
H="$(scan '>\s*0[0-9]\s*<|>\s*0{2,3}[0-9]?\s*[·/]|\b0{2,3}[0-9]?\s*[·/]\s*[a-z]')"
[ -n "$H" ] && report P1 P1l "Numbered-section eyebrow (00 / 01 / 00·INDEX) — decorative section numbering is a generated-portfolio tell; label sections by what they are." "$H"

# ── P1m — "· No. 01" sub-eyebrow meta-line ───────────────────────────────────
H="$(scan '·\s*no\.\s*0?[0-9]|\bno\.\s*0[0-9]\b')"
[ -n "$H" ] && report P1 P1m "'· No. 01' sub-eyebrow meta-line — a decorative 'brand · no.' affectation; remove the faux catalogue numbering." "$H"

# ── P1n — Locale/time/weather HUD strip (18°C-style temperature chip) ─────────
H="$(scan '[0-9]{1,3}\s*°\s*[cf]\b')"
[ -n "$H" ] && report P1 P1n "Temperature chip (e.g. 18°C) as a decorative HUD strip — a stock 'ambient dashboard' tell; drop unless the app is genuinely weather/locale-driven." "$H"

# ── P1o — Scroll-cue indicator text ──────────────────────────────────────────
# As element text only, so it never matches scrollTo/scrollIntoView/overflow-scroll/scrollbar.
H="$(scan '>\s*scroll(\s+down)?\s*<|scroll to (explore|discover)|scroll for more')"
[ -n "$H" ] && report P1 P1o "Scroll-cue indicator copy ('scroll' / 'scroll down') — a decorative hero affectation; let the content invite the scroll instead." "$H"

# ── P1p — Decorative status dots everywhere (tiny rounded-full + animate-pulse) ──
# Two-pass (ERE has no lookahead): lines with rounded-full AND animate-pulse AND a tiny size
# token — a status dot, not a spinner (animate-spin) or a skeleton (rounded-md) loader.
H="$(scan 'rounded-full' | grep -iE 'animate-pulse' | grep -iE '\b(w|h)-(1|1\.5|2)\b')"
[ -n "$H" ] && report P1 P1p "Tiny pulsing status dot used as ornament — a generated-UI signature when it decorates everything; reserve a live-status dot for a real live status." "$H"

# ── P1q — Middot separator strip (2+ "·" on one line) ────────────────────────
H="$(scan '·[^·<>]{1,40}·')"
[ -n "$H" ] && report P1 P1q "Middot (·) as a universal separator strip — the default AI meta-line glue; vary separators or use real layout." "$H"

# ── P1r — Em-dash density in copy (2+ "—" on one line) ───────────────────────
H="$(scan '—[^—<>]{1,60}—')"
[ -n "$H" ] && report P1 P1r "Em-dash (—) density on a single line — reads as an AI copy affectation; review whether the sentence needs restructuring (also flagged by impeccable)." "$H"

# ── P1s — Decorative glow / halo / spotlight backdrop ────────────────────────
H="$(scan '\bblur-[23]xl\b|class(Name)?="[^"]*\b(glow|halo|spotlight)\b')"
[ -n "$H" ] && report P1 P1s "Decorative glow/halo/spotlight backdrop (heavy blur-2xl/3xl or a glow/halo class) — a generated-hero signature; prefer a deliberate, restrained backdrop." "$H"

# ── P1t — Codex grid-line background pattern ─────────────────────────────────
H="$(scan 'linear-gradient\([^)]*[12]px[^)]*transparent|\b(bg-grid|grid-pattern|grid-bg)\b')"
[ -n "$H" ] && report P1 P1t "Grid-line background pattern (1px linear-gradient grid / bg-grid) — the canonical 'codex' decorative backdrop; use only if a grid is genuinely part of the design language." "$H"

# ── P1u — Premium beige/brass luxury palette overuse ─────────────────────────
# Specific cream/beige + brass/clay/oxblood hexes used as the stock 'luxury' palette.
H="$(scan '#(f5f5dc|faf0e6|fdf6e3|f5efe6|f7f3e9|b5a642|c9a227|b08d57|800020|6b1414|b66a50)\b')"
[ -n "$H" ] && report P1 P1u "Stock beige/brass 'premium-consumer' palette hex — a default-luxury tell; derive the palette from docs/DESIGN.md tokens, not the canned cream/brass set." "$H"

# ============================================================================
# Summary  (mirrors lint-deploy.sh)
# ============================================================================
printf "%b─────────────────────────────────────────────────────%b\n" "$CYN" "$RST"
printf "DESIGN ANTI-SLOP SUMMARY  |  files scanned: %d\n" "${#UI_FILES[@]}"
if [ "$FAILS" -gt 0 ]; then
  printf "  Result : %b  (%d P0 sin(s), %d P1 warning(s))%b\n" "$FAIL" "$FAILS" "$WARNS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n" "$CYN" "$RST"
  [ "$MODE" = "strict" ] && exit 1 || exit 0   # report-only/default surface; --strict gates
elif [ "$WARNS" -gt 0 ]; then
  printf "  Result : %b  (%d P1 warning(s) — review)%b\n" "$WARN" "$WARNS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n" "$CYN" "$RST"
  exit 0
else
  printf "  Result : %b  (no AI-slop tells found)%b\n" "$PASS" "$RST"
  printf "%b─────────────────────────────────────────────────────%b\n" "$CYN" "$RST"
  exit 0
fi
