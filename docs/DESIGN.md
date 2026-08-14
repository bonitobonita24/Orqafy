# Visual Design Reference — Orqafy

Visual design reference for Orqafy — canonical shadcn/studio "orqafy" theme.
Implementation uses shadcn/ui (Tailwind v4, oklch color space).

- **Active theme:** shadcn/studio "orqafy" theme — oklch zinc palette, Tailwind v4, dark
  default with light mode supported — owner-approved 2026-08-13, released in **v0.14.0**
- **Previous themes (archived):** shadcn/ui default dark neutral-gray (2026-06-18 — see
  `docs/DECISIONS_LOG.md`) and, before that, VoltAgent emerald (`docs/archive/DESIGN-voltagent.md`)
- **Source of canonical CSS values:** `apps/web/src/app/globals.css` (`:root` + `.dark` blocks,
  `@theme inline`) — those values override this doc if there is any discrepancy
- **Date of this rewrite:** 2026-08-14 — supersedes the 2026-06-18 "shadcn/ui default dark
  neutral-gray" revision of this file (owner-ratified theme adoption, `docs/DECISIONS_LOG.md`
  2026-08-14 entry: "THEME LOOK — APPROVED as-is")

> **Note on history:** Orqafy has been through four design iterations — Linear + sunset orange →
> VoltAgent emerald → shadcn/ui default dark neutral-gray → **shadcn/studio "orqafy" (oklch
> zinc, current)**. Earlier specs are archived and NOT the active design. See
> `docs/DECISIONS_LOG.md` for the full decision trail.

---

## 1. Visual Theme & Atmosphere

Orqafy uses the shadcn/studio "orqafy" theme as its canonical visual base — an oklch zinc
palette (Tailwind v4 native color space) that keeps the same low-distraction, component-driven
philosophy as the prior neutral-dark theme, now expressed in a perceptually-uniform color
model with a validated multi-hue chart system layered on top. Dark mode is the default
experience; light mode is fully supported via the same token pairs (`:root` for light,
`.dark` for dark) and toggled through `ThemeProvider` (`apps/web/src/components/theme-provider.tsx`).

**Key Characteristics:**
- oklch color space throughout (not HSL) — perceptually uniform lightness/chroma/hue, more
  predictable contrast behavior than the old HSL palette
- Achromatic base layer (near-white/near-black zinc tones) for background, surface, text,
  border, and primary — same "no chromatic brand accent in the base token layer" principle as
  before; semantic/status color still comes from Tailwind utilities, not CSS variables
- **NEW:** a validated 5-slot categorical **chart palette** (blue/orange/aqua/yellow/magenta),
  CVD-checked, with separate light and dark steps (see §2a)
- Three-typeface system: **Geist** for headings + UI, **Source Serif 4** for body copy,
  **Source Code Pro** for code/mono — replaces the old system-ui/Inter/SFMono stack (see §3)
- Icon system is **hugeicons**, accessed exclusively through a lucide-named shim
  (`apps/web/src/components/ui/icons.tsx`) — see §6. `lucide-react` is BANNED as a direct
  dependency anywhere in the app
- shadcn/ui component library remains the implementation vehicle; all Radix primitives consume
  these token values via the `@theme inline` block in `globals.css`
- Public/marketing surfaces (landing, login, register) are composed from **shadcn/studio Pro**
  blocks adapted to these tokens — see §7

---

## 2. Color Palette & Roles

Values below are the `oklch(L C H)` triples from `apps/web/src/app/globals.css`. Light mode =
`:root`; dark mode = `.dark`. Both are shipped; dark is the app default.

### Primary Accent (single identity)
- **Primary** — Light: `oklch(0.21 0.006 285.885)` (near-black) / Dark: `oklch(0.92 0.004 286.32)`
  (near-white). CSS: `--primary`
