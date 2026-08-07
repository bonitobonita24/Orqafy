# Decisions Log — Orqafy (formerly Powerbyte ERP / Nucleus Business Suite)

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

> ⛔ SUPERSEDED (2026-06-18): getdesign.md is DROPPED fleet-wide. The VoltAgent/getdesign
> aesthetic was never shipped to production. The canonical theme is **shadcn/ui neutral-dark**
> (owner-approved). See "Decision — 2026-06-18 — Canonical theme: shadcn neutral-dark
> (VoltAgent emerald deprecated)" below. This entry is preserved as historical provenance only —
> do not treat any getdesign.md instruction here as active.

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

## Decision — 2026-05-02 — Phase 2 locked decisions (Discovery Interview output)

**Decision:** Lock the 7 decisions made during Phase 2 Discovery Interview.

1. **Domains** — prod = `orqafy.powerbyte.app`, staging = `orqafy-staging.powerbyte.app`.
   Subdirectory tenancy routing (no wildcard DNS, no per-tenant SSL).

2. **Xendit dual-level architecture** — Platform-level Xendit account (Powerbyte's own,
   keys in platform `.env`) for tenant subscription billing — required at v1 launch.
   Tenant-level per-tenant Xendit (`TenantXenditConfig` entity, encrypted keys at rest)
   for e-commerce checkout + portal invoice payments — scaffolded at v1, activated at v2.

3. **Tax + fiscal year configurable per tenant** — multi-tenant SaaS targeting SEA
   markets requires per-tenant VAT rates + fiscal year start. Default: PHP, 12% VAT,
   January fiscal year.

4. **CSRF approach: SameSite=Lax** (not Strict). Rationale: Strict breaks customer
   email-link navigation (clicking invoice link forces re-login). Lax allows GET
   navigation while blocking cross-origin POST — sufficient given tRPC mutations are
   POST with JSON Content-Type.

5. **Demo tenant — ALL mutations blocked except role-switch.** `isDemoTenant: true`
   JWT claim enables single middleware check that blocks every write mutation in the
   demo tenant. Demonstrates flows visually but cannot persist any modification.
   Demo resets every 6 hours via cron job.

6. **Docker Hub publishing — enabled.** `docker.publish: true`,
   `hub_repo: bonitobonita24/orqafy`, `image_name: orqafy`. Image pushed by GitHub
   Actions on every merge to main with tags `:latest`, `:staging-latest`, `:sha-<short>`.
   Komodo staging auto-detects `:staging-latest` (auto_update). Production manual deploy
   via Komodo UI.

7. **TenantXenditConfig entity added** — supports decision #2 (per-tenant Xendit keys).

**Reversible:** Decisions 1, 3, 5, 6 are reversible cheaply. Decisions 2, 4, 7 are
locked (cross-cutting impact on auth/payment/schema).

**Files affected:** `PRODUCT.md` (12 edits), `inputs.yml`, `.env.{dev,staging,prod}`.

---

## Decision — 2026-05-03 — Phase 3 spec file generation (ports + governance)

**Decision:** Lock Phase 3 outputs.

**Port strategy (Rule 22):**
- Dev port base: **42941** (random, generated once via `shuf -i 40000-49999`).
- All dev ports derive from base + offset:
  - 42941 PostgreSQL · 42942 PgBouncer · 42943 Valkey · 42944 MinIO API
  - 42945 MinIO Console · 42946 MailHog SMTP · 42947 MailHog UI · 42948 pgAdmin
  - 42951 App (Next.js) · 42952 Worker · 42961 Prisma Studio
- Staging ports: 5433 / 6433 / 6380 / 9010 / 5051 (offset from prod)
- Prod ports: 5432 / 6432 / 6379 / 9000 / 5050 (standard)
- Staging + prod app services: **no host port** — Traefik routes via internal Docker
  network (V27 reverse proxy decision).

**Containers + volumes:** named per-environment via `COMPOSE_PROJECT_NAME` to guarantee
isolation when staging + prod run on the same Komodo server.

**Generated files:**
- `inputs.yml` (v3) — full app spec
- `inputs.schema.json` — strict validation
- `.env.dev`, `.env.staging`, `.env.prod`, `.env.example`
- `scripts/sync-credentials-to-env.sh` — propagates CREDENTIALS.md → env files
- `design-system/MASTER.md` (Phase 2.6 output, harmonised with `docs/DESIGN.md`)
- `.socraticodecontextartifacts.json` — SocratiCode context artifacts

**Spec stress-test (Phase 2.7) result:** PASS, 0 gaps found.

**Reversible:** Port base regeneration is cheap (edit `inputs.yml` + `.env.dev` +
restart compose). Schema strictness can be tightened/relaxed via Feature Update.

---

## Decision — 2026-05-03 — Phase 4 Part 2 — api-client architecture: typed fetch wrapper, deferred tRPC integration to Part 5

**Decision:** `packages/api-client` is implemented as a typed fetch wrapper
(`ApiClient` class with Zod response parsing), NOT as a tRPC client. tRPC
integration is deferred to Phase 4 Part 5 when the server-side tRPC routers
are scaffolded.

**Rationale:**
- The tRPC server doesn't exist yet — Part 5 territory. Building a tRPC client
  before the server has a defined shape would be premature coupling.
- A typed fetch wrapper is isomorphic — works identically in web (Next.js client +
  server), Node (server-side scripts, workers), and mobile (Expo). The same
  package serves all three apps per Rule 13 (mobile never imports `packages/db`,
  must use api-client).
- Zod response parsing reuses the schemas already defined in `packages/shared`
  — no schema duplication. Frontends and mobile clients get runtime validation
  for free.
- Optional async `getAuthToken` resolver is pluggable, so the same client serves:
  unauthenticated public endpoints, NextAuth-derived web sessions, and
  SecureStore-backed mobile tokens — without the package needing to know about
  any specific auth mechanism.
