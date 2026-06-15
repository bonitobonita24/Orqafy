# UI ↔ Backend Gaps — Refreshed (code-verified 2026-06-15)

> **What this file is.** A code-verified gap audit against HEAD `2907c79` (main, 2026-06-15).
> Each domain was spot-checked by grepping `apps/web/src/app` for `trpc.<router>.` call sites.
> This supersedes the original W0–W13 wiring-wave input, which was partly stale.

---

## Wiring status by domain

| Domain | Router | UI calls it | Mutations wired | Gap class |
|--------|--------|------------|-----------------|-----------|
| CRM (quotations / customers / contacts / credit) | Y | Y (8 files) | Y — create, update, toggle, credit, contact-log | **DONE** |
| Clients (B2B list) | Y | Y (1 file) | Partial — list only, no create/edit form | **AUTONOMOUS** |
| Invoices | Y | Y (2 files) | Y — create, markSent, recordPayment, markPaid, void | **DONE** |
| POS (sessions / sales / void) | Y | Y (4 files) | Y — sale.create, sale.void, session.open/close | **DONE** |
| Inventory (products / categories / warehouses / movements) | Y | Y (6 files) | Y — product CRUD, warehouse, category, stock movements | **DONE** |
| Purchasing (vendors / POs / goods receipt) | Y | **0 UI calls** | N — 11 mutations entirely unwired | **AUTONOMOUS** |
| Accounting (journals / chart of accounts) | Y | **0 UI calls** | N — full CRUD surface has zero UI wiring | **AUTONOMOUS** |
| Banking / Fund Sources | Y | Y (2 files) | Y — create, update, toggleActive, income/expense | **DONE** |
| HR — Employees | Y | Y (3 files) | Y — create, update, terminate | **DONE** |
| HR — Payroll | Y | **0 UI calls** | N — create/process/approve/markPaid all missing | **AUTONOMOUS** |
| HR — DTR / Leave | Y | Y (3 files) | Y — approve/reject, leave full cycle (clockIn/clockOut missing) | **DONE** |
| Projects | Y | Y (1 file) | Partial — project.create only; update/complete/archive/milestones/expenses missing | **AUTONOMOUS** |
| Tasks | Y | **0 UI calls** | N — task cards are non-clickable divs; zero `trpc.tasks.` calls | **PHANTOM** |
| Job Orders / Service | Y | Y (3 files) | Partial — detail wired; intake form + assignTechnician missing | **AUTONOMOUS** |
| Support / Tickets | Y | **0 UI calls** | N — no create/update/assign/status/close/comment UI | **PHANTOM** |
| Notifications | Y | Y (1 file, dashboard) | Partial — markRead/markAllRead wired; delivery backend (Valkey) + header bell unbuilt | **OWNER-GATED** |
| Storefront / Ecommerce | Y | Y (6 files) | Y — staff order, Xendit pay, fulfillment, public checkout, order tracking | **DONE** |
| Reports | Y | **0 UI calls** | N — no `trpc.report.` calls in any UI page | **AUTONOMOUS** |
| Settings (account / users / xendit) | Y | Y (3 sub-pages) | Y — fully wired (these were already live before this session) | **DONE** |
| Settings (departments / expense-categories / smtp) | Y | Y (3 sub-pages) | Y — **built this session** (commit `2907c79`) | **DONE** |

**Totals: 10 DONE · 8 AUTONOMOUS · 1 OWNER-GATED · 2 PHANTOM**

---

## AUTONOMOUS gaps (specced CRUD, no product decisions needed)

These can be built by dispatching architects without owner input.

### 1. Purchasing — 11 mutations, zero UI
- Vendor CRUD (list/create/edit/deactivate)
- PO builder (line items, submit, approve, reject)
- Goods receipt form
- Purchase invoice recording

### 2. Accounting — full CRUD, zero UI
- Chart of accounts manager (account create/update/deactivate)
- Journal entry builder (debit/credit lines, submit, approve)
- Fiscal year management

### 3. Payroll — run lifecycle, zero UI
- Payroll create/process/approve/markPaid forms
- Payslip view per employee
- Cash advance create/approve/recovery recording

### 4. Tasks — 13 mutations, PHANTOM (task cards are static divs)
- Task create/edit modal (title, description, assignee, due date, priority)
- Status update (drag-drop or inline select)
- Comment/attachment add
- Task detail drawer

### 5. Support / Tickets — 6 mutations, PHANTOM
- Ticket intake form (create)
- Ticket detail view with status actions (assign, resolve, close)
- Internal comment add

### 6. Projects — partial (create only)
- Project update / complete / archive
- Milestone create/update/complete
- Project expense entry
- Project note add/attach

### 7. Job Orders — partial (detail wired, intake missing)
- Job order intake form (client, description, technician assign)
- `assignTechnician` mutation wiring

### 8. Clients (B2B) — list only, no write forms
- Client create/edit form

### 9. Reports — router exists, zero UI
- Report pages need UI consumers (revenue, expense, inventory, payroll summary)

### 10. HR — DTR clockIn/clockOut
- Time clock UI (button-based clockIn / clockOut) missing from DTR surface

---

## OWNER-GATED gaps (need product decision before building)

### 1. Notifications — Valkey delivery backend + header bell
The `notificationRouter` is a stub returning empty arrays. Two decisions needed:
- **Delivery mechanism**: Valkey pub/sub + SSE vs. polling every N seconds (owner call)
- **Notification inbox UX**: full-page inbox vs. header-bell dropdown (owner call)

Build is blocked until these are decided. Once decided, the backend worker + UI header bell + inbox page are all autonomous.

---

## Verdict

Orqafy is **roughly half-wired** as of 2026-06-15. The customer-facing revenue domains (CRM, Invoices, POS, Inventory, Storefront, Banking, HR core, Settings) are fully wired. The operational/internal domains — Purchasing, Accounting, Payroll, Tasks, Support — are either completely phantom or have routers with zero UI consumers. Approximately 8 autonomous waves of work remain, each scoped to one domain. Notifications is the only true owner-gated item. The app is demo-ready on its live domains but not production-ready for internal operations workflows.

---

*Last verified: 2026-06-15, HEAD `2907c79` (main). Re-verify after each wave by grepping `trpc.<router>.` in `apps/web/src/app`.*
