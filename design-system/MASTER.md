# Design System Master File — Orqafy

> **PRECEDENCE (Scenario 33 — V31):**
> 1. `docs/PRODUCT.md` — spec authority (any UI requirement here wins)
> 2. **`docs/DESIGN.md` — AUTHORITATIVE for color, typography, layout density, atmosphere**
>    (VoltAgent aesthetic: Abyss Black `#050507` + Emerald Signal Green `#00d992`)
> 3. `design-system/MASTER.md` — this file; supplemental component patterns,
>    anti-patterns, pre-delivery checklists, Vercel guidelines, WCAG enforcement
> 4. `design-system/pages/[page-name].md` — page-specific overrides; if present,
>    those rules override this Master file for that page only
> 5. shadcn/ui defaults — component implementation always
>
> **DO NOT use the auto-generated color palette and font choices below.**
> They are skill-generated generic recommendations and are SUPERSEDED by DESIGN.md.
> Read DESIGN.md for the locked Orqafy palette (Abyss Black canvas, Carbon Surface
> panels, Emerald Signal Green accent, Snow White / Warm Parchment / Steel Slate
> text hierarchy) and typography (system-ui headings, Inter body, SFMono mono).

---

**Project:** Orqafy
**Generated:** 2026-05-02 (UI UX Pro Max v2.0.1)
**Category:** Analytics Dashboard / Internal Tool — dense data-first
**Visual reference:** `docs/DESIGN.md` (VoltAgent — terminal-native developer aesthetic)

---

## Global Rules

### Color Palette ⚠ SUPERSEDED BY DESIGN.md

The skill-generated palette below is **not used**. Phase 4 reads `docs/DESIGN.md`
for the active palette: Abyss Black `#050507` background, Carbon Surface `#101010`
panels, Warm Charcoal `#3d3a39` borders, Emerald Signal Green `#00d992` primary
accent, VoltAgent Mint `#2fd6a1` for bright text, Snow White `#f2f2f2` body text.

| Role | Hex (skill default) | Status |
|------|---------------------|--------|
| Primary | `#2563EB` | ❌ superseded by DESIGN.md `#00d992` |
| Secondary | `#3B82F6` | ❌ superseded — single Signal Green accent in VoltAgent |
| CTA/Accent | `#F97316` | ❌ superseded by DESIGN.md `#00d992` (outlined CTA pattern) |
| Background | `#F8FAFC` | ❌ superseded by DESIGN.md `#050507` (dark canvas) |
| Text | `#1E293B` | ❌ superseded by DESIGN.md `#f2f2f2` Snow White |

### Typography ⚠ SUPERSEDED BY DESIGN.md

| Token | Skill default | Status |
|-------|---------------|--------|
| Heading | Fira Code | ❌ superseded — DESIGN.md uses `system-ui` for `.font-heading` |
| Body | Fira Sans | ❌ superseded — DESIGN.md uses Inter with `calt, rlig` features |
| Mono | — | DESIGN.md adds `SFMono-Regular` for code blocks |

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #F97316;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #2563EB;
  border: 2px solid #2563EB;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2563EB;
  outline: none;
  box-shadow: 0 0 0 3px #2563EB20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Data-Dense Dashboard

**Keywords:** Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout, space-efficient, maximum data visibility

**Best For:** Business intelligence dashboards, financial analytics, enterprise reporting, operational dashboards, data warehousing

**Key Effects:** Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ No filtering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Web Interface Quality Standards (Vercel Guidelines)

### Interactions
- Every interactive element must have a visible focus state (2–4px ring, not just outline-none)
- Touch targets minimum 44×44px (mobile) — never smaller
- Hover → active transitions: 150–300ms (below 100ms feels instant/broken, above 400ms feels slow)
- Disabled states must look disabled — reduced opacity + no pointer-events

### Forms
- Inline validation: show errors on blur, not on submit
- Required fields must be marked — never rely on placeholder alone
- Error messages must be adjacent to the field, not just at the top
- Success feedback must be explicit — never silent