- **Primary Foreground** — Light: `oklch(0.985 0 0)` / Dark: `oklch(0.21 0.006 285.885)`.
  CSS: `--primary-foreground`

### Surface & Background
- **Background / Card / Popover** — Light: `oklch(1 0 0)` (pure white) / Dark:
  `oklch(0.141 0.005 285.823)` (near-black zinc). Card and Popover step up one level in dark
  mode (`oklch(0.21 0.006 285.885)`) for elevation separation. CSS: `--background` / `--card` /
  `--popover`
- **Secondary / Muted / Accent / Input / Border** — Light: `oklch(0.967 0.001 286.375)` (border
  is slightly darker at `oklch(0.92 0.004 286.32)`) / Dark: `oklch(0.274 0.006 286.033)` (border
  uses translucent white: `oklch(1 0 0 / 10%)`, input `oklch(1 0 0 / 15%)`). CSS: `--secondary` /
  `--muted` / `--accent` / `--input` / `--border`
- **Brand Muted / Surface** (app-extended aliases consumed by `packages/ui`): mirror
  `--secondary`/`--muted` in each mode. CSS: `--brand-muted` / `--surface`

### Text Hierarchy
- **Foreground** — Light: `oklch(0.141 0.005 285.823)` / Dark: `oklch(0.985 0 0)`.
  CSS: `--foreground` (also `--card-foreground`, `--popover-foreground`)
- **Muted Foreground** — Light: `oklch(0.552 0.016 285.938)` / Dark: `oklch(0.705 0.015 286.067)`.
  CSS: `--muted-foreground` — descriptions, metadata, de-emphasized text
- **Primary Foreground** (text on primary-colored surfaces): see above

### Status Colors (semantic exceptions — Tailwind utilities, not CSS variables)
Unchanged from the prior theme — these bypass the token layer by design, chromatic specificity
needed for semantic clarity:
- **Blue** (`text-blue-400 bg-blue-400/10 border-blue-400/30`): Info, planning states
- **Yellow** (`text-yellow-400 bg-yellow-400/10 border-yellow-400/30`): Warning, on-hold states
- **Red** (`text-red-400 bg-red-400/10 border-red-400/30`): Error, cancelled states
- **Green** (`text-green-400 bg-green-400/10 border-green-400/30`): Success, completed states
- **Destructive** — Light: `oklch(0.577 0.245 27.325)` / Dark: `oklch(0.704 0.191 22.216)`.
  CSS: `--destructive`

### Ring / Focus
- **Ring** — Light: `oklch(0.705 0.015 286.067)` / Dark: `oklch(0.552 0.016 285.938)`. Focus
  rings + `.signal-glow` animation color. CSS: `--ring`

### Sidebar Tokens
Sidebar has its own dedicated pair (no longer a straight alias of root, per the shadcn/studio
registry): `--sidebar` / `--sidebar-foreground` / `--sidebar-primary` /
`--sidebar-primary-foreground` / `--sidebar-accent` / `--sidebar-accent-foreground` /
`--sidebar-border` / `--sidebar-ring`. Light-mode sidebar sits at `oklch(0.985 0 0)` (near-white,
one step lighter than card); dark-mode sidebar matches card at `oklch(0.21 0.006 285.885)`.
Notably, `--sidebar-primary` in dark mode is a distinct blue accent
(`oklch(0.488 0.243 264.376)`) rather than the achromatic primary — the one deliberate chromatic
break in the base token layer, reserved for sidebar active-state emphasis.

