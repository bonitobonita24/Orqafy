# Visual Design Reference — Orqafy

Visual design reference for Orqafy — canonical neutral-dark theme.
Implementation uses shadcn/ui.

- **Active theme:** shadcn/ui default dark (neutral-gray palette) — owner-approved reskin 2026-06-18
- **Previous theme:** VoltAgent emerald (archived — see `docs/archive/DESIGN-voltagent.md` and `docs/DECISIONS_LOG.md`)
- **Source of canonical CSS values:** `apps/web/src/app/globals.css` (`:root` block) — those values override this doc if there is any discrepancy
- **Date of this rewrite:** 2026-06-18

> **Note on history:** Orqafy went through three design iterations — Linear + sunset orange →
> VoltAgent emerald → shadcn neutral-dark. The VoltAgent spec (Signal Green, Abyss Black,
> Carbon Surface, Warm Charcoal) is archived and NOT the active design. See `docs/DECISIONS_LOG.md`
> for the full decision trail.

---

## 1. Visual Theme & Atmosphere

Orqafy uses the shadcn/ui default dark theme as its canonical visual base — a clean,
neutral-gray darkness that prioritises legibility and component consistency over chromatic
identity. The palette is intentionally achromatic: near-pure-black surfaces, high-contrast
white primary, and mid-gray accents. This creates a professional, low-distraction workspace
appropriate for a multi-department ERP used across HR, finance, projects, and field operations.

**Key Characteristics:**
- Near-pure-black canvas (`hsl(0 0% 3.9%)`) — neutral, no warm undertone
- Single primary identity: near-white (`hsl(0 0% 98%)`) with near-black foreground (`hsl(0 0% 9%)`)
- Achromatic accent system — secondary, muted, and accent all use the same mid-gray (`hsl(0 0% 14.9%)`)
- No chromatic brand accent in the base token layer — semantic color comes from status pills (blue/yellow/red/green via Tailwind utilities)
- Dual-typography system: system-ui for authoritative headings (h1/h2/h3), Inter for UI/body text, SFMono for code
- Tight heading compression (negative letter-spacing, compressed line-heights) — inherited from the VoltAgent typography decision (see §3)
- shadcn/ui component library is the primary implementation vehicle; all radix primitives use these token values

---

## 2. Color Palette & Roles

### Primary Accent (single identity)
- **Near-White** (`hsl(0 0% 98%)`): Primary interactive color — filled buttons, active chips,
  primary CTA background. CSS: `--primary: 0 0% 98%`
- **Near-Black Foreground** (`hsl(0 0% 9%)`): Text on primary surfaces (buttons, chips).
  CSS: `--primary-foreground: 0 0% 9%`

### Surface & Background
- **Near-Black Canvas** (`hsl(0 0% 3.9%)`): Page background, card background, popover background.
  CSS: `--background: 0 0% 3.9%` / `--card: 0 0% 3.9%` / `--popover: 0 0% 3.9%`
- **Mid-Gray Elevated** (`hsl(0 0% 14.9%)`): Secondary, muted, accent, input, border surfaces.
  CSS: `--secondary / --muted / --accent / --input / --border: 0 0% 14.9%`
- **Brand Muted** (`hsl(0 0% 14.9%)`): Extended alias for muted brand surfaces (`bg-brand-muted`).
  CSS: `--brand-muted: 0 0% 14.9%`
- **Surface** (`hsl(0 0% 14.9%)`): Extended alias for elevated surfaces (`bg-surface`).
  CSS: `--surface: 0 0% 14.9%`

### Text Hierarchy
- **Near-White** (`hsl(0 0% 98%)`): Primary text — all foreground, card-foreground, popover-foreground.
  CSS: `--foreground: 0 0% 98%`
- **Mid-Gray** (`hsl(0 0% 63.9%)`): Muted / secondary text — descriptions, metadata.
  CSS: `--muted-foreground: 0 0% 63.9%`
- **Near-Black** (`hsl(0 0% 9%)`): Text on primary-colored backgrounds (buttons, chips).
  CSS: `--primary-foreground: 0 0% 9%`

### Status Colors (semantic exceptions — Tailwind utilities, not CSS variables)
These bypass the token layer by design — semantic clarity requires chromatic specificity:
- **Blue** (`text-blue-400 bg-blue-400/10 border-blue-400/30`): Info, planning states
- **Yellow** (`text-yellow-400 bg-yellow-400/10 border-yellow-400/30`): Warning, on-hold states
- **Red** (`text-red-400 bg-red-400/10 border-red-400/30`): Error, cancelled states
- **Green** (`text-green-400 bg-green-400/10 border-green-400/30`): Success, completed states
- **Destructive** (`hsl(0 62.8% 30.6%)`): shadcn destructive variant. CSS: `--destructive: 0 62.8% 30.6%`

