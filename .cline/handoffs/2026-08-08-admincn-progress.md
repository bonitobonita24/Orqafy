# [FOCUS: Orqafy] AdminCN adoption progress — 2026-08-08 (full-auto overnight)

Owner approved (2026-08-07) the held-line work + "do it one at a time, full auto." Executed with my
recommended options (D-A light/dark default-dark · D-B closest preset · D-C fold into globals.css ·
D-D ERP-first · D-SEO Yes/adaptive). Deploy HARD HOLD stands — all LOCAL, nothing pushed.

## ✅ DONE + VERIFIED THIS RUN
- **SEO retrofit** — branch `feat/seo-foundation`, commit `cd7d655`. Adaptive baseline (public indexable,
  authed noindex), robots.ts + sitemap.ts, Organization/WebSite JSON-LD, metadataBase. typecheck/lint/build green.
- **AdminCN Phase A1** (`a7e22c6`) — component set → 50 (dark palette preserved; skipped kanban/combobox/
  button-group = need @base-ui).
- **AdminCN Phase A2** (`5a071d6`) — theme infra: next-themes ThemeProvider (default DARK) + ModeToggle;
  `.dark` == old `:root` byte-identical (appearance unchanged); light palette added.
- **AdminCN Phase B** (`0f56bd7`) — app-shell → shadcn `sidebar` primitive; RBAC nav gating preserved verbatim;
  white-label footer + hrefs intact; mobile-nav folded in. **LIVE-VERIFIED** (prod build + `next start` +
  Playwright): /demo/dashboard + /demo/crm/customers render correctly, real tRPC data, RBAC nav, only a
  benign favicon 404.

Branches (all off `chore/framework-sync-v32.31-admincn-prereq`, which is off local `main`): `feat/seo-foundation`,
`feat/admincn-adoption` (A1→A2→B). UNMERGED, unpushed. Merge order is owner's call.

## ▶ REMAINING — Phase C/D/E (design-depth; see docs/ADMINCN_ADOPTION_PLAN.md)
- **C** — graft each module's VIEWS to AdminCN scaffolds (fake-db→tRPC, 5 states, RBAC), 6 groups:
  C1 dashboard+reports · C2 settings/RBAC · C3 sales · C4 supply/retail · C5 finance · C6 ops/HR.
- **D** — storefront (`store/*`) + platform-admin (`powerbyte-admin/*`) design passes.
- **E** — re-baseline: update docs/DESIGN.md + docs/MOCKUP.jsx, capture `design:fidelity` baseline, log DECISIONS_LOG.
- These are design-subjective; the live AdminCN shell is now viewable — owner eyes will sharpen how far to
  graft each module. Full-auto will proceed with C1 on the next loop cycle unless the owner redirects.

## ⚠ ENV NOTES for whoever verifies next (NOT code bugs)
- Native `next dev` UNUSABLE: `apps/web/tailwind.config.ts:105` `require("tailwindcss-animate")` breaks Next's
  ESM dev loader (pre-existing). Verify via: prod build + `next start` with `set -a; . ./.env.dev; set +a`.
- Sandbox blocks `pkill` + foreground `sleep` (exit 144) — use `kill <pid>` + background `until` loops. No `curl`.
- Backing services (postgres/valkey) already up. `/demo-login` → "Enter demo workspace" = quick authed session.

## Minor follow-ups
3 skipped components (kanban/combobox/button-group); no default OG image / favicon / logo.png brand assets.

---

## ADDENDUM (later same session) — C1 fixed, C2 verified, C3–E paused for calibration
- **C1 dashboard** `5c6326a` + fix `14f382a`: shipped a RUNTIME RSC bug (server passed `<CircularProgress
  renderLabel={fn}/>` as a ReactNode into a client component → "Functions cannot be passed to Client
  Components"; build/typecheck MISSED it). Found via live verify, fixed (default label identical). Live-verified OK.
  Lesson → LESSONS_GLOBAL.md `nextjs.rsc.function-prop-to-client-via-reactnode`.
- **C2 settings roles/users** `37f4b33`: UI-only, all RBAC logic preserved verbatim. Live-verified: dashboard +
  roles + users render, 0 error boundaries, 0 console errors.
- **C3–C6 / D / E PAUSED — scope reassessment for owner:** AdminCN slice has NO ERP-CRUD scaffolds, so C3–C6
  = broad *idiom polish* across ~80 CRUD pages (marginal value, design-subjective, high live-verify overhead —
  C1 proved UI-only grafts can still add runtime regressions). The high-value adoption (foundation + shell +
  dashboard + settings/RBAC) is DONE + live-verified. Recommend owner calibrates whether to grind C3–C6 vs.
  stop before spending it; E (re-baseline) needs owner design sign-off; D = owner's call. Loop paced pending direction.
- Branches (all unmerged, off framework-sync branch, off local main): feat/seo-foundation, feat/admincn-adoption
  (A1→A2→B→C1→C2→C1-fix). HARD HOLD — nothing pushed.
