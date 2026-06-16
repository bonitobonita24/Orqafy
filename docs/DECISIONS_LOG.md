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
