# Orqafy — Mobile-First UI/UX Plan

> **Status:** PLAN ONLY (no code changed). Author: AIEF architect, 2026-07-17.
> **Scope:** the tenant back-office app under `apps/web/src/app/(tenant)/[slug]/(app)/` (94 pages, 19 modules) plus the customer-facing `store/` surface.
> **Contract:** INHERIT-not-REPLACE. This complements the existing design system + the neutral-dark reskin; it does not rip out the app-shell. shadcn/ui is the ONLY component library (hard rule — `.claude/rules/ui-rules.md` + fleet rule). Every recommendation honors `~/.claude/rules/design-defaults.md` (Entry 1 max-width+gutter, Entry 2 sidebar app-shell archetype incl. focused-work icon-rail variant, Entry 3 sidebar-footer white-label).
> **Deploy posture:** HARD HOLD — implementation lands as LOCAL commits on a feature branch; no staging/prod/demo push without the owner's explicit word.

---

## 1. Executive summary

The good news: Orqafy is **not** as desktop-locked as a typical dense B2B app. The shell already does three mobile-critical things right — the readable-content container honors Entry 1 (`ContentContainer` = `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`), the primary nav already has an off-canvas mobile Sheet (`MobileNav`) behind a hamburger, and the shadcn `Table` primitive already wraps rows in `overflow-auto` so wide tables scroll instead of overflowing the body. Tables are also **rare** — only 4 files touch the `Table` primitive; most list surfaces are card grids and custom lists, which are inherently more mobile-friendly.

The real mobile pain is concentrated and fixable:

1. **~110 fixed multi-column grids** (`grid-cols-2` ×71, `grid-cols-3` ×28, `grid-cols-4` ×11) with **no responsive prefix** — KPI/stat rows, form field pairs, and the POS payment pad cram or clip at 375px.
2. **30 `Dialog` usages** stay as center-screen modals on phones (awkward reach, small hit-area, keyboard collisions) — they should become bottom **Drawer/Sheet** on mobile.
3. **Touch targets below 44px** in the nav (`py-2 text-[13px]`), sortable-header buttons, and icon-only buttons.
4. **Missing shadcn primitives** for mobile patterns: no `Drawer` (vaul), `Tabs`, `Pagination`, `Popover`, or `Command` installed, and no shadcn `Form` wrapper (raw `react-hook-form`). These are prerequisites for the responsive patterns below.
5. **The 4 real data tables** (`data-table.tsx`, reports) scroll horizontally but have no mobile card-list fallback and no pagination.
6. **POS `new-sale`** is the one genuinely hard screen — a two-pane register (`lg:grid-cols-[1fr_1.2fr]`) that stacks on mobile but isn't optimized as a thumb-driven point-of-work flow.

**Recommended approach (phased):** first install the missing shadcn primitives + a `useIsMobile` hook and a small responsive-primitives layer (ResponsiveDialog, ResponsiveDataTable, StatGrid) — this is the leverage that makes every later fix a one-line swap. Then do a mechanical responsive-grid sweep, upgrade dialogs and tables, right-size touch targets, and finish with the two bespoke point-of-work screens (POS register, and the DTR clock-in) using the Entry-2 focused-work variant. See the roadmap in §6.

**Executive roadmap (6 phases):**

- **P0 — Foundation primitives** (Drawer/Tabs/Pagination/Popover + `useIsMobile` + ResponsiveDialog/ResponsiveDataTable/StatGrid). Unblocks everything. ~S.
- **P1 — Shell & nav polish** (touch targets ≥44px, header cluster reflow, safe-area insets). ~S.
- **P2 — Responsive grid sweep** (add breakpoint prefixes to the ~110 fixed grids). Mechanical, high-coverage. ~M.
- **P3 — Dialog → Drawer + Data-table → card-list** (swap 30 dialogs + 4 tables to the responsive wrappers). ~M.
- **P4 — Forms & list-page ergonomics** (shadcn Form wrapper, single-column mobile forms, sticky action bars, filter Sheet). ~M.
- **P5 — Point-of-work screens** (POS register mobile flow + DTR + icon-rail variant). Bespoke. ~M–L.