### Ring / Focus
- **Ring** (`hsl(0 0% 83.1%)`): Focus rings, signal-glow animation color. CSS: `--ring: 0 0% 83.1%`

### Sidebar Tokens
Sidebar uses the same values as the root — fully consistent neutral-dark:
`--sidebar-background: 0 0% 3.9%` / `--sidebar-foreground: 0 0% 98%` /
`--sidebar-primary: 0 0% 98%` / `--sidebar-primary-foreground: 0 0% 9%` /
`--sidebar-accent: 0 0% 14.9%` / `--sidebar-border: 0 0% 14.9%` /
`--sidebar-ring: 0 0% 83.1%`

---

## 3. Typography Rules

### Font Family

- **Primary (Headings h1/h2/h3)**: `system-ui`, with fallbacks:
  `-apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif`
- **Secondary (Body/UI)**: `Inter` loaded via `next/font/google` in `apps/web/src/app/layout.tsx`,
  exposed as `--font-inter` CSS variable. Tailwind `font-sans` = `var(--font-inter), Inter, system-ui, sans-serif`.
  OpenType features: `"calt", "rlig"` (contextual alternates and required ligatures)
- **Monospace (Code)**: `SFMono-Regular`, with fallbacks: `Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`

**Implementation:**
- `h1/h2/h3` elements: `font-family: system-ui` declared in `globals.css` base layer
- `body`: `font-family: var(--font-inter, Inter, system-ui, sans-serif)` + OpenType features
- Tailwind `font-sans` class maps to `[var(--font-inter), Inter, system-ui, sans-serif]`
- `.font-heading` CSS class is defined but intentionally redundant — h1/h2/h3 are already
  declared system-ui in the base layer. Use it for semantic override only.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | CSS Utility |
|---|---|---|---|---|---|---|
| Display / Hero | system-ui | 60px | 400 | 1.00 | -0.65px | `.heading-display` |
| Section Heading | system-ui | 36px | 400 | 1.11 | -0.9px | `.heading-section` |
| Sub-heading | system-ui | 24px | 700 | 1.33 | -0.6px | `.heading-sub` |
| Overline / Tag | system-ui | 14px | 600 | 1.43 | +2.52px | `.heading-overline` (uppercase) |
| Feature Title | Inter | 20px | 500–600 | 1.40 | normal | Tailwind `text-xl font-medium` |
| Body / Button | Inter | 16px | 400–600 | 1.50–1.65 | normal | Tailwind `text-base` |
| Nav Link | Inter | 14.45px | 500 | 1.65 | normal | Navigation (approx `text-[14.45px]`) |
| Caption / Label | Inter | 14px | 400–600 | 1.43–1.65 | normal | Tailwind `text-sm` |
| Micro | Inter | 12px | 400–500 | 1.33 | normal | Tailwind `text-xs` |
| Code Body | SFMono-Regular | 13–14px | 400 | 1.23–1.43 | normal | `.font-code` or `font-mono` |

### Principles

- **System-native authority**: Display headings use system-ui — renders instantly, inherits OS native personality. Variability is a feature.
- **Tight compression creates density**: Negative letter-spacing at display sizes (-0.65px at 60px, -0.9px at 36px). Use `.heading-display` / `.heading-section` / `.heading-sub` utilities from `globals.css`.
- **Weight gradient**: Standard 400→500→600→700 progression. `.w-510` = 500, `.w-590` = 600 (legacy markup compatibility).
- **Uppercase is earned and wide**: Always paired with generous letter-spacing (+2.52px via `.heading-overline`). Never applied to main headings.
- **OpenType**: `"calt"` and `"rlig"` enabled globally on body.

---

## 4. Animation

### Signal Glow (`.signal-glow`)
Pulsing drop-shadow animation applied to identity elements only. In neutral-dark, the glow uses
`hsl(var(--ring))` — the ring gray (`hsl(0 0% 83.1%)`).

```css
/* From globals.css */
@keyframes signal-glow {
  0%, 100% { filter: drop-shadow(0 0 2px hsl(var(--ring) / 0.6)); }
  50%       { filter: drop-shadow(0 0 8px hsl(var(--ring) / 0.9)); }
}
.signal-glow { animation: signal-glow 2.5s ease-in-out infinite; }
```

