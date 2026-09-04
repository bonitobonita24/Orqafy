#!/usr/bin/env bash
# =============================================================================
# demo-reset-cron-install.sh — install / remove the DEMO self-heal SCHEDULE (ORQ-25).
#
# ⚠⚠ HARD HOLD — LOCAL, INERT BY DEFAULT. Running this with no flag only PRINTS a plan and a
# pre-flight report; it changes NOTHING. Actually enabling the cron is a deliberate, owner-gated
# "explicit go" step (`--enable`, then an interactive confirm) — do NOT enable without the owner's
# explicit word (deploy-discipline.md / D-DEMO-CRON Option 1: "code now, defer live").
#
# WHAT IT SCHEDULES: deploy/demo-reset.sh (6-hourly golden self-heal) for the Orqafy client demo,
# which now lives on the always-on box EC2-Komodo (ubuntu@18.138.220.90). The demo is the ONLY
# environment that self-heals; staging/prod never do.
#
# WHY A SEPARATE INSTALLER + WHY IT REFUSES TO ENABLE YET (the deferred-live residual):
#   demo-reset.sh is a WORKSTATION script — it SSHes into the demo host AND runs `pnpm --filter
#   @orqafy/db db:migrate:deploy` locally (needs the repo + node + pnpm). A self-heal must fire even
#   when the workstation is OFF, so the schedule belongs ON the always-on EC2 box. But the EC2 box
#   (as delivered) has: no repo checkout, no pnpm/node toolchain, and its Security Group allows :22
#   only from the operator /32 — so demo-reset.sh cannot self-SSH via the EIP from a box cron. Those
#   are the "explicit go" prerequisites this installer PRE-FLIGHT-CHECKS and, if unmet, REFUSES to
#   enable (fail-closed). Resolving the on-box migrate + SSH-topology cleanly is tracked as ORQ-26.
#
# Usage:
#   bash deploy/demo-reset-cron-install.sh            # dry-run: print plan + pre-flight, change nothing
#   bash deploy/demo-reset-cron-install.sh --status   # show the current demo-reset crontab entry (if any)
#   bash deploy/demo-reset-cron-install.sh --enable    # (owner-gated) install the 6h cron ON EC2 — confirms first
#   bash deploy/demo-reset-cron-install.sh --disable   # remove the demo-reset cron entry from EC2
# =============================================================================
set -euo pipefail

MODE="${1:-plan}"
VPS="ubuntu@18.138.220.90"; KEY="$HOME/.ssh/powerbyte_ec2_komodo"
REPO_ON_BOX="/home/ubuntu/apps/Orqafy"            # expected repo checkout on the EC2 box (prereq)
GOLDEN="/home/ubuntu/golden/orqafy-demo"          # must match demo-reset.sh / demo-bless-golden.sh
SCHEDULE="0 */6 * * *"                            # every 6 hours
LOG="/home/ubuntu/demo-reset.log"
CRON_TAG="# orqafy-demo-self-heal (ORQ-25)"       # marker so we can find/replace/remove our line idempotently
CRON_LINE="${SCHEDULE} cd ${REPO_ON_BOX} && bash deploy/demo-reset.sh >> ${LOG} 2>&1 ${CRON_TAG}"
ssh_vps(){ ssh -o ConnectTimeout=15 -i "$KEY" "$VPS" "$@"; }

echo "── Orqafy demo self-heal cron installer (ORQ-25) ─────────────────────────────"
echo "  host:      ${VPS}"
echo "  schedule:  ${SCHEDULE}  → cd ${REPO_ON_BOX} && bash deploy/demo-reset.sh"
echo "  golden:    ${GOLDEN}"
echo ""

preflight(){ # returns 0 if all prereqs for a live cron are met, else 1 (and prints what's missing)
  local ok=0
  echo "▶ Pre-flight (read-only) — can the box actually run demo-reset.sh on a schedule?"
  if ! ssh_vps true 2>/dev/null; then
    echo "  ✗ cannot SSH ${VPS} (key ${KEY} or SG :22 /32 stale) — re-authorize the operator IP."
    return 1
  fi
  ssh_vps "[ -f '${GOLDEN}/db.sql.gz' ]" 2>/dev/null \
    && echo "  ✓ golden baseline present (${GOLDEN}/db.sql.gz)" \
    || { echo "  ✗ no golden baseline yet — run 'bash deploy/demo-bless-golden.sh' FIRST (nothing to restore)."; ok=1; }
  ssh_vps "[ -d '${REPO_ON_BOX}/.git' ]" 2>/dev/null \
    && echo "  ✓ repo checkout on box (${REPO_ON_BOX})" \
    || { echo "  ✗ no repo checkout at ${REPO_ON_BOX} — demo-reset.sh needs the repo for its migrate step."; ok=1; }
  ssh_vps "command -v pnpm >/dev/null 2>&1" \
    && echo "  ✓ pnpm on box" \
    || { echo "  ✗ no pnpm on box — the migrate step (pnpm --filter @orqafy/db db:migrate:deploy) can't run."; ok=1; }
  # demo-reset.sh SSHes to VPS (the EIP). From the box, self-SSH via the EIP is blocked by the SG
  # (:22 = operator /32 only). This is the ORQ-26 topology item — surfaced, not silently worked around.
  echo "  ⚠ ORQ-26: demo-reset.sh self-SSHes via the EIP; the SG blocks :22 from the box itself."
  echo "     A box cron needs demo-reset.sh in a --local mode (direct docker, no SSH) OR an SG/localhost"
  echo "     path + on-box migrate. NOT resolved here — enable is gated on it."
  return "$ok"
}

case "$MODE" in
  --status)
    echo "▶ Current demo-reset cron entry on ${VPS}:"
    ssh_vps "crontab -l 2>/dev/null | grep -F '${CRON_TAG}' || echo '  (none installed)'"
    ;;
  --disable)
    echo "▶ Removing the demo-reset cron entry from ${VPS} (idempotent)…"
    ssh_vps "( crontab -l 2>/dev/null | grep -vF '${CRON_TAG}' ) | crontab - && echo '  ✓ removed (if present)'"
    ;;
  --enable)
    if ! preflight; then
      echo ""
      echo "✗ REFUSING to enable — prerequisites above are unmet (fail-closed). Resolve them (and ORQ-26),"
      echo "  then re-run with --enable. Nothing was changed."
      exit 1
    fi
    echo ""
    echo "⚠ This INSTALLS a 6-hourly cron on the LIVE demo box. Per HARD HOLD this needs the owner's"
    read -r -p "  explicit go. Type 'yes-enable-demo-cron' to proceed, anything else aborts: " C
    [ "$C" = "yes-enable-demo-cron" ] || { echo "  aborted — nothing changed."; exit 1; }
    ssh_vps "( crontab -l 2>/dev/null | grep -vF '${CRON_TAG}'; echo '${CRON_LINE}' ) | crontab - && echo '  ✓ installed'"
    echo "✅ demo self-heal cron enabled (${SCHEDULE}). Logs: ${VPS}:${LOG}"
    ;;
  plan|"")
    preflight || true
    echo ""
    echo "▶ DRY-RUN — this is what --enable WOULD install (nothing changed):"
    echo "    ${CRON_LINE}"
    echo ""
    echo "  Next: bless a golden baseline (deploy/demo-bless-golden.sh), satisfy the pre-flight items"
    echo "  above + ORQ-26, then (owner go) run: bash deploy/demo-reset-cron-install.sh --enable"
    ;;
  *)
    echo "❌ Usage: bash deploy/demo-reset-cron-install.sh [--status|--enable|--disable]"; exit 1 ;;
esac
