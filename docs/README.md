# Orqafy

**Move as one.** — The all-in-one project & business operations platform for growing companies.

Orqafy unifies sales, purchasing, inventory, projects, HR & payroll, POS, e-commerce, repairs, accounting, and support into a single multi-tenant SaaS platform — where every peso movement, every employee clock-in, and every project cost traces back to one fund source ledger.

## What it does

- **CRM & Sales** — Customers (government/private/individual) with 3-tier pricing (Regular/VIP/Authorized Dealer), proposals & quotations with full-snapshot revision tracking, invoices with partial payments & credit management, subscriptions, public invoice sharing with digital signatures
- **Proposals & Quotations** — Proposals as pitch containers (files, links, scope); Quotations with Excel-like markup computation using the golden formula (`markedUpPrice = prevPrice / (1 - pct/100)`), configurable sections (Equipment/Materials/Labor), ceiling-capped markup mode for high-value products
- **Purchasing** — Direct suppliers & e-commerce sellers (Shopee/Lazada/TikTok Shop), PO item allocation splits (stock/project/company), multi-leg shipping cost distribution (equal share or proportional by cost), inline product quick-add, fuzzy product matching, cost change decision system
- **Inventory** — Products with 3-tier standard pricing (Dealer/Commissioner/SRP), ceiling markup, QR/barcode generation, serial number tracking with smartphone camera OCR, multi-warehouse stock, project disbursement workflow (4-step: request → approve → scan → expense at actual cost)
- **Projects** — Budget tracking, milestones, multi-assignee tasks with subtasks, time logs, Notion-style project notes (BlockNote), expense tracking by category
- **HR & Payroll** — Employee records, GPS-based attendance (online + offline), leave management, cash advances with payroll recovery, payslip generation
- **POS** — Session-based point of sale with serial number scanning, cash reconciliation, walk-in customer account linking
- **Banking & Finance** — 5 account types (cash on hand, e-wallet, bank, credit card, loan), custodian accounts for decentralized expense recording, fund transfers & requests, credit card lifecycle (per-charge tracking, bank fees, selective multi-select payment, installments), loan accounts (3 transaction types only), master ledger (cross-account chronological view)
- **E-Commerce** — Public storefront with Xendit payment gateway (GCash/Maya/cards/bank/OTC), customer tier pricing auto-applied, order management, inventory integration
- **Repairs & Job Orders** — Digitized job order form (14-char system ID), device intake/pickup signatures, repair workflow with parts quotation from inventory, printable PDF, customer portal approval
- **Accounting** — Chart of accounts, auto-posted journal entries, P&L, balance sheet, income vs expense reports (POs excluded as assets), inventory valuation (at cost + at SRP)
- **Support** — Priority-based ticketing with internal/external comments and project linking
- **Customer Portal** — 11 submenus: dashboard, online orders, invoices (pay via Xendit), proposals (accept/decline), repairs (approve parts), projects, subscriptions, payments & credit, tickets, documents, profile

## Architecture

- **Frontend:** Next.js (single unified app) + tRPC + shadcn/ui + Tailwind CSS
- **Database:** PostgreSQL with separate schema per tenant (schema-level isolation, not RLS)
- **Auth:** Auth.js v5
- **Queue:** BullMQ + Valkey (23 queues with DLQ on each)
- **Storage:** MinIO (dev) / Cloudflare R2 (prod)
- **Payment:** Xendit (platform billing + per-tenant e-commerce)
- **Mobile:** Expo managed workflow + WatermelonDB (offline-first) + Expo Push Notifications
- **Design:** VoltAgent aesthetic — Abyss Black `#050507`, Signal Green `#00d992`, Carbon Surface `#101010`

## Plans

| Plan | Monthly | Annual | Users | Storage |
|------|---------|--------|-------|---------|
| Free | ₱0 | ₱0 | 3 | 0 GB (no uploads/scanning/projects) |
| Starter | ₱2,500 | ₱25,000 | 5 | 5 GB |
| Growth | ₱5,000 | ₱50,000 | 15 | 25 GB |
| Pro | ₱10,000 | ₱100,000 | 50 | 100 GB |
| Enterprise | ₱25,000 | ₱250,000 | Unlimited | 500 GB |

7-day free trial on Starter plan. Annual pricing = 10 months (2-month discount).

## Roles

13 roles: `platform_owner`, `tenant_super_admin`, `admin`, `accountant`, `hr_manager`, `project_manager`, `sales_staff`, `purchasing_staff`, `inventory_staff`, `staff`, `cashier`, `support_agent`, `customer`. Single role per user, strictly enforced.

## URLs

- **Production:** `https://orqafy.powerbyte.app/<slug>/erp`
- **Staging:** `https://orqafy-staging.powerbyte.app/<slug>/erp`
- **Docker Hub:** `bonitobonita24/orqafy`

## Status

🚧 **In development** — Phase 2 (specification) complete, Phase 3 (scaffolding) next.

## License

Proprietary — © Powerbyte I.T. Solutions. All rights reserved.

---

<sub>Powered by **Powerbyte I.T. Solutions**</sub>
