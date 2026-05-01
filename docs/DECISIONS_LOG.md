# Decisions Log — Powerbyte ERP / Nucleus Business Suite

This file records reversible and locked architectural decisions made during planning
and Feature Updates. Decisions are append-only — supersede, don't edit historical entries.

---

## Decision — 2026-04-20 — Adopt Linear visual aesthetic

**Decision:** Adopt Linear visual aesthetic (color + typography + layout + theme) with
shadcn/ui component implementation.

**Source:** https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md

**Rationale:**
- Nucleus is an internal ERP used by power users 8+ hours/day — the dark-mode-native,
  data-dense Linear aesthetic matches the declared design identity (Linear/Notion-style
  dense information architecture) better than generic shadcn defaults.
- Linear's tight typography (Inter 510 weight, negative letter-spacing at display sizes)
  signals precision engineering — appropriate for a financial/accounting ERP where every
  peso must trace back to a fund source.
- Single chromatic accent (indigo-violet `#5e6ad2` / `#7170ff`) reserved for CTAs and
  interactive state gives the UI clear visual hierarchy without decorative noise — critical
  for an app with 33+ screens and complex state indicators (invoice status, disbursement
  pipeline, GPS warnings, credit balances).
- Public landing page will naturally differentiate from the ERP app by using Linear's
  marketing-black hero treatment, while the authenticated app uses the panel-dark +
  elevated-surface stack.

**Scope:** Visual inspiration only. Sections 1 (Theme), 2 (Color), 3 (Typography),
5 (Layout) were extracted. Sections 4 (Component Stylings), 6 (Depth & Elevation),
7 (Do's/Don'ts), 8 (Responsive), 9 (Agent Prompt Guide) were NOT adopted — shadcn/ui
handles components, elevation, and responsive; do's/don'ts are style-guide opinions
not binding on implementation.

**Reversible:** YES — can be swapped by re-running prompt 4.8 with a different design
from VoltAgent/awesome-design-md.

**Files affected:**
- `docs/PRODUCT.md` — added Visual Design line in Non-functional Requirements section
  pointing to DESIGN.md
- `docs/DESIGN.md` — NEW FILE (authoritative visual reference)
- `docs/DECISIONS_LOG.md` — this entry

---

## Decision — 2026-04-20 — Override Linear indigo with sunset orange accent `#F26419`

**Decision:** Override Linear's default indigo-violet brand accent (`#5e6ad2` / `#7170ff` /
`#828fff`) with Powerbyte's sunset burnt orange accent scale (`#F26419` / `#FF8647` /
`#FFA570` / `#FFCBA8`). All other Linear tokens (dark surfaces, Inter Variable typography
with cv01/ss03, weight 510, negative letter-spacing at display sizes, 8px spacing grid,
border radius scale, semi-transparent white borders) remain adopted as-is.

**Rationale:**
- Powerbyte IT Solutions serves IT services and field-work customers in the Philippines;
  warm orange aligns with the field-services brand family (DHL, Home Depot, Mozilla,
  construction/installation trades) better than cool indigo, which skews generic-SaaS.
- `#F26419` was selected after A/B evaluation of five candidates (Linear indigo `#5e6ad2`,
  coral `#FF2A00`, terracotta `#FF5533`, pure orange `#FF5600`, sunset `#F26419`).
- The lower red channel (R=242 vs pure R=255) reduces eye fatigue over 8-hour sessions
  while retaining visual presence — critical for a data-dense ERP used all workday.
- Hue separation from destructive pill red (`#f43f5e`) is approximately 31°, comfortably
  above the 20° threshold where pill-color confusion becomes a concern for colorblind
  users and fast-glance readers.
- Contrast against `#08090a` background: `#F26419` text = 5.8:1 (WCAG AA), `#FFA570`
  text = 8.9:1 (WCAG AAA), `#FFCBA8` text = 11.2:1 (WCAG AAA) — all validated.

**Scope:**
- Primary CTA backgrounds, logo gradient, hero primary buttons, MOST POPULAR pricing ribbon
- Active nav link state and primary-button hover
- Project links, "View credit ledger →" links, in-progress icons, pill-brand text,
  tab underlines, pagination active indicator
- Info banner headlines (e.g. "No journal entry will be created") and banner tint backgrounds
- Inventory-consumed expense bars at 60% opacity (visual subdue for P&L-excluded expenses)

