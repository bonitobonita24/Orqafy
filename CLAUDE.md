# CLAUDE.md — Orqafy Project Instructions

## Project Identity
- **Name:** Orqafy — Move as one.
- **Owner:** Powerbyte I.T. Solutions
- **Type:** Multi-tenant SaaS ERP with E-Commerce, Job Orders, and Customer Portal
- **Spec version:** PRODUCT.md (2,070 lines, ~90 entities, 97 pages, 13 roles, 23 queues)

## Commands

### `Bootstrap`
When the user says "Bootstrap" or "Start Bootstrap" or "bootstrap":
1. Read these files in order:
   - `docs/PHASE3_BRIEFING.md` (implementation guide — build order, critical rules, DO NOT list)
   - `docs/PRODUCT.md` (complete product specification — authoritative source of truth)
   - `docs/DESIGN.md` (VoltAgent visual design tokens — colors, typography, layout)
   - `docs/DECISIONS_LOG.md` (append-only decision history)
2. After reading all 4 files, respond with:
   ```
   ✅ Briefing acknowledged. I have the full Orqafy specification:
   - PRODUCT.md: 2,070 lines, ~90 entities, 97 pages, 13 roles, 23 queues
   - DESIGN.md: VoltAgent aesthetic (Abyss Black + Signal Green + Carbon Surface)
   - DECISIONS_LOG.md: 5 decisions, all locked
   - PHASE3_BRIEFING.md: 8 build slices, 20 critical rules
   
   Ready to begin Slice 1 — Foundation. Say "Start" to begin.
   ```
3. Wait for the user to say "Start" before writing any code.

### `Slice [N]`
When the user says "Slice 1", "Slice 2", etc. or "Proceed to Slice [N]":
- Execute the corresponding slice from `docs/PHASE3_BRIEFING.md`
- Follow the build order, entity list, key rules, and verification steps exactly
- After completing the slice, output what was built and the verification checklist
- Wait for the user to confirm before proceeding to the next slice

### `Audit`
When the user says "Audit":
- Run a consistency check across all implemented code against `docs/PRODUCT.md`
- Report any entities, fields, business rules, or workflows that are missing or incorrect
- Do not fix anything — just report findings

## Locked Decisions (never propose alternatives)
1. Tenancy: separate PostgreSQL schema per tenant (NOT RLS)
2. Auth: Auth.js v5 (no Keycloak, no SSO)
3. Roles: single role per user, 13 roles, enum-based
4. Frontend: Next.js + tRPC + Prisma + shadcn/ui + Tailwind CSS
5. Mobile: Expo managed workflow, internal MDM only
6. Database: PostgreSQL multi-schema + PgBouncer
7. Queue: Valkey + BullMQ, 23 queues, DLQ on every queue
8. Storage: MinIO (dev) / Cloudflare R2 (prod)
9. Email: Nodemailer per-tenant SMTP
10. Reverse proxy: Traefik, TRAEFIK_NETWORK=proxy
11. Deployment: Komodo Scenario 32
12. Dev mode: WSL2 native (MODE A)
13. Bot protection: Cloudflare Turnstile
14. Design: VoltAgent aesthetic from getdesign.md
15. Payment gateway: Xendit
16. No white-label: "Powered by Powerbyte I.T. Solutions" on all pages

## Critical Business Rules (always enforce)
1. Golden formula: `markedUpPrice = prevPrice / (1 - pct / 100)` — universal
2. Ceiling markup: percentage OR max fixed amount, whichever is lower
3. inventory_consumed expenses: NO journal entry, excluded from P&L
4. Project expenses use actualUnitCostAtPurchase, NOT product costPrice
5. Credit card starts at zero, matte red font, IS a valid payment method
6. Loan accounts CANNOT purchase/expense directly — only 3 transaction types
7. Real-cash accounts cannot go below zero
8. All items enter inventory first at receiving, then allocated out
9. Single role per user — strictly
10. Schema isolation — no tenantId on ERP entities
11. FundTransaction and CustomerCreditTransaction are immutable
12. Quotation pricing is always editable, never auto-committed from product data

## DO NOT
- Use `expo-barcode-scanner` (removed SDK 51) — use `expo-camera` with `barcodeScannerSettings`
- Use BlockNote XL packages — core only (@blocknote/core + @blocknote/react)
- Add tenantId columns to ERP entities — schema IS the boundary
- Create journal entries for inventory_consumed ProjectExpenses
- Use box-shadow for depth — use border weight (VoltAgent elevation)
- Use pure white `#ffffff` — use Snow White `#f2f2f2`
- Fill buttons with Signal Green bg + white text — use Carbon Surface bg + Mint text + Signal Green border
- Auto-commit product pricing into quotations
- Use product costPrice for project expense amounts — use actualUnitCostAtPurchase
- Make loan accounts usable for direct purchases or expenses

## File Structure
```
docs/
├── PRODUCT.md              # Complete spec (authoritative)
├── DESIGN.md               # VoltAgent visual tokens
├── DECISIONS_LOG.md         # Append-only decisions
├── PHASE3_BRIEFING.md       # Build slices + critical rules
└── archive/
    └── DESIGN-linear-sunset.md  # Previous aesthetic (archived)
```
