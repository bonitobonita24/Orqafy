# Orqafy — Finance Business-Rules Proposal (D-2)

> **Status:** PROPOSAL — awaiting owner approval/redline. On approval, rules back-port to
> `docs/DECISIONS_LOG.md` + `docs/PRODUCT.md`, and the build = mostly **UI wiring over existing
> backend** + 3 genuinely-new pieces (PO tax compute, chart-of-accounts seed + default mapping,
> over-receipt guard). Authored by Claude (conductor) 2026-06-25 from a code-verified scout.

## Context — what already exists (do NOT rebuild)

Backend finance logic is **already built and tested** (~1026 tests). Earlier sessions shipped:

- **§A Accounting** — `journalEntry.post` (balanced + ≥2 lines + active-account + open-period guards,
  immutable once POSTED), `reverse` (mirror entry), `trialBalance`, `generalLedger`, Chart-of-Accounts
  CRUD, FiscalYear open/close.
- **§B Purchasing** — full PO lifecycle (`submit`/`approve`/`markOrdered`/`cancel`/`close`),
  per-tenant `poApprovalThreshold` (auto-approve ≤ ₱10k default), GR→Inventory stock movements, and
  **GR→JE auto-post is wired** — it fires automatically *the moment* GL default-account mapping is set.
- **§C Payroll** — `payroll.process` computes PH statutory (SSS/PhilHealth/Pag-IBIG/withholding) from a
  tenant-editable, effective-dated `StatutoryRate` table seeded with cited 2025 rates; `markPaid`
  deducts a FundSource + posts the payroll JE.

So D-2 is **not** "build finance logic." It is: (1) settle ~7 open owner-rules, (2) wire the UI that
surfaces the already-built procedures, (3) turn GR auto-post ON by seeding a chart + default mapping.

---

## Proposed rules (recommended defaults in **bold**)

### R1 — PO tax (VAT)  ⟵ genuinely new logic
- **Default: 12% Philippine VAT, computed automatically, EXCLUSIVE** (added on top of line subtotal),
  shown as a separate "VAT (12%)" line in the PO total.
- Per-PO **"VAT-exempt / zero-rated" toggle** (for exempt vendors / exempt transactions) → suppresses VAT.
- On GR→JE, input VAT posts to a **default "Input VAT" asset account** (added to the chart seed, R4).
- *Alternative if you prefer:* VAT-inclusive pricing (back-out 12% from entered amounts), or manual tax entry.

### R2 — PO line allocation routing
- **Per-line picker on the PO form: `stock` · `project_expense` · `company_expense`.**
- **Default = `company_expense`** when the line has no inventory-tracked product; **default = `stock`**
  when the line references an inventory product. `project_expense` requires choosing a project.
- This already drives GR→JE (stock → Inventory asset DR; expense → Expense DR; both CR AP). UI just needs
  to expose the choice (today it silently defaults to company_expense).

### R3 — Over-receipt (receiving more than ordered)
- **Default: ALLOW with a non-blocking warning** (3-way-match flag), capped at a configurable tolerance
  **(default 10% over PO qty)**; beyond tolerance requires an explicit confirm + reason (audited).
- *Alternative:* hard-block any over-receipt.

### R4 — GL default-account mapping  ⟵ the switch that turns GR auto-post ON
- **Seed a standard PH SME Chart of Accounts** on tenant provisioning (Assets/Liabilities/Equity/
  Income/Expense, incl. Inventory, Accounts Payable, Input VAT, Purchases/COGS, Salaries Expense,
  Statutory Payables, Withholding Payable), and **auto-set** the four AccountingSettings defaults
  (`defaultInventoryAccountId`, `defaultApAccountId`, `defaultExpenseAccountId`, `defaultFiscalYearId`)
  to the seeded accounts + the current open fiscal year.
- Expose an **Accounting → Settings UI** to review/remap these (and the new Input-VAT account).
- Effect: GR→JE auto-posts out-of-the-box; no per-tenant manual config needed.
- *Alternative:* ship the mapping UI only and require the owner to pick accounts before auto-post turns on.

### R5 — Editing & approval of POs
- **No header/line edits once a PO is APPROVED or beyond** (DRAFT/SUBMITTED editable only). To change an
  approved PO: `cancel` + clone a new draft. Keeps the approval meaningful + audit clean.
- Keep the **single-threshold auto-approval** (≤ ₱10k auto, above → approver role
  Administrator/Purchasing Manager). **No multi-tier approval in v1** (add later if needed).

### R6 — Vendor reactivation
- **A deactivated vendor may be reactivated by Administrator or Purchasing Manager at any time**
  (audited). No PO can be raised against a deactivated vendor.

### R7 — Payroll statutory rates (confirm, don't rebuild)
- **Confirm the already-seeded 2025 PH rates are the intended formula**: SSS 15% MSC (EE 5% / ER 10%,
  MSC ₱5k–₱35k), PhilHealth 5% (EE/ER 2.5% each, ₱10k–₱100k), Pag-IBIG 2%/2% (cap ₱200 EE),
  BIR TRAIN withholding by pay frequency. Owner edits annually via the StatutoryRate UI.
- Payslip form keeps manual-override fields, but **`payroll.process` is the source of truth** for
  computed deductions at the run level.

---

## Build plan once approved (architect-dispatched, UI-wiring-heavy)

1. **Accounting** — Settings UI for GL default mapping + Input-VAT; chart-of-accounts seed on provisioning (R4); JE list/create/post/reverse + Trial Balance + GL pages.
2. **Purchasing** — PO form: VAT compute (R1) + per-line allocation picker (R2); PO detail: submit/approve/markOrdered/cancel/close action island; GR form: over-receipt guard (R3) + auto-post notice; vendor reactivate (R6); block edits on approved POs (R5).
3. **Payroll** — process/approve/markPaid workflow UI + fund-source picker + statutory breakdown display; StatutoryRate config UI (R7).

All over existing procedures except R1 (tax compute), R3 (tolerance guard), R4 (chart seed). Each step:
verify-before-build, tenant-parity tests, L5 audit, full-suite gate before commit. Deploy stays HELD.
