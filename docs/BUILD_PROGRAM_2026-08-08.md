# Orqafy Build Program — 2026-08-08 (owner-authorized)

> Owner directive (2026-08-08): ship the ready work now, migrate to the real domain `orqafy.com`,
> then build the storefront/POS/PM/portal features — **one wave at a time, swarm-orchestrated**.
> Sequencing = **ship-now-then-build**. Domain scheme = **root + subdomains**.
> HARD HOLD is LIFTED for Wave 0 (owner said "push and ship anything" + "migrate to the real domain").
> Waves 1+ land local-first; each ships on the same standing authorization once its QA gate is green.

Owner answers to the DECISIONS-FIRST items:
1. Ship gate → **GO** (push origin/main, staging, PROD first stand-up, demo, promote version).
2. Storefront is e-commerce-like → **make it publicly crawlable + guest-accessible**.
3. Customer Portal (D-1) → **build it, correlated with the storefront**.
4. Restyle + E re-baseline + landing "Store" menu + adopt 3 paid ShadcnStudio templates
   (INHERIT-not-REPLACE — graft UI + wire to our tRPC/Prisma/Auth.js backend):
   - **Shopix** (full e-commerce) → public storefront
   - **RestroPOS** → POS module (walk-in customers)
   - **Sprintrix** (PM) → Project Management admin module
   Zips present in `_tempfiles/` (paid — vendored slices stay private, never pushed to a public remote).

Domain scheme (confirmed): prod = `orqafy.com` (+ `www` 301) · staging = `staging.orqafy.com` ·
demo = `demo.orqafy.com`. Old `*.powerbyte.app` → 301 redirects for a grace period.
DNS = Cloudflare under **Powerbyte-Hostinger** creds (Server-Setups SOPS+age `deploy-api`/`cloudflare`).

---

## Execution model
- PM (Opus) conducts; each wave dispatches an **Architect** + dep-ordered **Sonnet workers**
  (`spec-executor`), worktree-isolated where parallel writes could collide.
- **One wave at a time.** A wave is DONE only at the full Rule-32 bar (built AND tests green AND
  live-verified AND evidence recorded) before the next starts.
- Every UI wave adopts its template **UI-layer only** (AdminCN discipline): keep tRPC/Prisma/Auth.js,
  graft components/layout, wire to real data. Re-baseline `docs/DESIGN.md` + `docs/MOCKUP.jsx` (Rule 31)
  for that surface FIRST, owner-approved, before building.
- Branch-per-wave, Conventional Commits, local-first. Ship = owner-authorized push (already granted).

---

## WAVE 0 — Ship + Domain migration to orqafy.com  [AUTHORIZED — in progress]
Sequential + stateful (git → CI → deploy → DNS → verify); not parallel-swarmed.
- **0.1 Pre-ship gate.** `main` green: web typecheck 0 · full vitest · lint · build. Record evidence. (never ship red)
- **0.2 Release + push.** Propose version + consolidated changelog (`gen-release-notes`) → owner one-word OK →
  push `main` → origin/main (`# HARDHOLD-OK`), `--follow-tags`. CI builds+pushes image.
- **0.3 Staging.** Redeploy on the CI image via data-first gate. Cloudflare A/CNAME `staging.orqafy.com` →
  update Traefik host rule + `SITE_URL`/`NEXTAUTH_URL`/Auth.js callbacks + SEO base. Verify /health, /login, TLS.
- **0.4 Demo.** Redeploy latest (migrate-yes/reseed-never). DNS `demo.orqafy.com` + host/env re-point. Verify.
- **0.5 PROD first-time stand-up (M7 — IRREVERSIBLE — checkpoint before executing).** Stand up prod stack on
  `orqafy.com`, Telegram storage, **manual** `prisma migrate deploy`, seed super_admin (staging_prod vault cred),
  promote image → `v0.11.0`(or agreed version). DNS `orqafy.com` + `www`→301.
- **0.6 Cutover cleanup.** Old `*.powerbyte.app` → 301 redirects. **Rebuild dev off same sha** (Rule 39, app+worker).
  Final verify: all three envs live on new domain, SEO canonical/robots/sitemap now emit orqafy.com.

## WAVE 1 — Public storefront (Shopix) + landing "Store" menu   [C + E·Shopix + F·store]
- 1.1 Extract Shopix → design re-baseline of the store surface into DESIGN.md/MOCKUP.jsx (Rule 31), owner sign-off.
- 1.2 Move `/[slug]/store/**` public (auth-boundary change; guest browse + crawlable; keep account/checkout auth
      where a session is required). Full SEO metadata + sitemap inclusion (fixes the deferred index-but-307).
- 1.3 Graft Shopix UI onto existing store tRPC/Prisma data (products, cart, checkout, order-track).
- 1.4 Landing page "Store" nav link.
- 1.5 QA verify-all-pages + anti-slop + a11y gate → local commit → authorized ship.

## WAVE 2 — Customer Portal (D-1)   [D — correlated w/ storefront]
- Brainstorm scope (guest→customer accounts, order history, tracking, addresses) → TDD build → QA → ship.

## WAVE 3 — POS module (RestroPOS)   [E·RestroPOS + F·pos]
- Re-baseline POS surface from RestroPOS → graft UI onto our POS/inventory/order backend → QA → ship.

## WAVE 4 — Project Management module (Sprintrix)   [E·Sprintrix + F·pm]
- Re-baseline PM surface from Sprintrix → graft onto our project/task backend → QA → ship.

---

## Out of scope (this program)
- RBAC 3-tier slug retrofit (standing offer, separate). Notifications/Valkey SSE realtime bug (separate triage).

## Tracked security exception (revisit)
- `pnpm.auditConfig.ignoreGhsas` = `GHSA-w3rx-r6r6-pgpr`, `GHSA-5p2g-fcmc-qvqq` — two HIGH advisories in
  `image-size` (transitive: `apps/mobile > react-native > metro > image-size`). **No upstream patch exists**
  (2.0.2 is latest; advisory "patched: <0.0.0"). Not in the deployed web/worker runtime (mobile ships via EAS,
  not this Docker image). Scoped ignore of exactly these two GHSAs keeps CI green while any NEW advisory still
  fails. **Revisit when metro/image-size publishes a fix, then remove the ignore.**

## Status log
- 2026-08-08 — Program authored; owner confirmed ship-now + root+subdomains + swarm one-wave-at-a-time.
- 2026-08-08 — Wave 0: pre-ship gate green (1439 tests) → v0.12.0 pushed → CI Docker fail (unpinned pnpm)
  → pinned pnpm@10.11.0, v0.12.1, image sha-4b5ea8f built → CI audit gate caught critical Auth.js fail-open
  → security bump (next-auth β32, @auth/core 0.41.3, next 15.5.23 + toolchain floors), 1439 tests still green,
  audit 0 critical + 2 mobile-only highs ignored → v0.12.2 next. Then domain cutover 0.3→0.6.