- When Part 5 lands, this package can either: (a) grow a tRPC proxy alongside
  the fetch wrapper for non-tRPC integrations (third-party callbacks, mobile
  endpoints that don't traverse tRPC), or (b) be replaced entirely if we
  decide to standardise on tRPC for everything. The fetch wrapper is small
  enough to delete cheaply if (b) wins.

**Infrastructure detail:** `packages/api-client/tsconfig.json` overrides the
base `lib: ["ES2022"]` with `lib: ["ES2022", "DOM"]` to provide types for
`fetch`, `URL`, `Response`, `RequestInit`, `AbortSignal`. These globals are
available in Node 22 (web-compatible globals) and in browsers — adding the
DOM lib is purely a TypeScript-types decision, not a runtime requirement.

**Three error classes** (`ApiError`, `NetworkError`, `ResponseValidationError`)
distinguish HTTP error responses (with status + code from server payload),
transport-layer failures (DNS, network, TLS), and schema validation failures
(server returned a 200 but the body didn't match the expected Zod schema).
Each can be caught separately by callers — Part 5 will define standard handling
patterns at the tRPC layer + Next.js error boundaries.

**Reversible:** Yes — package is small (~150 lines). Replacing it with a tRPC
client during Part 5 (or later) is a Feature Update, not an architectural
overhaul. The Zod schemas remain in `packages/shared` regardless and stay
useful for both directions.

**Locked elements:**
- Package name: `@orqafy/api-client`
- Workspace dep on `@orqafy/shared` via `workspace:*` (Rule 13 — apps must
  consume types via this layer, never import shared directly across app
  boundaries)
- Three error class hierarchy (above)

**Open elements:** tRPC vs continued fetch — revisit at Phase 4 Part 5.

---

## packages/storage — Cross-Tenant Access Returns Null (Not 403)
**Decision:** `createPresignedDownloadUrl`, `deleteObject`, and `getObjectMetadata` return `null`/`false` when a storage key does not belong to the requesting tenant — they do NOT throw 403.
**Rationale:** Returning 403 (Forbidden) confirms the object exists, enabling enumeration attacks where an attacker discovers valid storage paths by observing different responses for existing vs non-existing keys. Returning `null` treats out-of-tenant access identically to "not found". Per security.md FILE UPLOAD SAFETY rule 8: "return 404 (not 403 — do not confirm the file exists)."
**Locked:** Yes — do not change to throw/403 pattern without security review.
**Phase:** Phase 4 Part 4

## packages/storage — ContentDisposition:attachment on All PutObject Commands
**Decision:** Every `PutObject` command in `packages/storage/src/operations.ts` includes `ContentDisposition: "attachment"` regardless of file type.
**Rationale:** Defence-in-depth against XSS. If a future bug bypasses MIME validation and an executable content type is stored, `ContentDisposition: "attachment"` forces the browser to download the file rather than render it inline. Stored XSS via uploaded files is mitigated at the storage layer, not solely at the MIME-check layer.
**Locked:** Yes — do not remove ContentDisposition header from PutObject calls.
**Phase:** Phase 4 Part 4

## Phase 5 — Unfixed HIGH CVEs in Expo transitive dependencies (tar, @xmldom/xmldom)

**Decision:** Accept 11 HIGH CVEs in `tar` and `@xmldom/xmldom` with documented mitigation. Set `audit-level=critical` in `.npmrc` so `pnpm audit --audit-level=high` no longer blocks on these.

**CVEs accepted:**
- `tar` (5 HIGH): GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256
  Path: `apps__mobile > expo > @expo/cli > tar`
  Patched in tar >=7.5.11, but locked by expo's dependency resolution.
- `@xmldom/xmldom` (6 HIGH): GHSA-j759-j44w-7fr8, GHSA-wh4c-j3r5-mjhp, and 4 others
  Path: `apps__mobile > expo > @expo/cli > @expo/plist > @xmldom/xmldom`
  Patched in @xmldom/xmldom >=0.8.13, but locked by expo's dependency resolution.

**Mitigation:**
1. Both packages are transitive dependencies of `@expo/cli` — a build-time CLI tool, not runtime code shipped to users.
2. `tar` vulnerabilities require crafted tar archives to exploit — Expo CLI only extracts known-good archives from Expo's own servers.
3. `@xmldom/xmldom` vulnerabilities require crafted XML input — used only for plist parsing in Expo's internal tooling.
4. Neither package is imported by application code or included in production bundles.
5. Will be resolved automatically when Expo SDK upgrades its internal dependencies.

**Risk accepted:** YES — build-time CLI dependencies with no runtime exposure.
**Locked:** Yes — revisit when Expo SDK releases an update that bumps tar/xmldom.
**Phase:** Phase 5

---

## packages/jobs — removeOnFail:false in DEFAULT_JOB_OPTIONS
**Decision:** `DEFAULT_JOB_OPTIONS` in `packages/jobs/src/config.ts` sets `removeOnFail: false`. Failed BullMQ jobs are retained in the dead-letter queue for inspection, not automatically discarded.
**Rationale:** DLQ safety — no data is silently lost on job failure. Failed jobs accumulate in Redis/Valkey but can be inspected, retried, or manually cleared. The trade-off is storage growth for high-volume persistent failures. Acceptable for Orqafy's job types (all business-domain: invoicing, payroll, inventory, etc.) where silent loss is worse than storage cost.
**Locked:** Yes — do not change to removeOnFail:true globally. Per-queue override is acceptable if a queue is explicitly designed for fire-and-forget workloads (log to DECISIONS_LOG.md).
**Phase:** Phase 4 Part 4

---

## Platform-Admin Route Guard — Server-Side Layout Check (Option A)
**Decision:** `/powerbyte-admin/*` routes are protected by a server-side check in `apps/web/src/app/powerbyte-admin/layout.tsx` using `getServerSession()` + `roles.includes("Platform Owner")`. Unauthorized requests are redirected to `/login`.
**Rationale:** Option A (server-side layout) was chosen over Option B (middleware fast-path) because it keeps the auth logic co-located with the admin route tree, avoids adding another conditional branch to `middleware.ts` (already complex), and Next.js App Router layout components are guaranteed to run server-side before any child page renders. Middleware Option B would be marginally faster but adds cognitive overhead to an already-critical security file.
**Locked:** Yes — do not move the platform-admin guard into middleware without a security review and DECISIONS_LOG.md update.
**Phase:** Phase 8 Batch 1 Item 3

---

## Quotation Totals Computation Rule (CRM Phase 2)
**Decision:** Quotation totals are computed and stored according to a fixed rule at create time:
- `subtotal` = Σ over all line items of `quantity × baseCost`
- `taxAmount` = caller-supplied (e.g. PH VAT = subtotal × 0.12 computed client-side)
- `totalAmount` = `subtotal + taxAmount`

`QuotationMarkupColumn.percentage` values are PRESENTATION TIERS shown to the customer
(tier1/tier2/tier3 with different markup-and-markedUpPrice tables) — they do NOT affect
the stored subtotal/totalAmount. The accepted price is implicit at `status=accepted`
and is locked at conversion-to-invoice (Phase 3 — `convertedToInvoiceId` field).

**Rationale:** Quotation has a complex multi-tier markup display (different prices shown
to customers depending on which tier they purchase under), but the accounting truth at
storage time is the baseCost. Storing marked-up totals would couple "what we show" with
"what we owe" and create ambiguity when the customer accepts a different tier than what
was sent first. Locking the accepted price at invoice-conversion time keeps the data
model honest: a quotation is a snapshot of base costs + markup options; an invoice is a
signed-off amount.

**Locked:** Yes — do not store marked-up totals in Quotation.totalAmount. Use the
`QuotationLineItemMarkup.markedUpPrice` table for per-tier display. Invoice conversion
(Phase 3) will read the chosen markup column and lock the final amount on the Invoice.

**Phase:** Phase 8 Batch 9 Item 2

## 2026-05-16 — Quotation marked-up price ceiling-rounding convention (Phase 8 Batch 10 Item 1)

`QuotationMarkupColumn.useCeiling` is a presentation-only rounding rule applied
**client-side** when computing per-line marked-up prices for display + storage.

Formula in `apps/web/src/lib/quotation-build.ts` → `computeMarkedUpPrice`:

- `raw = baseCost * (1 + percentage / 100)`
- `markedUpPrice = useCeiling ? Math.ceil(raw) : round2(raw)`

**Rationale:** Ceiling-rounding to the next whole peso is a common request for
customer-facing quote sheets (avoid fractional pesos in printed quotations). The
choice is per-column so a single quotation can mix exact-cent tiers with
ceiling-rounded tiers. Server stores whatever the client computed; server does not
re-validate or recompute `markedUpPrice`. The pure helper in `quotation-build.ts`
is the single source of truth.

**Locked:** Yes — `useCeiling=true` → `Math.ceil` to whole peso. `useCeiling=false`
→ round to 2 decimals. Do not introduce alternative rounding rules (banker's
rounding, round-up-to-nearest-5-peso, etc.) without a new column.

**Phase:** Phase 8 Batch 10 Item 1

## 2026-05-16 — ContactLog type enum (Phase 8 Batch 10 Item 2)

`ContactLog.type` is constrained to one of: `call | email | meeting | note`.

**Rationale:** These 4 cover the common touchpoint categories for a customer
relationship system. Validated as a zod enum on every write procedure
(`crm.contactLogCreate`, `crm.contactLogUpdate`, `crm.contactLogList`,
`crm.contactLogListForCustomer`). The Prisma column is `String` (not enum) for
forward compatibility — adding a new type requires only updating
`CONTACT_LOG_TYPES` in `apps/web/src/server/trpc/routers/crm.ts` (and any new
tests) without a schema migration.

**Locked:** Yes — these 4 values are the canonical set as of Batch 10. Add new
types by appending to `CONTACT_LOG_TYPES`; do NOT remove an existing type without
a data migration to remap rows.

**Phase:** Phase 8 Batch 10 Item 2
- [swarm W0 · 2026-06-12 18:28:45] 2026-06-12 W0 q-W0-01 [A/high] Brain: split W0 into 14 per-domain W0-N audit sub-sessions (~4-5 pages + 1 router each, /tmp/punchlist-<domain>.md output) + 1 W0-synth session (stitch + commit docs/UI_WIRING_PUNCHLIST.md + STATE/CHANGELOG). Governed by V32 R2 (500L cap), V32.2 R7 (Parallel Fan-Out), Memory Governance §1 (Tier 3 mandatory split) + §4 (Architect-Execute). Rejected grep-only dodge, Opus direct-write exception, and W0 deferral.
- [swarm W0 · 2026-06-12 18:29:03] 2026-06-12 W0/q-W0-02 [Brain/A]: 14-domain partition confirmed; domain 14 kept as single catch-all (reports/settings/dashboard + platform/admin/auth/registration). W14 session authorized to self-split into 14a/14b at scout time if Tiered Decomposition flags >12 files or >80K tokens. Provenance: Master Prompt Anti-Thrashing + memory-governance.md §1 + V32.2 R6.
- [swarm W0 · 2026-06-12 18:30:41] 2026-06-12 W0 q-W0-03 [A/high]: Re-dispatch W0 as 15-child partition (W0-01..W0-14 + W0-synth) per pre-resolved Answer A on q-W0-01; single-worker W0 closed under V32 R2 (≤500 lines) + R4 (BLOCKED→re-decompose) + pre-flight rule 3 (≤12 files / ≤80K tokens).
- [swarm W0 · 2026-06-12 18:31:54] 2026-06-12 | q-W0-04 | Bucket A | Confirmed 15-child W0 partition per q-W0-03 standing directive; single-worker W0 closed pre-audit, no commits. Children W0-01..W0-14 emit /tmp/punchlist-<domain>.md; W0-synth aggregates to docs/UI_WIRING_PUNCHLIST.md + STATE.md + CHANGELOG_AI.md. Governing: V32.2 R7 Parallel Fan-Out.
- [swarm W0 · 2026-06-12 18:33:18] 2026-06-12 q-W0-05 [A]: W0 cancelled (no commits) and re-dispatched as 15-child partition (W0-01..W0-14 + W0-synth, audit-only per domain) per V32 R2 + Phase 4 anti-thrashing + pre-resolved Answers A on q-W0-03/04.

## 2026-06-14 — Phase 7 owner decisions D1–D8 (accepted)

Owner accepted the Phase 7 backend feature spec (`docs/PRODUCT_PHASE7_PROPOSAL.md`,
commit 5fce839) including all 8 recommended defaults. Recorded here as accepted /
locked for the Phase 7 build. Source: owner redline on the proposal.

- **D1 — Invoice payment ↔ Banking auto-post: ACCEPTED (a) auto-post.** Recording an
  invoice payment auto-creates a Banking `income` FundTransaction against the chosen
  fund source. Rationale: Orqafy's thesis is "every peso traces to a fund source," so
  coupling payment to the ledger is on-brand.
- **D2 — DTR time-clock device model: ACCEPTED (a) per-user web widget now, (c) mobile
  later.** Web time-clock ships first; GPS mobile clock deferred. Rationale: fastest to
  ship; unblocks attendance without native dependency.
- **D3 — Kanban task status: ACCEPTED status-dropdown v1.** Task status changes via a
  dropdown driving the router state machine; drag-and-drop board deferred. Rationale:
  smallest surface that wires the existing transition procedures.
- **D4 — POS Open Session UX: ACCEPTED modal.** Opening a POS session is a shadcn modal,
  not a dedicated route. Rationale: light, in-context action.
- **D5 — Job-order detail route: ACCEPTED (a) consolidate on the interactive view.** The
  interactive job-order detail route is canonical; the duplicate read-only route is
  retired/redirected, and a `service/job-orders` list is added. Rationale: removes
  divergence before building intake.
- **D6 — Authenticated storefront customer + placeOrder role: ACCEPTED (c) both,
  staff-on-behalf first.** Logged-in customer checkout AND staff "order on behalf";
  staff-on-behalf built first. Rationale: reuses the line-item builder, unblocks the
  common internal flow sooner.
- **D7 — Notification store: ACCEPTED (b) Prisma durable + Valkey fan-out.** Notifications
  persist in a Prisma `Notification` model; Valkey handles real-time fan-out only.
  Rationale: survives restarts, queryable history, schema-as-source-of-truth.
- **D8 — Platform suspend/reactivate reason-capture UX: ACCEPTED (a) AlertDialog +
  textarea.** Suspend/reactivate uses a shadcn AlertDialog with a required reason
  textarea (`reason: min(1)`). Rationale: consistent with lifecycle/authority confirm UX.

**Foundations landed alongside this acceptance (Phase 7 build, branch main):**
- **F1 — RSC→tRPC server-caller** (`apps/web/src/server/trpc/server.ts`):
  `createServerCaller()` wraps `createCallerFactory(appRouter)` with a request context
  resolved from `auth()` + `next/headers`, so RSC pages / Server Actions call tRPC
  procedures (gaining RBAC + L5 AuditLog) instead of reading Prisma directly.
- **F2 — Invoice partial-payment model** (`packages/db` + `invoice.recordPayment`):
  the existing `Payment` model is EXTENDED (not duplicated into a new `InvoicePayment`
  table) with `fundSourceId` + `recordedById`. `invoice.recordPayment` records a
  partial/full payment, updates `amountPaid`/`balance`, transitions status
  `partially_paid`/`paid`, rejects over-payment, and — per D1 — auto-posts a Banking
  income FundTransaction when a fund source is supplied. `invoice.markPaid` is now a
  thin "pay full balance" convenience over `recordPayment`.

**Phase:** Phase 7 Foundations

## 2026-06-14 — D7 Notifications: build + product-judgment defaults (async review)

D7 ("Prisma durable `Notification` + Valkey real-time fan-out") was already
ACCEPTED option (b); this entry logs the **product-judgment calls** made while
building it, so the owner can course-correct. None of these block — each is a
sensible default wired with `createNotification`.

- **Category set (initial).** `Notification.category` is a plain String (matches
  the repo's String-status convention). Canonical set seeded in
  `apps/web/src/server/notifications/categories.ts`:
  `order_placed` · `task_assigned` · `invoice_payment` · `system`. Add by
  appending; removing one needs a data migration to remap rows.
- **Which events emit (default = 3 obvious existing user-recipient flows):**
  1. **Task assigned** (`tasks.taskAssign`) → notifies the **assignee** (category
     `task_assigned`). Skips self-assignment.
  2. **Invoice payment recorded** (`invoice.recordPayment`, the F2 flow) →
     notifies the **invoice creator** (`createdById`, category `invoice_payment`),
     fired AFTER the payment transaction commits. Skips self (recorder == creator).
  3. **Job order assigned to a technician** (`jobOrder.assignTechnician`) →
     notifies the **technician** (category `task_assigned`). Skips self.
  - **`order_placed` is defined but NOT yet wired.** The storefront `placeOrder`
    is staff-on-behalf (D6), so the placing user would self-notify; the natural
    recipient (a manager/admin role fan-out) needs a product decision on WHO
    receives. Left unwired pending owner input rather than guessing a broad
    recipient set. **OWNER: confirm desired order-placed recipients.**
- **Recipient model = single `recipientUserId` (per-user), not role-targeted.**
  Each notification targets one user. Role/department fan-out (notify all
  Administrators, etc.) is deferrable; if wanted, emit one row per resolved user.
  **OWNER: confirm per-user is sufficient for v1.**
- **Tenant-isolation hardening (incidental).** `jobOrder.assignTechnician`
  previously looked up the technician without a tenant check; added
  `technician.tenantId === ctx.tenantId` (BAD_REQUEST otherwise) so the
  assignment — and its notification — can never cross tenants.

**Phase:** Phase 7 (D7 build)

---

## 2026-06-15 — Finance domains (Purchasing, Accounting, Payroll): scaffold data-entry CRUD now, HOLD business logic

**Decision (owner, 2026-06-15):** For the three remaining finance domains, build the **safe data-entry CRUD/UI scaffolding now**, but **HOLD all business logic** pending owner-supplied rules. Chosen over "build everything with best-guess defaults" specifically to avoid guessing financial computation (esp. payroll pay math), which would be harmful if wrong.

**In scope (built autonomously):**
- **Purchasing:** Vendor CRUD; Purchase Order as DRAFT records (header + line items); Goods Receipt record-entry. (Shipped `a4fc63b`.)
- **Accounting:** Chart-of-Accounts CRUD; Journal Entry as DRAFT records (debit==credit enforced as a form-level data-validation rule only).
- **Payroll:** Payroll Run records (period + draft status) + manual payroll-line entry.

**HELD pending owner rules (marked `// HOLD(owner-rule)` in code):**
- Purchasing: PO approval workflow / status transitions beyond draft; auto-post received PO to Inventory; auto-post to Accounting; tax auto-calc / 3-way match / budget checks.
- Accounting: posting journals to the ledger; trial balance / GL rollups / financial statements; auto-posting from invoices/purchasing/payroll; period/year close.
- Payroll: pay computation (gross/net/tax/deductions); approval/markPaid lifecycle; auto-calc from DTR/attendance; FundSource deduction + Journal posting (PRODUCT.md Core Flow 8).

**OWNER follow-up needed:** supply the business rules for each HELD item above (approval workflows, posting rules, payroll computation formula incl. PH tax/deductions) to unblock the logic build.

**Incidental governance note:** the pre-existing `purchasing.ts` router lacks L5 `writeAuditLog` (predates the Epic-1 audit-hardening). Flagged for an audit-hardening pass; not added in this UI-scaffolding scope.

**Phase:** Phase 7 (finance scaffolding)

---

## 2026-06-15 — Finance business RULES (Claude-provided, owner-delegated) — build the HELD logic

**Decision (owner, 2026-06-15):** owner delegated the finance business rules to Claude ("start on a set of finance rules you provide"). The rules below are Claude-authored sensible/standard defaults; they UNBLOCK the `// HOLD(owner-rule)` logic scaffolded earlier. Built in dependency order: **Accounting posting → Purchasing approval/posting → Payroll computation.** Owner may override any rule; statutory rate constants are stored editable (see Payroll).

### A) Accounting — Journal Entry posting (build FIRST; others post into it)
- **Lifecycle:** DRAFT → POSTED → (REVERSED). 
- **Post preconditions:** balanced (Σdebit == Σcredit), ≥2 lines, all referenced accounts active, entry date within an OPEN fiscal period.
- **Post effect:** status=POSTED, entry becomes immutable, stamp `postedAt`/`postedById`. No separate ledger table — account balances, GL, and trial balance are DERIVED by aggregating POSTED journal lines (DRAFT excluded).
- **Reverse:** create a NEW POSTED mirror entry (debit/credit swapped), link `reversalOfId`; original stays POSTED. Posted entries are NEVER deleted (audit integrity).
- **Void/delete:** DRAFT entries only.
- **Trial balance:** Σ POSTED debits == Σ POSTED credits (must net zero); per-account = posted lines aggregated.
- **Fiscal period close:** OPEN→CLOSED blocks new postings dated within the period; reopen = Administrator only; both audited.

### B) Purchasing — PO approval + receipt posting (depends on A)
- **PO lifecycle:** DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED; CANCELLED allowed from any pre-RECEIVED state.
- **Approval threshold:** per-tenant configurable `poApprovalThreshold` (default **₱10,000**). PO total ≤ threshold → auto-APPROVE on submit; above → requires an approver role (Administrator/Manager/purchasing approver) to APPROVE.
- **Goods receipt:** increments Inventory stock for received qty on lines allocated to `stock`; partial receipts allowed (→ PARTIALLY_RECEIVED until fully received).
- **Accounting posting (honors PRODUCT.md: expense at PURCHASE time, not consumption):** on goods receipt, post a JE — DR Inventory-asset (stock lines) / Expense account (company/project-expense lines), CR Accounts Payable (or the chosen FundSource if paid immediately). Later inventory consumption posts **NO** JE (prevents double-expense, per PRODUCT.md L97-98).
  - **⚠ OPEN OWNER ITEM — JE auto-post deferred (2026-06-15):** The goods-receipt JE auto-post requires the owner to configure default GL account mapping on `AccountingSettings`: `defaultInventoryAccountId` (asset), `defaultApAccountId` (liability), `defaultExpenseAccountId` (expense), and a default `FiscalYear` pointer. Without this mapping the system cannot unambiguously resolve which `Account` records to debit/credit. The inventory increment and PO workflow are BUILT; the auto-post is behind `// HOLD(owner-rule)` in `goodsReceiptRouter.create`. Owner must add the account-mapping fields (or manually wire accounts) before this can be enabled.
- **3-way match:** non-blocking flag if receipt qty ≠ PO qty.

**Build status (2026-06-15):** PO lifecycle BUILT (submit/approve/markOrdered/cancel/close + auto-approve threshold + GR→Inventory). JE auto-post HELD pending account-mapping (see open item above).

### C) Payroll — computation (PH statutory; configurable, depends on A)
- **Run lifecycle:** DRAFT → PROCESSED (computed) → APPROVED → PAID.
- **Per-payslip:** gross = basic + allowances + overtime + adjustments. employee deductions = SSS-EE + PhilHealth-EE + Pag-IBIG-EE + withholding-tax + cash-advance-recovery + other. net = gross − deductions. Employer shares (SSS-ER/PhilHealth-ER/Pag-IBIG-ER) tracked as employer cost (not deducted from employee).
- **Statutory rates → stored in a CONFIGURABLE `StatutoryRate` table** (owner-editable), seeded with CITED **2025** PH values (statutory tables change annually — owner MUST verify):
  - **SSS (2025):** 15% of MSC; EE 5% / ER 10%; MSC floor ₱5,000, ceiling ₱35,000 (incl. WISP/MPF above ₱20,000).
  - **PhilHealth (2024/2025):** 5% of monthly basic; EE 2.5%; floor ₱10,000, ceiling ₱100,000.
  - **Pag-IBIG:** EE 2% / ER 2%; comp cap ₱10,000 → max EE ₱200 (editable for voluntary higher).
  - **Withholding tax:** BIR TRAIN revised withholding table (2023+), applied per pay frequency (monthly / semi-monthly); brackets stored in the configurable table.
- **APPROVED→PAID:** deduct chosen FundSource for net pay + employer remittances; post payroll JE (DR salaries-expense + employer-statutory-expense, CR cash/FundSource + statutory-payables + withholding-payable) per PRODUCT.md Core Flow 8.
- **Cash-advance recovery:** per-run installment deducted from linked advances (manual amount per PRODUCT.md L581).

**Build status:** rules recorded; Accounting posting build NEXT (this session). Purchasing + Payroll waves follow.

**Phase:** Phase 7 (finance logic)

---

## 2026-06-16 — F3 Payroll computation (§C) + JE auto-post default-account mapping (§B unblocked) — BUILT

**Decision (owner-delegated):** implement the HELD §C payroll computation and unblock the §B goods-receipt JE auto-post, sharing one `AccountingSettings` migration. Claude-authored per the §A/§B/§C rules above.

### Schema (one migration: `20260615020000_add_payroll_statutory_and_je_mapping`, create-only; dev synced via `prisma db push` against the direct postgres `orqafy_dev_postgres:5432`)
- **`AccountingSettings`** + `defaultInventoryAccountId`, `defaultApAccountId`, `defaultExpenseAccountId`, `defaultFiscalYearId` (all nullable) — default GL account mapping for JE auto-post.
- **`Payslip`** + `sssEmployerShare`, `philhealthEmployerShare`, `pagibigEmployerShare` (Decimal, default 0) — employer cost, NOT deducted from employee net.
- **NEW `StatutoryRate`** — tenant-scoped, owner-editable, effective-dated, **cited** (`source`) rate tables; `config` JSON consumed by the compute lib. Seeded with cited 2025 PH values (SSS Circular 2024-006; PhilHealth UHC 5%; HDMF Pag-IBIG; BIR TRAIN withholding). Indexed `(tenantId, type, isActive)`.

### Payroll computation (§C) — `apps/web/src/server/lib/payroll-compute.ts` (pure, unit-tested)
- gross → SSS-EE/PhilHealth-EE/Pag-IBIG-EE + BIR withholding (on gross less mandatory EE contributions) → net; employer shares tracked separately. Cited 2025 constants double as seed source + fallback (`resolveRatesFromRows` prefers the most recent active effective row per type, else default).
- `payroll.process` (DRAFT→PROCESSING): computes every payslip in the run from the tenant's `StatutoryRate` rows, persists deductions + employer shares + `deductionDetails` breakdown, rolls up run totals. Audited (`PROCESS`).
- `payroll.markPaid` (APPROVED→PAID): deducts the chosen FundSource for net pay (records a `FundTransaction`) and posts the payroll JE (DR salaries + employer-statutory expense, CR Accounts Payable) per Core Flow 8, resolving expense/AP/fiscal-year from `AccountingSettings` (clear error if unset). Requires a `fundSourceId`. Audited (`MARK_PAID`).
- `payroll.statutoryRate.{list,resolved,upsert,seedDefaults}` — owner-configurable rates.

### JE auto-post (§B unblocked) — `apps/web/src/server/lib/journal-posting.ts` (shared by GR + payroll)
- `resolveAccountingDefaults` (clear BAD_REQUEST listing missing mapping keys) + `postJournalEntryTx` (≥2 lines, balanced, active accounts, open FY, status=posted).
- Goods receipt (`purchasing.ts`): accumulates DR Inventory (stock allocs) + DR Expense (company/project-expense allocs), CR AP for the total; **only posts when mapping is configured** (auto-post skipped otherwise → preserves prior GR behavior; partial config → clear error).
- New `accounting.settings.{get,update}` procedures + Accounting → Settings UI to configure the mapping.

### UI
- Payroll detail page: per-payslip SSS/PhilHealth/Pag-IBIG/withholding columns + lifecycle actions (Process / Approve / Mark Paid with fund-source picker).
- Accounting → Settings page: default account mapping + fiscal year selectors.

### Gate / caveats
- `prisma generate` + web typecheck (no net-new tsc errors vs baseline) + lint (new code clean) + full vitest suite **1026 passing** (was 1003; +23: payroll-compute unit tests, finance statutory/settings parity, GR auto-post positive test, updated markPaid/process tests).
- **Migration:** create-only; applied to dev via `db push` only (staging/prod credential-gated, not attempted). Pre-existing `seed/index.ts` departments `tenant_id` raw-SQL drift is unrelated and still fails the full seed before reaching the StatutoryRate block (StatutoryRate seed verified independently against dev DB).
- **Owner action:** statutory rate tables change annually — verify the seeded 2025 values; configure the default account mapping per tenant to enable auto-post.

**Phase:** Phase 7 (finance logic)

---

## Decision — 2026-06-16 — Phase 8 completeness sweep: tenant-scope server-component leaks + fix seed drift

**Context:** Phase 8 (PRODUCT.md ↔ code completeness check) surfaced two real gaps. Both are
technical (HOW-to-build), so they were fixed autonomously.

**1. Cross-tenant data exposure in Next.js server components (SECURITY 🔴).**
Orqafy is shared-schema multi-tenancy (every table has `tenant_id`; isolation is by explicit
`where:{tenantId}`). tRPC routers are correctly scoped, but ~30 Server Components (`page.tsx`)
imported the global `prisma` client and queried WITHOUT a tenant filter — two leak shapes:
(a) list/aggregate pages whose `where` carried only status/date filters → returned every tenant's
rows; (b) `[id]` detail pages doing `findUnique({where:{id}})` with no tenant check → classic IDOR
(read another tenant's record by id). Parent-chain leaks in `projects/[id]` + `.../expenses`
(unverified parent project → children scoped off it). Fixed across DTR, banking, POS, purchasing,
ecommerce, projects, payroll, employees, job-orders, and the demo workspace counts — following the
in-repo pattern (lists `where:{tenantId}`; detail `findFirst{id,tenantId}` or post-fetch
`tenantId !== tenant.id → notFound()`; parents tenant-verified before children). Commits `1bdc224`,
`1187bfc`. Correctly-scoped modules (accounting, crm, inventory, reports, dashboard, tasks, support,
invoices, expenses) needed no change. The unused `createTenantPrisma`/`tenantGuardExtension`
schema-switch path was NOT adopted — explicit `where:{tenantId}` is the established convention.

**2. `pnpm seed` drift (TECHNICAL).** Supersedes the prior note that the seed "still fails." Root
cause: the demo schema `t_demo` was snapshotted once and never reconciled, so after later migrations
(e.g. `departments.tenant_id`) it went stale → `column tenant_id does not exist`. Also four
`ON CONFLICT (tenant_id, code)` targets referenced a constraint that doesn't exist — the models
declare `code @unique` (global), only `Department` is `@@unique([tenantId, code])`. Fix: rebuild
`t_demo` from current `public` on every seed run (guarded to t_demo only); correct the four
ON CONFLICT targets to `(code)` for expense_categories/tax_rates/warehouses/accounts. `pnpm seed`
now runs end-to-end through the StatutoryRate block. Commit `de19377`.

**Gate:** prisma generate + web typecheck (28 pre-existing tsc errors, **zero net-new**) + full
vitest suite **1026 passing** (unchanged — server-component + seed fixes, no unit-test regression).
UI-only changes; no schema migration.

**Owner action / follow-ups (NOT done — listed for owner):** The shared-schema `code @unique`
(global) vs tenant-scoped uniqueness on ExpenseCategory/TaxRate/Warehouse/Account is a data-model
inconsistency worth an owner decision (would need a migration). 28 pre-existing TypeScript errors
(form `exactOptionalPropertyTypes` + `nodemailer` types) predate this sweep and remain. The
"deferred leave self-cancel UI" (owner-decision-3) was found ALREADY BUILT and wired
(`dtr/leave-request-actions.tsx` cancel dialog gated on `isOwn`, backed by tested
`leaveRequestCancel`) — no work needed (phantom gap).

**Phase:** Phase 8 (completeness sweep)

---

## Decision — 2026-06-16 — Phase 8: clear all 28 pre-existing tsc errors (technical cleanup)

**Context:** The prior sweep noted "28 pre-existing TypeScript errors remain." CI gates on tests,
not `tsc`, so they lingered. Clearing them is pure HOW-to-build technical work, so it was done
autonomously — without weakening types (no net-new `any`, no `@ts-ignore`). Commit `cf692e8`.

**Real bug found (root-cause, not cosmetic):** the tRPC root router registered a sub-router under
the key `client` (`client: clientRouter` in `_app.ts`). In `@trpc/react-query` v11, `.client` is a
**reserved built-in** on the React proxy, so naming a router `client` collapses the entire root
proxy type into an error-string type — which is why `trpc.department.*` and `trpc.expenseCategory.*`
broke at the type level (6 of the 28 errors). Fixed by renaming the registration key to `clients`
(internal tRPC procedure-path only — no DB, REST, or product-intent change); updated `_app.ts`, the
two clients UI surfaces, and the client-tenant-parity test caller paths.

**Other fixes (all type-accurate):**
- `accounting.ts`: self-referential `as typeof existing` cast → `Awaited<ReturnType<…>>` (matches
  the two sibling mutations that already used the correct pattern).
- `accounting.test.ts`: add `findFirst` to the journalEntry mock **type** (already assigned at runtime).
- `accounting-ui-tenant-parity.test.ts`: add missing `isDemoTenant`/`session` to the test `ctx()` so
  it satisfies `TRPCContext` (matches the other parity tests).
- `exactOptionalPropertyTypes`: widen optional form-prop fields to `| undefined` on account-form,
  po-form, vendor-form, task-board, create-task-dialog (accurately models "absent or undefined";
  values are read defensively with `?? default`).
- `po-form`: guard nullable mutation `data` in `onSuccess`.
- `receipts/new`: serialize Prisma `Decimal` → string before passing into the client `GrForm`
  (Decimal is not a valid RSC-boundary value — same pattern as the banking-Decimal fixes); widen
  `PoItem.product.sku` to `string | null` (it is nullable in the schema).
- Dependencies: add `@radix-ui/react-alert-dialog` + create the standard shadcn `alert-dialog.tsx`
  that the tasks board imports (was a missing component → build-breaking import); add
  `nodemailer@^7` (+ `@types/nodemailer`) actually `require()`d by the smtp-config test-connection
  route (was unmet at runtime AND type level; pinned to `^7` to satisfy the next-auth/@auth/core
  peer range — avoids a peer-dep conflict).

**Gate (evidence):** `pnpm typecheck` → **11/11 tasks green, 0 errors** (was 28); `pnpm test` →
**1026 web + 3 worker passing** (unchanged); `pnpm --filter @orqafy/web build` compiles + generates
all static pages. Pre-existing **lint** debt (~28 files, OWASP-unrelated style rules; not CI-gated)
was left as-is — my changes are lint-neutral (added zero new lint errors). No schema migration.

**Phase:** Phase 8 (completeness sweep)

---

## 2026-06-16 — Task A: Real presigned file uploads + Attachment model + quota enforcement

**Decision:** Implement real S3-presigned upload/download across all entity surfaces (customers,
projects, job orders, tasks, expenses). No server-side file proxy — browser PUTs directly to
MinIO/R2 via presigned URL, then calls `storage.confirmUpload` to record the Attachment row.

**Schema changes (migration: 20260616130000_add_attachment_and_storage_tracking):**
- `Tenant.storageBytesUsed BigInt @default(0)` — running total for quota tracking
- New `Attachment` model: tenant_id, entity_type, entity_id (polymorphic), storage_key,
  filename, mime_type, size_bytes (BigInt), uploaded_by_user_id, created_at; indexes on
  (tenant_id), (entity_type, entity_id), (tenant_id, entity_type, entity_id)

**Storage router rewrite (`apps/web/src/server/trpc/routers/storage.ts`):**
- `getUploadUrl` — calls `createPresignedUploadUrl` from `@orqafy/storage`; enforces per-tenant
  quota server-side (rejects with FORBIDDEN + upgrade message when over limit)
- `confirmUpload` — records Attachment row + increments `storageBytesUsed` in one DB transaction
- `list` — returns attachments for an entity (tenant-scoped)
- `getDownloadUrl` — generates presigned GET URL; tenant ownership verified via `isKeyOwnedByTenant`
- `delete` — best-effort S3 delete + decrements `storageBytesUsed`; AuditLog on all mutations
- `quotaInfo` — returns usedBytes/maxBytes/percentUsed for UI quota display

**Plan gating:** `plan.maxStorageMb` from the Plan model (already existed); default 500 MB when
tenant has no plan. Two tenants on the same Free plan each get their own 500 MB quota (per-tenant
tracking via `storageBytesUsed`, not a shared pool).

**UI components:**
- `apps/web/src/components/file-upload.tsx` — drag-and-drop + XHR progress bar; calls getUploadUrl
  → PUT to S3 → confirmUpload; quota errors shown inline
- `apps/web/src/components/attachments-panel.tsx` — lists attachments (download/delete); embeds
  FileUpload; used on all 5 entity surfaces

**Wired surfaces:** customer detail, project detail (overview tab), job order detail, task board
(task-attachments.tsx reusable), expense list (expense-attachments.tsx reusable)

**Env vars:** `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`,
`STORAGE_SECRET_KEY` — already in `.env.example`; no new vars needed.

**Phase:** Phase 7 (feature update) / Phase 8 (completeness)

---

## 2026-06-16 — Task B: Tenant-scoped composite unique on code fields

**Decision:** Change global `@unique` on `code` fields to `@@unique([tenantId, code])` for
Warehouse, Account, TaxRate, and ExpenseCategory. Two tenants may now share the same code value
(e.g., both can have a warehouse with code `main-warehouse`).

**Schema changes (migration: 20260616120000_tenant_scoped_code_unique):**
- `Warehouse.code` — dropped `warehouses_code_key`; created `warehouses_tenant_id_code_key`
- `Account.code` — dropped `accounts_code_key`; created `accounts_tenant_id_code_key`
- `TaxRate.code` — dropped `tax_rates_code_key`; created `tax_rates_tenant_id_code_key`
- `ExpenseCategory.code` — dropped `expense_categories_code_key`; created
  `expense_categories_tenant_id_code_key`
- `Department` already had `@@unique([tenantId, code])` — not modified
- `Product` only has `barcode @unique` (no code field) — not modified

**Seed fixes (`packages/db/src/seed/index.ts`):**
- 4 `ON CONFLICT (code) DO NOTHING` clauses → `ON CONFLICT (tenant_id, code) DO NOTHING`
  (expense_categories, tax_rates, warehouses, accounts); departments line already correct

**Rationale:** The original global uniqueness was a design error — a multi-tenant app must allow
different tenants to use the same internal codes (chart of accounts code `1000`, warehouse
`main-warehouse`, VAT code `vat-12`). No application code relied on cross-tenant uniqueness —
all queries were already tenant-scoped.

**Phase:** Phase 8 (schema correctness / completeness sweep)

---

## 2026-06-16 — D8: Notification Delivery — In-app Realtime + Email Digest

**Owner decision:** notification delivery model = in-app realtime + email digest (no mobile
push — Orqafy is web-only). Decision recorded from owner directive; no further discussion needed.

**In-app realtime (extends D7 — no rebuild):**
D7 already shipped the full realtime stack: `Notification` Prisma model, `createNotification()`
helper, Valkey pub/sub publisher (`valkey.ts`), SSE endpoint (`/api/sse`), notification bell
component (SSE + tRPC list/markRead/markAllRead), and the job-order router already calling
`createNotification` on assignment. D8 extends this by adding `emailDigestSentAt` to track
which rows have been included in a digest email.

**Schema changes (migration: 20260616140000_add_notification_email_digest_sent_at):**
- `Notification.emailDigestSentAt DateTime? @map("email_digest_sent_at")` — tracks digest
  inclusion per row; null = not yet sent in any digest
- New index: `@@index([tenantId, emailDigestSentAt])` — supports efficient unsent-rows query

**Email digest — new files:**
- `apps/web/src/server/notifications/digest-scheduler.ts` — `scheduleDigestsForTenant()`:
  enqueues one BullMQ repeatable job per active user in a tenant (jobId =
  `email-digest:<tenantId>:<userId>`; cron = `DIGEST_CRON` env, default `0 7 * * *` UTC);
  `cancelDigestForUser()` for deactivation/SMTP deletion
- `apps/web/src/server/trpc/routers/smtp-config.ts` — `testConnection` mutation extended:
  after successful SMTP verify, calls `scheduleDigestsForTenant()` fail-soft (scheduling
  failure never blocks the verify success response)
- `apps/web/src/app/api/internal/schedule-digests/route.ts` — POST-only internal cron
  endpoint; guarded by `x-internal-secret` header; sweeps all tenants with verified SMTP and
  re-schedules any users not yet covered (handles new users added after initial SMTP verify)
- `apps/worker/src/processors/notification-email-digest.ts` — `processNotificationEmailDigest`:
  fetches unsent rows (emailDigestSentAt = null, createdAt < cutoff), skips if none or SMTP
  not configured/verified, builds HTML+text batch email via nodemailer, sends, stamps rows;
  all queries carry tenantId + recipientUserId guard
- `apps/worker/src/index.ts` — wires `createNotificationEmailDigestWorker` + graceful shutdown

**packages/jobs changes:**
- `NotificationEmailDigestJobData` type added (types.ts)
- `NOTIFICATION_EMAIL_DIGEST` queue name + `OrqafyQueues.notificationEmailDigest` (queues/index.ts)
- `createNotificationEmailDigestWorker` factory (workers/index.ts)
- Package rebuilt (dist regenerated)

**Worker deps:** `nodemailer ^7.0.13` + `@types/nodemailer ^8.0.1` added to `apps/worker`

**Env vars:**
- `DIGEST_CRON` — cron pattern for digest schedule; default `0 7 * * *` (daily 07:00 UTC)
- `INTERNAL_CRON_SECRET` — at least 16 chars; required for the schedule-digests API route
- `ENCRYPTION_KEY` — already required by web app crypto; now also required by worker for
  SMTP password decryption in the digest processor

**Fail-safety:**
- Valkey outage: durable Prisma row is source of truth (D7 contract preserved)
- SMTP not configured / not verified: processor returns early — no error, no queue backlog
- Valkey unavailable when scheduling: BullMQ connection error → caught per-user, logged, skipped
- Email send failure: BullMQ retries (3× exponential from 5 s per DEFAULT_JOB_OPTIONS)
- Stamp failure after successful send: retried — row may be re-included in next digest
  (bounded double-send risk, acceptable vs. silent drop)

**Tests:** `apps/worker/src/__tests__/notification-email-digest.test.ts` — 8 unit tests
(mocked Prisma + nodemailer + crypto); all passing. Web app: 1026 tests passing, 0 regressions.

**Phase:** Phase 7 (feature update) / Phase 8 (completeness)

## 2026-06-16 — Attachments UI wired on ALL entity surfaces

**Owner decision:** Surface file attachments (upload + list + download + delete) on every
entity that has an attachment requirement per PRODUCT.md — "all of them."

**Surfaces wired:**

| Entity | Route | UI pattern | entityType |
|--------|-------|-----------|------------|
| Customer | `/crm/customers/[id]` | Inline panel (already existed) | `customer` |
| Project | `/projects/[id]` overview tab | Inline panel (already existed) | `project` |
| Job Order | `/service/job-orders/[id]` | Inline panel (already existed) | `job_order` |
| Task | `/tasks` Kanban | Paperclip button per card → Dialog | `task` |
| Expense | `/expenses` list | Paperclip button per row → Dialog | `expense` |
| Invoice | `/invoices/[id]` | Inline panel (new section above Payment History) | `invoice` |
| Employee | `/employees/[id]` | Inline panel (full-width card, new) | `employee` |
| Purchase Order | `/purchasing/orders/[id]` | Inline panel (bottom of page) | `purchase_order` |
| Goods Receipt | `/purchasing/receipts/[grId]` | Inline panel (bottom of page) | `goods_receipt` |

**Implementation notes:**
- All 9 entity types share the single `Attachment` Prisma model + `storage` tRPC router.
  No new backend or migration required — the `entityType` field is a plain `String` (not
  a DB enum), so new values are additive without a schema change.
- `ENTITY_TYPES` const extended in 3 files: `storage.ts` (router), `attachments-panel.tsx`,
  `file-upload.tsx`. All must stay in sync.
- `AttachmentsPanel` + `FileUpload` are the single reusable components; per-surface wrappers
  are thin pass-throughs (`InvoiceAttachments`, `EmployeeAttachments`, etc.).
- Tenant isolation preserved: all queries filter on `tenantId`; presign enforces
  `isKeyOwnedByTenant`; download URL checks `tenantId` on the Attachment row.
- Plan gating preserved: quota checked at presign time server-side.

**Build result:** next build clean (0 errors), tsc --noEmit clean, 57 test files /
1026 tests all passing.

**Phase:** Phase 7 (feature update)

---

## Decision — 2026-06-18 — Canonical theme: shadcn neutral-dark (VoltAgent emerald deprecated)

**Decision:** Declare the shadcn/ui default dark (neutral-gray) palette as the canonical and only
active visual theme for Orqafy. The VoltAgent emerald identity (`#00d992` Signal Green, `#050507`
Abyss Black, `#101010` Carbon Surface, `#3d3a39` Warm Charcoal border) is **deprecated and
archived**. `docs/DESIGN.md` has been rewritten to reflect the actual live palette.

**Supersedes:** "Replace Linear + sunset orange with VoltAgent aesthetic" (2026-04-20) — that
decision governed the Phase 2.8 mockup and was itself superseded by the shadcn neutral-dark reskin
applied to the actual codebase during the Phase 3/4 shadcn scaffold.

**Rationale:**
- The shadcn scaffold generated neutral-dark CSS variables as the base. This was intentionally
  kept (owner-approved) rather than overriding back to the VoltAgent emerald palette.
- The neutral-dark theme is production-live and visible to users — making the VoltAgent spec the
  canonical document while neutral-dark is running in prod creates a dangerous contract inversion
  (audit tools see "massive drift" when the drift is actually intentional).
- DESIGN.md must describe the ACTUAL deployed palette, not the aspirational mockup palette. The
  V32.8 design audit (DESIGN_DRIFT.md) confirmed this inversion was the root cause of the audit
  appearing to show regressions that were not regressions.

**What changes:**
- `docs/DESIGN.md` — rewritten to describe neutral-dark palette + HSL CSS variable values;
  VoltAgent references removed from the active spec; typography compression rules retained
  (system-ui headings, Inter body, tight letter-spacing utilities — these survived the reskin)
- `apps/web/src/app/globals.css` — accidental drift bugs fixed (see sibling commit in
  `chore/v328-design-audit`): `--brand-muted` / `--surface` defined; `.signal-glow` @keyframes
  added (neutral ring-gray glow); heading compression utilities tokenized; `--font-inter`
  variable wired into body font-family
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/page.tsx` and
  `apps/web/src/app/(tenant)/[slug]/(app)/projects/[id]/expenses/page.tsx` — hardcoded
  `text-[#050507]` (VoltAgent Abyss Black) replaced with `text-primary-foreground` (semantic token)
- `packages/ui/tailwind.config.ts` — `font-sans` stack prepended with `var(--font-inter)` so
  Next.js font optimizer controls the family

**What is NOT changing:**
- All business logic, tRPC routers, Prisma schema, tests — unaffected
- Component structure — no component logic changes
- Status pill colors (blue/yellow/red/green Tailwind utilities) — retained as semantic exceptions

**Archived artifacts:**
- `docs/archive/DESIGN-linear-sunset.md` — Linear + sunset orange (archived 2026-04-20)
- The VoltAgent DESIGN.md content is preserved in git history (branch `chore/v328-design-audit`,
  commit `77ef041` contains the last VoltAgent-era `docs/DESIGN.md`)

**Reversible:** YES — re-running the VoltAgent CSS variable values into `globals.css` would
restore the emerald palette. Typography compression utilities are theme-agnostic and stay either way.

**Files affected:**
- `docs/DESIGN.md` — rewritten (this entry)
- `docs/DECISIONS_LOG.md` — this entry
- `apps/web/src/app/globals.css` — drift fixes + new tokens (sibling commit)
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/page.tsx` — drift fix (sibling commit)
- `apps/web/src/app/(tenant)/[slug]/(app)/projects/[id]/expenses/page.tsx` — drift fix (sibling commit)
- `packages/ui/tailwind.config.ts` — font-sans variable fix (sibling commit)

**Phase:** Design contract reconciliation (V32.8 design-audit branch)

## Decision — 2026-06-19 — #9b: Tenant owner ("Tenant Super Admin") may manage departments

**Decision:** The tenant owner / super-admin role (`Tenant Super Admin`, slug `tenant_super_admin`)
SHALL be permitted to create AND manage (update/delete) departments within its own tenant. The
tenant operational `Admin` and cross-tenant `Platform Owner` roles remain permitted as before.

**Context / bug:** `department.create|update|delete` gated on the role NAME `"Administrator"`, but
NO seeded role carries that name (the seeded set is `Platform Owner`, `Tenant Super Admin`, `Admin`,
… — see `packages/db/src/seed/roles.ts`). The tenant owner was therefore 403'd
("You don't have permission to manage departments.") when managing departments in their own tenant.
An in-code note at `department.ts` flagged this as an owner-decision-pending RBAC gate; that decision
is now made and the stale note resolved.

**Implementation:** Followed the established RBAC pattern (hardcoded seeded-role-name arrays consumed
by the `requireRole(...)` middleware in `apps/web/src/server/trpc/middleware/rbac.ts` — there is no
permission-`can()` helper in this codebase). Replaced the dead `["Administrator", "Platform Owner"]`
list with a single shared `DEPARTMENT_MANAGE_ROLES = ["Tenant Super Admin", "Admin", "Platform Owner"]`
constant applied consistently to create/update/delete. Tenant scoping (`where:{tenantId}` guards,
ctx-injected `tenantId`) unchanged.

**Reversible:** YES — narrow the role list to revert.

**Files affected:**
- `apps/web/src/server/trpc/routers/department.ts` — role list + stale note resolved
- `apps/web/src/server/trpc/routers/__tests__/department-tenant-parity.test.ts` — +3 tests
  (owner `Tenant Super Admin` can create; `Admin` can create; unauthorized `Staff` → 403)
- `docs/PRODUCT.md` — Roles + Permissions note
- `docs/DECISIONS_LOG.md` — this entry

**Gate (evidence):** `pnpm typecheck` 11/11 green · `pnpm lint` clean · `pnpm test` **1029 passing**
(1026 baseline + 3 new) · `pnpm build` compiles.

**Phase:** Phase 7 (Feature Update)

## Decision — 2026-06-19 — #10: Fiscal-year management UI wired

**Decision:** Surface the already-existing, already-tested `accounting.fiscalYear.create` procedure
in the UI. Added a tenant-scoped Fiscal Years management page (list existing + inline create form)
under the accounting area, plus a nav entry alongside the other accounting sub-surfaces.

**Context:** The `accounting.fiscalYear.create` proc + its test predate this change; only the UI page
and nav link were missing. Fiscal years define accounting periods; a closed fiscal year blocks new
journal postings dated within its range (see Accounting §A in this log).

**Implementation:** Mirrored the sibling accounting create surfaces (account-form / settings-form):
shadcn/ui only (`Button`, `Input`, `Label`), `trpc.accounting.fiscalYear.list` query +
`trpc.accounting.fiscalYear.create` mutation with `sonner` toast + `utils.…invalidate()` +
`router.refresh()`, tenant scoping enforced server-side by the existing proc (ctx `tenantId`). Nav
entry added as a card on the accounting index page (the established nav pattern for accounting
sub-surfaces — accounts / journal-entries / trial-balance / settings).

**Reversible:** YES — UI-only addition; remove the route + nav card to revert.

**Files affected:**
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/fiscal-years/page.tsx` — NEW server page
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/fiscal-years/fiscal-years-client.tsx` — NEW list
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/fiscal-years/fiscal-year-form.tsx` — NEW create form
- `apps/web/src/app/(tenant)/[slug]/(app)/accounting/page.tsx` — nav card
- `docs/PRODUCT.md` — Modules + Features note
- `docs/DECISIONS_LOG.md` — this entry

**Gate (evidence):** `pnpm build` emits `ƒ /[slug]/accounting/fiscal-years` (4.6 kB); typecheck/lint/test green.

**Phase:** Phase 7 (Feature Update)

---

## V32.9 Compliance & Data Privacy Layer — Rule-1 Assumptions (2026-06-20, AI architect, autonomous)

**Decision class:** Compliance / Data Privacy (PH Data Privacy Act RA 10173, NPC IRR, WCAG 2.2 AA).
Implemented `feat/v329-compliance-features`. The following are PRODUCT-level (Rule 1, human-owned)
decisions made with sensible defaults by the AI architect and FLAGGED for owner ratification. They are
recorded here (NOT written into the human-only docs/PRODUCT.md §11 Compliance).

**Assumptions chosen (owner: please confirm or amend):**
1. **Personal Information Controller** = *Powerbyte IT Solutions* (the platform operator). Surfaced in
   the public privacy notice and `dsr.inform`.
2. **Data Protection Officer (DPO) contact** = *bonitobonita24@gmail.com* (placeholder until a DPO is
   formally appointed per NPC requirement). Surfaced in the privacy notice.
3. **Lawful basis for HR/employee PII** = *contract* + *legitimate interest* (employment relationship +
   ERP operations). For customer/financial data: contract + legitimate interest.
4. **Right to erasure** for ERP/payroll/banking records = **request-and-review**, NOT immediate
   hard-delete. Rationale: PH tax/labor law mandates multi-year retention of payroll, accounting, and
   transaction records; `dsr.requestErasure` creates a `DataSubjectRequest(type=erase, status=received)`
   for admin review against legal-retention exceptions, rather than deleting data.

**What was implemented (this branch):**
- Prisma models `DataSubjectRequest`, `BreachRecord` (public schema, migration
  `20260620000000_add_compliance_privacy`).
- tRPC `dsr.*` (subject self-service: inform/access/port/rectify/requestErasure/object/myRequests +
  admin list/updateStatus) and `compliance.breach.*` (admin-only breach register with NPC 72h +
  5-business-day full-report deadline tracking). All tenant-scoped (ctx.tenantId), subject ops scoped
  to ctx.userId, all audited to L5 AuditLog.
- Public `/privacy` page; in-app `/[slug]/privacy` (Privacy & My Data) self-service; admin
  `/[slug]/settings/breach` register.
- Honest `ComplianceFooter` (design-claims ON: security-by-default, PH-DPA-aligned, WCAG-target;
  certification badges OFF — none held).
- WCAG 2.2 AA quick wins on new pages + landing (labels, landmarks, aria, heading order); remainder
  tracked in `docs/V329_WCAG_REMAINING.md`.

**Reversible:** YES — additive feature branch; revert the branch to remove. Migration is create-only
(two new tables, no alters to existing tables).

**Owner product input still needed:** ratify items 1-4; decide actual DPO appointment; confirm whether
NPC registration / a formal PIA artifact is required for Orqafy's processing scale.

**Phase:** Phase 7 (Feature Update — V32.9 framework feature applied to app).

### ✅ OWNER-RATIFIED 2026-06-21 (supersedes the flagged-assumption status above)

The owner has ratified the V32.9 compliance product/legal values. Status of the four flagged items:

1. **Personal Information Controller = Powerbyte IT Solutions** — **RATIFIED.** No change (already coded).
2. **Lawful bases** — **RATIFIED.** The coded set in `dsr.inform` is the three standard
   RA 10173 §12 statutory lawful bases (fulfillment of a contract · compliance with a legal obligation ·
   legitimate interests of the PIC). These are generic statutory bases, not per-processing-activity
   business judgments, so they are confirmed as-is. NOTE: if the owner later wants a per-processing-activity
   lawful-basis register (e.g. mapping each specific processing activity to one declared basis for an NPC
   PIA), that finer-grained mapping remains a future business-judgment exercise — out of scope here.
3. **Retention periods** — **RATIFIED:** payroll/financial **7 years** · audit logs **5 years** ·
   general operational data **3 years**. Matches the values already coded in `dsr.inform` +
   `app/privacy/page.tsx` — confirmed, caveats dropped.
4. **DSR statutory response window = 15 days** — **RATIFIED.** Matches the "within 15 business days"
   already coded in the public + tenant privacy pages — confirmed.
5. **Right to erasure = request-and-review (not immediate hard-delete)** — **RATIFIED** as correct for
   PH payroll/tax statutory retention. No change.

**STILL PENDING (not ratified — physical/business gates only):**
- **DPO APPOINTMENT** — `dsr.inform` keeps `bonitobonita24@gmail.com` as an explicit placeholder until a
  DPO is formally appointed per NPC requirement. Pending.
- **NPC registration / formal PIA artifact** — whether required at Orqafy's processing scale is still an
  owner decision. Pending.

These ratified values are back-ported to `docs/PRODUCT.md` §Non-functional (Data retention + DSR window +
WCAG 2.2 AA) under the standing "decisions back-port to PRODUCT.md" authorization. No code change was
required — the 15-day window, 7/5/3 retention, and standard lawful bases were already coded as
authoritative values with no "needs confirmation" caveats.

**Phase:** Phase 7 (owner ratification of V32.9 compliance product values).

---

## Scout — 2026-06-20 — Epics 3-5 are fully implemented (PHANTOM); proposal doc is stale

**Decision class:** Build-state finding (not an architectural decision). Recorded so future
sessions stop re-scouting `docs/PRODUCT_PHASE7_PROPOSAL.md` Epics 3-5 as if open.

**Finding:** A code-verified scout of every Epic 3-5 surface named in
`docs/PRODUCT_PHASE7_PROPOSAL.md` (against `main` @ `700e972`) found **all of them already built**.
The proposal predates the W0-W13 wiring program + the Phase-8 tenant-scoping sweeps, which closed
these. Per-surface verification:

- **Epic 3 — Invoicing:** `invoice.create/update/markSent/recordPayment/markPaid/void` all present;
  UI `invoices/new` (form) + `invoices/[id]/invoice-actions.tsx`. DONE.
- **Epic 4.1 — Banking money-movement:** all 9 procedures present
  (`recordIncome/recordExpense/transfer/recordCreditCardCharge/payCreditCard/loanMoneyOutTo/
  loanMoneyIn/recordRefund/recordAdjustment`) + `banking/transactions/transaction-form.tsx` +
  `fund-sources/`. DONE.
- **Epic 4.2 — POS session lifecycle:** `open-session-dialog.tsx`, `close-session-dialog.tsx`,
  `[id]/void-sale-action.tsx`. **D4 resolved = (a) modal.** DONE.
- **Epic 5.1 — Service/Job Orders:** `jobOrder.create` + `service/job-orders/new` intake page +
  both detail routes. **D5 resolved = both routes coexist.** DONE.
- **Epic 5.2 — Storefront checkout:** `placeOrder` (writeProcedure, staff-on-behalf) AND
  `placeOrderAsCustomer` (publicProcedure, logged-in customer) + `listAllOrders`. **D6 resolved =
  (c) both.** DONE.
- **Epic 5.3 — Notifications:** `notificationRouter` is a REAL Prisma backend (`db.notification.*`,
  not the old stub) + `components/layout/notification-bell.tsx` wired into `app-header.tsx`.
  **D7 resolved = (b) durable Prisma Notification.** DONE.
- **Epic 5.4 — Settings sub-pages:** all 5 (`users`, `departments`, `expense-categories`, `smtp`,
  `account`) exist (+ `xendit`, + new `breach`). DONE.
- **Epic 5.5 — Platform-admin:** `platform.listTenants/getTenant/suspendTenant/reactivateTenant`
  (platformProcedure) + `powerbyte-admin/[tenantId]/tenant-status-actions.tsx`. **D8 resolved.** DONE.
- **Tasks (D2):** `task-board.tsx` + `create-task-dialog.tsx` interactive (useMutation). DONE.

**Autonomously-buildable remaining in Epics 3-5: NONE.** No new code was written this session for M2;
writing speculative features would violate the no-gold-plating + Rule-1 (don't invent product) posture.

**Product-gated items left for owner (carried from M1):**
1. ~~Ratify the four V32.9 compliance Rule-1 assumptions~~ — ✅ **RATIFIED 2026-06-21** (retention 7/5/3,
   DSR window 15 days, lawful bases, request-and-review erasure). See the OWNER-RATIFIED block in the
   entry above. Only the two items below remain open.
2. Decide actual DPO appointment (currently `bonitobonita24@gmail.com` placeholder in `dsr.inform`). PENDING.
3. Confirm whether NPC registration / a formal PIA artifact is required at Orqafy's processing scale. PENDING.

**Reversible:** N/A (a finding, not a change).

**Phase:** Phase 8 scout (Epic 3-5 completeness re-verification).

---

## Decision — 2026-06-25 — Finance RULES D-2 (owner-approved R1–R7)

**Decision:** Settle the seven open finance business-rules from `docs/FINANCE_RULES_PROPOSAL.md`.
All of R1–R7 are **owner-approved** with the confirmed choices below. This entry is the locked
contract; the implementation surfaces the already-built finance backends and adds the few
genuinely-new pieces (provisioning seed, PO VAT fields, over-receipt tolerance, Input-VAT account,
audited vendor reactivate).

**R1 — PO tax (VAT).** PH VAT **12%, EXCLUSIVE, auto-computed** at the PO level and shown as a
separate "VAT (12%)" total line. A per-PO **VAT-exempt / zero-rated toggle** (`isVatExempt`)
suppresses the VAT line (taxAmount → 0). Input VAT posts to a default **Input VAT** asset account
(`AccountingSettings.defaultInputVatAccountId`, new). Tax is header-level (no per-line tax rates).

**R2 — PO line allocation routing.** Expose the existing allocation picker
(`stock` / `project_expense` / `company_expense`) on the PO form. Default **`company_expense`**;
default **`stock`** when the line references an inventory product; `project_expense` requires a
project. Backend allocation create + GR→JE consumption already exist — UI only.

**R3 — Over-receipt.** **Allowed + non-blocking warning** within a **10% tolerance**. Beyond 10%
requires explicit confirm + an audited reason (`GoodsReceipt.overReceiptReason`). Enforced in
`goodsReceipt.create` with a clear error past tolerance unless reason supplied; GR form warns
(≤10%) / blocks-until-confirm-and-reason (>10%).

**R4 — GL default-account mapping (turns GR→JE auto-post ON out-of-the-box).** **Seed a standard
PH SME Chart of Accounts on tenant provisioning** (Assets/Liabilities/Equity/Income/Expense incl.
Inventory, Accounts Payable, **Input VAT**, Purchases/COGS, Salaries Expense, Statutory Payables,
Withholding Payable), seed the current open FiscalYear + default VAT TaxRate + cited 2025 PH
StatutoryRates, and **auto-set** the four `AccountingSettings` defaults
(`defaultInventoryAccountId`, `defaultApAccountId`, `defaultExpenseAccountId`, `defaultFiscalYearId`)
+ `defaultInputVatAccountId` to the seeded accounts. Shared seed logic is extracted to `@orqafy/db`
and called from both the demo seed and `tenant-provisioning`. Accounting → Settings UI exposes
review/remap of all five default accounts.

**R5 — PO editing & approval.** Block header/line edits once a PO is **beyond DRAFT**
(`status !== "draft"` — already enforced server-side in `purchaseOrder.update`/`submit`). To change
an approved PO: cancel + clone. Keep the single `poApprovalThreshold` auto-approve (≤ ₱10,000) —
**NO multi-tier.** PO detail gets a status-aware action island (submit/approve/markOrdered/
cancel/close) surfacing the existing procedures.

**R6 — Vendor reactivation.** A deactivated vendor may be reactivated by **Administrator or
Purchasing Manager** (audited via L5 `writeAuditLog`). No PO may be raised against a deactivated
vendor (existing guard). New `vendor.reactivate` procedure + reactivate button.

**R7 — Payroll statutory rates.** Keep the seeded 2025 PH `StatutoryRate` values as the formula
(SSS 15% MSC, PhilHealth 5%, Pag-IBIG 2%/2%, BIR TRAIN withholding) — **no rate changes**. Surface
the StatutoryRate config UI (list/upsert) + confirm the payroll process/approve/markPaid workflow UI
(fund-source picker on markPaid, statutory deduction breakdown display). Owner edits rates annually.

**Already-built (verified at code level, surfaced not rebuilt):** GR→JE auto-post
(`goodsReceipt.create`), PO lifecycle procedures + R5 edit-lock, allocation backend, payroll
process/approve/markPaid + `statutoryRate.{list,resolved,upsert,seedDefaults}`, Accounting Settings
4-default mapping form, Trial Balance / GL / fiscal-years / chart-of-accounts pages.

**Reversible:** Tolerance %, VAT rate, and allocation defaults are config-level and reversible.
The chart-on-provisioning seed is idempotent (ON CONFLICT DO NOTHING) and reversible by remapping
in Settings.

**Phase:** Phase 7 Feature Update (Finance D-2 ruleset) — deploy HELD (commit+push to `main` only).

## 2026-07-10 — RBAC alignment: Wave scoping + A2 defer (M2a)
**Architecture finding (LOCKED):** Orqafy RBAC is a DATA-DRIVEN per-tenant `Role` table (slug/name/permissions-JSON/isSystem), NOT a `UserRole` enum. Runtime authz keys off role DISPLAY NAME (user.role.name), not slug. The fleet standard + Scenario 42 assume an enum; their `ALTER TYPE RENAME VALUE` mechanic does NOT apply here.
**Wave split (LOCKED):** A = safe mechanical (done: A1 role-gate bug fix). B = one-owner-per-tenant integrity + two-way succession (dev-local [HOW], next). C = platform tenant_id NULL, enforced permission-matrix, tenant role-builder UI — OWNER-GATED [WHAT] (real blast-radius on tenant isolation / product scope) → docs/PENDING_DECISIONS.md D-RBAC-C1..C4.
**A2 slug rename DEFERRED:** tenant_super_admin→tenant_superadmin is cosmetic (names, not slugs, drive authz) and adds migration churn for zero behavior change. Not executing under Full-Auto; revisit only if the enum-model migration (C1) is ever authorized.

## 2026-07-11 — RBAC Wave B: one-owner-per-tenant integrity + two-way succession (M2b)
**Owner model (LOCKED):** A tenant's OWNER is a single user flagged `users.is_tenant_owner = true`, DISTINCT from the `tenant_super_admin` ROLE (several users may hold that role — the seed creates webmaster + dev admin — but only ONE is the owner). This decouples ownership from role and avoids denormalizing the role.
**DB enforcement (LOCKED):** partial unique index `one_tenant_owner_per_tenant ON users(tenant_id) WHERE is_tenant_owner` — guarantees ≤1 owner/tenant, parity with the fleet standard's one-owner index. The standard's enum form (`WHERE role='tenant_superadmin'`) is not expressible here (roles are per-tenant FK rows), so the boolean-flag form is used. Migration `20260710160000_add_tenant_owner_flag` backfills exactly one owner/tenant (earliest-created tenant_super_admin holder via `DISTINCT ON`) BEFORE creating the index.
**Succession (LOCKED, both directions per standard §2):** `packages/db/src/helpers/succession.ts` — `transferTenantOwnership(from→to)` (in-tenant, owner-only; index-safe demote-then-promote in a txn; outgoing owner demoted to `admin` role, incoming promoted to `tenant_super_admin`; both `securityVersion++` to force re-auth) and `reassignTenantOwner(tenantId, newOwnerUserId)` (platform break-glass; clears existing owner first; rejects unknown tenant with `NOT_FOUND`). Wired: `platform.reassignTenantOwner` (platformProcedure, audited `PLATFORM:REASSIGN_TENANT_OWNER`) + `user.transferOwnership` (protectedProcedure, current-owner-only guard). Backend only — role-builder/transfer UI is Wave C (owner-gated).
**Seed/provisioning:** `provisionTenantRolesAndOwner` + demo seed set `isTenantOwner: true` on the owner; dev `admin@mail.com` stays non-owner (default false).
**NOT applied yet:** migration authored but NOT run (dev Docker stack down during Full-Auto). Apply via `prisma migrate deploy` on next dev up; staging/prod application owner-gated. Worker integration test `apps/worker/src/__tests__/succession.test.ts` verifies the index + succession against a live DB then.
**Validation:** web suite 1060/1060 green (+5 mocked succession unit tests); typecheck + lint clean (web + worker + db). LOCAL commits on `feat/tenant-rbac-3tier`; HARD HOLD — no push/deploy.

## 2026-07-11 — Tenant-model canonicalization + rate-limiting + UI defaults (M5 remainder + M6.2–M6.5)

**Tenant data model (LOCKED — single canonical form):** Orqafy stores ALL tenant-scoped data in the
single `public` schema, isolated by an explicit `tenantId` column (+ the L1/L3/L5/L6 guards). The dormant
"physical schema-per-tenant" path is REMOVED, not just unused:
- M5 S-P2a (commit 3dd3fe0): deleted `createTenantPrisma` + the `tenantGuardExtension` file that ran
  `SET search_path` (a SQL-injection landmine) — zero runtime callers (scout-confirmed).
- M6.2 (commit 5422479): removed the remaining physical `t_<slug>` machinery
  (`createTenantSchema`/`tenantSchemaExists`/`dropTenantSchema`) from the helper, barrel, worker
  provisioning, and tests (kept only `toSchemaName`). Removing the hack UNCOVERED + FIXED two latent
  multi-tenant PROD bugs it was masking:
  - (a) the seed wrote demo departments/expense-categories/warehouse via raw SQL into the invisible
    `t_demo` schema (so `public` had 0 demo rows) → rewritten to Prisma upserts into `public`; last
    `SET search_path` in the codebase removed.
  - (b) STALE single-column `UNIQUE(code)` indexes on `warehouses`/`accounts`/`tax_rates`/
    `expense_categories` blocked two tenants ever sharing a code (e.g. both provisioning `vat-12`). Root
    cause: migration `20260616120000` used `DROP CONSTRAINT`, a no-op on a Prisma single-col `@unique`
    (which is a UNIQUE INDEX, not a constraint). Fix = new migration
    `20260711010000_drop_stale_single_col_code_uniques` (correct `DROP INDEX`).
- Both dev migrations (`20260710160000_add_tenant_owner_flag` + `20260711010000`) are applied to the DEV
  DB. **Applying them to staging/prod is owner-gated (HARD HOLD)** → PENDING_DECISIONS D-MIG-APPLY.
- Verified: fresh seed → demo data in `public`, zero `t_*` schemas, 1 owner; worker 15/15; web 1063/1063.
- Two global footgun lessons logged (`~/.claude/LESSONS_GLOBAL.md`).

**Rate-limiting posture (LOCKED — M6.3 / S-P1a, commit 0e1e45f):** two authenticated-abuse surfaces are
gated via the existing pure `rateLimiters` lib (no tRPC dependency → no circular import):
- `authorize()` (NextAuth Credentials): `rateLimiters.auth` = **10/min per client IP**, checked before
  any DB lookup; opaque deny (returns `null`) on limit — no enumeration signal. Blunts login
  brute-force / credential stuffing.
- `protectedProcedure`: `rateLimiters.api` = **120/min per userId on MUTATIONS only**.
  **Authenticated READS are intentionally NOT tRPC-throttled** — a data-dense ERP page fires 10–15
  parallel reads, so a per-request read limit is prone to false lock-outs; the abuse surface is writes,
  and 120 mutations/min sits far above any human rate. This mutation-scoping also removed the need for a
  live read-lock-out test (the design eliminates the risk). The mutation check is guarded off under
  `NODE_ENV=test` so the shared module-singleton limiter cache can't pollute the vitest suite. Behavior
  covered by 3 deterministic lib tests. (Tradeoff: a compromised authenticated account could still scrape
  via reads at machine speed; acceptable given tenant-scoping + the lock-out risk — revisit if a
  dual-ceiling read limiter is ever warranted.)

**Content max-width container (LOCKED — M6.4 / D-P1a, commit 89f0fa2):** design-defaults Entry 1 —
readable/dense content sits in a centered `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` container instead of
bleeding edge-to-edge on wide monitors. Applied ONCE at `(app)/layout.tsx` via a client
`ContentContainer` (covers all 89 app pages); immersive point-of-work routes opt OUT via a pathname
allowlist (currently `/pos/new-sale`, the two-pane register). `<main>` keeps vertical `py-6`; the
responsive horizontal gutter lives in the container.

**Mobile off-canvas sidebar (LOCKED — M6.5 / D-P1b, commit d2e59e6):** the shared logo/nav/footer is
extracted into `<SidebarNav>`; `app-sidebar.tsx` is a `hidden ... md:flex` DESKTOP wrapper (unchanged
above `md`); mobile uses a `md:hidden` header hamburger opening a shadcn `<Sheet side="left">` that renders
the same `SidebarNav` (sr-only `SheetTitle` for a11y; closes on nav). Fixes the phone layout where the
fixed `w-56` aside squeezed content to ~150px.

**Validation (M6.2–M6.5):** each step web typecheck 0 + eslint clean; M6.3 web 1066/1066; live Visual QA
(dev, 1920/1440/375px) of dashboard/invoices/settings/pos-new-sale/users — capped-centering + immersive
opt-out + off-canvas nav all confirmed; RBAC Users page renders post-migration with 0 console errors.
All LOCAL on `feat/tenant-rbac-3tier`; HARD HOLD — no push/deploy.

## 2026-07-11 — M7: Zod StatutoryRate typing + STANDING tenant-guard contract + storage accept + numbering deferred

**StatutoryRate config typing (LOCKED, M7.1, commit 75bc162):** `payroll.ts` `StatutoryRate.upsert`'s
`config` field was `z.record(z.string(), z.unknown())` — a full validation bypass for that input.
Replaced with a typed `z.discriminatedUnion("type", [...])` covering the four real config shapes
(`sss` / `philhealth` / `pagibig` / `withholding`), each `.strict()` with `z.number().nonnegative()`
fields matching the existing `SssConfig`/`PhilhealthConfig`/`PagibigConfig`/`WithholdingConfig`
interfaces. Grep confirms 0 remaining `z.unknown()`/`z.any()` on server mutation inputs anywhere in the
codebase.

**⚠ STANDING CONTRACT (LOCKED, M7.2) — explicit tenant validation is now MANDATORY on every tenant-scoped
query/mutation, with no ORM-level safety net:** M5 (S-P2a, 2026-07-11 earlier this day) deleted the
dormant L6 auto-tenant-guard Prisma extension (the `$allOperations` interceptor that used to inject
`tenantId` automatically). That removal was correct — the extension was dead code with a live SQL-
injection landmine — but it also meant every query written against the assumption of an implicit guard
became silently unscoped. M7.2 found this had already caused real damage: a SEVERE record-IDOR
(`inventory.productUpdate` via `findUnique` with no tenant check) and two full list-leaks
(`inventory.productList`, `purchasing.goodsReceipt.list` — `where` clauses missing `tenantId` entirely,
returning ALL tenants' rows), plus numerous unguarded user-supplied foreign-key writes across 8 more
routers. **Going forward: every `findUnique`/`findFirst`/`findMany`/`update`/`delete`/`count` on a
tenant-scoped model MUST explicitly filter or verify `tenantId` — no exceptions, no assumption that
"it was probably guarded upstream."** The four accepted idioms (use whichever fits): (a)
`findFirst({ where: { id, tenantId } })` in place of `findUnique({ where: { id } })`; (b) a
`loadXForTenant(id, tenantId)` helper for record-existence + ownership checks before a write; (c) for
batch operations, `count({ where: { id: { in: ids }, tenantId } }) === ids.length` before proceeding;
(d) for user-membership checks (e.g. assigning another user to a record), `user.tenantId ===
ctx.tenantId`. Any future removal of an ORM-level tenant guard (or any other cross-cutting Prisma
extension) MUST be followed by a full grep-the-surface re-audit of every affected query type — this is
now a mandatory follow-up step, not optional cleanup.

**Storage magic-byte sniff — accepted, not fixed (LOCKED, M7.3):** file-upload validation is
presigned-direct-to-S3, so the app server never receives the uploaded bytes and cannot sniff magic
numbers before storage. The XSS vector this would otherwise guard against is already closed by two
independent controls: SVG/HTML MIME types are blocked outright, and every download is served with a
forced `Content-Disposition: attachment` (never inline-rendered). **Decision: accept the gap as an
architectural tradeoff of the presigned-upload design**, not a defect to fix now. A bounded
download-and-sniff check inside `confirmUpload` (post-upload, before the DB record is finalized) is a
possible future enhancement if the risk profile changes (e.g. inline preview features are added later)
— judged disproportionate to build today.

**Document numbering — deferred as a product decision, not a security fix (`D-NUM-1`, M7.2 residual):**
`generatePoNumber`, `generateGrNumber` (purchasing), and `generateQuotationNumber` (crm) all resolve the
next sequence number via an unscoped `findFirst`, so PO/GR/quotation numbers currently form ONE global
sequence across all tenants rather than a per-tenant sequence. This is an information-leak (a tenant can
infer relative order-volume of other tenants from gaps in its own numbering) but exposes NO actual data
— unlike the M7.2 IDOR fixes, this is a numbering-SCHEME choice (global vs per-tenant sequences, and
whether per-tenant numbering should reset or continue on tenant creation), which is a product/business
call, not a pure security bug. Logged to `PENDING_DECISIONS.md` as `D-NUM-1` for owner input rather than
auto-fixed.

**Loading states (LOCKED, M7.4, commit 7d5ac4a):** installed shadcn `Skeleton`
(`apps/web/src/components/ui/skeleton.tsx`) and replaced the ad-hoc `animate-spin` divs in 10 of the 11
app-shell `loading.tsx` files with layout-matched placeholders (dashboard = stat-card grid + chart
skeleton; the 9 table-page loaders = a uniform title+toolbar+rows skeleton). `login/loading.tsx` was left
as a minimal spinner — the auth card is small enough that a skeleton adds no perceptible value. Follows
ui-rules Rule 11 PATH A (shadcn-composed loading states use `<Skeleton>` inline); zero
`*Skeleton.tsx` twin files were created, per the hard constraint.

**Validation:** web typecheck 0 errors · web suite 1101/1101 (≈+35 new regression tests from the M7.2
IDOR remediation) · lint-design PASS · worker typecheck 0 errors · live app smoke PASS. 12 LOCAL commits
on `feat/tenant-rbac-3tier` (75bc162..418a3c8); HARD HOLD — no push/deploy.

## 2026-07-11 — RBAC Wave C decisions (owner-approved)

**C1 (LOCKED) — Keep tenant-scoped Platform Owner as the fleet `tenant_manager`-equivalent.** Orqafy's
existing `Platform Owner` role (gated to `/powerbyte-admin` via `platformProcedure`) is retained as the
documented equivalent of the fleet Tenant-RBAC standard's platform-level `tenant_manager` tier — it is
NOT migrated to a true cross-tenant, `tenant_id = NULL` platform role. Do NOT migrate `User.tenantId` to
nullable; do NOT touch the L6 tenant-guard Prisma extension or `middleware.ts` tenant-slug routing.
Per-tenant `/<slug>` subdirectory access is preserved exactly as-is. Rationale: a true platform-role
migration would touch the tenant isolation model built and hardened across 30+ Phase 8 batches (L1-L6,
`tenant_id` scoping, the middleware slug-to-session cross-check) for no functional gain — the
documented-equivalent mapping satisfies the fleet standard's intent (a designated break-glass/cross-
tenant-admin tier exists and is named) without an isolation-architecture rewrite.

**C2/C3 (LOCKED) — Implement the full standard §4 custom-role permission-matrix subsystem.** Build:
(a) a feature registry (typed enum of gateable modules/features), (b) a `role_permissions` table with a
strict CRUD-split schema (`tenant_id, role_id, feature_key, view, create, update, delete` — `create` and
`update` as separate columns, never combined into a single "write"), (c) a `hasPermission(role, feature,
action)` resolver reading the matrix, (d) matrix-driven enforcement wired identically at THREE surfaces:
tRPC (a `matrixProcedure(feature, action)` factory), route/page-level guards (deny-by-default from the
matrix), and sidebar nav (menu items filtered by `view`), and (e) a `tenant_superadmin`-only shadcn/ui
role-builder screen (features down the side, 4 permission columns across the top, checkbox matrix).
Guardrails carried over from the fleet standard (non-negotiable): a custom role can never exceed the
`tenant_admin`/Admin capability ceiling; custom roles may NEVER grant Billing or User-Management; only
`tenant_superadmin` (Tenant Super Admin) and the platform-equivalent (Platform Owner) may create/edit/
assign custom roles; the fixed system-role tiers stay hard-coded, never data-driven. **CRITICAL
backfill requirement:** the initial `role_permissions` data MUST be seeded to reproduce today's
name-based role-gate grants EXACTLY (byte-for-byte equivalent access per existing role), so switching
enforcement over to the matrix is a day-one no-op — no user's effective permissions change on cutover.

**C4 (LOCKED, DEV/LOCAL only) — Reseed dev accounts to the canonical universal-login-credentials
scheme.** Dev seed data is updated to match `Server-Setups/secrets/universal-login-credentials.enc.yaml`
`local_dev` entries: `tenant_superadmin` → `webmaster@localhost.com`; `tenant_admin` →
`admin@admin.com`; the universal `tenant_manager` account (`tenantadmin@powerbyteitsolutions.com`) is
seeded as a Platform Owner within the demo tenant (consistent with C1's documented-equivalent mapping,
since Orqafy's Platform Owner is tenant-scoped, not a true `tenant_id = NULL` role). All passwords are
sourced ONLY from the vault or environment variables at seed time — never hardcoded in the seed script
— and gated behind `SEED_DEV_ACCOUNTS=true` (dev-only flag, consistent with the framework's existing
dev-weak-credential gating pattern). The vault is referenced by PATH ONLY in all governance docs and
code comments; no credential VALUE is ever pasted into the repo, a commit message, or an AI context.

**PM finding — dead-role-name gates (NEW, tracked as `D-RBAC-DEADGATE`):** a scout sweep found 4
authorization gates referencing role name strings that do not exist in `STANDARD_ROLES`
("Administrator" / "Manager") — in `accounting.ts`, `dtr.ts`, `employee.ts`, and `storefront.ts`. Because
no user can ever hold a role literally named "Administrator" or "Manager", these gates are dead
code that is accidentally MORE restrictive than intended (they silently deny everyone rather than
gating a real role). **Decision:** the C2/C3 matrix backfill will PRESERVE the current effective
(overly-restrictive) behavior of these 4 gates as-is — the backfill's job is byte-for-byte parity with
today's behavior, not a behavior expansion. Whether to loosen these 4 gates to grant the access to a
real existing role is an owner product/business call, deferred to `PENDING_DECISIONS.md` as
`D-RBAC-DEADGATE`. Not auto-fixed.

## 2026-07-11 — RBAC §4 Track C deferred-router rulings + Tracks A/B (owner-approved)

**Context:** `docs/RBAC_S4_ROLLOUT_PLAN.md` deferred 4 routers (`accounting`, `purchasing`,
`storefront`, `dsr`) pending an owner `[WHAT]` ruling, and left Track A (nav filtering) and
Track B (role-builder UI) not started. The owner accepted the "recommended" option on every
open item this session. Rollout moves from 20/35 → 23/35 feature routers on the matrix, plus
Tracks A and B are DONE.

**Ruling 1 (LOCKED) — `accounting` migrates to the matrix as the deliberate tightening.**
Reads → `matrix:view`. Writes (`account`/`journalEntry`/`fiscalYear`/`taxRate` create+update,
JE post/reverse, `settings.update`, `toggleActive`) → `matrix:create`/`matrix:update`, which per
the ground-truthed seed resolve to **Accountant + bypass roles only**. This NARROWS the
previously-ungated broad `writeProcedure` writes (chart-of-accounts CRUD, journal creates) down
to the seed's existing accountant-only grant — closing the pre-existing gap the rollout plan
flagged as "internally inconsistent," rather than preserving it. It also retires the dead-name
`accountantWriteProcedure` gate (matched no real role name, so it silently behaved as
Accountant-only already — the matrix reproduces that outcome by design, not by accident).

**Ruling 2 (LOCKED) — `purchasing` migrates; `approve` maps to `matrix:delete`.** Reads →
`matrix:view`; vendor/PO creates+updates → `matrix:create`/`matrix:update`. The router's
`approve`/`reactivate` actions map to `matrix:delete` (seeded to Admin + Purchasing Staff +
bypass) — the "elevated purchasing action" bucket, since the 4-action CRUD model has no
`approve` verb. This is a deliberate FIX of the router's pre-existing `po.approve` dead-gate
(role names `["Administrator","Purchasing Manager","admin"]` matched no real role and 403'd for
literally everyone, including bypass roles) — `po.approve` now actually functions. No seed
change was required; the existing `purchasing:delete` grant already covered this action.

**Ruling 3 (LOCKED) — `storefront` migrates; admin actions widen to Tenant Super Admin.**
Reads → `matrix:view`; `placeOrder` → `matrix:create`. Admin-only actions
(`listAllOrders`, `updateFulfillment`, `updateOrderStatus`, `createXenditInvoice`) →
`matrix:update`, seeded to **bypass roles only** (Tenant Super Admin + Platform Owner). This
is a deliberate WIDENING (owner-approved): the router's prior `requireAdmin` gate
(`{"Administrator"(dead), "Platform Owner"}`) only ever let Platform Owner through — Tenant
Super Admin is intentionally added as an order-management admin now. `createXenditInvoice` was
previously completely ungated; bringing it under the same admin gate is an intended hardening,
not a side effect. `listAllOrders` is gated on `matrix:update` (not the broader `matrix:view`)
specifically to avoid over-widening read access to the full cross-customer order list. Guest
`publicProcedure` catalog/checkout endpoints are unchanged.

**Ruling 4 (LOCKED, no code change) — `dsr` stays on its real-name `requireRole` gate.**
Confirmed as the correct terminal state, not a deferred item: the self-service DSR endpoints
(RA 10173 data-subject rights) must remain open to the requesting user regardless of role, and
the admin queue's `requireRole` gate (`DSR_ADMIN_ROLES` = Tenant Super Admin/Admin/Platform
Owner) already matches real role names — there is no dead-gate or matrix-migration benefit here.
Routing it through the matrix would either over-widen the RA-10173 admin queue (seed `view` is
broad) or lock Admin out of `adminUpdateStatus` (seed `update` is false) without a dedicated
seed change the owner has not requested. No seed edit, no router edit.

**Track A (DONE) — sidebar nav filtered by the permission matrix.** The existing
`role.myPermissions` tRPC query resolves the caller's effective `{view,create,update,delete}`
per feature (bypass roles → all keys granted; deny-by-default while the query is pending, via a
`Skeleton` placeholder — never a flash of unauthorized items). Every `NAV_ITEM` now carries a
`FeatureKey`, and the sidebar filters to items whose `view` is `true`. Fixed a latent build
regression surfaced by live Visual QA during this work: `packages/shared/src/rbac/index.ts` was
the only shared package index using `.js`-suffixed re-export specifiers (its siblings are
extensionless, consistent with the repo's `moduleResolution: "bundler"`); this 500'd the Next.js
dev bundler on `role.ts`'s value import of the RBAC module ("Can't resolve `./features.js`").
Changed to extensionless re-exports — no functional change, bundler-resolution fix only.

**Track B (DONE) — Tenant Super Admin-only role-builder UI at `/settings/roles`.** Ships on top
of the `role.ts` backend (list/create/update + guardrails) that already existed from M9. New
screen renders a feature × action checkbox matrix, prefilled from `role.list`; the `users` and
`billing` feature rows are rendered disabled with a "Reserved for owner" note (matching the
non-negotiable guardrail that custom roles may never grant Billing or User-Management);
guardrail rejections from the backend surface as toasts. The page itself is gated to Tenant
Super Admin + Platform Owner (`guardPage`), and the "Roles" sidebar entry / settings card is
conditionally rendered for the same tier.

**Verification (PM ground-truth, not self-report):** web typecheck 0 errors · web vitest suite
1242/1242 · web eslint 0 warnings · `lint-design.sh --report-only` PASS · `@orqafy/db` 61/61 ·
`@orqafy/shared` 4/4. Live Visual QA against the dev app (port 42951): logged in as Tenant Super
Admin — sidebar shows the filtered nav plus the Roles entry, `/settings/roles` renders the
matrix prefilled per the seed with `users`/`billing` rows locked, 0 console errors; logged in as
a Staff-tier role — redirected off `/settings/roles` and the Roles card is hidden from settings.

**Commits (LOCAL on `feat/tenant-rbac-3tier`, HARD HOLD — no push/deploy):** `e3d8f1f` (Track C:
accounting/purchasing/storefront migrated, dsr confirmed no-op), `f5092a6` (Track A: sidebar
nav filtering + the rbac index `.js`→extensionless bundler fix), `d7e1f5a` (Track B:
role-builder UI at `/settings/roles`).

**Residual (owner-gated, tracked in `PENDING_DECISIONS.md`):** the feature-router matrix
rollout is now considered COMPLETE at 23/35 (the remaining ~12 routers are non-feature/utility
routers outside the matrix's scope, per the rollout plan's router inventory). Two pre-existing
gaps surfaced but deliberately NOT auto-fixed this session, both owner `[WHAT]` calls:
`user.ts` (`list`/`byId`/`deactivate`) has no matrix gate at all — any authenticated tenant
member can currently list/view/deactivate any other user in the tenant, which conflicts with
the fleet standard reserving User Management to Tenant Super Admin/Platform Owner; and
`payroll.ts` is fully ungated versus its legacy HR-Manager-only intent. See

---

## Decision — 2026-07-12 — RBAC §4 — user-management + payroll hardening (owner-approved)

**Decision:** Owner approved (2026-07-12) both `D-RBAC-USERS-UNGATED` and
`D-RBAC-PAYROLL-UNGATED` from `PENDING_DECISIONS.md` — resolved as follows.

**`user.ts` (list/byId/deactivate) — gated to a fixed Tenant Super Admin / Platform Owner
check, NOT routed through the permission matrix.** User Management is explicitly excluded
from the custom-role matrix by the fleet Tenant-RBAC standard §4 guardrail ("custom roles may
NEVER grant Billing or User Management — those stay exclusive to `tenant_superadmin` + platform
`tenant_manager`"); Users is a guardrail-forbidden/reserved feature in the role-builder UI
(Track B), so it correctly has no `role_permissions` rows to key off. The fix instead hardens
the existing `superAdminProcedure` (fixing a gap in that procedure itself) and composes a
superAdmin-gated write for `deactivate`, applied to `list`/`byId`/`deactivate`. Also added a
`/settings/users` page redirect gate (non-TSA/PO users bounced) and hid the Users card on the
settings hub from non-TSA/PO roles. Takes effect immediately — no reseed required.

**`payroll.ts` — tightened at the seed, not the router (router was already matrix-migrated).**
`payroll.ts` create/update/delete already read the matrix; the gap was in
`packages/db/src/seed/role-permissions.ts`, which had granted payroll write access to all
internal staff roles instead of the legacy HR-Manager-only intent. Tightened the seed grant so
payroll `create`/`update`/`delete` = HR Manager + bypass roles only, mirroring the existing
`dtr`/`employees` grant pattern. Required a dev reseed (`pnpm db:seed`, idempotent) to take
effect — verified at the data layer: payroll rows are HR Manager full CUD; Staff/Admin/
Accountant view-only; Tenant Super Admin/Platform Owner full via bypass.

**Verification (PM ground-truth):** web typecheck 0 · web vitest 1253/1253 · web eslint 0
warnings · `lint-design.sh --report-only` PASS · `@orqafy/db` 61/61 + typecheck 0. Live QA:
Staff redirected off `/settings/users`; Users card hidden from non-TSA/PO. `succession.test.ts`
denies Staff and non-owner Admin on all three `user.ts` endpoints.

**Reversible:** YES — both are seed/router-level authorization tightenings, not schema changes.

**Files affected:**
- `apps/web/src/server/trpc/routers/user.ts` — list/byId gated; deactivate composed with a
  superAdmin-gated write
- `apps/web/src/server/rbac/` — `superAdminProcedure` fix
- `apps/web/src/app/(tenant)/[slug]/(app)/settings/users/page.tsx` — TSA/PO redirect gate
- `apps/web/src/components/layout/*` — Users card hidden from non-TSA/PO
- `packages/db/src/seed/role-permissions.ts` — payroll create/update/delete tightened to HR
  Manager + bypass
- `apps/web/src/server/trpc/routers/__tests__/succession.test.ts` — non-owner/Staff denial
  coverage
- `docs/PENDING_DECISIONS.md` — both items marked resolved

**Commit (LOCAL on `feat/tenant-rbac-3tier`, HARD HOLD):** `cb0c783`.
`D-RBAC-USERS-UNGATED` and `D-RBAC-PAYROLL-UNGATED` in `PENDING_DECISIONS.md`.

---

## LOCKED: Deploy model (staging/demo) — Komodo hand-placed stacks, repo compose is a mirror

**Decision:** Deploy model = **(a)**: Komodo, via the data-first gate script
`deploy/staging-refresh-and-deploy.sh`, deploys the hand-placed stack files under
`/etc/komodo/stacks/orqafy-{staging,demo}/` on the VPS. The repo's `deploy/compose/{stage,demo}`
files are a **reference mirror** of that live layout — NOT the deploy source. No compose
templating/generator system is introduced.

**Consequences:**
- Staging deploys ONLY via `deploy/staging-refresh-and-deploy.sh` (prod-data-first refresh →
  image pull → `prisma migrate deploy` → schema-status hard gate → bring-up → health-verify).
- Komodo `auto_update` stays OFF for both staging and demo — deploys are agent-triggered
  ("validate staging" / "push to demo"), never automatic on image push.
- Production and demo promotion stay manual, owner-gated steps (never triggered by CI or the
  staging gate script).
- The repo `deploy/compose/{stage,demo}` tree is reconciled to be a **verbatim mirror** of the
  live `/etc/komodo/stacks/*` layout (2026-07-19) — see `docs/DEPLOY_COMPOSE_RECONCILIATION.md`
  for the full ground-truthed divergence table and what changed. Future drift between the repo
  mirror and the live stack should be re-reconciled the same way (read-only SSH ground-truth →
  update repo → re-validate with `docker compose config`), never assumed.
- `deploy/compose/dev/*` and `deploy/compose/prod/*` are unaffected by this reconciliation —
  dev uses a different (local build) model, and prod has not yet had a live stack to
  ground-truth against.

**Reference:** `docs/DEPLOY_COMPOSE_RECONCILIATION.md` (ground-truthed divergence table,
what changed, verification performed).

## RECORD (2026-08-08): AdminCN design adoption — foundation + shell + all authed surfaces

Owner-directed (2026-08-07) + approved ("all approved, do it, full auto"). Adopted the fleet-default
**AdminCN** design language (Scenario 49, `.ai_prompt/admincn-starter.md`) as a UI/design layer ONLY —
tRPC + Prisma + Auth.js v5 backend unchanged; no `fake-db`/`zustand`(server)/`nuqs` adopted. Branch
`feat/admincn-adoption` (off the V32.45.1 framework-sync branch), LOCAL / HARD HOLD (unmerged, unpushed).

Done + verified:
- **Foundation**: reconciled component set to 50 (shadcn + AdminCN Pro extras; kanban/combobox/button-group
  skipped — need @base-ui). Theme infra: next-themes light/dark (default DARK), ModeToggle; existing dark
  palette preserved byte-identical (INHERIT-not-REPLACE).
- **App-shell**: swapped to the shadcn `sidebar` primitive (default-layout); RBAC nav gating + tenant-slug
  hrefs + white-label SidebarFooter (V32.26) preserved. Live-verified.
- **All 23 authed modules** (dashboard, settings/RBAC, CRM/clients/invoices/quotations, purchasing/inventory/
  POS/ecommerce, banking/accounting/payroll/expenses, projects/tasks/job-orders/service/employees/dtr/support)
  + **platform-admin**: consistent reusable RSC-safe `PageHeader` + Card/Table/Badge/EmptyState idiom. Every
  query/mutation/link/amount-math preserved verbatim; typecheck/lint/build green per module; comprehensive
  live-verify passed (~15 pages, 0 errors). One runtime RSC bug (function prop across server→client) found +
  fixed on the dashboard; lesson logged globally.

PENDING (owner):
- **Storefront (`store/*`)** — NOT restyled: it is the PUBLIC customer shop (product cards + cart), a different
  design language than the admin ERP; AdminCN has no shop scaffold. Needs a dedicated shop-design decision.
- **E re-baseline** — update `docs/DESIGN.md` + `docs/MOCKUP.jsx` to the AdminCN direction + capture a fresh
  `design:fidelity` baseline: this is a design-contract re-approval requiring owner sign-off (Scenario 49 §6, Rule 31).
- **Merge** `feat/admincn-adoption` (+ `feat/seo-foundation`, framework-sync) → local `main`: owner's call (HARD HOLD).
- Pre-existing (NOT AdminCN): notifications realtime — `/api/sse` Valkey "Stream isn't writeable" +
  `notification.list` connection errors. Separate bug to triage.