---

## 2. Current-state assessment (grounded)

### 2.1 The shell — already mobile-aware

`apps/web/src/app/(tenant)/[slug]/(app)/layout.tsx`:

```
<div className="flex h-screen overflow-hidden">
  <AppSidebar slug />           // hidden below md
  <div className="flex flex-1 flex-col overflow-hidden">
    <AppHeader tenantSlug />     // contains <MobileNav> hamburger
    <main className="flex-1 overflow-y-auto py-6">
      <ContentContainer>{children}</ContentContainer>
    </main>
  </div>
</div>
```

- **`AppSidebar`** (`app-sidebar.tsx`): `hidden … md:flex w-56` — correctly desktop-only.
- **`MobileNav`** (`mobile-nav.tsx`): shadcn `Sheet side="left" w-56`, renders the shared `SidebarNav`, closes on navigate. ✅ Entry-2 off-canvas pattern already present.
- **`ContentContainer`** (`content-container.tsx`): Entry-1 compliant, with an `IMMERSIVE_PATTERNS` allowlist (currently only `/pos/new-sale`) that opts out to full-width. ✅ The exemption mechanism the plan needs already exists.
- **`SidebarNav`** (`sidebar-nav.tsx`): flat, RBAC-filtered (`role.myPermissions`), footer carries version + Powerbyte white-label (Entry 3). ✅

**Gaps in the shell:** nav rows are `px-3 py-2 text-[13px]` → ~32–34px tall, below the 44px touch minimum. `AppHeader` right cluster shows a "Move as one." tagline (already `hidden … sm:block`) + `NotificationBell`; the header is `px-6` (should reduce to `px-4` on mobile to match Entry-1 base gutter). No safe-area inset handling for notched devices.

### 2.2 Where it breaks at 375px

| Symptom | Evidence | Impact |
|---|---|---|
| Fixed multi-col grids don't collapse | `grid-cols-2` ×71, `grid-cols-3` ×28, `grid-cols-4` ×11 with **no** `sm:/md:` prefix | KPI rows, form field pairs, POS payment pad cram/clip on phones |
| Modals not thumb-reachable | 30 files use `Dialog` (center modal) | Small hit-area, top-of-screen reach, keyboard overlap on mobile |
| Sub-44px touch targets | nav `py-2 text-[13px]`; `sortableHeader` button; icon buttons `size="icon"` (36px) | Mis-taps, fails WCAG 2.5.5/2.5.8 |
| POS register cramped | `pos/new-sale/cart-client.tsx`: two-pane `lg:grid-cols-[1fr_1.2fr]`, payment pad `grid grid-cols-2` (no collapse) | Usable but not a thumb-first POS flow |
| Data tables have no mobile view | `data-table.tsx` scrolls horizontally (via `Table` `overflow-auto`) but no card fallback, no pagination | Horizontal-scroll-hunting for a value on a phone |
| Header gutter mismatch | `app-header.tsx` `px-6` vs Entry-1 base `px-4` | Content and header edges misalign on mobile |

### 2.3 What's already good (preserve)

- Responsive grids ARE used in many places: `sm:grid-cols-2` ×39, `sm:grid-cols-3` ×15, `md:grid-cols-3` ×7, `lg:grid-cols-4` ×5, etc. The sweep in P2 extends this pattern to the fixed grids — it's continuation, not new invention.
- `Table` primitive already has `<div className="relative w-full overflow-auto">` — horizontal scroll is free.
- `EmptyState` component exists and is wired into `DataTable`.
- Dual-path loading states (Rule 11) already practiced (`Skeleton` in `SidebarNav`).

### 2.4 Component inventory (shadcn installed vs missing)

**Installed:** `alert-dialog, avatar, badge, button, card, chart, data-table, dialog, dropdown-menu, empty-state, input, label, select, separator, sheet, skeleton, sonner, table, textarea`.

