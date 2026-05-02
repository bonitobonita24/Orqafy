# Visual Design Reference — Orqafy

Visual design reference for Orqafy — inspired by **VoltAgent** from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).
Implementation uses shadcn/ui.

- **Source:** https://getdesign.md/voltagent/design-md (canonical location as of 2026-04-20)
- **Original GitHub location:** https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/voltagent (now redirects to getdesign.md)
- **Date adopted:** 2026-04-20 (supersedes Linear + sunset orange — see DECISIONS_LOG.md)
- **Scope extracted:** Sections 1, 2, 3, 5 only (Theme, Color, Typography, Layout).
  Component styling, elevation, do's/don'ts, and responsive behaviour are
  handled by shadcn/ui and not re-specified here.
- **Previous aesthetic:** Linear + sunset orange `#F26419` accent — archived at
  `docs/archive/DESIGN-linear-sunset.md`.

---

## 1. Visual Theme & Atmosphere

VoltAgent's interface is a deep-space command terminal for the AI age — a developer-facing darkness built on near-pure-black surfaces (`#050507`) where the only interruption is the electric pulse of emerald green energy. The entire experience evokes the feeling of staring into a high-powered IDE at 2am: dark, focused, and alive with purpose. This is not a friendly SaaS landing page — it's an engineering platform that announces itself through code snippets, architectural diagrams, and raw technical confidence.

The green accent (`#00d992`) is used with surgical precision — it glows from headlines, borders, and interactive elements like a circuit board carrying a signal. Against the carbon-black canvas, this green reads as "power on" — a deliberate visual metaphor for an AI agent engineering platform. The supporting palette is built entirely from warm-neutral grays (`#3d3a39`, `#8b949e`, `#b8b3b0`) that soften the darkness without introducing color noise, creating a cockpit-like warmth that pure blue-grays would lack.

Typography leans on the system font stack for headings — achieving maximum rendering speed and native-feeling authority — while Inter carries the body and UI text with geometric precision. Code blocks use SFMono-Regular, the same font developers see in their terminals, reinforcing the tool's credibility at every scroll.

**Key Characteristics:**
- Carbon-black canvas (`#050507`) with warm-gray border containment (`#3d3a39`) — not cold or sterile
- Single-accent identity: Emerald Signal Green (`#00d992`) as the sole chromatic energy source
- Dual-typography system: system-ui for authoritative headings, Inter for precise UI/body text, SFMono for code credibility
- Ultra-tight heading line-heights (1.0–1.11) creating dense, compressed power blocks
- Warm neutral palette (`#3d3a39`, `#8b949e`, `#b8b3b0`) that prevents the dark theme from feeling clinical
- Developer-terminal aesthetic — unusual choice for an ERP used by accountants/HR/field staff, but adopted deliberately (see DECISIONS_LOG.md)
- Green glow effects (`drop-shadow`, border accents) that make UI elements feel electrically alive

---

## 2. Color Palette & Roles

### Primary Accent (single chromatic identity)
- **Emerald Signal Green** (`#00d992`): Core brand energy — accent borders, glow effects, active nav link border, in-progress pipeline step borders, pill-brand text, highest-signal interactive moments. The "power-on" indicator of the entire interface.
- **VoltAgent Mint** (`#2fd6a1`): Button-text variant of the brand green — slightly warmer and more readable than pure Signal Green. Used specifically for CTA text on dark surfaces (Primary CTA pattern: Carbon Surface bg + Mint text + Signal Green border).
- **Tailwind Emerald** (`#10b981`): Ecosystem-standard green for success pills and completion states — intentionally distinct from Signal Green so success and brand don't visually collide.

### Secondary (used sparingly)
- **Soft Purple** (`#818cf8`): Cool indigo-violet reserved for Security Lavender contexts (Turnstile verified indicator, SMTP encryption badges) — does NOT participate in primary brand accent system.
- **Info Teal** (`#4cb3d4`): Cool teal-blue for informational callouts — reserved for tip admonitions.

### Surface & Background
- **Abyss Black** (`#050507`): Page canvas — near-pure black with faintest warm undertone. All public-facing pages, dashboard background, sidebar outer shell.
- **Carbon Surface** (`#101010`): Primary card, button, and contained-element background — one shade lighter than Abyss. Used across ALL contained surfaces (cards, header, sidebar, inputs, buttons).
- **Warm Charcoal Border** (`#3d3a39`): Signature containment color — warm, almost brownish dark tone. Applied as 1px standard, 2px emphasized, 3px large-button container.

