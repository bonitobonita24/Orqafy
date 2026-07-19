# [FOCUS: Orqafy] NEXT-SESSION HANDOFF — 2026-07-19 (Full-Auto M4: STAGING is LIVE)

> ⭐ **STAGING DEPLOYED + VERIFIED. Owner directive was "execute the STAGING milestone (M4), then reboot per milestone."**
> Branch `feat/telegram-storage`, HEAD after this checkpoint. UNPUSHED (HARD HOLD). Demo + Staging live; nothing pushed to GitHub.

## ✅ DONE THIS SESSION — M4 Staging
- Built + pushed FRESH images from HEAD `e8fbb72` (`bonitobonita24/orqafy{,-worker}:dev-sha-e8fbb72`) —
  needed because the demo image `923feb6` predated the committed accounting-fix migration `20260719000000`.
  push.sh dev = the build-green verification (both images on Docker Hub, manifest-confirmed).
- First-ever `orqafy-staging` Komodo stack on 72.62.74.203 `/etc/komodo/stacks/orqafy-staging/`
  (mirrors the WORKING demo layout — NOT the repo `deploy/compose/stage/*.yml`, which diverge).
  Ports postgres 5440 · valkey 6387 · minio 9018/9019; network `orqafy_staging_network`; Traefik
  router `orqafy_staging_app` + TLS. No pgbouncer/pgadmin. `STORAGE_BACKEND=telegram`.
- migrate deploy = ALL applied (incl. accounting `20260719000000` + media ledger `20260718000000`).
- Seed (APP_ENV=staging) = all modules populated; weak dev accounts correctly SKIPPED.
- **VERIFIED:** ext health 200 (`https://orqafy-staging.powerbyte.app/api/health`); /login renders
  (form intact); app container `STORAGE_BACKEND=telegram` + bot `getMe` ok + **real `sendDocument`
  E2E ok (has_document, 47B)** — the priority Telegram-media feature works on staging. Only benign
  console errors (CSP-blocked CF Insights beacon + favicon 404).
- Governance: STATE.md + FULL_AUTO_PLAN.md M4 updated; staging creds note in
  `scratchpad/orqafy-staging-CREDENTIALS.txt`. Committed LOCAL (HARD HOLD).

## Login (staging)
Workspace `demo` · `webmaster@orqafy.local` · pw = vault `staging_prod.tenant_superadmin`
(`Server-Setups/secrets/universal-login-credentials.enc.yaml`; also server `.env` WEBMASTER_PASSWORD).

## ⏭ NEXT — all OWNER-GATED (do NOT auto-proceed)
- **M7 PROD** (`orqafy.powerbyte.app`, Telegram storage) — the staging directive did NOT authorize prod.
  Prod is NEVER automatic (deploy-discipline). Needs explicit owner word ("push to production"/"go live").
  Pattern proven: same manual Komodo stack as demo/staging, staging_prod creds, Telegram storage, fresh
  ports (e.g. postgres 5441 · valkey 6388 · minio 9020/9021 — verify free). Staging-refresh data-first
  gate is MOOT for a first prod stand-up (no prod to refresh from) — plain migrate+seed.
- **Before prod:** (a) patch `deploy/staging-refresh-and-deploy.sh` with robustness invariants 1–3
  (ephemeral tunnel port, verify-tunnel-up, schema-status HARD GATE) — needed for FUTURE staging→prod
  promotions; (b) cut tag **0.11.0** (owner-declared MINOR).
- **Push-to-GitHub (main)** — separately owner-gated (first push of the ~79-commit branch → public repo).
  Wiring real CI/CD (docker-publish.yml → main) rides with this. Deliberately NOT done.

## Follow-ups (un-gated [HOW], low priority)
- Reconcile repo `deploy/compose/stage/*.yml` + `push.sh staging` + `push-to-prod.sh` to the deployed
  layout (env_file `.env`, INTERNAL_* overrides, per-env Traefik router names, STORAGE_BACKEND in
  `environment:`). Same divergence noted for demo.
- Optionally CSP-allowlist `static.cloudflareinsights.com` (kills the 1 benign console error fleet-wide).
- Reconcile the seed's hardcoded `webmaster@orqafy.local` email vs the universal-login scheme email.

## PENDING owner [WHAT] (carried)
D-DEVCH-CONFIRM (dev channel) · D-RBAC-SPEC (§756 stale) · D-PORTAL (Customer Portal build/descope) ·
D-TAG (cut 0.11.0) · D-PRIV-1 (RA 10173 DSR) · D-NUM-1 · push-per-tier word.

## ✅ Deploy-workflow model — CONFIRMED with owner this session (2026-07-19)
Owner restated + I confirmed the fleet 3-tier contract for Orqafy:
1. **`git push main` = manual, on owner's word** (local dev + dummy data validated FIRST; a plain
   "commit" only saves locally + rebuilds the local dev container, never pushes).
2. **Staging = auto on push to `main`**: push main → GitHub Actions BUILDS image + pushes to Docker Hub
   (`:staging-latest`) → Komodo staging PULLS the pre-built image (never builds from source / clones).
3. **Prod = ALWAYS manual** — never auto, no matter how much changed; explicit "push to production" only.

**⚠ REALITY GAP (important):** this CI pipeline is NOT wired/active yet. Today's demo + staging were
deployed via **manual Komodo stacks** because the branch has **never been pushed to `main`**. The
"auto-staging on push to main" behavior only turns on the FIRST push to main — and that first push
(making ~79 local commits public) is itself the separately-gated step. Refinement for later: once prod
exists, staging refreshes its DB from a prod copy before pulling a candidate image (staging-refresh-gate);
moot now (no prod).

## ⏭ TASK QUEUE (all owner-gated — pick per owner word)
- [ ] **Wire auto-staging CI/CD = do the FIRST push of `feat/telegram-storage` → origin/main.** Activates
      docker-publish.yml (build→Docker Hub) + Komodo staging auto-pull. Makes 79 commits public. → owner word.
- [ ] **M7 PROD** — stand up `orqafy.powerbyte.app` (Telegram storage) via the proven manual Komodo pattern
      (fresh free ports e.g. postgres 5441/valkey 6388/minio 9020-21 — verify). → explicit "push to production".
- [ ] **Before prod:** patch `deploy/staging-refresh-and-deploy.sh` w/ robustness invariants 1–3;
      cut tag **0.11.0** (owner-declared MINOR).
- [ ] Reconcile repo `deploy/compose/{stage,demo,prod}/*.yml` + push scripts to the deployed layout.
- [ ] Optionally CSP-allowlist `static.cloudflareinsights.com` (kills the benign console error fleet-wide).

## Env quick-facts
VPS root@72.62.74.203 key ~/.ssh/powerbyte_hostinger; Komodo kmd.powerbyte.app; Traefik `proxy` net.
Docker Hub login via `deploy-api.enc.yaml` (bonitobonita24). Vault: orqafy-telegram, universal-login,
deploy-api, cloudflare, orqafy-turnstile (SOPS+age). Runbook: `Server-Setups/.../runbooks/deploy-orqafy.md`.
Local dev DB containers may be up (harmless). Resume: "resume full auto" / "push to production".
