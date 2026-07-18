# [FOCUS: Orqafy] Full-Auto Plan — 2026-07-18

> Engaged on owner directive: "do all tasks one at a time with reboot loop yourself for every
> milestone, full auto mode." Deploy targets (demo/staging/prod) are OWNER-AUTHORIZED by this
> directive (explicit named subdomains + CI/CD + demo deploy) — this overrides the standing
> HARD HOLD for THESE named targets only. Verify green before each ship.

## Milestones (sequential — one at a time, checkpoint + reboot between each)

- [x] **M1 — Plan & Review (local, unblocked). ✅ DONE 2026-07-18.** Independently verified coverage ≈93–94% (17/18 modules built; only Customer Portal §703 ~35% genuinely unbuilt; RBAC ahead-of-spec). Committed mobile plan + audit + governance wrap-up. Finalize + commit the two Jul-17 draft artifacts:
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
- [x] **M3 — Cloudflare DNS. ✅ DONE 2026-07-18 (already existed).** All three A records
  (orqafy / orqafy-staging / orqafy-demo → 72.62.74.203, proxied) already present in zone
  powerbyte.app (814c7d6e8db45e1a4015e67a030d5e41). Verified read-only; nothing created.

### ⚠ Verified server state (2026-07-18) — reshapes M4–M7
Despite the Jun-16 deploy runbook, the VPS currently has **NO orqafy Komodo stacks, containers, or
volumes** → M4/M6/M7 are **greenfield deploys**. DNS is ready. Sequencing decision:
**DEPLOY DEMO FIRST** — demo uses MinIO (not Telegram) so it is fully unblocked and is the owner's
most-wanted tangible result. Staging+prod are pinned to Telegram (Jul-17) → they depend on M2's
chat_id (owner channel post). New order: M5(demo creds)+M6(demo seed)+M4(demo stack)→M7-demo, then
unblock M2 → staging/prod.
- [~] **M4 — CI/CD pipeline (demo/staging/prod).** DEMO ✅ + **STAGING ✅ LIVE 2026-07-19**
  (https://orqafy-staging.powerbyte.app, Telegram storage, image dev-sha-e8fbb72; first-ever staging
  stand-up via manual Komodo stack mirroring demo). PROD stack = owner-gated (not authorized by the
  staging directive). CI auto-deploy gating (push-to-main → CI) deliberately NOT wired yet — deployed
  via manual Komodo pattern; wiring the GitHub-main→CI pipeline rides with the (separately-gated) first
  push of the 77-commit branch to origin/main. Owner task #5 (partially done: demo+staging).
- [ ] **M5 — Default env credentials.** Seed each env's super_admin/admin from
  Server-Setups/secrets/universal-login-credentials.enc.yaml (staging_prod tier -> staging+prod;
  demo tier -> demo). Reference vault only, never paste. Owner task #6.
- [ ] **M6 — Demo full-featured dummy seed.** Rich showcase dataset covering all 18 modules so the
  owner sees every feature live on the demo site. Demo = MinIO storage (fleet exception). Owner task #7.
- [ ] **M7 — Deploys.** demo -> staging -> prod, verify each green + reachable at its subdomain. Owner task #8.

## M2 update — chat_id RESOLVED ✅ 2026-07-18
Owner posted in channel. Resolved `chat_id = -1004449537821`, stored in vault, bot write-access
proven (sendMessage ok, msg_id 3). Remaining M2 work = wire STORAGE_BACKEND=telegram +
TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHANNEL_ID into staging/prod `.env` at their deploy (M7).
No longer a blocker.

## Demo-deploy chunk — sub-plan (executing now; owner said "go ahead")
Deploy artifacts EXIST: deploy/compose/demo/{db,cache,storage,app,worker,pgadmin}, push.sh (build+push),
push-to-demo.sh (UPDATE-only — assumes stack exists). VPS empty → FIRST-TIME stack creation needed.
- [ ] **D1 — M6 seed enrichment (LOCAL, dispatched).** New packages/db/src/seed/demo-showcase.ts
  populating the empty modules (CRM quotations/contacts, inventory products+stock, purchasing PO chain,
  projects+milestones+tasks, POS sales, job orders, support tickets, ecommerce orders, DTR, payroll run)
  with realistic PH-context dummy data, tenant-scoped to demo, idempotent, wired into seed/index.ts.
  Verify: db build + dev seed run green.
- [x] **D2 — Build + push images. ✅ DONE 2026-07-18.** After fixing two latent first-build breakages
  (commits 24a618c shared ESM/Node16 + 923feb6 worker Dockerfile missing shared/zod), push.sh dev built
  + pushed both images: bonitobonita24/orqafy{,-worker}:dev-latest + :dev-sha-923feb6.
  ⟨history⟩ FIRST BUILD FAILED (real bug, caught by verify-before-ship):
  `@orqafy/db` build (tsc Node16) breaks on `@orqafy/shared` source-only ESM barrels using extensionless
  re-exports (TS2835) + a `def` possibly-undefined in seed/role-permissions.ts. Introduced by the RBAC
  merge; branch has NEVER imaged successfully (Jun-16 deploy predates RBAC). FIX DISPATCHED (bg worker):
  add `.js` extensions to shared/src/rbac (+types/schemas barrels) + guard `def`; dual-verify db+jobs+web
  builds green WITHOUT regressing the M9 web-bundler extensionless fix. Then re-run push.sh dev.
- [ ] **D3 — First-time orqafy-demo stack** on VPS: /etc/komodo/stacks/orqafy-demo + demo compose +
  .env (demo-tier universal-login creds + MinIO + DB/redis/auth/encryption). Bring up db/cache/storage.
- [ ] **D4 — Migrate + seed** (first-time seed allowed) + bring up app+worker.
- [ ] **D5 — Verify** https://orqafy-demo.powerbyte.app health 200 + login admin@demo.com (demo-tier).

## Owner-action items (surfaced; do not block non-dependent milestones)
1. Post any message in the "Orqafy - Assets" Telegram channel -> unblocks M2 chat_id resolution.
2. Dev Telegram channel? Default = dev stays MinIO (per architect note). Say if you want a
   dedicated dev channel instead.

## Reboot cadence
Checkpoint STATE.md + memory + this file after each milestone, then reboot. True unattended looping
needs `claude-loop 0` launched from a terminal; otherwise resume on owner's next prompt.

## Status log
- 2026-07-18: Plan created. Token secured to vault (orqafy-telegram.enc.yaml). M1 starting.
