# Phase 3 — Claude Code Implementation Briefing
# Product: Orqafy — Move as one.
# Generated: 2026-05-01
# Target agent: Claude Opus 4.6 or Claude Sonnet 4.6 via Claude Code
# Spec version: PRODUCT.md (2,070 lines, ~90 entities, 97 pages, 13 roles, 23 queues)

---

## How this file works with the Spec-Driven Platform

This file lives at `docs/PHASE3_BRIEFING.md` and is read by Claude Code as part of
the governance docs (Rule 4 in the framework's CLAUDE.md). It provides Orqafy-specific
implementation guidance that supplements the framework's standard phase system.

**DO NOT create a separate CLAUDE.md for this project.** The framework's deploy-v31.sh
generates CLAUDE.md automatically. This briefing file is the project-specific layer.

**Workflow:**
1. Run `deploy-v31.sh` → framework generates CLAUDE.md + .claude/rules/ + governance files
2. Place docs: `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/DECISIONS_LOG.md`, this file
3. Open Claude Code → auto-loads framework CLAUDE.md → type "Bootstrap"
4. After Bootstrap completes → type "Start Phase 4"
5. Claude Code reads this briefing as part of governance docs and follows the 8 build slices
6. After each slice → verify → "Proceed to Slice [N+1]"

**Reading order for this project's docs:**
1. `docs/PRODUCT.md` — the complete product specification (2,070 lines, authoritative)
2. `docs/DESIGN.md` — VoltAgent visual design reference (color tokens, typography, layout)
3. `docs/DECISIONS_LOG.md` — append-only decision history (5 entries)
4. This file — implementation build slices and critical rules

All architectural decisions are LOCKED. Do not propose alternatives for any locked decision.

---

## Product identity

**Name:** Orqafy
**Tagline:** Move as one. — The all-in-one project & business operations platform for growing companies.
**Owner:** Bonito, founder of Powerbyte IT Solutions (Lipa City, Philippines)
**Branding:** "Powered by Powerbyte I.T. Solutions" footer on ALL pages
**Domain:** Multi-tenant SaaS ERP with E-Commerce, Job Orders, and Customer Portal
**Currency:** Philippine Peso (₱ / PHP)
**Production URL:** `erp.powerbyte.app/<tenant_slug>/erp`

---

## Locked architectural decisions (DO NOT revisit)

1. **Tenancy:** Multi-tenant, separate PostgreSQL schema per tenant (NOT RLS). Schema: `t_<slug_underscored>`. Subdirectory routing. No wildcard DNS.
2. **Auth:** Auth.js v5. No Keycloak, no SSO.
3. **Roles:** Single role per user (enum). 13 roles. No custom roles.
4. **Frontend:** Next.js single app + tRPC + Prisma + shadcn/ui + Tailwind CSS.
5. **Mobile:** Expo managed workflow + React Native Reusables + NativeWind + WatermelonDB + Expo Push. Internal MDM only.
6. **Database:** PostgreSQL multi-schema, PgBouncer. Railway or Supabase in prod.
7. **Queue:** Valkey + BullMQ (single shared worker, tenantSlug per job). 23 queues, DLQ on every queue.
8. **Storage:** MinIO (dev) / Cloudflare R2 (prod).
9. **Email:** Nodemailer per-tenant SMTP (TenantSmtpConfig, encrypted). Platform emails from .env.
10. **Reverse proxy:** Traefik, TRAEFIK_NETWORK=proxy (LOCKED).
11. **Deployment:** Komodo Scenario 32 — staging auto-update, prod manual.
12. **Dev mode:** WSL2 native (MODE A).
13. **Bot protection:** Cloudflare Turnstile free tier, Managed mode.
14. **Password policy:** 22-char minimum AI-generated. First admin = `webmaster`.
15. **Design:** VoltAgent aesthetic — Abyss Black `#050507`, Signal Green `#00d992`, Carbon Surface `#101010`, Warm Charcoal borders `#3d3a39`. See DESIGN.md.
16. **Payment gateway:** Xendit (GCash, Maya, cards, bank, OTC).
17. **No white-label:** All tenants show Orqafy brand + "Powered by Powerbyte I.T. Solutions".

---

## Implementation build order (8 slices)

Build in this order. Each slice must be tested and verified before proceeding to the next.
The full PRODUCT.md stays in context throughout — slices are for implementation focus, not
context management.

### Slice 1 — Foundation (Week 1)
**Goal:** Repo scaffold, Docker Compose, database, auth, tenant provisioning.

Build:
- Monorepo structure: `apps/web` (Next.js), `apps/worker` (BullMQ), `apps/mobile` (Expo), `packages/jobs`, `packages/db` (Prisma)
- Docker Compose: postgres + pgbouncer, valkey, minio, mailhog (dev), web, worker
- Prisma schema: global entities (Tenant, Plan, TenantSubscription, TenantInvoice, TenantPayment, TenantAuditLog, TenantSmtpConfig)
- Prisma multi-schema middleware: `search_path` switching per request
- Auth.js v5 setup with JWT, role enum, tenantSlug in token
- Tenant provisioning flow: signup → schema creation → seed → welcome email
- tRPC router scaffold with tenant-scoped context
- Basic RBAC middleware (role checking per procedure)
- Cloudflare Turnstile on login/register
- CREDENTIALS.md generation
- shadcn/ui + Tailwind + VoltAgent globals.css (see DESIGN.md CSS variables)
- Landing page, login, register, demo system scaffold

**Verify:** Can create a tenant, login, see empty dashboard, role-based route protection works.

### Slice 2 — CRM & Sales (Week 2)
**Goal:** Customers, Proposals & Quotations, Invoices, Subscriptions, Payments, Credit.

Entities:
- Customer (3 types: government/private/individual, 3 tiers: regular/vip/authorized_dealer)
- CustomerContact (multiple per customer, hidden for individual)
- CustomerCreditAccount, CustomerCreditTransaction (immutable ledger)
- Proposal, ProposalAttachment, ProposalLink, ProposalRevision
- Quotation, QuotationSection, QuotationMarkupColumn, QuotationLineItem, QuotationLineItemMarkup, QuotationRevision
- Invoice (with quotationId, projectId, publicToken, signatureUrl)
- Payment (excess handling: credit or refund)
- Subscription (auto-invoice generation)

Key rules:
- **Golden formula:** `markedUpPrice = previousPrice / (1 - percentage / 100)` — this is universal, applied in both Quotation markup columns AND Product standard pricing. Treat as locked invariant. It is a REVERSE-PERCENTAGE markup, NOT simple multiply.
- **Quotation pricing is always manual/editable** — system suggests but never auto-commits
- **Invoice from Quotation** uses Quotation's approved prices, NOT product standard pricing
- **Customer tier pricing:** Regular = SRP, VIP = 10% off, Dealer = 12% off
- **Revision tracking:** full document snapshot per revision, never overwritten
- **Customer detail page:** 8 submenus (Profile, Proposals, Invoices, Subscriptions, Payments, Credit Notes, Projects, Tickets)
- **Public invoice:** publicToken UUID, /invoice/<publicToken> no auth, rate-limited

**Verify:** Create customer (all 3 types), create proposal with files + links, create quotation with markup computation (verify golden formula math), revise quotation (verify snapshot saved), convert to invoice, record partial payment, verify credit flow.

### Slice 3 — Purchasing (Week 3)
**Goal:** Vendors, POs, shipping distribution, goods receipt, allocation splits.

Entities:
- Vendor, DirectSupplier, ECommerceSeller (Shopee/Lazada/TikTok Shop/Zalora/FB Marketplace)
- PurchaseOrder, PurchaseOrderItem (with cost computation fields)
- PurchaseOrderItemAllocation (stock/project_expense/company_expense splits)
- ShippingCost (multiple per PO, each with FundSource payment), ShippingCostDistribution
- GoodsReceipt, GoodsReceiptItem
- PurchaseInvoice

Key rules:
- **Item allocation at PO creation, execution at receiving** — all items enter inventory FIRST
- **Allocation prompt** at receiving for project/company items
- **Allocation re-assignment** — bidirectional (project↔stock↔company)
- **Approval roles:** project use → project_manager accepts, company use → admin accepts
- **Shipping cost distribution:** two methods — equal share (÷ qty) or proportional by cost (% of order value); pre-filled editable suggestions per item
- **landedUnitCost** = effectiveUnitCost + distributedShippingCost
- **Cost change decision:** when new cost differs from previous, show comparison, admin chooses Accept or Retain. Retention affects product SRP only — project expenses ALWAYS use actual purchase cost (actualUnitCostAtPurchase).
- **Inline product quick-add** during PO creation (no navigation away from PO form)
- **Fuzzy product matching** for Shopee items against existing inventory
- **Shopee API:** optional v2 integration, manual entry is primary flow

**Verify:** Create PO with 5 items, split allocations, add 3 shipping legs, verify both distribution methods, receive goods, verify allocation prompt, process project take-out, verify ProjectExpense at actual cost.

### Slice 4 — Inventory & POS (Week 4)
**Goal:** Products with 3-tier pricing, serial numbers, QR/barcode, POS.

Entities:
- Product (3-tier standard pricing, ceiling markup mode, barcodeValue, isVisibleInEcommerce, ecommerceDescription, ecommerceImages, requiresSerialNumber)
- ProductSerialNumber (lifecycle: in_stock → sold | disbursed | transferred | written_off)
- Category (parent-child hierarchy)
- ProductPurchaseHistory
- StockMovement, Warehouse, WarehouseStock
- InventoryDisbursement, InventoryDisbursementItem
- POSSession, POSSale, POSSaleItem

Key rules:
- **3-tier pricing:** Cost → Tier 1 Dealer (15%) → Tier 2 Commissioner (5%) → Tier 3 SRP+VAT (12%). Same golden formula per tier.
- **Ceiling markup:** per product per tier — percentage OR max fixed amount, whichever is lower
- **Serial number scanning:** smartphone camera OCR + QR/barcode scanner; system flags items needing scan before sale/handover
- **QR/barcode generation:** auto-generated or manual input per product
- **Inventory disbursement:** 4-step workflow (request → approve → scan/fulfill → expense at actual cost). NO journal entry (prevents double-expensing).
- **POS walk-in linkage:** staff can link sale to customer account; appears in portal as in_store order
- **isVisibleInEcommerce:** controls storefront visibility

**Verify:** Create product with all 3 tiers + ceiling cap, verify pricing math, create serialized product, receive via goods receipt (scan serials), sell via POS (scan serials), verify stock deduction, create disbursement to project, verify ProjectExpense at actual cost with no journal entry.

### Slice 5 — Banking & Finance (Week 5)
**Goal:** Fund sources (5 types), transfers, requests, credit card lifecycle, loan accounts, master ledger.

Entities:
- FundSource (cash_on_hand, e_wallet, bank, credit_card, loan — with assignedTo for custodians)
- FundTransfer, FundRequest
- FundTransaction (immutable ledger with details + attachments)
- FundTransactionAttachment
- CreditCardTransaction (per-charge tracking with bankFee, isPaid lifecycle)
- CreditCardPayment (selective multi-select, installments)

Key rules:
- **5 account types** with distinct behaviors (see PRODUCT.md entity NOTE)
- **Credit card:** starts at zero, matte red font, CAN be used for any purchase/expense
- **Credit card bill payment:** selective multi-select matching billing statement; bankFee addable after the fact; paid transactions grayed + PAID badge but still clickable
- **Installment:** excess over original = bank charges expense
- **Loan:** real money received, CANNOT purchase/expense directly, only 3 transaction types (Money Out To, Money In, Payback To); paid → disabled with PAID label
- **Custodian accounts:** employee holds company funds, records own expenses, admin reviews
- **Fund requests:** any custodian can request, account holder approves/denies
- **Master ledger:** centralized chronological view ALL accounts in one timeline
- **Transaction attachments:** file uploads per transaction (receipts, proofs)
- **Real-cash guard:** cash/bank/e-wallet cannot go below zero

**Verify:** Create all 5 account types, transfer between accounts, create fund request (approve/deny), charge credit card, add bankFee, do selective payment (multi-select), convert to installment, create loan, disburse to bank, repay, payback to close.

### Slice 6 — Projects, Tasks, HR & Payroll (Week 6)
**Goal:** Project management, tasks, attendance, employees, payroll.

Entities:
- Project, ProjectExpense, ProjectNote, ProjectNoteAttachment, Milestone
- Task, TaskAssignment, TaskAttachment, TaskStatusReport, ToDo
- TimeLog, ExpenseCategory
- Employee, AttendanceRecord, Attendance, LeaveRequest
- CashAdvance, CashAdvanceRecovery, Payroll, Payslip
- Department

Key rules:
- **ProjectExpense costType:** direct (normal, creates journal entry) vs inventory_consumed (from disbursement, NO journal entry, project-only visibility)
- **Inventory-consumed expenses excluded from P&L** and all accounting reports
- **Task multi-assignee** via TaskAssignment join table
- **BlockNote** for project notes (web: full editor, mobile: read-only renderer)
- **GPS attendance** with null-GPS policy (allowed with warning)
- **Cash advance** recovery per payroll cycle (e.g. "3/6 recovered")
- **CashAdvance is personal loan** — different from custodian FundSource (company funds)

**Verify:** Create project with budget, add tasks with multi-assignee, log time, create milestone (verify auto-completion), add project note (BlockNote), create expense (direct + inventory_consumed), verify P&L exclusion, run payroll with CA deduction.

### Slice 7 — E-Commerce, Job Orders, Customer Portal (Week 7)
**Goal:** Public storefront, Xendit payments, repair workflow, full customer portal.

Entities:
- EcommerceOrder, EcommerceOrderItem
- JobOrder (14-char ID, full repair workflow, signatures, printable PDF)
- CustomerDocument
- Customer portal: 11 submenus

Key rules:
- **E-Commerce:** public browsing, login required for checkout; Xendit webhook for payment confirmation; stock deducted on payment (not cart add); customer tier discount auto-applied
- **Job Order ID:** YYYYMMDD + 6 random uppercase alphanumeric (e.g. 20260430UPWLFM)
- **Job Order workflow:** received → diagnosis → quotation_pending → customer_approved → in_repair → testing → ready_for_pickup → released → closed
- **Parts from inventory:** uses same Quotation markup computation; deducted from stock on approval
- **Customer portal:** activity feed, online payment for invoices via Xendit, approve/decline repair quotations
- **Walk-in POS linkage** to customer account

**Verify:** Browse storefront (only isVisibleInEcommerce products), add to cart, checkout with Xendit (test mode), verify order + stock deduction + FundTransaction. Create job order, run through full workflow, create parts quotation, verify inventory deduction, print PDF with signatures.

### Slice 8 — Accounting, Reports, Support, Platform Admin (Week 8)
**Goal:** Chart of accounts, journal entries, all reports, tickets, platform admin.

Entities:
- Account, JournalEntry, JournalLine, TaxRate, FiscalYear
- Ticket, TicketComment, TicketAttachment
- Platform admin entities already built in Slice 1

Key rules:
- **Journal entries auto-posted** on every money movement
- **inventory_consumed ProjectExpenses:** NO journal entry, excluded from ALL accounting reports
- **Purchase Orders:** treated as asset acquisitions in P&L, NOT operational expenses
- **Income vs Expense report:** POs excluded from expenses
- **Master Ledger report:** all transactions, all accounts, chronological
- **Inventory Valuation:** dual view — at cost (costPrice × qty) AND at SRP (tier3Price × qty)
- **Credit card outstanding:** liability on balance sheet

**Verify:** Verify journal entries auto-created for payments, expenses, payroll. Run P&L — confirm inventory_consumed excluded and POs not in expenses. Run inventory valuation — verify both cost and SRP totals. Run master ledger export.

---

## Critical business rules (must-implement checklist)

These rules MUST be explicitly implemented. If any is missed, the system produces incorrect
financial data.

| # | Rule | Where it applies |
|---|------|-----------------|
| 1 | Golden formula: `markedUpPrice = prevPrice / (1 - pct / 100)` | Quotation markup, Product 3-tier pricing |
| 2 | Ceiling markup: when computed markup exceeds ceiling, use ceiling amount | Product pricing per tier |
| 3 | inventory_consumed expenses: NO journal entry, excluded from P&L | ProjectExpense, Accounting reports |
| 4 | Project expenses use actualUnitCostAtPurchase, NOT product costPrice | PurchaseOrderItemAllocation, InventoryDisbursement |
| 5 | Cost retention affects SRP only, never project expenses | Goods receipt cost change decision |
| 6 | Credit card starts at zero, matte red font, IS a valid payment method | FundSource type=credit_card |
| 7 | Loan cannot purchase/expense directly, only 3 transaction types | FundSource type=loan |
| 8 | Real-cash accounts cannot go below zero | FundSource cash/bank/e-wallet |
| 9 | All items enter inventory first at receiving, then allocated out | GoodsReceipt + PurchaseOrderItemAllocation |
| 10 | Single role per user — strictly | User.role enum |
| 11 | Schema isolation — no tenantId on ERP entities, schema IS the boundary | Prisma middleware, all tenant entities |
| 12 | publicToken immutable once created, never regenerated | Invoice.publicToken |
| 13 | FundTransaction is immutable — never updated or deleted | FundTransaction entity |
| 14 | CustomerCreditTransaction is immutable | CustomerCreditTransaction entity |
| 15 | Revision snapshots are full document copies, never overwritten | ProposalRevision, QuotationRevision |
| 16 | Quotation pricing is always editable, never auto-committed from product data | Quotation creation flow |
| 17 | VIP = 10% discount, Dealer = 12% discount, Regular = SRP (5% if ≥₱3K + admin approval) | Customer tier pricing |
| 18 | Credit card bankFee addable after the fact, not at charge time | CreditCardTransaction.bankFee |
| 19 | CC bill payment is selective multi-select, not automatic oldest-first | CreditCardPayment.coveredTransactionIds |
| 20 | Job Order ID = YYYYMMDD + 6 random uppercase alphanumeric | JobOrder.jobOrderNumber |

---

## File upload paths

All uploads go to R2/MinIO under tenant slug prefix:

```
<tenant_slug>/receipts/<type>/<id>/<filename>
<tenant_slug>/documents/proposals/<id>/<filename>
<tenant_slug>/documents/proposals/<id>/links (ProposalLink — external URLs, not files)
<tenant_slug>/tickets/<id>/<filename>
<tenant_slug>/projects/<project_id>/notes/<note_id>/<filename>
<tenant_slug>/projects/<project_id>/tasks/<task_id>/<filename>
<tenant_slug>/invoices/<id>/signature.png
<tenant_slug>/job-orders/<id>/device-photos/<filename>
<tenant_slug>/job-orders/<id>/intake-signature.png
<tenant_slug>/job-orders/<id>/pickup-signature.png
<tenant_slug>/ecommerce/products/<id>/<filename>
<tenant_slug>/transactions/<id>/<filename>
<tenant_slug>/customers/<id>/documents/<filename>
```

Max file sizes: 10MB standard, 50MB for ProjectNote and Proposal attachments, 1MB for signatures.

---

## Environment variables required

```env
# Database
DATABASE_URL=postgresql://...
PGBOUNCER_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=<22+ char>
NEXTAUTH_URL=http://localhost:<port>

# Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=<generated>
MINIO_SECRET_KEY=<generated>
MINIO_BUCKET=orqafy

# Queue
VALKEY_URL=redis://localhost:6379

# Platform SMTP
SMTP_HOST=<powerbyte smtp>
SMTP_PORT=587
SMTP_USER=<powerbyte email>
SMTP_PASS=<powerbyte pass>
SMTP_FROM_ADDRESS=noreply@powerbyte.app
SMTP_FROM_NAME=Orqafy

# Cloudflare Turnstile
TURNSTILE_SITE_KEY=1x00000000000000000000AA  # dev test key
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA  # dev test secret

# Xendit (per-tenant in TenantXenditConfig, but platform-level fallback)
XENDIT_SECRET_KEY=<dev test key>
XENDIT_WEBHOOK_TOKEN=<generated>
```

---

## Sample data theme

All seed data and demo data must use Filipino business context:

**Companies:** Metro Aquatics Inc., Alaska Milk Corporation, Jollibee Foods Corp., San Miguel Corporation, Universal Robina Corp., PLDT Enterprise, BDO Unibank, Converge ICT, Globe Telecom, Smart Communications, Batangas Medical Center, Municipality of Lipa, Dept. of Education Region IV-A

**Staff:** Bonito Aguileon (CEO), Maria Santos (PM), Juan dela Cruz (Sr. Tech), Rhea Aquino (Inventory), Paolo Villanueva (Field Tech), Jenny Reyes (Accountant), Carlo Tan (Sales), Rica Mendoza (HR), Kevin Lim (Support), Beth Magno (Cashier)

**Vendors:** Dataworld Direct, Hikvision PH Distributor, Ubiquiti PH Official, APC Philippines, Cisco Gold Partner PH, NetVille Solutions (Shopee), CDR King (Lazada), Cable Express (Shopee), MikroTik PH (TikTok Shop)

**Products:** SKU format `PB-CBL-6A-305`, `PB-SW-CC2960X-24`, `PB-RT-MK-RB5009`, etc. IT networking/infrastructure equipment.

**Tenant slugs:** acme-corp, mabuhay-systems, batangas-it-hub, cebu-tech-partners, davao-netlink

**Couriers:** Lalamove, Aguileon Cargo Express Corp., J&T Express

**Banks:** BDO, UnionBank, BPI

**E-wallets:** GCash, Maya, GoTyme

---

## What NOT to do

- Do NOT use `expo-barcode-scanner` — removed in SDK 51. Use `expo-camera` with `barcodeScannerSettings`.
- Do NOT use BlockNote XL packages — core packages only (@blocknote/core + @blocknote/react).
- Do NOT add tenantId columns to ERP entities — schema IS the boundary.
- Do NOT create journal entries for inventory_consumed ProjectExpenses.
- Do NOT use box-shadow for depth — use border weight (VoltAgent elevation philosophy).
- Do NOT use pure white `#ffffff` — use Snow White `#f2f2f2`.
- Do NOT fill buttons with Signal Green background + white text — use Carbon Surface bg + Mint text + Signal Green border (VoltAgent CTA pattern).
- Do NOT auto-commit product pricing into quotations — always editable.
- Do NOT use product costPrice for project expense amounts — use actualUnitCostAtPurchase from the specific PO.
- Do NOT make loan accounts usable for direct purchases or expenses.

---

## Ready signal

When Claude Code reads this briefing as part of Phase 4 startup, it should confirm:

```
✅ Orqafy implementation briefing loaded.
- PRODUCT.md: 2,070 lines, ~90 entities, 97 pages, 13 roles, 23 queues
- DESIGN.md: VoltAgent aesthetic (Abyss Black + Signal Green)
- DECISIONS_LOG.md: 5 locked decisions
- Build plan: 8 slices, 20 critical rules, 10 DO NOT items

Ready to begin Slice 1 — Foundation. Say "Start" to begin.
```

Then wait for "Start" before writing any code.

**Slice commands during Phase 4:**
- "Start" → begins Slice 1
- "Proceed to Slice [N]" → advances to next slice
- "Audit" → runs consistency check against PRODUCT.md without fixing anything
