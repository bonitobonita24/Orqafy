# AdminCN Design Starter — Fleet-Default Design Baseline (V32.43 — Deliverable #39)

> Loaded contextually (read-on-demand, NOT auto-loaded — same posture as `design-principles.md` /
> `motion.md` / `ui-rules.md`). This file is the authority for the framework's **default UI/UX design
> starter**: **AdminCN — Shadcn Admin Dashboard Template** (shadcn/studio Pro, v1.0.0). Every
> framework-built app (Next.js · tRPC · Prisma · Auth.js v5 · PostgreSQL · shadcn/ui · Tailwind)
> starts its design language FROM the AdminCN baseline unless the Planning Assistant interview
> deliberately diverges.
>
> ⚠️ **DESIGN / REFERENCE, not a backend swap.** AdminCN is adopted as a **UI/design layer ONLY**
> under an **INHERIT-not-REPLACE** contract. The locked backend stack is unchanged — tRPC + Prisma +
> Auth.js v5 stay. AdminCN's own data layer (`fake-db` mock data, `zustand` stores, `nuqs` URL state)
> is **NOT adopted**; every adopted view is data-decoupled and re-wired to tRPC/Prisma per the graft
> procedure below. This file never overrides `docs/DESIGN.md` compiled tokens (ui-rules Rule 12) — the
> app's design system wins token VALUES; AdminCN supplies STRUCTURE, shell, components, and presets.

---

## Umbrella principle (owner rule-of-thumb, 2026-08-07)

**shadcn/studio Pro is the PRIORITY design asset for the ENTIRE design workflow** — blocks, components,
pages, AND templates. Alternatives (plain shadcn/ui + Blocks, Kibo UI, community registries) are
**FALLBACKS only**. AdminCN-as-default (this file) is the *template* expression of that principle;
the V32.11 Pro generator (`/cui`→`/iui`→`/rui`) is the *generation* expression. Both extend the same
AdminCN baseline. Encoded in `ui-rules.md` header ("DESIGN-ASSET SOURCING PRIORITY") + the global
`~/.claude/rules/skill-loadout-card.md` design pipeline.

## When to read

Read this file when:
- A **design phase** starts — Planning Assistant Step 7 (DESIGN.md/MOCKUP), Phase 2.8 (mockup),
  Phase 3.3 (prototype), Phase 4 Parts 5-6 (UI wiring).
- **Phase 0 / bootstrap** seeds a new app — the curated AdminCN slice + theme presets are copied in.
- You are choosing an **app-shell / layout archetype** (maps ui-rules Rule 8).
- You adopt an AdminCN **view scaffold** (dashboard, RBAC, settings, auth) and need the `fake-db`→tRPC
  graft procedure.
- A **Feature Update** (Phase 7) adds a page/section that should match the AdminCN design language.

## What AdminCN is

A production-grade Next.js 16 App-Router admin template from shadcn/studio Pro (purchased $79, v1.0.0),
shipping **6 layouts**, **50 shadcn/ui components**, a **10+ preset theme system** (820-line
`theme-presets.ts` + `ThemeCustomizer`), and complete dashboard / app / page view scaffolds. Its deps
are already framework-aligned: `shadcn`, `motion` (Rule 14), `recharts` (Rule 2), `react-hook-form`+`zod`
(Rule 4), `next-themes` (Rule 3), `lucide-react` (Rule 9), `@tanstack/react-table` (Rule 5).

**Source of truth (full 6-layout template):** `~/UbuntuDevFiles/1_COMPANY_DEV/_ref/admincn/shadcn-nextjs-admincn-admin-template-1.0.0/`
(outside the AIEF repo). The framework ships only the **curated slice** below.

## The vendored curated slice

