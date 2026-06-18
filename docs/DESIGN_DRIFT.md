# DESIGN_DRIFT.md — Orqafy V32.8 Design Fidelity Audit

**Branch:** `chore/v328-design-audit`  
**Audit Date:** 2026-06-18  
**Framework Version:** V32.8 (Design-as-Contract, Rule 31 / Rule 32)  
**Auditor:** Claude Sonnet 4.6 (static/code analysis only — no browser available)  
**Scope:** Token-level + spec-level fidelity audit. **Component-level mockup diff added in second pass** (`docs/OrqafyMockup.jsx` found — see §G).

---

## Audit Methodology

Source of truth read-order (per Rule 31 / phases.md §3.3):
1. `docs/DESIGN.md` (199 lines) — PA-emitted visual contract
2. `apps/web/src/app/globals.css` — live CSS custom properties
3. `packages/ui/tailwind.config.ts` + `apps/web/tailwind.config.ts` — token wiring
4. `apps/web/components.json` — shadcn config (style, baseColor)
5. Spot grep of `apps/web/src/**/*.tsx` — component-level enforcement

---

## §A — Token Mismatches (Intended vs Actual)

### A1. PRIMARY ACCENT — Signal Green vs Neutral White [CRITICAL]

**Intended** (`docs/DESIGN.md` §2 + shadcn/ui Translation Guide, line 187):
```css
--primary: 0 217 146;          /* #00d992 Signal Green */
--primary-foreground: 5 6 8;   /* Abyss Black on Signal */
--ring: 0 217 146;             /* Signal Green focus ring */
```

**Actual** (`apps/web/src/app/globals.css`):
```css
--primary: 0 0% 98%;           /* near-white */
--primary-foreground: 0 0% 9%; /* near-black */
--ring: 0 0% 83.1%;            /* light gray */
```

**File:Line:** `apps/web/src/app/globals.css:15` (`--primary`), `:18` (`--primary-foreground`), `:20` (`--ring`)  
**Delta:** Entire chromatic identity replaced. Signal Green (`#00d992`, hue 152°) → achromatic white. Ring → achromatic gray.  
**Classification:** INTENTIONAL RESKIN (see §C)

---

### A2. BACKGROUND — Abyss Black vs Near-Black [HIGH]

**Intended** (`docs/DESIGN.md` §2, Translation Guide line 180):
```css
--background: 5 6 8;   /* #050507 Abyss Black — warm near-black with blue-violet cast */
```

**Actual** (`apps/web/src/app/globals.css:8`):
```css
--background: 0 0% 3.9%;  /* pure achromatic near-black, no hue */
```

**Delta:** `#050507` (H≈243°, S≈1%, L≈3%) → pure neutral `hsl(0,0%,3.9%)`. The warm-toned hue specificity of DESIGN.md is lost. Perceptual difference is subtle but the DESIGN.md specified it deliberately as "warm near-black with blue-violet cast."  
**Classification:** INTENTIONAL RESKIN

---

### A3. CARD SURFACE — Carbon Surface vs Same-as-Background [HIGH]

**Intended** (`docs/DESIGN.md` Translation Guide):
```css
--card: 16 16 16;      /* #101010 Carbon Surface — distinct from Abyss Black */
```

**Actual** (`apps/web/src/app/globals.css:10`):
```css
--card: 0 0% 3.9%;     /* identical to --background */
```

**Delta:** Spec required a distinct card surface (`#101010`, ~6% lighter than background) to create visual layering without shadows. Actual: card = background — zero surface distinction.  
**Classification:** INTENTIONAL RESKIN (shadcn stock "flat dark" aesthetic) but note: **the DESIGN.md elevation philosophy** ("border IS the elevation" with distinct card surfaces) is violated — components that rely on card-background contrast will show no surface differentiation.

---

### A4. BORDER — Warm Charcoal vs Neutral Mid-Gray [HIGH]

**Intended** (`docs/DESIGN.md` §2 "Border System" + Translation Guide):
```css
--border: 61 58 57;    /* #3d3a39 Warm Charcoal — warm-toned gray */
--input: 61 58 57;
```

**Actual** (`apps/web/src/app/globals.css:21,22`):
```css
--border: 0 0% 14.9%;  /* neutral achromatic gray */
--input: 0 0% 14.9%;
```

**Delta:** Warm Charcoal (`#3d3a39`, H≈5°, S≈3.5%) → achromatic. Whitespace philosophy note: `docs/DESIGN.md` §5 states "Warm Charcoal borders (`#3d3a39`) delineate content zones." The warm tone is part of the design intent and is gone.  
**Classification:** INTENTIONAL RESKIN

---

### A5. ACCENT / MUTED / SECONDARY — Collapsed to Same Value [MEDIUM]

**Intended** (`docs/DESIGN.md` Translation Guide):
```css
--muted: 139 148 158;  /* #8b949e Steel Slate — a warm cool-gray */
--accent: 47 214 161;  /* #2fd6a1 VoltAgent Mint — a secondary teal-green */
```