### Animations
- Use CSS transitions/animations only — no JS-based animation for layout shifts
- Respect prefers-reduced-motion: always provide a reduced-motion fallback
- Page transitions: ≤200ms — longer feels laggy in production apps
- Loading skeletons > spinners for content areas > 300px tall

### Layout
- Scrollable containers must have visible overflow indicators
- Sticky headers must not obscure focused elements on keyboard navigation
- Mobile breakpoint (375px): test before every delivery — never assume desktop-first works

### Performance perception
- Optimistic UI for user actions (create, update, delete) — show change immediately, revert on error
- No layout shift on data load — skeleton loaders must match final layout dimensions
- Images must have explicit width/height (Next.js Image component enforces this)

### Dark mode
- Test dark mode contrast independently — do not assume light mode values invert correctly
- Borders visible in both modes (bg-border not bg-foreground/10)
- Shadow-based elevation does not work in dark mode — use border + subtle bg difference instead
  (Orqafy ships dark-by-default per DESIGN.md — VoltAgent border-weight elevation system)

### Keyboard navigation
- Tab order must follow visual reading order
- Modal/dialog: trap focus while open, restore focus on close
- Escape closes modals/dropdowns/drawers — no exceptions
- Arrow keys navigate menus and listboxes — not Tab

---

## Accessibility (WCAG 2.1 AA) — MANDATORY

This app requires WCAG 2.1 Level AA compliance (declared in PRODUCT.md
Non-functional Requirements: `accessibility: wcag_aa`).

Before delivering any UI component, verify:

- [ ] **Color contrast:** minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px bold+)
      DESIGN.md palette already validated — Snow White 17:1, Parchment 10.5:1,
      Steel Slate 6.2:1, Signal Green 12:1, Mint 10.8:1 against Abyss Black
- [ ] **Focus rings:** visible on ALL interactive elements (never `outline: none` without replacement);
      Orqafy uses `ring-1 ring-[#00d992]` per DESIGN.md
- [ ] **Alt text:** all meaningful images have descriptive alt attributes
- [ ] **ARIA labels:** all icon-only buttons have aria-label
- [ ] **Keyboard navigation:** all interactions reachable and usable without mouse
- [ ] **Form labels:** every input has an associated `<label>` element (not just placeholder)
- [ ] **Error announcement:** errors announced via `aria-live` or `role='alert'`
- [ ] **Touch targets:** ≥44×44px on Mobile First pages (PRODUCT.md per-page strategy table)
- [ ] **Screen reader:** test with VoiceOver or NVDA on at least one Mobile First page per module
- [ ] **prefers-reduced-motion:** signal-glow animation MUST disable when this media query matches

Run `/web-interface-guidelines` in Claude Code to audit UI code against these standards
during Phase 7 Feature Updates that touch UI files.

---

## Density & Layout Rules (Internal Tool — VoltAgent)

PRODUCT.md key constraint: *"Internal tool density — optimised for power users who spend
full workdays in the app; prioritise data density and keyboard-friendliness over
onboarding-style simplicity."*

This overrides the skill's generic "minimal padding" recommendation with concrete rules:

- **Sidebar nav:** 15 collapsible groups with indented sub-items (DESIGN.md reference)
- **Data tables:** TanStack Table via shadcn — sticky header, sortable columns,
  density toggle (comfortable / compact), 8+ columns acceptable on Mobile Ready pages
- **Forms:** single-column on Mobile First, 2-column on Mobile Ready desktop ≥1024px
- **Modals:** small (500px) for confirms, medium (700px) for forms, full-screen on mobile
- **Tabs:** underline style with VoltAgent Mint active indicator (matches DESIGN.md)
- **Status pills:** rounded-full, monochromatic background tint per status semantic
- **Charts:** Recharts via shadcn Chart — dark theme by default; respect Mobile First strategy

Per-page Mobile First / Mobile Ready strategy lives in PRODUCT.md (97 entries).
Phase 4 Part 5 reads PRODUCT.md to apply the right breakpoint priority per page.
