# Task Queue — Orqafy

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.

## 🔴 / 🟡 Open

_(none)_

## ✅ Done recently

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