**Applied to (targeted, not decorative):**
- Header logo ("O" mark — Orqafy brand identity)
- Login screen logo — high-visibility placement
- Active disbursement pipeline step — "current action" indicator

**NOT applied to:** general nav links, success pills, or CTA hover states.

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Tailwind spacing scale (Tailwind default: 4px = 1 unit)
- Button padding: `px-4 py-2` standard, `px-4 py-3` for larger CTAs
- Card internal padding: `p-6` (24px)
- Component gap: `gap-4` to `gap-6` (16–24px) between sibling cards

### Grid & Container
- Max content width: `container` class (1400px at 2xl) — centered with `2rem` padding
- Card grids: responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

### Border Radius Scale (from `--radius: 0.5rem`)
- `rounded-sm`: `calc(0.5rem - 4px)` = 4px — small inline elements
- `rounded-md`: `calc(0.5rem - 2px)` = 6px — buttons, inputs
- `rounded-lg`: `0.5rem` = 8px — cards (standard containment)
- `rounded-full`: pill-shaped — tags, badges, status chips

---

## Orqafy Implementation Notes

**CTA Pattern (neutral-dark):**
All primary CTAs: `bg-primary text-primary-foreground` — near-white background with near-black
text. This is the stock shadcn filled-button pattern. Do NOT use hardcoded `text-[#050507]`
(that was the VoltAgent Abyss Black value — now replaced with `text-primary-foreground`).

**Signal Glow Application:**
The `.signal-glow` class produces a neutral-gray pulsing glow (ring color). Applied to:
header logo, login screen logo, active disbursement pipeline step. NOT decorative.

**Success vs Brand Pill Disambiguation:**
- Success completion states: `text-green-400 bg-green-400/10 border-green-400/30` (Tailwind green)
- Active/in-progress brand states: `text-primary bg-primary/10 border-primary/30` (near-white)
- These must remain visually distinguishable.

**Elevation Philosophy:**
shadcn default: border-based separation using `--border` (`hsl(0 0% 14.9%)`). No custom shadow
system beyond Tailwind defaults. `ring-offset-background` uses `--background`.

**PDF Viewer Exception:**
`apps/web/src/app/(tenant)/[slug]/(app)/crm/quotations/[id]/pdf/quotation-pdf-viewer.tsx`
uses hardcoded Tailwind gray hex values (`#e5e7eb`, `#6b7280`, `#374151`, `#9ca3af`, `#d1d5db`).
This is a **platform-constrained exception** — `@react-pdf/renderer` does not support CSS
custom properties in inline styles. Do not attempt to replace these with `hsl(var(--*))`.

---

## shadcn/ui Translation Guide

Key CSS variable mappings in `apps/web/src/app/globals.css` (HSL format — space-separated
`H S% L%` inside `hsl()` calls, per shadcn/ui convention):

```css
:root {
  --background:           0 0% 3.9%;     /* near-pure-black canvas */
  --foreground:           0 0% 98%;      /* near-white primary text */
  --card:                 0 0% 3.9%;     /* same as background */
  --card-foreground:      0 0% 98%;
  --popover:              0 0% 3.9%;
  --popover-foreground:   0 0% 98%;
  --primary:              0 0% 98%;      /* near-white — filled buttons, active chips */
  --primary-foreground:   0 0% 9%;       /* near-black text on primary */
  --secondary:            0 0% 14.9%;    /* mid-gray secondary surfaces */
  --secondary-foreground: 0 0% 98%;
  --muted:                0 0% 14.9%;
  --muted-foreground:     0 0% 63.9%;    /* de-emphasized text */
  --accent:               0 0% 14.9%;
  --accent-foreground:    0 0% 98%;
  --destructive:          0 62.8% 30.6%; /* dark red for destructive variant */
  --destructive-foreground: 0 0% 98%;
  --border:               0 0% 14.9%;
  --input:                0 0% 14.9%;
  --ring:                 0 0% 83.1%;    /* focus ring + signal-glow color */
  --radius:               0.5rem;
  /* Extended: */
  --brand-muted:          0 0% 14.9%;    /* alias for bg-brand-muted */
  --surface:              0 0% 14.9%;    /* alias for bg-surface */
}
```

**Format note:** shadcn/ui CSS variables use `H S% L%` (space-separated, no `hsl()` wrapper)
because Tailwind's `hsl(var(--token))` wraps them at the point of use. The old VoltAgent
spec used raw `R G B` space-separated values — that format is **deprecated** and was the
source of the F2 format mismatch. All values here are in the correct `H S% L%` HSL format.

The extracted theme (sections 1–4) is the visual truth; shadcn/ui components are the
implementation vehicle.
