# Task Queue — Orqafy

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.
Mirrored to the PROD Squirlnote board (project **Orqafy**, prefix `ORQ`) per `project_squirlnote_use_obligation`.

## 🔴 / 🟡 Open

- 🔴 **`favicon.ico` 404** `[ORQ-10]` — app serves no favicon; browser logs a 404 on first load (harmless but
  shows in console). Add `apps/web/src/app/favicon.ico` (or `icon.png`). `agent-found 2026-08-27` (QA sweep).
- 🟡 **Regenerate stale `prod/MERGED.docker-compose.yml`** `[ORQ-13]` — the committed prod MERGED declares
  "no MinIO / uses R2" (generated 2026-06-16) but live prod runs MinIO; a Komodo redeploy from it would drop
  storage. Regenerate MERGED from the current per-service files. `agent-found 2026-08-28` (ORQ-11 work).
## ✅ Done recently

- ✅ **Harden `push-to-demo.sh` / `push-to-prod.sh` migration tunnel** `[ORQ-17]` — both opened the DB tunnel on a
  LOCAL bind port equal to the remote `DB_PORT`; when another local container published that port (hit live:
  `onepostman-postgres` on `:5439` vs demo `DB_PORT=5439`) the bind failed silently, `ssh -N` stayed alive, prisma
  migrated the WRONG local DB, and the script still printed "✅ done" (false success — remote DB left un-migrated).
  Fixed: dedicated high local tunnel port decoupled from `DB_PORT` (probe 15439–15443), `ExitOnForwardFailure=yes`
  makes a failed bind FATAL, `kill -0` liveness check, abort loudly BEFORE migrate. Brings both scripts to parity
  with `staging-refresh-and-deploy.sh` (already decoupled). Lesson: `bash.deploy.tunnel-port-collides-with-local-db-container-false-success`.
  `347e900` on `fix/orq-17-deploy-tunnel-port`, HARD HOLD local. (2026-08-30)

- ✅ **Promote v0.18.0 Customer Portal to PRODUCTION** `[ORQ-14]` — owner-approved. `push-to-prod.sh sha-0e7ba0f`:
  prod DB backed up, image promoted (web+worker), stack recreated, 2 migrations applied, health polled to 200.
  Verified orqafy.com/api/health 200, prod app revision `0e7ba0f`, `/{slug}/portal` 307→login. (2026-08-30)
- ✅ **Deploy v0.18.0 portal to DEMO** `[ORQ-15]` — owner-approved. `push-to-demo.sh sha-0e7ba0f`; demo DB backed
  up, image promoted → demo-latest, migration applied (had to re-run via a 15439 tunnel — see ORQ-17). Verified
  demo.orqafy.com/api/health 200, `/demo/portal/login` 200, demo app revision `0e7ba0f`. (2026-08-30)
- ✅ **Merge `fix/orq-11-compose-mem-limits` → main** `[ORQ-16]` — FF-merge (compose mem/cpu limits + session docs).
  main @ `376ee38`, 6 ahead of origin (HARD HOLD — not pushed; push=release moment). (2026-08-30)

- ✅ **Compose resource limits (mem/cpu) — outage hardening** `[ORQ-11]` — added top-level `mem_limit`/
  `memswap_limit`/`mem_reservation`/`cpus` (V32.10) to all prod/staging/demo services (dev exempt); applied
  live to all 15 running containers via `docker update` (non-disruptive, no repull/restart) AND committed
  durably to compose files. Modeled on ferrybook + real usage on the tight 2-vCPU/7.8G box. `3ac1210` on
  `fix/orq-11-compose-mem-limits`, HARD HOLD local. (2026-08-28)
- ✅ **Uptime monitoring + alerts for Orqafy** `[ORQ-12]` — added 3 HTTP monitors (orqafy.com /
  staging.orqafy.com / demo.orqafy.com → `/api/health`, 60s) to the existing shared Uptime-Kuma with the
  Telegram (Hermes) notification attached. All UP/200 verified. Closes the blind spot behind the silent
  4-day outage. (Kuma DB change — shared infra, not in-repo.) (2026-08-28)
