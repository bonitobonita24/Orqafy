# AdminCN Starter Slice — Provenance

**Source:** AdminCN — Shadcn Admin Dashboard Template v1.0.0 (shadcn/studio Pro, purchased $79).
Vendored 2026-08-07 from the `default-layout` layout variant (one of six layout variants shipped in
the template; the other five are opt-in, not vendored here).

## What this slice is

A curated reference slice, not a working app:
- **Theme system** — the preset/token engine (`utils/theme-presets.ts`, `utils/fonts.ts`,
  `configs/themeConfig.ts`), the provider wiring (`components/ThemeProvider.tsx`,
  `components/Providers.tsx`), the customizer UI (`components/layout/ThemeCustomizer.tsx`,
  `components/layout/ModeToggle.tsx`), global styles (`app/globals.css`), and the theme type
  (`types/theme.ts`).
- **Default-layout app-shell** — `Sidebar.tsx`, `Header.tsx`, `Footer.tsx`, `BlankLayout.tsx`,
  `CommandMenu.tsx`, `ScrollToTop.tsx`, `configs/navConfig.tsx`, `app/layout.tsx`.
- **50 shadcn/ui primitives** — the complete `components/ui/` directory as shipped.
- **Data-decoupled view scaffolds** — dashboard widgets/charts/statistics, and the
  permissions/roles/users/auth/onboarding/user-settings/pricing/faq page views, kept AS-IS
  (including their original imports) as structural/layout references.

File paths under this directory mirror their **source-relative path** inside the original
`default-layout/src/` tree (e.g. `src/components/ui/button.tsx` → `starter/admincn/components/ui/button.tsx`)
so the import shape stays legible as a reference, even though nothing here compiles inside the
AIEF repo.

## What was excluded, and why

- **`fake-db/`, `store/` (Zustand), and `nuqs` URL-state wiring** — the template's demo data layer.
  The Spec-Driven framework's locked stack uses tRPC + Prisma + Auth.js v5 instead, so this data
  layer does not carry over; view scaffolds are kept AS-IS with their original imports precisely so
  a build session can see the shape being replaced.
- **Non-adopted app views** — `views/apps/{calendar,chat,contact,kanban,mail}` and
  `views/{forms,datatables}` — not part of the curated slice; not needed for the AdminCN
  default-starter scope.
- **The other 5 layout variants** (only `default-layout` was vendored) — opt-in for a future slice
  if a different shell style is wanted later.
- **`hooks/`, `lib/`, `assets/`, `app/api`, `app/server`, `app/(pages)`, `app/(blank)`,
  `node_modules`, and root package/config files** — infrastructure/demo-app plumbing outside the
  curated theme+shell+ui+views scope.
- **`components/shared/*`** (ActivityDialog, NotificationDropdown, ProfileDropdown, Logo) — imported
  by `Header.tsx` but not in the curated file list; the slice is reference material and is not
  expected to compile, so this dangling import was left as-is rather than pulled in speculatively.

## LICENSE — read before reusing

AdminCN is a **paid template ($79 via shadcn/studio Pro)** with **no bundled EULA file** in the
downloaded archive. The underlying shadcn/studio component primitives carry an MIT license, but
**AdminCN's own composed template (this slice) must be treated as use-in-own/client-projects ONLY**:

- **NO redistribution.**
- **NO open-sourcing.**
- **The Powerbyte-AIEF repo housing this slice MUST stay PRIVATE.**

Do not publish, fork-and-share, or otherwise distribute this directory outside Powerbyte's own
projects/client work.