**Missing (needed for this plan — all shadcn, no new libraries except vaul which shadcn's Drawer wraps):** `drawer`, `tabs`, `pagination`, `popover`, `command`, `form` (react-hook-form is already a dep — only the shadcn `Form` wrapper is missing), optionally `accordion`, `scroll-area`, `toggle-group`.

---

## 3. Mobile-first strategy

### 3.1 Breakpoint model (Tailwind defaults — do not invent custom breakpoints)

- **Base (0–639px, "mobile"):** single-column, stacked, full-width-within-gutter. Design here FIRST.
- **`sm` (≥640px):** 2-col where it helps (stat pairs, some form fields).
- **`md` (≥768px):** the **sidebar appears** (`AppSidebar` is `md:flex`), off-canvas nav retires. Treat `md` as the desktop-shell threshold.
- **`lg` (≥1024px):** dense multi-pane (POS two-pane, 3–4 col KPI rows).

Rule of thumb for the sweep: **every `grid-cols-{2,3,4}` becomes `grid-cols-1 sm:grid-cols-2 …`** unless the layout is intentionally always-2 (a rare true pair that reads fine at 160px/col). The default is collapse-to-one.

### 3.2 Navigation archetype (design-defaults Entry 2)

Orqafy is a purpose-driven functional app → **persistent left sidebar app-shell** is correct and already in place. The decision matrix for mobile:

- **Global module nav (19 items):** keep the **off-canvas Sheet** (`MobileNav`). A 19-item bottom tab bar is wrong (bottom nav caps at ~5). **Do NOT add a global bottom-nav.** ✅ Current approach stays.
- **Icon-rail variant (Entry-2 focused-work):** reserve for the two point-of-work screens — **POS register** and **DTR clock-in** — where the operator wants maximum working area. On those, the sidebar/nav collapses to an icon rail on `md+` and to a minimal top bar on mobile. This is the Entry-2 "non-obtrusive variant for focused work screens."
- **In-screen bottom action bar (NOT global nav):** for task screens with a primary commit action (POS "Charge", form "Save", cart "Checkout"), pin a **sticky bottom action bar** inside that screen on mobile (`sticky bottom-0` + safe-area inset). This is a per-screen affordance, not app navigation — it does not conflict with the "no global bottom-nav" rule.

### 3.3 Touch targets (WCAG 2.5.5 / 2.5.8, ≥44×44px)

- Nav rows: raise to `min-h-11` (44px) on mobile (`py-2.5` + larger tap area), keep compact on desktop.
- Icon buttons currently `size="icon"` (36px) → introduce a `size="icon-lg"` (44px) button variant for mobile-primary icon actions (row actions, header controls). Keep 36px for desktop-dense toolbars.
- Table row action menus, `sortableHeader` buttons, and any `<a>`/`<button>` in list rows → ensure ≥44px hit area on mobile (padding, not just font size).
- Minimum 8px spacing between adjacent tap targets.

### 3.4 Responsive data-table pattern (table ⇄ card-list)

The canonical shadcn-only pattern (no new lib):

- **`md+`:** render the existing `DataTable` (`table.tsx` already gives horizontal `overflow-auto` as the safety net for extra-wide tables).
- **Below `md`:** render a **card list** — one `Card` per row, label:value stacked, primary field as the card title, row actions in a `DropdownMenu` (or a per-card Drawer). Switch via a `useIsMobile()` hook.
- Wrap both behind a **`ResponsiveDataTable`** component so every list page passes columns + a `mobileCard(row)` renderer once. Add **`Pagination`** (new shadcn primitive) for lists that can exceed ~25 rows — infinite horizontal/vertical scroll on a phone is the worst case.

This is INHERIT-not-REPLACE: `ResponsiveDataTable` wraps the existing `DataTable`; existing table pages keep working, opt into the card view by supplying a `mobileCard`.

### 3.5 Forms

- Adopt the shadcn **`Form`** wrapper (over the already-present `react-hook-form`) for consistent label/field/error/description structure and a11y (`FormLabel`/`FormMessage` ids).
- **Single column on mobile:** every form field grid becomes `grid-cols-1 sm:grid-cols-2`. Full-width inputs, `h-11` on mobile for comfortable typing.
- **Sticky action bar** on long forms (`sticky bottom-0` Save/Cancel) so the primary action is always reachable without scrolling; respect `env(safe-area-inset-bottom)`.
- Use native mobile affordances: correct `inputMode`/`type` (numeric for money/qty, `tel`, `email`), `autocomplete`, and shadcn `Select` (already a native-friendly popover). For date fields, prefer native `<input type="date">` on mobile over a desktop calendar popover.

### 3.6 Dialog → Drawer/Sheet on mobile

- Install shadcn **`Drawer`** (vaul). Create a **`ResponsiveDialog`** wrapper: renders `Dialog` at `md+`, `Drawer` (bottom sheet) below `md`, with a shared API (`title`, `description`, `trigger`, `children`, `footer`). Swap the 30 `Dialog` call-sites to `ResponsiveDialog`.
- Right-side **`Sheet`** for filter/detail panels on mobile (already used for nav — reuse for "Filters" on list pages).
- `AlertDialog` (destructive confirms) can stay centered — it's short and benefits from center focus; optionally route through the same responsive wrapper for consistency.

### 3.7 Layout & gutters

- `app-header.tsx`: `px-6` → `px-4 sm:px-6` to match Entry-1 base gutter; keep the tagline `hidden sm:block`.
- Add safe-area padding to the shell for notched devices: `pb-[env(safe-area-inset-bottom)]` on sticky bottom bars, `pt-[env(safe-area-inset-top)]` where the header would sit under a notch (PWA/standalone).
- Keep `ContentContainer` as the single source of Entry-1 truth; add point-of-work routes to `IMMERSIVE_PATTERNS` rather than hand-rolling full-bleed per page.

---

## 4. shadcn component & primitive adoption (no other libraries)

| Add | Why | Used by |
|---|---|---|
| `drawer` (vaul via shadcn) | Bottom-sheet for mobile dialogs & POS panels | ResponsiveDialog, POS cart |
| `tabs` | Collapse multi-section detail pages into swipeable tabs on mobile | invoice/customer/PO/product detail |
| `pagination` | Bound list length on mobile | ResponsiveDataTable, list pages |
| `popover` | Filter menus, date pickers, quick-actions | list filters, forms |
| `command` | Fast product/customer search (POS, pickers) | POS register, entity pickers |
| `scroll-area` | Constrained scroll regions (POS product list, long selects) | POS, dropdowns |
| `form` | react-hook-form wrapper (dep already present) | every form page |
| `toggle-group` (opt) | Segmented controls (payment method, filters) | POS, filters |

**New shared primitives to build (thin, shadcn-composed — INHERIT-not-REPLACE):**

- `use-is-mobile.ts` — `useIsMobile(breakpoint = 768)` via `matchMedia`, SSR-safe.
- `responsive-dialog.tsx` — Dialog (md+) / Drawer (mobile) with one API.
- `responsive-data-table.tsx` — wraps `DataTable`; adds `mobileCard` render + `Pagination`.
- `stat-grid.tsx` — standard KPI row: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, one place to fix all stat rows.
- `page-header.tsx` — title + back link + primary action that reflows to a sticky mobile action on small screens (normalizes the ad-hoc `flex items-center gap-3` headers seen in `invoices/new` etc.).
- `mobile-action-bar.tsx` — sticky bottom commit bar with safe-area inset.

**Hard constraint:** no MUI/Chakra/Ant, no standalone table/drawer libs beyond shadcn's own (vaul ships inside shadcn Drawer). Charts stay on the shadcn `Chart` (Recharts) component.

---

## 5. Per-surface recommendations (heaviest pages)

### 5.1 POS register — `pos/new-sale/cart-client.tsx` (the hard one)

Current: session/warehouse selectors `md:grid-cols-2`; two-pane products|cart `lg:grid-cols-[1fr_1.2fr]` (stacks below lg); product list `max-h-[400px] overflow-y-auto`; payment pad `grid grid-cols-2` (does NOT collapse). Already in `IMMERSIVE_PATTERNS` (full-width).

Mobile flow (thumb-first):
- **Tabbed / stepped single-column on mobile:** `Products` → `Cart` as `Tabs` (or a two-step: pick items, then a "Review & Charge" Drawer). Keep the two-pane at `lg+`.
- Product picker: shadcn `Command` search + a `scroll-area` grid of large (≥44px) tap tiles; qty steppers with big +/− buttons.
- Cart: bottom **`Drawer`** summarizing line items + totals, with a **sticky "Charge" action bar** (safe-area inset).
- Payment pad: `grid grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; amount field `inputMode="decimal" h-11`; quick-cash chips as `toggle-group`.
- Run the sidebar as the Entry-2 **icon-rail** on `md+` here for maximum register area.

### 5.2 Inventory & list-table surfaces — `inventory/products`, `stock-movements`, `crm/customers`, `purchasing/*`, `banking/transactions`

- Route through **`ResponsiveDataTable`**: desktop table (horizontal `overflow-auto` retained), mobile card-list (SKU/name as title; price/stock/status as label:value; row actions in a `DropdownMenu` or per-card Drawer).
- Add **`Pagination`** (default 25/page) — critical on mobile.
- Filters/search: collapse into a right **`Sheet`** ("Filters") on mobile instead of an inline filter bar.

### 5.3 Invoices — `invoices`, `invoices/[id]`, `invoices/new`

- List: `ResponsiveDataTable` card view (invoice # + client as title; amount/status/due as fields; status `Badge`).
- Detail `[id]`: line-item table → mobile card-list per line; totals block `grid grid-cols-2` → single-column stacked summary; header actions (Send/Print/PDF) into a sticky action bar / `DropdownMenu`.
- `new`: single-column form (shadcn `Form`), line-item editor as stacked cards on mobile (not a wide grid), sticky Save bar.

### 5.4 Payroll — `payroll`, `payroll/[id]`, `payroll/[id]/payslips`, `statutory-rates`

- Highest data density in the app. Payroll runs = `ResponsiveDataTable` with pagination.
- Payslip detail: earnings/deductions/statutory as **`Tabs`** or `Accordion` on mobile (avoid one giant wide table); numeric columns right-aligned, `tabular-nums`.
- `statutory-rates` (bracket tables): keep table with horizontal `overflow-auto`; add a sticky first column (label) so scrolling keeps context. This is one place where the horizontal-scroll table is genuinely acceptable — flag as "reference table, scroll OK."

### 5.5 Dashboard — `dashboard`

- KPI row: replace ad-hoc `grid-cols-4` with **`StatGrid`** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- Charts (shadcn `Chart`/Recharts): ensure `ResponsiveContainer` width=100%, reduce tick density on mobile, allow horizontal scroll for wide time-series inside an `overflow-x-auto` wrapper.
- Recent-activity / lists: card-list on mobile.

### 5.6 Customer storefront — `store/*` (`products`, `products/[id]`, `checkout`, `orders/track`)

This is a **public, consumer-facing** surface → design-defaults Entry-2 archetype-1 (marketing/consumer) applies, NOT the app-shell. It should be aggressively mobile-first already (it's a storefront); audit separately: product grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, checkout single-column with sticky "Place order" bar, `orders/track` big status timeline. No left-sidebar here. (Lower priority than the back-office; call out as a distinct workstream.)

---

## 6. Phased implementation roadmap

Dependency-ordered so each phase unblocks the next. Effort: **S** ≈ 1 focused session, **M** ≈ 2–3, **L** ≈ 4+. All local-only, feature branch, HARD HOLD.

### Phase 0 — Foundation primitives (S) — do first, unblocks all
- Install shadcn `drawer, tabs, pagination, popover, command, form, scroll-area` (+ optional `toggle-group, accordion`).
- Build `useIsMobile`, `ResponsiveDialog`, `ResponsiveDataTable`, `StatGrid`, `PageHeader`, `MobileActionBar`.
- Add `size="icon-lg"` (44px) button variant.
- **Done-gate:** primitives typecheck; a throwaway story page renders Dialog↔Drawer swap at 375/1280px. No page migrated yet.

### Phase 1 — Shell & nav polish (S)
- Nav rows → `min-h-11` on mobile; `AppHeader` `px-4 sm:px-6`; header cluster reflow; safe-area insets on shell + future sticky bars.
- Verify off-canvas nav + Entry-1 gutter at 375px (Playwright/browser QA).
- **Done-gate:** live 375px QA of shell, 0 console errors; touch targets ≥44px in nav.

### Phase 2 — Responsive grid sweep (M) — highest coverage/effort ratio
- Mechanical: add breakpoint prefixes to the ~110 fixed `grid-cols-{2,3,4}` (default collapse-to-1). Prioritize KPI/stat rows and form field grids. Introduce `StatGrid` at the same time.
- Best done as scoped worker batches by module to stay within context budget.
- **Done-gate:** per-module 375px QA; no horizontal body scroll on any audited page.

### Phase 3 — Dialogs → Drawer + tables → card-list (M)
- Swap the 30 `Dialog` call-sites to `ResponsiveDialog`.
- Migrate the 4 real tables + heavy list pages to `ResponsiveDataTable` (card fallback + pagination).
- **Done-gate:** each migrated dialog/table QA'd at 375px; desktop unchanged.

### Phase 4 — Forms & list ergonomics (M)
- Adopt shadcn `Form` wrapper on the `*/new` and `*/edit` pages; single-column mobile; `PageHeader` + sticky `MobileActionBar`; filter `Sheet` on list pages; correct `inputMode`/native date on mobile.
- **Done-gate:** representative form (invoice/new, employee/new) fully thumb-usable at 375px; keyboard doesn't obscure the submit.

### Phase 5 — Point-of-work screens (M–L) — bespoke
- POS `new-sale` mobile flow (Tabs/steps + Command search + cart Drawer + Charge bar + icon-rail).
- DTR clock-in mobile-first; apply icon-rail Entry-2 variant to both; extend `IMMERSIVE_PATTERNS` as needed.
- **Done-gate:** live end-to-end POS sale + DTR punch on a 375px viewport.

### Parallel / later — Storefront workstream (M)
- Audit `store/*` as a consumer mobile-first surface (separate from app-shell); can run any time after P0.

**Suggested cut lines:** P0+P1+P2 delivers ~80% of the perceived mobile improvement for the least effort (shell right + everything stops cramping). P3–P5 are the polish + the two hard screens.

---

## 7. Owner [WHAT] decisions to surface

These are product/scope calls (not [HOW]) — record in `PENDING_DECISIONS.md`, keep un-gated work moving:

1. **Mobile priority scope** — is the priority the **back-office on tablets/phones for staff**, or the **customer `store/`**, or both? Changes phase ordering (storefront could jump ahead).
2. **PWA / installable / offline?** — do we want add-to-home-screen + offline for POS/DTR (field use)? That's a separate, larger workstream (service worker, manifest, offline queue) — not assumed here.
3. **POS on mobile — real use case?** — is POS actually operated on a phone, or tablet-and-up only? If tablet-only (`md+`), Phase 5's phone-flow effort drops significantly (two-pane is fine on a tablet).
4. **Pagination default page size** (proposed 25) and whether server-side pagination is in scope for the heaviest lists (payroll, stock-movements) — currently many pages `take: 200` client-side.
5. **Native date input vs shadcn calendar** on mobile — accept native pickers (recommended) or insist on a branded calendar everywhere?
6. **Statutory/bracket reference tables** — accept horizontal-scroll-with-sticky-first-column as the mobile pattern (recommended) vs. forcing a card view for dense numeric reference data.

---

*INHERIT-not-REPLACE throughout: every item above extends the existing shell, design system, and RBAC-filtered nav — none replaces them. shadcn/ui only. Local commits, HARD HOLD until owner approves any deploy.*
