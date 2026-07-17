# [FOCUS: Orqafy] Full-Auto Plan — 2026-07-18

> Engaged on owner directive: "do all tasks one at a time with reboot loop yourself for every
> milestone, full auto mode." Deploy targets (demo/staging/prod) are OWNER-AUTHORIZED by this
> directive (explicit named subdomains + CI/CD + demo deploy) — this overrides the standing
> HARD HOLD for THESE named targets only. Verify green before each ship.

## Milestones (sequential — one at a time, checkpoint + reboot between each)

- [ ] **M1 — Plan & Review (local, unblocked).** Finalize + commit the two Jul-17 draft artifacts:
  `docs/MOBILE_UX_PLAN.md` (mobile-first UI/UX approach — "plan first") and
  `docs/PRODUCT_COVERAGE_AUDIT.md` (full PRODUCT.md cross-reference, ~93%). Re-validate the audit
  against current code (branch advanced with Telegram work since Jul 17). ALSO close the interrupted
  Telegram-storage session's governance wrap-up (STATE.md + CHANGELOG_AI.md) — verified green
  (web tc 0 · 1265/1265). Owner tasks #2 + #3.
- [ ] **M2 — Telegram media go-live (PRIORITY feature).** BLOCKED on numeric `chat_id`
  (owner must post one message in "Orqafy - Assets" channel → getUpdates resolves it). Token already
  in vault. Decision (architect note, surfaced): "Orqafy - Assets" = staging/prod channel;
  dev stays MinIO unless owner provides a dedicated dev channel. Wire STORAGE_BACKEND=telegram
  + TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHANNEL_ID into staging/prod .env (gitignored) + mirror
  vault; end-to-end upload test. Owner task #1.
- [ ] **M3 — Cloudflare DNS.** Create subdomains under Powerbyte-Hostinger (VPS 72.62.74.203):
  orqafy-demo.powerbyte.app / orqafy-staging.powerbyte.app / orqafy.powerbyte.app.
  Creds: Server-Setups cloudflare.enc.yaml / deploy-api.enc.yaml. Owner task #4.
- [ ] **M4 — CI/CD pipeline (demo/staging/prod).** Groundwork already committed Jul-17
  (orqafy_demo compose, Telegram pin on stage/prod, staging data-first gate, demo/prod promotion
  scripts, docker-publish.yml). Wire Komodo stacks + Traefik routers for the 3 subdomains; gate CI
  staging auto-deploy per staging-refresh-gate. Owner task #5.
- [ ] **M5 — Default env credentials.** Seed each env's super_admin/admin from
  Server-Setups/secrets/universal-login-credentials.enc.yaml (staging_prod tier -> staging+prod;
  demo tier -> demo). Reference vault only, never paste. Owner task #6.
- [ ] **M6 — Demo full-featured dummy seed.** Rich showcase dataset covering all 18 modules so the
  owner sees every feature live on the demo site. Demo = MinIO storage (fleet exception). Owner task #7.
- [ ] **M7 — Deploys.** demo -> staging -> prod, verify each green + reachable at its subdomain. Owner task #8.

## Owner-action items (surfaced; do not block non-dependent milestones)
1. Post any message in the "Orqafy - Assets" Telegram channel -> unblocks M2 chat_id resolution.
2. Dev Telegram channel? Default = dev stays MinIO (per architect note). Say if you want a
   dedicated dev channel instead.

## Reboot cadence
Checkpoint STATE.md + memory + this file after each milestone, then reboot. True unattended looping
needs `claude-loop 0` launched from a terminal; otherwise resume on owner's next prompt.

## Status log
- 2026-07-18: Plan created. Token secured to vault (orqafy-telegram.enc.yaml). M1 starting.