Location: `specdrivenprompt/starter/admincn/` (deployed to apps by `deploy.sh` — see #39 wiring).
Extracted from the `default-layout` app; source-relative paths preserved so imports stay legible. It is
REFERENCE material — it does NOT compile standalone inside AIEF (some `lib/`/`hooks/` imports are left
dangling by design; the app supplies those or the builder grafts them).

| Category | Files | Contents |
|---|---|---|
| **Theme** | 10 | `utils/theme-presets.ts` (820 lines, 10+ presets) · `utils/fonts.ts` · `configs/themeConfig.ts` · `components/ThemeProvider.tsx` · `components/Providers.tsx` · `components/layout/ThemeCustomizer.tsx` · `components/layout/ModeToggle.tsx` · `app/globals.css` (token contract) · `types/theme.ts` · `contexts/settingsContext.tsx` (Settings/Mode types, narrowly included) |
| **App-shell** (default-layout) | 12 | `components/layout/{Sidebar,Header,Footer,BlankLayout,CommandMenu,ScrollToTop}.tsx` · `components/shared/{Logo,ProfileDropdown,NotificationDropdown,ActivityDialog}.tsx` · `configs/navConfig.tsx` · `app/layout.tsx` |
| **UI components** | 50 | Entire `components/ui/*.tsx` — the standard shadcn set PLUS AdminCN extras: `border-beam`, `morphing-text`, `number-ticker`, `timeline`, `kanban`, `rating`, `circular-progress`, `background-ripple`, `bg-dot-grid`, `bg-silk`, `button-group`, `combobox`, `field`, `input-group`, `kbd`. |
| **View scaffolds** (structure refs, data-decoupled) | 149 | `views/dashboards/{charts,statistics,widgets}` · `views/apps/{permissions,roles,users}` (RBAC baseline → Rule 34) · `views/pages/{auth,onboarding,user-settings,pricing,faq}` |

**Total ≈ 222 files + `PROVENANCE.md`.** Reconcile against the app's own `packages/ui` on adoption —
add the AdminCN extras; never duplicate a component the app already has.

**Explicitly excluded from the slice** (do NOT adopt): `fake-db/` · `store/` (Zustand) · `nuqs` usage ·
non-adopted app views (`calendar`, `chat`, `contact`, `kanban`, `mail`) · `forms`/`datatables` demo views ·
the other 5 layouts (opt-in — see below).

## The layout menu (Rule 8 app-shell archetypes)

| Layout | Status | Maps to |
|---|---|---|
| **`default-layout`** (classic left-sidebar) | ✅ **FLEET DEFAULT** | ui-rules **Rule 8** left-sidebar app-shell |
| `full-navbar-layout` | opt-in | top-nav shell |
| `horizontal-layout` | opt-in | horizontal menu shell |
| `icon-menu-layout` | opt-in | collapsed icon rail |
| `paper-layout` | opt-in | card/paper surface shell |
| `split-layout` | opt-in | split-pane shell |

Use `default-layout` unless `docs/PRODUCT.md` / the interview calls for another. Opt-in layouts live in
the full template under `_ref/admincn/` — copy the chosen layout's shell on an explicit divergence only.

## Theme presets

`utils/theme-presets.ts` carries 10+ named presets (accent + radius + surface tuning) driven through
`ThemeProvider` + `ThemeCustomizer` + `next-themes` (light/dark, Rule 3). On adoption, the app picks ONE
preset as its default and reconciles it INTO `docs/DESIGN.md` / the compiled token contract (ui-rules
Rule 12) — the preset seeds values, the app's `docs/tokens.json` remains the single source. Buttons follow
the **button-affordance standard** (companion feature): a subtle `shadow-xs/sm` emboss (or outline border),
colours ALWAYS from the current theme accent — the shadow is the only thing added (ui-rules Rule 3 +
`design-principles.md`).

## The `fake-db` → tRPC/Prisma graft procedure (the key adaptation)

For each adopted view, replace AdminCN's mock data layer with the framework backend:

1. **Identify** the view's `fake-db` import + the data shape it consumes.
2. **Map** that shape to a Prisma model + a tRPC router (Zod-validated; reuse `packages/shared` schemas).
3. **Replace** the mock fetch with a tRPC call — server components via `createCaller`, or client via
   `useQuery`/`useMutation`.
4. **Wire the 5 states** — loading / empty / error / partial / success (`design-principles.md` control
   contract); AdminCN scaffolds render the success state only.
5. **Enforce** tenant-scoping + RBAC on every query/mutation (`hasPermission`, Rule 34; the
   `permissions/roles/users` views are the RBAC UI baseline).
6. **Zustand** — keep ONLY for genuinely client-ephemeral UI state (theme, sidebar open/closed). NEVER
   for server data. Drop `nuqs`; use the framework's URL/query conventions.

## INHERIT-not-REPLACE contract (guardrails)

- AdminCN supplies **structure, shell, components, presets** — NOT token values. `docs/DESIGN.md` /
  compiled tokens (ui-rules Rule 12) win every value conflict.
- The **locked backend stack is untouched** — tRPC/Prisma/Auth.js v5. No `fake-db`/`zustand`/`nuqs`
  data layer enters an app.
- Adopt a divergent AdminCN dep (`three`, `xlsx`, `papaparse`) ONLY if a `docs/PRODUCT.md` need calls
  for it — never by default.
- shadcn/ui stays the ONLY component system (fleet rule). AdminCN IS shadcn/ui + studio Pro extras.

## License / provenance (⚠ read before touching the slice)

AdminCN is a **paid template ($79)** with **no bundled EULA**; the underlying shadcn/studio components
carry MIT. Treat AdminCN itself as **use-in-own / client-projects ONLY — NO redistribution, NO
open-sourcing**. The **AIEF repo MUST stay PRIVATE.** Provenance is stamped in
`specdrivenprompt/starter/admincn/PROVENANCE.md` and must travel with the slice.

## Design anti-slop gate (`lint-design.sh`) — scope note

The `lint-design.sh` anti-slop gate targets the **app's own authored screens** (`apps/web/src`), NOT this
vendored reference slice. Running it against `specdrivenprompt/starter/admincn/` surfaces a few EXPECTED,
non-actionable findings that are inherent to the upstream shadcn/studio Pro code and its demo scaffolds —
they are NOT framework regressions and must not be "fixed" by editing vendored third-party code:
- **D5 (AI-tile)** on `components/ui/button-group.tsx` / `toggle-group.tsx` — a false positive: this is
  shadcn's legitimate grouped-button internal styling (rounded outer corners + managed inner borders), not
  the rounded-card-with-coloured-left-border AI-tile pattern.
- **P1c (marketing buzzword)** in the `views/pages/user-settings/*` and `onboarding` demo scaffolds — filler
  copy the app REPLACES with real content during the graft; expected in a scaffold.
- **P1d (gradient stripes)** = a `TimelineLine` decoration · **P1e (layout-property animation)** = shadcn
  `sidebar.tsx`'s `transition-[width]` — both established shadcn component patterns.
When you build an app FROM this baseline, the gate runs on your authored screens and these upstream tells do
not appear. Do not gate the framework on this slice's own lint output.

## Per-app rollout (DEFERRED — per-seat broadcast, NOT from the AIEF seat)

Retrofitting an existing app onto the AdminCN baseline is a large per-app migration executed on that
app's own seat (global-feature-broadcast rule — never edit project repos/memory from AIEF). New apps get
the baseline at Phase 0 automatically.