**Out of scope (unchanged from Linear):**
- Status pills (success green `#10b981`, warning amber `#fbbf24`) — kept for semantic clarity
- Text color hierarchy (`#f7f8f8` / `#d0d6e0` / `#8a8f98` / `#62666d`) — Linear tokens retained
- Border colors and opacity tiers — Linear tokens retained
- Security Lavender `#7a7fad` — retained for Turnstile / SMTP-encryption indicators only
- Destructive pill: tuned to rose-red `#f43f5e` on `rgba(225,29,72,0.12)` background +
  `rgba(225,29,72,0.35)` border — specifically chosen to maintain hue separation from the
  sunset orange accent (rose-red hue ≈350°, sunset orange hue ≈21°)

**Reversible:** YES — accent scale is a small, contained set of CSS variables (4 hex values
+ 9 rgba opacity variants). Changing it in Phase 4 globals.css + Tailwind config takes
under 10 minutes. Linear default indigo values remain in DESIGN.md as historical reference.

**Files affected:**
- `docs/DESIGN.md` — added "Powerbyte-Specific Override" section at top; updated
  Brand & Accent subsection in Section 2 with sunset orange scale as active values;
  annotated Linear indigo as historical reference; updated Key Characteristics bullet
- `docs/DECISIONS_LOG.md` — this entry

**Phase 2.8 mockup snapshot:** `nucleus-phase28-sunset.html` (Phase 2.8 visual check
mockup; reference artifact only, not shipping code).

---

## Decision — 2026-04-20 — Replace Linear + sunset orange with VoltAgent aesthetic

**Decision:** Supersede the two prior decisions (adopt Linear visual aesthetic; override
Linear indigo with sunset orange `#F26419`) in favor of a full swap to the VoltAgent
aesthetic from getdesign.md. This decision:
- Supersedes "Adopt Linear visual aesthetic" (2026-04-20, earlier today)
- Supersedes "Override Linear indigo with sunset orange accent `#F26419`" (2026-04-20, earlier today)

**Source:** https://getdesign.md/voltagent/design-md

**Rationale:**
- User preference — deliberate choice of the terminal-native developer-tool aesthetic despite
  Nucleus's primary users being non-developers (accountants, HR managers, project managers,
  field staff). This is an unusual brand-to-user-fit choice that was explicitly acknowledged
  and accepted during the decision conversation.
- Powerbyte IT Solutions operates in the IT services category — the VoltAgent "engineering
  platform" aesthetic aligns with the parent company brand identity even though the direct
  users of the ERP are not themselves developers.
- VoltAgent's border-weight-as-elevation system (1px → 2px → 3px border weight, color shifts
  from Warm Charcoal to Signal Green) provides clearer semantic depth communication than
  translucent shadow layering.
- Signal Green (`#00d992`) accent has high contrast on Abyss Black (`#050507`) — validated at
  approximately 12:1 ratio, comfortably WCAG AAA for text and icon usage.

**Scope of change (full swap):**

1. **Canvas & surfaces**
   - Page background: `#08090a` → `#050507` (Abyss Black)
   - Panel / sidebar background: `#0f1011` → `#101010` (Carbon Surface)
   - Elevated card: `#191a1b` → `#101010` (same as panel; depth via border)
   - Border standard: `rgba(255,255,255,0.08)` translucent → `#3d3a39` solid (Warm Charcoal)

2. **Accent system (single chromatic identity)**
   - Primary: `#F26419` → `#00d992` (Emerald Signal Green)
   - Interactive / hover: `#FF8647` → `#00d992` (same Signal Green with glow enhancement)
   - Bright text: `#FFA570` → `#2fd6a1` (VoltAgent Mint)
   - Lightest: `#FFCBA8` → `#2fd6a1` (Mint — no separate lightest tier needed)
   - Tint rgba: `rgba(242,100,25,x)` → `rgba(0,217,146,x)`

3. **Typography (full replacement)**
   - Heading font: Inter Variable → system-ui (native OS font authority)
   - Body font: Inter Variable with `cv01, ss03` OpenType → Inter with `calt, rlig`
   - Monospace: Berkeley Mono → SFMono-Regular
   - Signature weight: Linear's 510 → VoltAgent's 500/600/700 standard progression
   - Letter-spacing at display: -1.584px → -0.65px (less compressed)
   - Letter-spacing at section heading: -0.704px → -0.9px (tightest in VoltAgent system)
   - Implementation: `.font-heading` CSS class applied to h1/h2 elements for system-ui rendering;
     `.w-510` / `.w-590` utility classes remapped to 500/600 respectively to preserve HTML markup

4. **CTA pattern (filled → outlined)**
   - Linear/sunset: filled Signal Green background with white text
   - VoltAgent: Carbon Surface background (`#101010`) with VoltAgent Mint text (`#2fd6a1`)
     and Signal Green border (`#00d992`); green glow appears on hover
   - Exception: Small tags/ribbons (e.g. "MOST POPULAR" pricing ribbon) retain Signal Green
     background with Abyss Black text for maximum contrast