### Radius & Shadow Scale
- `--radius: 0.625rem` (10px base — up from the prior theme's `0.5rem`). Derived scale in
  `@theme inline`: `--radius-sm` = `radius × 0.6`, `--radius-md` = `× 0.8`, `--radius-lg` =
  `radius`, `--radius-xl` = `× 1.4`, `--radius-2xl` = `× 1.8`, `--radius-3xl` = `× 2.2`,
  `--radius-4xl` = `× 2.6`.
- Shadow scale (`--shadow-2xs` through `--shadow-2xl`) is defined per-mode in `globals.css`,
  built from `oklch(0 0 0 / alpha)` — same values light and dark (shadows stay black-based
  regardless of theme mode).

---

## 2a. Chart Palette (NEW — categorical, CVD-validated)

The prior theme had no dedicated chart tokens (charts fell back to greyscale zinc). The
"orqafy" theme adds a 5-slot categorical palette, owner-ratified 2026-08-14
(`docs/DECISIONS_LOG.md`): **multi-hue ADOPTED**, replacing an earlier greyscale-only draft.

| Slot | Hue | Light (`:root`) | Dark (`.dark`) |
|---|---|---|---|
| `--chart-1` | Blue | `oklch(0.575 0.163 255.5)` — `#2a78d6` | `oklch(0.622 0.161 255.1)` — `#3987e5` |
| `--chart-2` | Orange | `oklch(0.671 0.175 40.6)` — `#eb6834` | `oklch(0.622 0.173 40.1)` — `#d95926` |
| `--chart-3` | Aqua | `oklch(0.669 0.141 162.1)` — `#1baf7a` | `oklch(0.621 0.128 163.1)` — `#199e70` |
| `--chart-4` | Yellow | `oklch(0.764 0.161 75.1)` — `#eda100` | `oklch(0.670 0.143 73.2)` — `#c98500` |
| `--chart-5` | Magenta | `oklch(0.716 0.141 357.4)` — `#e87ba4` | `oklch(0.622 0.171 0.8)` — `#d55181` |

**Rules:**
- **Assignment is fixed-order** — always assign `chart-1` → `chart-2` → `chart-3` → … in series
  order; never reorder or cherry-pick a slot per chart. Consistency across the app is the point.
- **Separate light/dark steps, both CVD-validated** on their real surface (white `#ffffff` for
  light, zinc-900 `#18181b` for dark) — worst adjacent ΔE 9.1 (light) / 8.4 (dark).
- **Relief rule (mandatory):** light-mode `chart-3`/`chart-4`/`chart-5` sit below 3:1 contrast
  against the white background. Any chart using those slots in light mode MUST keep legends
  and/or tooltips visible (the shadcn chart default) — color alone is never the only
  differentiator. Dark mode is all ≥3:1 and does not require this exception, but legends/
  tooltips remain best practice regardless of mode.
- This also fixed a latent light-mode bug in an earlier greyscale draft where `chart-1` at
  `L 0.871` was near-invisible on a white background.

---

## 3. Typography Rules

### Font Family

Three Google variable fonts, loaded via `next/font/google` in `apps/web/src/app/layout.tsx`,
each exposed as a CSS custom property and mapped into Tailwind's `@theme inline` block in
`globals.css`:

- **Headings + UI:** `Geist` → `--font-geist` → `--font-sans` / `--font-heading` (Tailwind
  `font-sans`, `.font-heading` utility, and the `h1`–`h6` base-layer rules all resolve here)
- **Body:** `Source Serif 4` → `--font-source-serif-4` → `--font-serif` / `--font-body`
  (`body` element font-family in the base layer)
- **Monospace (Code):** `Source Code Pro` → `--font-source-code-pro` → `--font-mono`
  (`code`, `pre`, and the `.font-code` utility)

All three are variable fonts loaded with the full weight range (no fixed `weight` array),
subsets `latin`/`latin-ext`, `display: "swap"` — chosen to protect LCP/CWV (Rule 35 SEO).

**Implementation:**
- `html` element: `font-sans` (Geist) — the default typeface for anything not explicitly body
  or heading
- `body`: `font-family: var(--font-body)` (Source Serif 4) + `line-height: 1.65` +
  `font-feature-settings: "calt", "rlig"` (contextual alternates and required ligatures) +
  antialiasing
- `h1`–`h6`: `font-family: var(--font-heading)` (Geist), each with its own size/line-height/
  letter-spacing/weight declared directly in `globals.css` `@layer base` (see Hierarchy table)
- `code`, `pre`: `font-family: var(--font-mono)` (Source Code Pro)

### Hierarchy

Base-layer heading sizes (from `globals.css` `@layer base`, in rem):

| Element | Font | Size | Line Height | Letter Spacing | Weight |
|---|---|---|---|---|---|
| `h1` | Geist | 2.25rem (36px) | 1.15 | -0.025em | 700 |
| `h2` | Geist | 1.875rem (30px) | 1.25 | -0.02em | 600 |
| `h3` | Geist | 1.5rem (24px) | 1.3 | -0.015em | 600 |
| `h4` | Geist | 1.25rem (20px) | 1.4 | -0.01em | 500 |
| `h5` | Geist | 1.125rem (18px) | 1.5 | 0 | 500 |
| `h6` | Geist | 1rem (16px) | 1.5 | 0 | 500 |
| Body | Source Serif 4 | 1rem (16px) | 1.65 | normal | 400 |
| Code | Source Code Pro | inherit | inherit | normal | 400 |

Legacy display-scale utility classes are still defined in `globals.css` for hero/marketing
copy and now render in Geist (via `--font-heading`) instead of `system-ui`:

| Utility | Size | Line Height | Letter Spacing |
|---|---|---|---|
| `.heading-display` | 3.75rem (60px) | 1.00 | -0.65px |
| `.heading-section` | 2.25rem (36px) | 1.11 | -0.9px |
| `.heading-sub` | 1.5rem (24px), weight 700 | 1.33 | -0.6px |
| `.heading-overline` | 0.875rem (14px), weight 600, uppercase | 1.43 | +2.52px |

### Principles

- **Geist for structure, Source Serif 4 for reading** — a deliberate sans/serif pairing: Geist
  gives headings and UI chrome a clean geometric voice; Source Serif 4 gives body copy warmth
  and long-form readability, a shift from the prior all-sans (system-ui/Inter) stack.
- **Weight gradient preserved**: `.w-510` = 500, `.w-590` = 600 (legacy markup compatibility,
  unchanged from the prior theme).
- **Uppercase is earned and wide**: `.heading-overline` always pairs uppercase with generous
  letter-spacing (+2.52px). Never applied to main headings.
- **OpenType**: `"calt"` and `"rlig"` enabled globally on `body`.

---

## 4. Animation

### Signal Glow (`.signal-glow`)
Pulsing drop-shadow animation applied to identity elements only — unchanged in purpose, updated
implementation for oklch: uses `color-mix(in oklch, var(--color-ring) <pct>%, transparent)`
instead of the old `hsl(var(--ring) / alpha)` syntax (oklch custom properties can't be alpha-
blended with the old slash-in-hsl trick).

```css
/* From globals.css */
@keyframes signal-glow {
  0%, 100% {
    filter: drop-shadow(0 0 2px color-mix(in oklch, var(--color-ring) 60%, transparent));
  }
  50% {
    filter: drop-shadow(0 0 8px color-mix(in oklch, var(--color-ring) 90%, transparent));
  }
}
.signal-glow { animation: signal-glow 2.5s ease-in-out infinite; }
```

**Applied to (targeted, not decorative):**
- Header logo ("O" mark — Orqafy brand identity)
- Login screen logo — high-visibility placement
- Active disbursement pipeline step — "current action" indicator

**NOT applied to:** general nav links, success pills, or CTA hover states.

### Reduced Motion (WCAG 2.3.3 / `.ai_prompt/motion.md` gate)
`globals.css` includes a `prefers-reduced-motion: reduce` media query that collapses all
animation/transition durations to `0.01ms` and forces `scroll-behavior: auto` — first-class,
not an afterthought, per Rule 14 (Motion & Micro-interactions) / `.ai_prompt/motion.md`.

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px (unchanged)
- Tailwind spacing scale (Tailwind default: 4px = 1 unit)
- Button padding: `px-4 py-2` standard, `px-4 py-3` for larger CTAs
- Card internal padding: `p-6` (24px)
- Component gap: `gap-4` to `gap-6` (16–24px) between sibling cards

### Grid & Container
- Max content width: `container` class (1400px at 2xl) — centered with `2rem` padding
- Card grids: responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

### Border Radius Scale (from `--radius: 0.625rem`, up from the prior `0.5rem`)
- `rounded-sm`: `radius × 0.6` ≈ 6px — small inline elements
- `rounded-md`: `radius × 0.8` ≈ 8px — buttons, inputs
- `rounded-lg`: `radius` = 10px — cards (standard containment)
- `rounded-xl` / `2xl` / `3xl` / `4xl`: `radius × 1.4` / `1.8` / `2.2` / `2.6` — larger surfaces,
  modals, hero panels
- `rounded-full`: pill-shaped — tags, badges, status chips

---

## 6. Icon System — hugeicons (via lucide-named shim)

Icons ship through **hugeicons** (`@hugeicons/react`), never through `lucide-react` directly.
`lucide-react` is **BANNED** as a direct dependency anywhere in the app (removed from both
`apps/web` and `packages/ui`; zero lockfile references).

All icon access goes through one file: **`apps/web/src/components/ui/icons.tsx`**. It:
- imports the underlying hugeicons glyph components (aliased with a leading underscore, e.g.
  `Add01Icon as _Add01Icon`),
- wraps each one through a shared `makeIcon()` helper over `HugeiconsIcon`,
- and re-exports it under its **original lucide component name** (e.g.
  `export const Trash2 = makeIcon(_Delete02Icon);`, `export const XIcon = makeIcon(_Cancel01Icon);`).

Call sites are **unchanged JSX** — every consumer still imports `Trash2`, `Users`, `Calendar`,
etc. from `@/components/ui/icons`; only the import source and the underlying glyph swapped.
This is a deliberate shim strategy (owner-approved 2026-08-13): the name-map in `icons.tsx` is
the single reviewable file for the whole 83-icon/69-file migration.

**Adding a new icon:** add one `makeIcon(_SomeHugeIcon)` wrapper line to `icons.tsx`. Never
import `lucide-react` or `@hugeicons/react` directly in a component — always go through the
shim. Glyph choices are owner-ratified (2026-08-14, `docs/DECISIONS_LOG.md`) — notable mappings
include `Landmark → Bank`, `Receipt/ReceiptText → Invoice01/03`, `ShieldAlert →
SecurityWarning`, `ShieldCheck → SecurityCheck`, `ClipboardList → TaskDaily01`,
`FolderTree → FolderLibrary`. Any future glyph change is a 1-line edit in `icons.tsx`.

---

## 7. Landing + Auth Surfaces — shadcn/studio Pro Blocks

Orqafy's public landing page and the login/register chrome are composed from **shadcn/studio
Pro** blocks, adapted to the tokens above (hero-section variants, features-section, cta-section,
and the Pro login/register templates). This follows the framework's **INHERIT-not-REPLACE**
contract (Rule 12 / `.ai_prompt/ui-rules.md` "sanctioned design generator"): Pro blocks are
restyled onto the existing `globals.css` token layer and component primitives — they extend the
design system, they do not fork it or introduce a second token set. Any new landing/auth section
pulled from the Pro registry goes through the same token mapping before it ships.

---

## Orqafy Implementation Notes

**CTA Pattern:**
All primary CTAs: `bg-primary text-primary-foreground`. This is the stock shadcn filled-button
pattern and holds unchanged across the theme swap — only the underlying oklch values changed,
not the class usage.

**Signal Glow Application:**
The `.signal-glow` class produces a ring-colored pulsing glow. Applied to: header logo, login
screen logo, active disbursement pipeline step. NOT decorative. See §4 for the oklch-safe
implementation.

**Success vs Brand Pill Disambiguation:**
- Success completion states: `text-green-400 bg-green-400/10 border-green-400/30` (Tailwind green)
- Active/in-progress brand states: `text-primary bg-primary/10 border-primary/30`
- These must remain visually distinguishable.

**Elevation Philosophy:**
shadcn default: border-based separation using `--border`, now supplemented by a real shadow
scale (`--shadow-2xs` through `--shadow-2xl`, oklch-black-based) defined in `globals.css` and
exposed via `@theme inline` — the prior theme had no dedicated shadow tokens beyond Tailwind
defaults. `ring-offset-background` still uses `--background`.

**PDF Viewer Exception:**
`apps/web/src/app/(tenant)/[slug]/(app)/crm/quotations/[id]/pdf/quotation-pdf-viewer.tsx`
uses hardcoded Tailwind gray hex values (`#e5e7eb`, `#6b7280`, `#374151`, `#9ca3af`, `#d1d5db`).
This is a **platform-constrained exception** — `@react-pdf/renderer` does not support CSS
custom properties (nor oklch) in inline styles. Do not attempt to replace these with
`var(--*)`/`oklch(var(--*))`.

---

## shadcn/ui Translation Guide

Key CSS variable mappings in `apps/web/src/app/globals.css` (oklch format — space-separated
`L C H` inside `oklch()` calls, per Tailwind v4 / shadcn/studio convention). Light values shown;
see `globals.css` `.dark` block for the dark-mode pair of each token, and §2a above for the
chart palette's per-mode values.

```css
:root {
  --radius:               0.625rem;
  --background:            oklch(1 0 0);              /* pure white canvas (light) */
  --foreground:            oklch(0.141 0.005 285.823); /* near-black primary text */
  --card:                  oklch(1 0 0);
  --card-foreground:       oklch(0.141 0.005 285.823);
  --popover:               oklch(1 0 0);
  --popover-foreground:    oklch(0.141 0.005 285.823);
  --primary:               oklch(0.21 0.006 285.885);  /* near-black — filled buttons, chips */
  --primary-foreground:    oklch(0.985 0 0);
  --secondary:             oklch(0.967 0.001 286.375);
  --secondary-foreground:  oklch(0.21 0.006 285.885);
  --muted:                 oklch(0.967 0.001 286.375);
  --muted-foreground:      oklch(0.552 0.016 285.938);
  --accent:                oklch(0.967 0.001 286.375);
  --accent-foreground:     oklch(0.21 0.006 285.885);
  --destructive:           oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border:                oklch(0.92 0.004 286.32);
  --input:                 oklch(0.92 0.004 286.32);
  --ring:                  oklch(0.705 0.015 286.067);
  --chart-1..5:            /* see §2a — categorical, per-mode */
  --sidebar / --sidebar-*: /* see §2 Sidebar Tokens */
  /* Extended: */
  --brand-muted:           oklch(0.967 0.001 286.375);
  --surface:               oklch(0.967 0.001 286.375);
}
```

**Format note:** Tailwind v4's native color space is `oklch(L C H)` (lightness / chroma / hue,
space-separated, no HSL). This is a hard break from the prior theme's `H S% L%` HSL convention
— any code or doc still referencing `hsl(var(--*))` for a themed token is stale and should be
corrected to consume the `--color-*` aliases exposed in the `@theme inline` block instead
(e.g. `bg-background`, `text-foreground`, `border-border` — Tailwind utility classes, not raw
`var()`/`hsl()` calls, remain the correct way to consume these tokens in components).

The extracted theme (sections 1–4, 2a, 6, 7) is the visual truth; shadcn/ui components
(optionally sourced via shadcn/studio Pro for landing/auth per §7) are the implementation
vehicle.