### Text Hierarchy
- **Snow White** (`#f2f2f2`): Primary text on dark surfaces — softened off-white, not pure `#ffffff`. Default text color.
- **Warm Parchment** (`#b8b3b0`): Secondary body text — warm light gray with slight pinkish undertone. Paragraph body, descriptions.
- **Steel Slate** (`#8b949e`): Tertiary text, metadata, timestamps, de-emphasized content. Nav link default state.
- **Warm Quaternary** (`#5c5855`): Most subdued text — group labels, disabled states, subtle labels, placeholder text.

### Status Colors (chromatic exceptions for semantic clarity)
- **Success** (`#10b981` Tailwind Emerald): Paid invoices, completed tasks, approved records. Intentionally distinct from Signal Green `#00d992`.
- **Signal Green Success** (`#00d992`): In-progress indicators, active pipeline steps, pulsing glow states — reserved for brand-adjacent "power on" signals rather than static completion.
- **Warning Amber** (`#ffba00`): Warning alerts, pending states, "awaiting approval" flags.
- **Warning Pale** (`#ffdd80`): Softened amber for warning backgrounds.
- **Danger Coral** (`#fb565b`): Error states, destructive actions, Overdue/Suspended pills.
- **Danger Rose** (`#fd9c9f`): Softened coral for error backgrounds.

### Border System (elevation via border weight, not shadow)
- **1px solid `#3d3a39`**: Standard card containment, default nav bar, code blocks — Contained (Level 1)
- **2px solid `#00d992`**: Active/highlighted feature cards, selected pipeline steps, focused nav link — Accent (Level 3)
- **3px solid `#3d3a39`**: Large interactive buttons, emphasized containers — Emphasized (Level 2)
- **1px dashed `rgba(79,93,117,0.4)`**: Workflow diagrams, decorative containers — blueprint aesthetic

### Gradient / Glow System
- **Green Signal Glow**: `drop-shadow(0 0 2px #00d992)` animating to `drop-shadow(0 0 8px #00d992)` — pulsing "electric charge" effect on the Orqafy "O" logo mark, active disbursement pipeline step, primary CTA hover states. Animated via `@keyframes signal-glow` with 2.5s ease-in-out infinite.
- **Warm Ambient Haze**: `rgba(92,88,85,0.2) 0px 0px 15px` — diffused warm-toned shadow for elevated cards.
- **Deep Dramatic Elevation**: `rgba(0,0,0,0.7) 0px 20px 60px` + `rgba(148,163,184,0.1) 0px 0px 0px 1px inset` — heavy downward shadow for modals/dialogs.

---

## 3. Typography Rules

### Font Family

- **Primary (Headings)**: `system-ui`, with fallbacks: `-apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif`
- **Secondary (Body/UI)**: `Inter`, with fallbacks inheriting from system-ui stack. OpenType features: `"calt", "rlig"` (contextual alternates and required ligatures)
- **Monospace (Code)**: `SFMono-Regular`, with fallbacks: `Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`

Implementation: Apply `.font-heading` class to h1/h2/h3 elements that should render in system-ui. Body text inherits Inter from the html/body font-family declaration.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display / Hero | system-ui | 60px | 400 | 1.00 | -0.65px | Maximum impact, compressed blocks |
| Section Heading | system-ui | 36px | 400 | 1.11 | -0.9px | Tightest letter-spacing in system |
| Sub-heading | system-ui | 24px | 700 | 1.33 | -0.6px | **Bold 700** at this size |
| Overline | system-ui | 20px | 600 | 1.40 | +0.5px | Uppercase transform |
| Feature Title | Inter | 20px | 500–600 | 1.40 | normal | Card headings |
| Body / Button | Inter | 16px | 400–600 | 1.50–1.65 | normal | Standard text, nav, buttons |
| Nav Link | Inter | 14.45px | 500 | 1.65 | normal | Navigation |
| Caption / Label | Inter | 14px | 400–600 | 1.43–1.65 | normal | Descriptions, metadata |
| Tag / Overline Tiny | system-ui | 14px | 600 | 1.43 | +2.52px | Widest letter-spacing |
| Micro | Inter | 12px | 400–500 | 1.33 | normal | Smallest sans |
| Code Body | SFMono-Regular | 13–14px | 400 | 1.23–1.43 | normal | Inline code, SKUs, refs |

### Principles