- ✅ **D-1 Customer Portal MVP (invite-only)** `[ORQ-1]` — 2nd Auth.js portal provider + principalType +
  portalProcedure; Dashboard/Invoices/Orders/Repairs (customer-scoped) + staff invite card. E2E-verified;
  6 defects caught in verification. Released **v0.18.0**, merged+pushed, deployed to staging. (2026-08-28)
- ✅ **Deploy v0.18.0 portal to staging (data-first gate)** `[ORQ-3]` — refreshed staging from prod, migration
  applied, schema HARD gate up-to-date, portal verified on staging.orqafy.com. Prod promote = separate owner
  step. (`sha-0e7ba0f`, 2026-08-28)
- ✅ **Production outage recovery** `[ORQ-4]` — prod/staging/demo down ~4 days after a VPS reboot; restored via
  `docker start` (not compose up); orqafy.com back to 200, all stacks healthy. (2026-08-28)
- ✅ **CI Turbo lint green** `[ORQ-5]` — cleared portal/D-4 ESLint errors (behavior-preserving); lint+typecheck+
  suite green. `0e7ba0f`. (dep-audit CI job stays red — pre-existing.) (2026-08-28)
- ✅ **D-4 public invoice view + Copy-share-link** `[ORQ-2]` — public `/invoice/[token]` page (noindex, notFound on bad
  token), shared sanitized fetch, allow-list flip, staff "Copy share link" button. Verified live (200/404/no
  field leak) + full suite 1491/1491. Released **v0.17.0** (local, HARD HOLD). (`353aeba`, 2026-08-27)
- ✅ **Demo invoices `publicToken` backfill** — seeded customer invoices now get a token so D-4 is demoable.
  (`6fb4e28`, 2026-08-27)
- ✅ **AdminCN Phase E re-baseline (authed admin fidelity gate)** — `design-fidelity.mjs` gained authed
  capture (login once, reuse storageState for `auth:true` entries); `data-fdl` landmark anchors on the
  AdminCN shell + dashboard; `/demo/dashboard` baseline captured. Gate now 8/8 PASS (was 7 public-only).
  Closes STATE.md authed-fidelity TODO + the AdminCN adoption's last PENDING item. Owner sign-off on the
  baseline deferred → PENDING_DECISIONS "D-ADMINCN-E". (`5a299b0`+`7b442df`+`fcdd765`, branch
  `feat/admincn-e-rebaseline`, HARD HOLD, 2026-08-27)
- ✅ **AdminCN adoption (decision #1)** — confirmed ALREADY built+merged+ratified 2026-08-08 (not re-done;
  stale "open" tracking corrected). `agent-found` reconcile, 2026-08-27.
- ✅ **POS grid product images blank** — root cause was NOT 404s/wrong source (POS resolves `imageUrl`
  from `ecommerceImageUrls[0]`, identical to the storefront catalog — always correct). Real cause: an
  opacity-0 **onLoad race** — a cached `<img>` reaches `complete` before React attaches `onLoad`, so the
  tile stays invisible/skeleton-stuck forever. Fixed with a ref callback flipping `imgLoaded` on the
  already-complete case. Verified on dev: 24/24 tiles visible, 0 stuck, 0 broken. (`1435c96`,
  branch `fix/pos-image-onload-race`, 2026-08-26)
- ✅ **Storefront demo seed coherence** — rethemed 24 demo products so name/brand/specs/category match
  each Shopix photo; 6 coherent categories; `onSale` gate (11/24 on sale); `ageDays` backdate (7/24 New);
  2 out-of-stock; idempotent reseed (UPDATE re-asserts name/createdAt/stock + slug pre-clear). Verified
  on dev + fidelity 7/7 + tests green. (`79b43b3`, 2026-08-25)
- ✅ **Public storefront rate limiter 10→60/min** — one page fans out to ~5-6 public checks; 10 locked
  out browsing (live catalog 500 + false fidelity fail). Bumped in rate-limit.ts + inputs.yml. (`7470a27`, 2026-08-25)
- ✅ **Overnight-hang recovery verification** — confirmed template-alignment P1–P4 all committed + clean
  handoff (nothing lost); re-ran tests 1479/1479, typecheck clean, fidelity 7/7 (proved the 1 "fail" a
  rate-limit false-negative), screenshotted storefront + POS. (2026-08-25)
