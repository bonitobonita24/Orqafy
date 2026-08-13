# Tailwind v4 Migration + shadcn/studio "orqafy" Theme Adoption — Plan of Record

**Branch:** `feat/tailwind-v4-shadcnstudio-theme` (off `main` @ v0.13.2)
**Status:** IN PROGRESS · **HARD HOLD** (local dev only — no staging/prod/demo deploy without explicit owner word)
**Owner decisions (2026-08-13):** Path A = migrate `apps/web` to Tailwind v4 then adopt natively · Blocks/templates = pull via shadcn-studio Pro MCP.

## Goal
Fully adopt the owner's shadcn/studio **`orqafy`** theme (color scheme + Geist/Source-Serif-4/Source-Code-Pro typography + radius & shadow scales + hugeicons + base-nova) into the live `apps/web` app, plus their shadcn/studio components/blocks/templates — natively, by first migrating `apps/web` from Tailwind v3.4 → v4.

## Why a migration is required (root fact)
The `orqafy.json` registry is **Tailwind v4-authored**: `@import "tailwindcss"`, `@theme inline`, `@custom-variant dark`, oklch tokens, `tw-animate-css`. The app is **Tailwind v3.4**: `@tailwind base/components/utilities`, JS `tailwind.config.ts`, HSL tokens, `tailwindcss-animate`. The theme CSS cannot compile on v3. Owner chose to migrate rather than hand-translate, so all current + future v4-native shadcn/studio assets drop in cleanly.

## Blast radius (measured)
`apps/web` only (mobile = React Native, worker = backend — not Tailwind-CSS). 50 shadcn ui components · 102 route `page.tsx` · 291 `.tsx` · 69 files import `lucide-react` · only 1 file uses `@apply` · `next-themes` defaultTheme=`dark`.

## Theme contents (from orqafy.json + owner-provided Step 2/3)
- **cssVars**: light (40) + dark (25) oklch tokens — palette is near-stock **zinc** (biggest visible change is typography + radius/shadow, not hue).
- **Typography**: Geist (headings, `--font-heading`), Source Serif 4 (body, `--font-body`), Source Code Pro (mono). `@layer base` h1–h6 size/weight/tracking scale.
- **Scales**: `--radius: 0.625rem` with sm/md/lg/xl/2xl/3xl/4xl; full shadow scale (2xs→2xl).
- **Deps**: `class-variance-authority`, `tw-animate-css`, `@hugeicons/react`, `@hugeicons/core-free-icons`.
- **config**: style `base-nova`, iconLibrary `hugeicons`, baseColor `zinc`.

## App-specific CSS that MUST survive the globals.css swap
- `@keyframes signal-glow` + `.signal-glow` animation (uses `--ring`) — re-express against new token.
- `prefers-reduced-motion` block (WCAG — keep verbatim).
- Any scrollbar / selection / drop-shadow rules present in the pre-migration `globals.css`.
Backups of all 5 design files saved to scratchpad before any edit.

---

## Phases (each = its own commit(s); verify green before advancing)

### Phase 0 — Safety baseline ✅ (branch + backups done)
- [x] Branch off main; back up globals.css / layout.tsx / tailwind.config.ts / components.json / postcss.config.js.
- [ ] Confirm current tree is green (tsc + build) as the known-good reference.

### Phase 1 — Tailwind v3 → v4 core migration (plumbing; highest risk)
- Run official codemod `npx @tailwindcss/upgrade@latest` (per context7 upgrade guide) in this branch.
- Verify: postcss → `@tailwindcss/postcss`; `@tailwind` → `@import "tailwindcss"`; deps → `tailwindcss@4` + `@tailwindcss/postcss`; config migrated to CSS `@theme`; compat layer preserves v3 border/ring defaults; `ring`→`ring-3` rewrites applied.
- Swap `tailwindcss-animate` → `tw-animate-css`.
- Gate: `pnpm --filter @orqafy/web build` compiles; `tsc` green. Fix breakages. Commit.

### Phase 2 — Apply the orqafy theme natively
- Replace `globals.css` token/`@theme`/typography blocks with the theme's Step-2 CSS (light+dark oklch, `@theme inline`, h1–h6 layer, radius/shadow). Re-graft the preserved app-specific CSS (signal-glow, reduced-motion) onto the new tokens.
- Update `components.json`: baseColor `zinc`, iconLibrary `hugeicons`, style. Add shadcn/studio registry entry.
- Gate: build green; dark + light both render. Commit.

### Phase 3 — Fonts
- `layout.tsx` (root): remove Inter; add Geist + Source Serif 4 + Source Code Pro via `next/font/google`; spread 3 `--font-*` vars into `<html>`. **Trim subsets to `latin`+`latin-ext` and to weights actually used** (the Step-3 snippet ships cyrillic/greek/vietnamese × 9 weights × 3 families — a large CWV/LCP hit; Rule 35 SEO cares). Verify the 2 other layout.tsx (auth, powerbyte-admin) inherit.
- Gate: fonts load, no duplicate-import warning, build green. Commit.

### Phase 4 — Icons (hugeicons) — install now, migrate gradually
- Install `@hugeicons/react` + `@hugeicons/core-free-icons`. Use hugeicons for pulled blocks + new UI.
- **Do NOT block the theme on churning 69 lucide files** — migrate existing lucide→hugeicons as a separate follow-up wave (swarm) so the visual theme lands first. Track as its own task.

### Phase 5 — Pull components/blocks/templates via shadcn-studio MCP
- Enumerate the owner's shadcn/studio library via the MCP; integrate blocks/templates onto the new theme (INHERIT-not-REPLACE over existing app structure; keep tRPC/Prisma/Auth wiring). Scope confirmed against what the MCP exposes.

### Phase 6 — Visual QA + regression (Rule 16 / Rule 32)
- Rebuild dev (Rule 39). Exercise the route archetypes across the 102 routes: auth, tenant app-shell, dashboards, tables, forms, settings/roles, powerbyte-admin — Playwright verify-all-pages + qa-skills smoke.
- `design-auditor` (19-rule) + `lint-design.sh --report-only` + a11y pass. Fix v4 fallout (border/ring defaults are the usual suspects).

### Phase 7 — Baseline reconciliation + governance (Rule 31 / Rule 3)
- Update the design contract baseline (`docs/DESIGN.md` / tokens / MOCKUP + fidelity baseline) to the new theme so the fidelity gate isn't left pointing at the old design. CHANGELOG_AI + DECISIONS_LOG entries.

## Rollback
Whole effort is one branch, local only. Any phase reverts via `git`; the pre-migration design files are in scratchpad. Nothing ships until owner says so.