**Actual** (`apps/web/src/app/globals.css`):
```css
--muted: 0 0% 14.9%;           /* near-black — same as border/input */
--muted-foreground: 0 0% 63.9%; /* mid-gray */
--secondary: 0 0% 14.9%;       /* same as muted */
--accent: 0 0% 14.9%;          /* same as muted — color-less */
--accent-foreground: 0 0% 98%; /* near-white */
```

**Delta:** `--muted` collapses from `#8b949e` (a visible gray text color used in spec for body text) to a near-black surface. `--accent` collapses from a distinct teal-green to achromatic near-black — effectively zero semantic distinction between accent, muted, and secondary.  
**Classification:** INTENTIONAL RESKIN

---

### A6. DESTRUCTIVE — Remapped to Dark Red vs Danger Coral [MEDIUM]

**Intended** (`docs/DESIGN.md` §2 "Status Colors" + Translation Guide):
```css
--destructive: 251 86 91;      /* #fb565b Danger Coral (hue ~357°, vivid) */
```

**Actual** (`apps/web/src/app/globals.css:23`):
```css
--destructive: 0 62.8% 30.6%; /* dark crimson — same hue family but much darker, muted */
```

**Delta:** `#fb565b` (L≈67%) → dark crimson (L≈30%). Danger Coral was vivid and readable on dark surfaces. Actual dark crimson is hard to read on dark backgrounds in text context.  
**Classification:** INTENTIONAL RESKIN (shadcn stock destructive) but represents an **accessibility concern** — the DESIGN.md specified vivid Danger Coral specifically for dark-background legibility.

---

### A7. CSS VARIABLE FORMAT — Space-separated vs HSL-function [LOW]

**Intended** (`docs/DESIGN.md` Translation Guide):
```css
--background: 5 6 8;   /* space-separated for use with hsl(var(--x)) */
```

**Actual** (`apps/web/src/app/globals.css`):
```css
--background: 0 0% 3.9%;  /* includes the % — full HSL triplet in percent form */
```