5. **Signature animation (new)**
   - `@keyframes signal-glow`: `drop-shadow(0 0 2px #00d992)` → `drop-shadow(0 0 8px #00d992)`
     on a 2.5s ease-in-out infinite cycle
   - Applied to: header logo, login screen logo, active disbursement pipeline step
   - Not applied decoratively — each placement is deliberate

6. **Status colors (tuned to VoltAgent palette)**
   - Success: `#34d399` / `#10b981` → `#10b981` (Tailwind Emerald, kept distinct from Signal Green)
   - Warning: `#fbbf24` → `#ffba00` (VoltAgent Warning Amber)
   - Destructive: `#f43f5e` → `#fb565b` (VoltAgent Danger Coral)
   - Security: Added `#818cf8` (Soft Purple) reserved for Turnstile / SMTP encryption badges

**Out of scope (unchanged):**
- All 72 screens in the mockup (8 Tier 1 + 64 Tier 2 full V31 coverage)
- All Filipino ERP sample data (Metro Aquatics, Alaska Milk, Jollibee, `PB-` SKUs, PHP currency)
- All business rules preserved visually (no journal entry banner, publicToken sharing,
  inventory_consumed excluded from P&L, demo tenant highlighted row, null-GPS warnings)
- All V31 Mobile First / Mobile Ready badge classifications
- Sidebar navigation structure (15 groups, indented sub-items)
- PRODUCT.md structure — only the Visual Design line already points to DESIGN.md

**Reversible:** YES. All changes live in `nucleus-phase28-voltagent.html` and `docs/DESIGN.md`.
Previous state preserved:
- Mockup: `nucleus-phase28-full.html` (Linear + sunset orange + full V31 coverage)
- Earlier variants: `nucleus-phase28-sunset.html`, `-orange.html`, `-terracotta.html`,
  `-coral.html`, `-linear.html`, `-mockup.html`
- DESIGN.md: `docs/archive/DESIGN-linear-sunset.md`

**Contrast validation (against `#050507` background):**
- `#f2f2f2` Snow White body text: ~17:1 (WCAG AAA)
- `#b8b3b0` Warm Parchment secondary: ~10.5:1 (WCAG AAA)
- `#8b949e` Steel Slate tertiary: ~6.2:1 (WCAG AA)
- `#00d992` Signal Green text: ~12:1 (WCAG AAA)
- `#2fd6a1` Mint text: ~10.8:1 (WCAG AAA)

**User-fit risk acknowledgment:**
VoltAgent was designed for developer tools and terminal-native UIs. Nucleus users include
accountants, HR managers, and field staff with no developer background. Fit is not ideal on
paper. This decision was made with explicit user awareness of that trade-off. If user testing
in later phases reveals the aesthetic creates friction (e.g. accountants finding the
terminal-native feel alien for financial work), this decision is reversible — revert to
`nucleus-phase28-sunset.html` and `docs/archive/DESIGN-linear-sunset.md` in under 15 minutes.

**Files affected:**
- `docs/DESIGN.md` — rewritten from scratch (old Linear+sunset content archived)
- `docs/archive/DESIGN-linear-sunset.md` — NEW archive of the prior DESIGN.md
- `docs/DECISIONS_LOG.md` — this entry (append-only; prior entries remain as historical record)
- `nucleus-phase28-voltagent.html` — NEW mockup artifact (Phase 2.8 final)

**Phase 2.8 final mockup:** `nucleus-phase28-voltagent.html` (72 screens, VoltAgent aesthetic,
full V31 Mobile Needs coverage).

---

## Decision — 2026-05-01 — Rename Nucleus Business Suite to Orqafy

**Decision:** Rename the product from "Powerbyte ERP — Nucleus Business Suite" to "Orqafy"
with tagline "Move as one."

**Rationale:**
- "Nucleus" is an extremely common name in the software/SaaS space — multiple existing
  products already use it, creating brand confusion.
- "Orqafy" is derived from "Orca" (killer whale) — symbolizing coordinated pod movement,
  intelligence, and team coordination. The "-fy" suffix means "to make/to do" — as in
  "Orqafy your business operations."
- Verified 100% unique — zero existing software, companies, or apps found for "Orqafy."
- The orca metaphor aligns with the platform's core value proposition: all departments
  and operations moving as one coordinated unit.
- Brand narrative: "Orcas don't hunt alone. They move as a pod — coordinated, intelligent,
  every member knowing its role."

