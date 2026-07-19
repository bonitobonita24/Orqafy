[FOCUS: Orqafy] Owner deferred ALL gated work to this session. Open by re-surfacing the gated queue below, then execute it IN ORDER on the owner's per-tier go — respecting HARD HOLD (each deploy tier needs its explicit word; PROD is irreversible — confirm before "go live").

════════════════════════════════════════════════════════════════════════════
ORQAFY — NEXT-SESSION HANDOFF (written 2026-07-19 by Full-Auto, end of un-gated cleanup)
════════════════════════════════════════════════════════════════════════════

## WHERE WE ARE
- Branch `feat/telegram-storage`, HEAD `d249752`, working tree CLEAN, **unpushed (HARD HOLD — intentional)**.
- Demo LIVE https://orqafy-demo.powerbyte.app (health 200) · Staging LIVE https://orqafy-staging.powerbyte.app (health 200, Telegram media E2E proven).
- Un-gated local [HOW] work is GENUINELY EXHAUSTED. Everything remaining is owner-gated [WHAT].

## ✅ DONE LAST RUN (3 local commits, unpushed)
- `7ffbe9c` — staging-refresh gate hardened (3 invariants: ephemeral scanned-free tunnel port ≠ remote DB_PORT; verify-tunnel-up; prisma-migrate-status HARD gate before app-up) + CSP allows CF Insights beacon (static.cloudflareinsights.com / cloudflareinsights.com). Verified bash -n + shellcheck + web tsc 0.
- `dc90d7f` — docs/DEPLOY_COMPOSE_RECONCILIATION.md (repo↔live compose diff, decision-ready; NOT applied) + global lesson deploy.compose.copied-stack-kept-source-default-image-tag.
- `d249752` — STATE.md checkpoint.

## 🔴 THE GATED QUEUE — execute in this order on owner's word (re-surface first)
1. **Push → main (CI / auto-staging).** Trigger "push to staging". First push to `main` activates GitHub Actions (`docker-publish.yml`) → builds+pushes images → Komodo staging auto-update. NOTE current staging/demo were stood up MANUALLY; the first real CI push is a new path — watch the Actions run + Komodo pull.
2. **Validate staging (data-first gate).** After CI, run `bash deploy/staging-refresh-and-deploy.sh` (now hardened) to rehearse migrations on prod-shaped data before prod. (First-run skips the prod-copy step until an orqafy_prod stack exists — see script header.)
3. **M7 — deploy PRODUCTION** (orqafy.powerbyte.app). Trigger MUST be explicit "push to production" / "go live" — IRREVERSIBLE, confirm scope before running. No orqafy_prod stack exists on the VPS yet (root@72.62.74.203) — this is a FIRST-TIME prod stand-up (mirror the staging stack build; postgres/valkey/minio + app + worker; STORAGE_BACKEND=telegram; prod creds from vault staging_prod tier).
4. **Cut tag `0.11.0`** after prod is verified (SemVer minor; drop -rc on promotion per versioning-standard).
5. **Apply compose reconciliation** — needs owner deploy-model answer (Komodo consumes hand-placed stack files [a] vs CI materializes from repo [b]) + fix the live STAGING footgun: its app/worker compose still defaults APP_IMAGE_TAG→demo-latest (see docs/DEPLOY_COMPOSE_RECONCILIATION.md). Owner-gated live-stack edit.
6. **RBAC naming retrofit** (optional) — Orqafy uses `tenant_super_admin` vs fleet-standard `tenant_superadmin`. Scenario 42, NAMING-ONLY (3-tier backbone + one-owner index + succession + custom-role matrix already built). Trigger "retrofit RBAC". Data-preserving ALTER TYPE…RENAME VALUE, dev-first.

## KEY FACTS / POINTERS
- VPS root@72.62.74.203, key ~/.ssh/powerbyte_hostinger. Stacks: /etc/komodo/stacks/orqafy-{staging,demo}. NO orqafy_prod yet.
- Staging: postgres5440·valkey6387·minio9018-19, Telegram chat -1004449537821, Traefik router orqafy_staging_app. Login workspace `demo` / webmaster@orqafy.local / pw = vault staging_prod tier. Creds note: scratchpad/orqafy-staging-CREDENTIALS.txt.
- Demo: image dev-sha-923feb6, MinIO/S3. Staging: images dev-sha-e8fbb72.
- Vault (SOPS+age): Server-Setups/secrets/universal-login-credentials.enc.yaml (never paste values).
- HARD RULES: HARD HOLD stays hard — no push/deploy without explicit per-tier owner word; prod never automatic; verify green before any ship; [HOW]=decide myself, [WHAT]=defer.
- Older open PENDING_DECISIONS.md: framework-sync push (2 commits on main), RA10173 data-privacy items, dev-only migrations must not reach staging/prod without owner word, product-scope D-1/D-3/D-4.

## PACING
Only owner-gated [WHAT] remains (nothing un-gated to advance). Loop rebooted with --hold to pace and
re-surface the queue until the owner drives the deploys. Do NOT auto-execute any deploy/push/tag.
════════════════════════════════════════════════════════════════════════════
