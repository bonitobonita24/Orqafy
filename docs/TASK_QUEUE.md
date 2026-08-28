# Task Queue — Orqafy

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.
Mirrored to the PROD Squirlnote board (project **Orqafy**, prefix `ORQ`) per `project_squirlnote_use_obligation`.

## 🔴 / 🟡 Open

- 🔴 **Add `mem_limit` to stage/prod compose (V32.10)** `[ORQ-11]` — stage/prod services have NO mem_limit
  despite the V32.10 mandate; likely the OOM behind the prod exit-255 → 4-day outage. Add per-role limits to
  `/etc/komodo/stacks/orqafy-{prod,staging,demo}` + repo templates. `agent-found 2026-08-28` (outage RCA).
- 🔴 **Wire uptime monitoring/alert for orqafy.com** `[ORQ-12]` — orqafy.com was down ~4 days unnoticed. Add an
  uptime-kuma check + alert for orqafy.com + staging.orqafy.com; consider `restart: always` for infra so a
  reboot self-heals. `agent-found 2026-08-28` (outage RCA).
- 🔴 **`favicon.ico` 404** `[ORQ-10]` — app serves no favicon; browser logs a 404 on first load (harmless but
  shows in console). Add `apps/web/src/app/favicon.ico` (or `icon.png`). `agent-found 2026-08-27` (QA sweep).

## ✅ Done recently

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