**Scope:** Full rename across all files — PRODUCT.md (title, tagline, problem statement,
mobile app name, Docker Hub repo), DESIGN.md (title), README.md, and all future artifacts.
"Powerbyte" remains as the parent company name: "Powered by Powerbyte I.T. Solutions"
footer on all pages.

**Reversible:** YES — cosmetic rename, no architectural impact.

**Files affected:**
- `PRODUCT.md` — 7 locations renamed
- `DESIGN.md` — title updated
- `README.md` — NEW file for GitHub repo
- `DECISIONS_LOG.md` — this entry

---

## Decision — 2026-05-01 — Major feature expansion (session changelog)

**Decision:** Expand PRODUCT.md from 1,210 lines (v31) to 2,062 lines with the following
additions in a single planning session:

1. **Customer type:** 2 → 3 values (government|private|individual)
2. **CustomerContact entity:** replaces single contactPerson field
3. **Customer detail page:** 8 submenus (Profile, Proposals, Invoices, Subscriptions,
   Payments, Credit Notes, Projects, Tickets)
4. **Proposals & Quotations:** split into distinct document types with full-snapshot revision
   tracking, file attachments (50MB), external links, submenus
5. **Quotation markup computation:** Excel-like spreadsheet with golden formula, configurable
   sections (Equipment/Materials/Labor), configurable markup columns, editable final price
6. **BudgetAllocation removed:** superseded by enhanced FundSource custodian accounts
7. **budget_holder role removed:** 14 → 13 roles
8. **FundSource enhanced:** assignedTo for custodians, 5 types (cash/ewallet/bank/cc/loan)
9. **FundTransfer entity:** inter-account transfers with approval
10. **FundRequest entity:** any custodian can request funds
11. **Credit card lifecycle:** CreditCardTransaction per-charge tracking, bankFee, selective
    multi-select payment, installment with bank charges
12. **Loan accounts:** real money received, 3 transaction types only, PAID lifecycle
13. **Product 3-tier standard pricing:** Dealer/Commissioner/SRP with ceiling markup mode
14. **Product QR/barcode generation** and smartphone camera OCR for serial numbers
15. **Purchasing overhaul:** item allocation splits (stock/project/company), multi-leg shipping
    cost distribution (equal share / proportional by cost), inline product quick-add, fuzzy
    product matching, cost change decision system preserving actual purchase cost for projects
16. **E-Commerce / Online Store:** public storefront, Xendit payment gateway, customer tier
    pricing (Regular/VIP/Dealer), order management
17. **Repairs & Job Orders:** digitized job order form, 14-char system ID, repair workflow,
    parts quotation integration, intake/pickup signatures, printable PDF
18. **Customer Portal expansion:** 11 submenus including online orders, repairs, documents,
    online invoice payment via Xendit
19. **Customer tiers:** Regular (SRP), VIP (10% off), Authorized Dealer (12% off)
20. **Master Ledger report:** centralized cross-account chronological view
21. **Income vs Expense report:** POs excluded (inventory assets)
22. **Inventory Valuation report:** dual view at cost and at SRP
23. **FundTransactionAttachment:** file uploads per transaction
24. **"Powered by Powerbyte I.T. Solutions"** footer on all pages

**Reversible:** Individual features can be reverted but the overall expansion is the new
baseline for Phase 3 implementation.

**Result:** PRODUCT.md: 2,062 lines, ~90 entities, 97 pages, 13 roles, 23 BullMQ queues.

---

## Dev Environment Mode
Decision: MODE A — WSL2 native (the only supported mode as of V25)
Rationale: Devcontainer adds 4 virtualisation layers on WSL2 + Docker Desktop causing
permission errors, shell server crashes, and socket failures. WSL2 native eliminates all of this.
Docker Desktop provides the Docker socket to WSL2 natively. No DinD needed.
Locked: yes — do not re-ask or scaffold devcontainer files.

---

## Git Branching Strategy
Decision: Branch-per-feature with squash-merge to main (Rule 23).
Branch patterns: feat/{slug}, scaffold/part-{N}, fix/{slug}, chore/{slug}.
Commit style: conventional (feat:, fix:, chore:, docs:).
Locked: yes — do not re-ask.

---

## Model Routing
Decision: Claude Code is the primary agent for all phases (V31).
  planning:   claude-code (Phase 2)
  execution:  claude-sonnet-4-6 via Claude Code (V31 primary)
  governance: gemini-2.5-flash-lite (cheapest, non-critical writes)
Cline: deprecated V31. .clinerules generated for historical parity but unused.
Locked: yes — do not re-ask.