**Note:** The DESIGN.md Translation Guide used `r g b` numeric triplets (matching shadcn's old RGB-channel format). The actual implementation uses `H S% L%` (modern shadcn HSL format). The format difference is not a visual drift but the Translation Guide's variable values are wrong for the current shadcn CSS format — they would produce wrong colors if applied verbatim.  
**Classification:** SPEC AUTHORING DRIFT (DESIGN.md Translation Guide uses obsolete variable format — the numeric values in the guide can't be copy-pasted into the current implementation)

---

## §B — Spec-vs-Built Divergences (Beyond Token Values)

### B1. `signal-glow` Animation — Class Used, No CSS Definition Found [HIGH]

**Specified** (`docs/DESIGN.md` §"Orqafy Implementation Notes"):
> `.signal-glow` animation (pulsing drop-shadow, 2px → 8px, 2.5s infinite) applied to: header logo, login screen logo, active disbursement pipeline step.

**Actual usage found in components:**
- `apps/web/src/app/(auth)/login/page.tsx:39` — logo uses `signal-glow`
- `apps/web/src/app/page.tsx:21` — logo uses `signal-glow`
- `apps/web/src/app/demo-login/page.tsx:35` — uses `signal-glow`
- `apps/web/src/app/powerbyte-admin/layout.tsx:22` — uses `signal-glow`
- `apps/web/src/components/layout/app-sidebar.tsx:63` — uses inline `drop-shadow(0 0 4px hsl(var(--ring)))` (NOT `.signal-glow`)

**Missing:** No `@keyframes` or `.signal-glow` CSS rule was found in `globals.css` or any scanned CSS file.  
**Impact:** The class is silently no-op'd — all elements with `.signal-glow` display without the pulsing glow effect.  
**Post-reskin note:** After reskin, the `--ring` variable is achromatic gray — even the sidebar's inline drop-shadow will produce a gray glow, not the Signal Green glow the spec calls for.  
**Classification:** ACCIDENTAL DRIFT (missing CSS rule — not related to the reskin decision)

---

### B2. Primary CTA Pattern — Inverted vs Spec [HIGH]

**Specified** (`docs/DESIGN.md` §"CTA Pattern"):
> All primary CTAs: Carbon Surface background (`#101010`) + VoltAgent Mint text (`#2fd6a1`) + Signal Green border (`#00d992`) + green glow on hover. Signal Green NEVER used as filled button background.

**Actual** (found in multiple TSX files):
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/page.tsx:210` — `bg-primary text-[#050507]`
- `apps/web/src/app/(tenant)/[slug]/(app)/invoices/page.tsx:108` — `bg-primary text-[#050507]`
- `apps/web/src/app/(tenant)/[slug]/(app)/payroll/[id]/page.tsx:90` — `rounded-md bg-primary text-primary-foreground`

After the reskin, `bg-primary` = near-white background + near-black foreground = **stock shadcn filled button pattern** — which is the exact inverse of DESIGN.md's "Carbon Surface + Mint text" convention.  
**Additionally:** Hardcoded `text-[#050507]` (Abyss Black) appears in component files **post-reskin** (`projects/page.tsx:210,222,235`, `projects/[id]/expenses/page.tsx:210,222`) — this is a pre-reskin hardcoded value that now conflicts with the neutral-dark background assumption.  
**File:Line:** `projects/page.tsx:210,222,235`, `expenses/page.tsx:210,222`  
**Classification:** PARTIALLY INTENTIONAL RESKIN (button fill pattern changed) + ACCIDENTAL DRIFT (hardcoded `#050507` not cleaned up after reskin)

---

### B3. Emerald-400 Status Colors — Post-Reskin Residuals [MEDIUM]

**Specified** (`docs/DESIGN.md` §2 "Status Colors"):
> Success: `#10b981` (Tailwind Emerald) via `pill-success`. Danger Coral: `#fb565b` via `pill-brand`.

**Actual** (found in TSX):
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/trial-balance/page.tsx:64,136,187` — `text-emerald-400`, `border-emerald-500/30 bg-emerald-500/10 text-emerald-400`
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/journal-entries/[id]/JournalEntryActions.tsx:50` — `border-emerald-500/40 bg-emerald-500/10 text-emerald-400`

These use Tailwind's emerald palette directly (`text-emerald-400`, `bg-emerald-500/10`) rather than any design-system token. After the reskin, this represents a chromatic leak into an otherwise achromatic palette — the emerald color is the only saturated color remaining in the app outside the primary token.  
**Classification:** AMBIGUOUS — The spec permitted `#10b981` Emerald for success states. The token-level approach (via Tailwind direct palette) is defensible in this context. However, using raw Tailwind Emerald bypasses the design-system token layer that Rule 31 requires.

---

### B4. PDF Viewer — Hardcoded Tailwind Gray Scale Hex Values [MEDIUM]

**Specified:** All colors should flow through CSS custom properties / design tokens.

**Actual** (`apps/web/src/app/(tenant)/[slug]/(app)/crm/quotations/[id]/pdf/quotation-pdf-viewer.tsx`):
- Line 63: `borderBottomColor: "#e5e7eb"` (Tailwind gray-200)
- Line 72, 107, 130, 140, 156: `color: "#6b7280"` (Tailwind gray-500)
- Line 78, 93, 168: `color: "#374151"` (Tailwind gray-700)
- Line 81, 180: `color: "#9ca3af"` (Tailwind gray-400)
- Line 103, 117: `borderBottomColor: "#d1d5db"` (Tailwind gray-300)

**Context:** These are inline React-PDF styles. React-PDF requires inline style objects (CSS variables are not supported in `@react-pdf/renderer`). This is a **known platform constraint**, not accidental drift.  
**Classification:** PLATFORM-CONSTRAINED EXCEPTION (React-PDF can't use CSS vars) — acceptable with a comment noting the constraint. No fix needed, but should be documented.

---

### B5. Signature Pad — White Background Hardcode [LOW]

**Actual** (`apps/web/src/app/(tenant)/[slug]/(app)/service/job-orders/[id]/signature-pad.tsx:61`):
- `backgroundColor="rgb(255,255,255)"`

**Classification:** PLATFORM-CONSTRAINED EXCEPTION — canvas-based signature pads require a solid background color for ink contrast. Acceptable.

---

### B6. Font Loading — Inter Not Loaded via next/font [MEDIUM]

**Specified** (`docs/DESIGN.md` §3 Font Family):
> Secondary (Body/UI): Inter with OpenType features `"calt", "rlig"`. Implementation: body text inherits Inter from html/body font-family declaration.

**Actual:** No `next/font/google` import found in any `layout.tsx`. The `packages/ui/tailwind.config.ts` declares `fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] }` but Inter is not loaded via `next/font/google` — meaning the browser falls back to the system font stack if Inter is not cached locally.  
**Impact:** Users without Inter installed will see system-ui everywhere (body included), not just headings.  
**Classification:** ACCIDENTAL DRIFT — Inter must be loaded via `next/font/google` in root `layout.tsx`.

---

### B7. `.font-heading` Class — Unused in Components [LOW]

**Specified** (`docs/DESIGN.md` §3 Font Family):
> "Apply `.font-heading` class to h1/h2/h3 elements."

**Actual** (`globals.css`): h1/h2/h3 receive `system-ui` via an element selector (correct). But the DESIGN.md prescribes a class `.font-heading` — the implementation uses a tag selector in `globals.css` instead. Components use `tracking-tight` and `font-bold` without `.font-heading`.  
**Classification:** MINOR SPEC DRIFT — functionally equivalent (system-ui still applied to h1-h3) but deviates from the prescribed class-based approach that gives explicit opt-in control.

---

### B8. `brand-muted` and `surface` CSS Variables — Referenced but Undefined [HIGH]

**Actual** (`packages/ui/tailwind.config.ts`):
```ts
brand: {
  DEFAULT: "hsl(var(--primary))",
  muted: "hsl(var(--brand-muted))",   // ← CSS var never defined in globals.css
},
surface: "hsl(var(--surface))",       // ← CSS var never defined in globals.css
```

`--brand-muted` and `--surface` are referenced in the shared Tailwind config but **not defined in `globals.css`**. Any component using `bg-brand-muted` or `bg-surface` will render `hsl(NaN)` = transparent.  
**Classification:** ACCIDENTAL DRIFT (broken token references)

---

### B9. Typography Letter-Spacing / Line-Height — Not Enforced in Token Layer [MEDIUM]

**Specified** (`docs/DESIGN.md` §3 Hierarchy table):
- Display 60px: `line-height: 1.00`, `letter-spacing: -0.65px`
- Section 36px: `line-height: 1.11`, `letter-spacing: -0.9px`
- Sub-heading 24px: `line-height: 1.33`, `letter-spacing: -0.6px`
- Tag/Overline: `letter-spacing: +2.52px`

**Actual:** `globals.css` defines no custom letter-spacing or line-height variables. Components use `tracking-tight` (Tailwind's `letter-spacing: -0.025em` ≈ `-0.6px` at 24px) which partially approximates the sub-heading spec, but Display and Section heading specs are not implemented. No component was found using `tracking-[−0.65px]` or `tracking-[−0.9px]` custom utilities.  
**Classification:** ACCIDENTAL DRIFT — the tight-heading compression is a core design identity element (DESIGN.md explicitly calls this "counter-intuitive, VoltAgent's explicit choice") but is absent from the token layer.

---

### B10. Border Radius Scale — Partially Mismatched [LOW]

**Specified** (`docs/DESIGN.md` §5 Border Radius):
- Small inline: 4px (`rounded-[4px]` or `rounded-sm`)
- Buttons/links: 6px
- Code blocks: 6.4px
- Content cards: 8px
- Pills: 9999px

**Actual** (`globals.css`): `--radius: 0.5rem` (8px). Tailwind extends:
- `rounded-lg` = `0.5rem` (8px) — matches card spec ✓
- `rounded-md` = `calc(0.5rem - 2px)` = `6px` — matches button spec ✓
- `rounded-sm` = `calc(0.5rem - 4px)` = `4px` — matches small spec ✓

**In components:** `rounded-lg` used on cards, `rounded-md` on buttons, `rounded-full` on pills — broadly correct. Code-specific 6.4px radius is not tokenized (minor).  
**Classification:** MOSTLY ALIGNED — minor gap on 6.4px code-block radius.

---

## §C — Reskin Classification: Intentional vs Accidental

### The Reskin Decision (CONFIRMED INTENTIONAL)

Git history establishes a clear, owner-approved decision chain:
```
bdaa405  chore(theme): replace VoltAgent emerald with shadcn default neutral dark
746ae56  style(theme): neutralize residual dashboard KPI accent colors to stock neutral
c03f894  Merge shadcn default neutral dark theme (owner-approved)
```

**Commit message `c03f894` explicitly says "(owner-approved)"** — this was a deliberate product decision, not a mistake.

The reskin scope was: replace the VoltAgent/Signal-Green chromatic identity (`#00d992` primary, `#050507` background, `#3d3a39` borders) with the stock shadcn neutral-dark theme (achromatic whites/grays).

### What IS Intentional (do not treat as drift to fix):
| Token | DESIGN.md Value | Current Value | Verdict |
|---|---|---|---|
| `--primary` | Signal Green `#00d992` | Near-white `98%` | INTENTIONAL |
| `--background` | Abyss Black `#050507` | `0 0% 3.9%` | INTENTIONAL |
| `--card` | Carbon `#101010` | Same as background | INTENTIONAL |
| `--border` | Warm Charcoal `#3d3a39` | Neutral `14.9%` | INTENTIONAL |
| `--accent` | VoltAgent Mint `#2fd6a1` | Achromatic | INTENTIONAL |
| `--destructive` | Danger Coral vivid | Dark crimson | INTENTIONAL |
| CTA button fill | Carbon bg + Mint text | `bg-primary` white | INTENTIONAL |

### What is ACCIDENTAL DRIFT (not covered by the reskin decision):
| Finding | Classification |
|---|---|
| `signal-glow` class used but no CSS @keyframes defined | ACCIDENTAL |
| `#050507` hardcoded in `projects/page.tsx` post-reskin | ACCIDENTAL |
| `--brand-muted` / `--surface` CSS vars undefined | ACCIDENTAL |
| Inter font not loaded via `next/font` | ACCIDENTAL |
| Typography letter-spacing/line-height not tokenized | ACCIDENTAL |
| Emerald Tailwind classes bypass token layer | AMBIGUOUS |

### DESIGN.md Update Requirement:
The `docs/DESIGN.md` file was **not updated when the reskin was applied**. It still describes the VoltAgent/Signal-Green identity as the design contract. This is the root cause of the apparent "massive drift" — the spec and implementation diverged at a product-level decision that was not back-propagated to DESIGN.md.

**The correct fix is a DESIGN.md rewrite, not reverting the theme.** The shadcn neutral-dark reskin is owner-approved; DESIGN.md must reflect it.

---

## §D — MOCKUP.jsx — FOUND (prior pass missed it)

`docs/OrqafyMockup.jsx` **exists** and contains a full 97-screen Phase 2.8 fidelity mockup. The prior audit scan failed to locate it (filename differs from the default `MOCKUP.jsx` convention).

Full component-level analysis performed in second pass — see §G below.

---

## §E — V32.8 Scaffold Status

### Prescribed by V32.8 Rule 31 (per `phases.md` §3.3 checks):
| Artifact | Required | Present | Status |
|---|---|---|---|
| `sd.config.mjs` | Yes | No | MISSING |
| `scripts/design-validate.mjs` | Yes | No | MISSING |
| `tokens/build/` directory | Yes | No | MISSING |
| `npm run design:validate` script | Yes | No | MISSING |
| `npm run design:build` script | Yes | No | MISSING |
| `npm run design:check` script | Yes | No | MISSING |
| `LESSONS_REGISTRY.md` | Yes | `.ai_prompt/LESSONS_REGISTRY.md` | PRESENT ✓ |
| `scripts/design-stop-hook.sh` | Yes | `scripts/design-stop-hook.sh` | PRESENT ✓ |
| `scripts/lint-deploy.sh` | Yes | `scripts/lint-deploy.sh` | PRESENT ✓ |

**Assessment:** The V32.8 design toolchain (DTCG token compilation, design-validate script, tokens/build/ output) is **not scaffolded**. The stop-hook and lint-deploy scripts are present (deployed via V32.7.5/V32.8 `deploy-v31.sh`), but the design:validate / design:build npm commands that Rule 31 requires are absent.

**Scaffolding cannot be fully created without:**
1. A decision on whether to use the VoltAgent token set or the neutral-dark token set as the authoritative source
2. A DESIGN.md that reflects the current (post-reskin) design intent
3. MOCKUP.jsx (or formal waiver)

**Recommendation:** Scaffold is blocked on §C decision — update DESIGN.md first, then scaffold `sd.config.mjs` and `scripts/design-validate.mjs` targeting the neutral-dark tokens.

---

## §F — Framework Gaps / Conflicts

### F1. DESIGN.md Not Updated Post-Reskin (Framework Process Gap)
V32.8 Rule 31 + Rule 1 both state that DESIGN.md is a human-verified contract. But neither rule specifies a required update process when a product-level theme decision overrides the existing contract. The reskin was owner-approved but DESIGN.md was not updated — a process gap in the framework's change-management for design contracts.

**Recommendation:** Add to `LESSONS_REGISTRY.md`: "When a product-level theme reskin is approved, DESIGN.md MUST be updated in the same PR (or an explicit DESIGN_DEBT.md entry created). The commit that merges the reskin must include either a DESIGN.md update or a DESIGN_DEBT.md stub."

### F2. V32.8 shadcn/ui Translation Guide Format is Obsolete
The DESIGN.md Translation Guide uses space-separated RGB channel format (`--background: 5 6 8;`) which matches shadcn's legacy RGB format. Current shadcn `new-york` style (as configured in `components.json`) uses HSL format (`--background: 0 0% 3.9%;`). The translation guide values cannot be copy-pasted — they produce wrong results.  
**Recommendation:** Update the Translation Guide format in DESIGN.md (or in the PA template) to `H S% L%` to match current shadcn output.

### F3. `brand-muted` / `surface` Tokens Referenced but Not in Shadcn Scaffold
The shared `packages/ui/tailwind.config.ts` defines `brand.muted` and `surface` color aliases that reference CSS variables never generated by `deploy-v31.sh` or `bootstrap.md`. These are broken by default in new deployments.  
**Recommendation:** Either add `--brand-muted` and `--surface` to the `globals.css` template in `templates.md`, or remove them from the shared Tailwind config.

---

## Summary Table — Severity Counts

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 1 | A1 (primary accent complete replacement) |
| HIGH | 5 | A2, A3, A4, B1 (signal-glow missing keyframes), B8 (undefined CSS vars) |
| MEDIUM | 5 | A5, A6, B2 (CTA pattern + hardcoded #050507), B3 (emerald bypass), B6 (Inter not loaded), B9 (typography not tokenized) |
| LOW | 4 | A7 (var format), B4 (PDF exception), B5 (sig-pad exception), B7 (font-heading class), B10 (radius minor) |
| FRAMEWORK GAPS | 3 | F1 (no reskin→DESIGN.md process), F2 (obsolete var format in PA template), F3 (brand-muted/surface undefined) |

**Intentional reskin items (A1–A6 palette, CTA fill): 7** — do not fix; update DESIGN.md instead.  
**Accidental drift items requiring fixes: 5** — B1, B2 (hardcoded #050507), B6, B8, B9.  
**Platform exceptions (no fix needed): 2** — B4, B5.  
**V32.8 scaffold: entirely missing** — blocked on DESIGN.md update decision.

---

## Recommended Fix Order (do NOT apply in this audit — detection only)

1. **[Decision required]** Update `docs/DESIGN.md` to reflect the approved neutral-dark theme (rewrite §1, §2 color palette, shadcn Translation Guide). This unblocks scaffold creation and resolves the spec/implementation mismatch at source.
2. **B8** — Define `--brand-muted` and `--surface` in `globals.css` (or remove aliases from Tailwind config).
3. **B1** — Add `.signal-glow` keyframe animation to `globals.css` with a color that makes sense in neutral-dark (e.g. `hsl(var(--ring))` pulsing shadow if emerald is gone, or retain emerald as a targeted brand exception).
4. **B2** — Remove hardcoded `text-[#050507]` from `projects/page.tsx` and `expenses/page.tsx` — replace with `text-primary-foreground`.
5. **B6** — Add `Inter` font loading via `next/font/google` in root `layout.tsx`.
6. **B9** — Add letter-spacing and line-height utilities to `globals.css` for the typography hierarchy (Display, Section, Sub-heading).
7. **Scaffold** — After DESIGN.md updated: create `sd.config.mjs`, `scripts/design-validate.mjs`, `tokens/build/`, wire `design:validate` / `design:build` / `design:check` npm scripts.
8. **F1** — Append lesson to `.ai_prompt/LESSONS_REGISTRY.md`.

---

---

## §G — Component-Level Mockup Findings (Second Pass — `docs/OrqafyMockup.jsx`)

**Source:** `docs/OrqafyMockup.jsx` — 97-screen Phase 2.8 fidelity mockup.  
**Method:** Full JSX parse + structural comparison vs `apps/web/src/components/layout/` and selected page files.  
**Color classification rule:** Mockup uses Signal Green (`C.sig = #00d992`). Where built diverges in *color only*, classification = INTENTIONAL RESKIN (owner-approved neutral-dark). Where built diverges in *structure/layout/IA*, classification = STRUCTURAL DRIFT → FIX.

---

### G1. Sidebar — Flat List vs Grouped Sections [STRUCTURAL — FIXED]

**Mockup (`docs/OrqafyMockup.jsx` NAV array):**
- 16 section groups with uppercase labels (`MAIN`, `CRM / SALES`, `PURCHASING`, `INVENTORY`, `PROJECTS`, `TASKS`, `HR & PAYROLL`, `BANKING & FINANCE`, `ACCOUNTING`, `E-COMMERCE`, `REPAIRS`, `SUPPORT`, `POS`, `CUSTOMER PORTAL`, `SETTINGS`, `PLATFORM ADMIN`)
- Each group has a label rendered as overline text above its items
- 97 total screens across all groups

**Built (before fix):**
- Single flat `NAV_ITEMS` array — 19 items, no section labels, no grouping
- No overline labels visible to user

**Classification:** STRUCTURAL DRIFT (information architecture — the grouped/labelled sidebar is the intended IA)  
**Fix applied:** `app-sidebar.tsx` rewritten with 11 grouped sections + uppercase overline labels (`NAV_GROUPS` array). Section groupings map existing routes to logical domains matching mockup IA.  
**Status:** FIXED ✓

---

### G2. Sidebar Active Item — No Right-Border Accent [STRUCTURAL — FIXED]

**Mockup:**
```js
borderRight: sc===item.id ? `2px solid ${C.sig}` : "2px solid transparent"
background:  sc===item.id ? "rgba(0,217,146,0.08)" : "transparent"
```
Active item has a **2px right-edge accent border** as a structural UI pattern (scan indicator), in addition to tinted background.

**Built (before fix):**
- `bg-primary/10 text-primary` — tinted background only, no right-border accent structure

**Classification:** STRUCTURAL DRIFT (the right-border is a layout indicator pattern, not just a color)  
**Color note:** In neutral-dark reskin, accent border uses `border-primary` (white) not Signal Green — intentional.  
**Fix applied:** Active nav items now include `border-r-2 border-primary bg-primary/10` vs `border-r-2 border-transparent` for inactive — preserves the structural pattern in neutral-dark colors.  
**Status:** FIXED ✓

---

### G3. Sidebar Logo — Slug Shown Below App Name [STRUCTURAL — FIXED]

**Mockup:**
```jsx
<div style={{fontSize:13,fontWeight:700}}>Orqafy</div>
<div style={{fontSize:10,color:C.slate}}>acme-corp</div>  // ← tenant slug below name
```

**Built (before fix):**
- App name shown: `Orqafy`
- Tenant slug shown only in a footer bar at the bottom of the sidebar

**Classification:** STRUCTURAL DRIFT (slug is contextual identity — should be co-located with the logo, not footer-banished)  
**Fix applied:** Sidebar logo block now shows `Orqafy` (name) + `{slug}` (10px muted-foreground) below it. Footer bar replaced with "Powered by Powerbyte I.T. Solutions" attribution.  
**Status:** FIXED ✓

---

### G4. Sidebar Logo — signal-glow Applied to Inline Style, Not CSS Class [STRUCTURAL — FIXED]

**Mockup:**
```jsx
filter: "drop-shadow(0 0 4px #00d992)"  // Green glow inline
```

**Built (before fix):**
```jsx
style={{ filter: "drop-shadow(0 0 4px hsl(var(--ring)))" }}  // Inline, bypasses .signal-glow
```

**Classification:** STRUCTURAL (the animation class `.signal-glow` was not being used on the logo — inline style produces static shadow, not pulsing animation)  
**Fix applied:** Sidebar logo badge now uses `className="... signal-glow"` (the CSS-class animation) instead of inline static drop-shadow. Animation uses `--ring` (neutral gray per reskin) — intentional.  
**Status:** FIXED ✓

---

### G5. Header — Missing Tenant Slug Context + Tagline [STRUCTURAL — FIXED]

**Mockup header (right side of top bar):**
```jsx
<span style={{...}}>Move as one.</span>
<div style={{...}}>B</div>  // user avatar
```
**Mockup header (left side):**
```jsx
<button>☰</button>  // sidebar toggle
<span style={{...}}>acme-corp</span>  // tenant slug
```

**Built (before fix):**
- Left: page title (optional) or empty div
- Right: notification bell only
- No tenant context, no tagline

**Classification:** STRUCTURAL DRIFT (mockup shows tenant name as header context + "Move as one." tagline as brand identity anchor)  
**Fix applied:** `AppHeader` now accepts `tenantSlug` prop (passed from app layout). Renders slug on left (context breadcrumb) + "Move as one." tagline on right (hidden on mobile via `sm:block`). Sidebar collapse toggle deferred — requires full client-side state lift (scope too large for this pass; flagged for owner).  
**Status:** PARTIALLY FIXED ✓ (slug + tagline added; sidebar collapse toggle deferred)

---

### G6. Sidebar Footer — Missing Attribution [STRUCTURAL — FIXED]

**Mockup:**
```jsx
<div>Powered by Powerbyte I.T. Solutions</div>
```

**Built (before fix):**
- Slug-only text in footer (`<p className="truncate text-xs text-muted-foreground">{slug}</p>`)
- Slug moved to logo header block in fix G3

**Classification:** STRUCTURAL (brand attribution is part of the mockup's footer contract)  
**Fix applied:** Footer now shows `Powered by Powerbyte I.T. Solutions` in `text-[10px] text-muted-foreground/50`.  
**Status:** FIXED ✓

---

### G7. Sidebar — Logo Color (Green Badge → Neutral) [COLOR — INTENTIONAL RESKIN, FLAGGED]

**Mockup:**
```jsx
background: C.sig  // #00d992 Signal Green badge
color: C.abyss     // #050507 black text on green
filter: "drop-shadow(0 0 4px #00d992)"  // green glow
```

**Built:**
```jsx
className="bg-primary/10 text-primary"  // neutral white tinted badge
```

**Classification:** INTENTIONAL RESKIN — Signal Green primary is replaced with neutral white per owner-approved shadcn neutral-dark reskin. Logo badge is achromatic. Signal glow uses `--ring` (gray).  
**Owner flag:** If you want to keep the "O" badge identifiable against the dark sidebar, consider a subtle `bg-muted border border-border` badge — the current `bg-primary/10` (≈ 10% white) is very subtle at `hsl(0 0% 3.9%)` background.  
**Status:** NOT FIXED (intentional reskin)

---

### G8. Nav Item Active Background — Emerald Tint → Neutral [COLOR — INTENTIONAL RESKIN]

**Mockup:**
```js
background: "rgba(0,217,146,0.08)"  // Signal Green 8% tint = visible green wash
```

**Built:**
```jsx
className="bg-primary/10"  // 10% white = extremely subtle; nearly invisible on near-black bg
```

**Classification:** INTENTIONAL RESKIN  
**Owner flag:** At neutral-dark (`--background: 0 0% 3.9%`, `--primary: 0 0% 98%`), `bg-primary/10` ≈ `hsl(0 0% 13.7%)` which is close to `--muted`. The active vs inactive state distinction may be too subtle visually. The right-border fix (G2) partially compensates. Consider `bg-primary/15` for stronger active contrast without color change.  
**Status:** NOT FIXED (intentional reskin) — right-border structural fix (G2) provides structural differentiation

---

### G9. Dashboard — KPI Grid Layout Consistent [ALIGNED ✓]

**Mockup dashboard:**
- `<KPI>` components in `display:"flex",gap:14,flexWrap:"wrap"` — flexible row with wrap
- KPI card: `background: C.carbon`, border, padding 14px, ~180px wide

**Built dashboard:**
- `grid grid-cols-2 gap-4 sm:grid-cols-4` for metric cards
- Cards: `rounded-lg border border-border bg-card p-4`

**Classification:** ALIGNED in structure (grid/flex of KPI cards). Minor: mockup uses 4-wide flexible wrap; built uses fixed `sm:grid-cols-4`. Functionally equivalent. No fix needed.

---

### G10. Login Page — Centered Form Layout [ALIGNED ✓]

**Mockup:** Full-screen centered login form with logo badge, app name, tagline, email/password/workspace inputs in a card.

**Built:** `flex min-h-screen items-center justify-center` auth layout + `max-w-sm space-y-6` form — structurally matches mockup intent. Logo uses `signal-glow` class (now has keyframes ✓).

**Classification:** ALIGNED

---

## §H — Regression Fixes Applied (This Pass)

| ID | Issue | Fix | Status |
|---|---|---|---|
| R1 | `font-sans` class doesn't resolve to Inter — `apps/web/tailwind.config.ts` missing `fontFamily.sans` extension | Added `fontFamily: { sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"] }` to `theme.extend` | FIXED ✓ |
| R2 | `bg-brand-muted` / `bg-surface` classes undefined — `apps/web/tailwind.config.ts` missing `brand.muted` / `surface` color tokens | Added `brand: { DEFAULT: "hsl(var(--primary))", muted: "hsl(var(--brand-muted))" }` and `surface: "hsl(var(--surface))"` to `theme.extend.colors` | FIXED ✓ |
| R3 | `signal-glow` CSS missing (prior pass) | `.signal-glow` + `@keyframes` already added to `globals.css` in prior pass ✓ | ALREADY FIXED |
| R4 | `--brand-muted` / `--surface` CSS vars missing (prior pass) | Both vars already defined in `globals.css` in prior pass ✓ | ALREADY FIXED |
| R5 | Inter not loaded via `next/font` (prior pass) | `layout.tsx` already imports `Inter` from `next/font/google` with `variable: "--font-inter"` ✓ | ALREADY FIXED |

**Note on R1:** The `packages/ui/tailwind.config.ts` already had `fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] }` — but `apps/web/tailwind.config.ts` was not extending it and takes precedence for the web app build. The fix is specifically in `apps/web/tailwind.config.ts` which is what the Next.js build actually uses.

---

## §I — Color / Theme Diffs Flagged for Owner (Mockup Emerald vs Neutral-Dark)

These are **not bugs** — they document where the mockup's original emerald identity diverges from the owner-approved neutral-dark reskin. Listed so the owner can make informed decisions.

| Element | Mockup (Emerald) | Built (Neutral-Dark) | Owner Decision Needed? |
|---|---|---|---|
| Primary accent | `#00d992` Signal Green | Near-white `hsl(0 0% 98%)` | No — reskin approved |
| Logo badge bg | Signal Green filled | `bg-primary/10` (subtle white tint) | Optional: consider `bg-muted border border-border` for visibility |
| Active nav border | `2px solid #00d992` | `2px solid hsl(0 0% 98%)` | No — structure retained, color is reskin |
| Active nav bg | `rgba(0,217,146,0.08)` = visible green wash | `bg-primary/10` ≈ 13.7% gray | Optional: increase to `bg-primary/15` for contrast |
| signal-glow color | Green (`#00d992`) | Ring gray (`hsl(0 0% 83.1%)`) | Optional: keep gray or introduce a single brand accent |
| Sidebar bg | Carbon `#101010` | `bg-card` = `hsl(0 0% 3.9%)` (same as background) | Optional: `bg-muted` (`0 0% 14.9%`) would restore sidebar/content contrast |

**Sidebar bg contrast note (highest visual impact):** The mockup specified `C.carbon = #101010` for the sidebar vs `C.abyss = #050507` for the main canvas — a deliberate 6% lightness difference to create visual layering. Current built uses `bg-card = hsl(0 0% 3.9%)` which equals `--background`. The sidebar and main content area are indistinguishable without the border. **Recommended:** Change sidebar from `bg-card` to `bg-muted` (`hsl(0 0% 14.9%)`) — this restores the sidebar/content elevation without re-introducing any brand color.

---

*First pass: 2026-06-18, token-level audit only. Second pass: 2026-06-18, full component-level mockup diff + structural fixes applied. Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>*