- **System-native authority**: Display headings use system-ui rather than custom web font — largest text renders instantly and inherits OS native personality. Variability is a feature.
- **Tight compression creates density**: Hero line-heights extremely compressed (1.0), negative letter-spacing (-0.65px at 60px, -0.9px at 36px). Counterintuitively, 36px uses tighter letter-spacing than 60px — VoltAgent's explicit choice.
- **Weight gradient, not weight contrast**: Traditional 300→400→500→600→700 progression. Bold (700) reserved for sub-headings.
- **No signature weight**: Unlike Linear's 510, VoltAgent uses standard 500/600/700. CSS `.w-510` and `.w-590` utility classes are REMAPPED to 500 and 600 respectively to preserve HTML markup while applying VoltAgent's weights.
- **Uppercase is earned and wide**: When uppercase appears, always paired with generous letter-spacing (+0.45px to +2.52px). Never applied to headings.
- **OpenType**: `"calt"` and `"rlig"` enabled globally (different from Linear's `"cv01", "ss03"`).

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 2px, 4px, 5px, 6px, 6.4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px, 40px, 48px, 64px
- Button padding: 12px × 16px standard, 20px container-button
- Card internal padding: 24–32px
- Section vertical spacing: 64–96px between major sections
- Component gap: 16–24px between sibling cards

### Grid & Container
- Max content width: ~1280–1440px, centered
- Hero: centered single-column with maximum breathing room
- Card grids: 2–3 column for feature showcases

### Whitespace Philosophy
- **Cinematic breathing room between sections**: massive vertical gaps create a "scroll-through-chapters" experience
- **Dense within components**: cards internally compact with tight line-heights and controlled padding
- **Border-defined separation**: Warm Charcoal borders (`#3d3a39`) delineate content zones — the border IS the whitespace signal
- **Hero-first hierarchy**: top of page commands the most space

### Border Radius Scale
- Nearly squared (4px): Small inline elements, SVG containers, code spans
- Subtly rounded (6px): Buttons, links
- Code-specific (6.4px): Code blocks, `<pre>` elements
- Comfortably rounded (8px): Content cards — STANDARD containment radius
- Pill-shaped (9999px): Tags, badges, status indicators

---

## Orqafy Implementation Notes

**CTA Pattern (overrides filled-button pattern):**
All primary CTAs follow VoltAgent's "Primary Green CTA" convention — Carbon Surface background (`#101010`) + VoltAgent Mint text (`#2fd6a1`) + Signal Green border (`#00d992`) + green glow on hover. NEVER use Signal Green as a filled button background EXCEPT for small tags/ribbons (e.g. "MOST POPULAR" pricing plan ribbon, which uses Abyss Black text on Signal Green for maximum contrast).

**Signal Glow Application (targeted, not decorative):**
The `.signal-glow` animation (pulsing drop-shadow, 2px → 8px, 2.5s infinite) is applied to:
- Header logo ("O" mark — Orqafy brand) — identity reinforcement
- Login screen logo — high-visibility on the most-loaded page
- Active disbursement pipeline step — the "current action" indicator

NOT applied to: every active nav link, every success pill, or CTA buttons (hover-only glow). The animation earns its placement.

NOTE: The app logo is the Orqafy "O" mark (Signal Green rounded square with white/dark "O").
"Powered by Powerbyte I.T. Solutions" appears as text in the footer — NOT as a logo mark.
The Powerbyte parent brand is text-only in the product UI.

**Success vs Brand Pill Disambiguation:**
- `pill-success` uses Tailwind Emerald `#10b981` (completion state)
- `pill-brand` uses Signal Green `#00d992` (brand association — Trial, Published, Approved)

These must remain visually distinguishable to prevent users from confusing "done" with "brand-marked".

**Elevation Philosophy (no box-shadow for depth):**
VoltAgent communicates depth primarily through border weight and color. The standard `1px solid #3d3a39` border IS the elevation. Adding `2px solid #00d992` or switching border color communicates importance more than adding box-shadow. Shadows reserved for Level 4 (ambient haze on elevated cards) and Level 5 (dramatic modals) only.

**Destructive Pill Tuning:**
Kept at `#fb565b` (Danger Coral) with `rgba(251,86,91,0.12)` background + `rgba(251,86,91,0.4)` border. Hue-distinct from Signal Green (~360° vs 152° — far beyond confusion threshold).

---

## shadcn/ui Translation Guide

Key CSS variable mappings for Phase 4 `globals.css`:

```css
:root {
  --background: 5 6 8;           /* #050507 Abyss Black */
  --foreground: 242 242 242;     /* #f2f2f2 Snow White */
  --card: 16 16 16;              /* #101010 Carbon Surface */
  --card-foreground: 242 242 242;
  --border: 61 58 57;            /* #3d3a39 Warm Charcoal */
  --input: 61 58 57;
  --primary: 0 217 146;          /* #00d992 Signal Green */
  --primary-foreground: 5 6 8;   /* Abyss on Signal */
  --ring: 0 217 146;
  --muted: 139 148 158;          /* #8b949e Steel Slate */
  --accent: 47 214 161;          /* #2fd6a1 VoltAgent Mint */
  --destructive: 251 86 91;      /* #fb565b Danger Coral */
}
```

The extracted theme (sections 1–3, 5) is the visual truth; shadcn/ui components are the implementation vehicle.
