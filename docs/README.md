# Orqafy

**Move as one.** — The all-in-one project & business operations platform for growing companies.

Orqafy unifies sales, purchasing, inventory, projects, HR & payroll, POS, accounting, and support into a single multi-tenant SaaS platform — where every peso movement, every employee clock-in, and every project cost traces back to one fund source ledger.

## What it does

- **CRM & Sales** — Customers, proposals & quotations, invoices with partial payments, credit management, subscriptions, public invoice sharing with digital signatures
- **Purchasing** — Vendors (direct suppliers + e-commerce sellers), purchase orders with landed cost computation, goods receipts with photo uploads
- **Inventory** — Products with serial number tracking, barcode/QR scanning, multi-warehouse stock, low-stock alerts, project disbursement workflow
- **Projects** — Budget tracking, milestones, multi-assignee tasks with subtasks, time logs, Notion-style project notes (BlockNote), expense tracking by category
- **HR & Payroll** — Employee records, GPS-based attendance (online + offline), leave management, cash advances with payroll recovery, payslip generation
- **POS** — Session-based point of sale with real-time stock deduction, serial number scanning, cash reconciliation
- **Accounting** — Chart of accounts, auto-posted journal entries on every money movement, P&L, balance sheet, tax management
- **Support** — Ticketing system with priority levels, internal/external comments, customer and project linking

## Architecture

- **Frontend:** Next.js (single unified app) + tRPC + shadcn/ui + Tailwind CSS
- **Database:** PostgreSQL with separate schema per tenant (schema-level isolation, not RLS)
- **Auth:** Auth.js v5
- **Queue:** BullMQ + Valkey (20 queues with DLQ on each)
- **Storage:** MinIO (dev) / Cloudflare R2 (prod)
- **Mobile:** Expo managed workflow + WatermelonDB (offline-first) + Expo Push Notifications

## Multi-tenancy

Subdirectory routing (`erp.powerbyte.app/<tenant_slug>/erp`) with separate PostgreSQL schema per tenant. No wildcard DNS, no per-tenant SSL. Prisma middleware switches `search_path` atomically per request.

## Mobile app

**Orqafy Mobile** — iOS + Android via Expo. Internal/enterprise distribution only (MDM, not app stores). Offline-first DTR clock-in/out with native GPS, task management, expense submission with receipt capture, payslip viewing. WatermelonDB for local storage, auto-sync on reconnect.

## Key differentiators

- **Fund source ledger** — Every money movement (payment, expense, payroll, credit card settlement) references a specific fund source. Complete audit trail.
- **Inventory disbursement** — 4-step workflow (request → approve → scan & fulfill → expense logged) with no double-expensing. Inventory costs journaled at purchase, not at project consumption.
- **Credit Manager** — Customer advance payments, excess payment decisions, credit application to invoices — all tracked via immutable ledger.
- **Serial number tracking** — Per-unit lifecycle tracking from goods receipt through sale, disbursement, transfer, or write-off.
- **Demo system** — Single shared demo tenant with role switcher, auto-reset every 6 hours, all mutations blocked server-side.

## Roles

13 roles: `platform_owner`, `tenant_super_admin`, `admin`, `accountant`, `hr_manager`, `project_manager`, `sales_staff`, `purchasing_staff`, `inventory_staff`, `staff`, `cashier`, `support_agent`, `customer`. Single role per user, strictly enforced.

## Status

🚧 **In development** — Phase 2 (specification) complete, Phase 3 (scaffolding) next.

## License

Proprietary — © Powerbyte I.T. Solutions. All rights reserved.

---

<sub>Powered by **Powerbyte I.T. Solutions**</sub>
