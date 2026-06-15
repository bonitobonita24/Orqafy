# Orqafy — Move as one.
# Wrap sensitive content in <private>...</private> to prevent agent propagation.

## App Identity
Name:           Orqafy
Tagline:        Move as one. — The all-in-one project & business operations platform
                for growing companies
Industry:       ERP / SaaS / IT Services
Primary users:  Business owners, admins, accountants, HR managers, project managers, field staff

## Problem Statement
Small-to-medium businesses juggle sales, purchasing, inventory,
projects, HR, payroll, and accounting across disconnected tools — creating data silos,
manual reconciliation work, and no single source of truth for money movement. Orqafy
unifies all operations into one multi-tenant SaaS platform where every peso
movement, every employee clock-in, and every project cost traces back to a single fund
source ledger. Existing generic ERPs either over-engineer for enterprise or under-deliver
for growing businesses — Orqafy is purpose-built for companies that need project-driven
operations and financial traceability without the complexity.

## Core User Flows

1. Tenant signs up: Visitor fills signup form → system generates slug (validated: lowercase
   alphanumeric+hyphens 3–30 chars, globally unique, NOT in reserved list: demo,
   powerbyte-admin, admin, api, static, assets) → background job provisions isolated
   PostgreSQL schema → tenant assigned to Starter plan with 7-day free trial (trialEndsAt
   = now + 7 days, status = trial) → tenant_super_admin created → welcome email sent via
   platform SMTP with trial info → tenant lands on ERP dashboard with trial banner showing
   days remaining. Trial expires: auto-downgraded to Free plan (data preserved, uploads/
   scanning/projects restricted). Error: provisioning fails → retry 3x exponential;
   platform_owner notified; tenant sees "setup in progress." Error: slug taken or reserved
   → user prompted to choose a different name.

2. Sales staff creates invoice and receives partial payment: Staff creates Proposal →
   optionally creates Quotation(s) under Proposal with line items and pricing → customer
   accepts Quotation → Draft Invoice auto-generated from Quotation line items (OR admin
   manually converts Quotation/Proposal to Invoice) → staff records Payment with FundSource →
   Invoice.amountPaid updated, balance recalculated, status transitions
   (unpaid→partially_paid→paid) → FundTransaction created → Journal Entry posted. Error:
   FundTransaction or Journal Entry fails → full rollback, payment not saved.

3. Customer advance payment / credit applied: Staff sets creditLimit on Customer → records
   advance payment → CustomerCreditTransaction: advance_payment → creditBalance increased →
   staff applies credit to Invoice → CustomerCreditTransaction: credit_applied → Invoice
   balance reduced. Error: creditLimit = 0 → blocked with message.

4. Excess payment decision: Staff records Payment exceeding invoice balance → system detects
   excess → invoice marked paid → staff prompted: Credit to Account or Refund? → either path
   creates CustomerCreditTransaction and Journal Entry. Error: staff closes without deciding →
   saved as pending_decision, flagged in Sales Dashboard until resolved.

5. Employee clocks in (online): Employee taps Clock In in Orqafy Mobile → native GPS
   captured → selects Office or Project Site → AttendanceRecord created on server, status =
   pending → approved by admin/hr_manager/project_manager. Error: GPS unavailable → warning
   shown, clock-in allowed, coordinates null, HR notified.

6. Employee clocks in (offline): Employee opens app without internet → taps Clock In → GPS
   captured from device natively → record stored in WatermelonDB locally, isSyncedFromOffline
   = true → on reconnect app syncs records chronologically. Error: sync conflict (duplicate
   timestamp) → server rejects, mobile shows error, user contacts HR.

7. Purchase order with goods receiving: Purchasing staff creates PO for Vendor (e-commerce
   or direct supplier) → adds line items with live autocomplete from Inventory → splits
   each item's quantity across allocations (stock, project_expense, company_expense) →
   records payment to vendor with FundSource → Shipping Costs added (multiple courier legs
   for direct suppliers) with FundSource per courier payment → system suggests shipping
   cost distribution (equal share or proportional by cost) → user reviews/edits per-item
   shipping amounts → landedUnitCost computed → PO submitted. On arrival: GoodsReceipt
   created with photos → ALL items enter inventory first (stock incremented) →
   landedUnitCost written to costPrice → if prior cost differs, admin notified: Accept or
   Retain → system prompts receiving staff about pending allocations (project/company
   items) → staff processes take-outs immediately or defers → take-out deducts from
   inventory, creates ProjectExpense (at costPrice, costType: inventory_consumed) or
   company Expense (at costPrice). Error: stock update fails → full rollback. Error:
   allocation quantity exceeds received quantity → blocked, adjusted quantity shown.

8. Payroll processing: HR reviews approved DTR and leave → creates Payroll run → pay computed
   per employee including manual cash advance deductions → approved → payslips generated →
   FundSource deducted → Journal Entry posted. Error: FundSource insufficient → payroll
   blocked, balance shown.

9. POS transaction: Cashier opens POSSession, selects FundSource → products added to cart →
   payment processed → stock auto-deducted → FundTransaction created → receipt issued →
   session closed with cash reconciliation. Error: stock = 0 → item blocked from cart.

10. Support ticket lifecycle: Customer submits or staff creates ticket → assigned to agent
    with priority → agent investigates, adds comments → linked to Project if applicable →
    resolved, customer notified, closed. Error: unassigned 24hrs → auto-escalation to admin.

11. Inventory disbursement to project: Project manager creates InventoryDisbursement request
    listing items and quantities needed for a specific project → admin reviews and approves →
    on approval, items are scanned out via barcode/QR code (or manual search); if product has
    requiresSerialNumber = true, serial number is scanned/selected per unit from
    ProductSerialNumber records → StockMovement created as type: out with referenceType:
    inventory_disbursement → ProjectExpense created at costPrice (NOT unitPrice/SRP) with
    costType: inventory_consumed → expense appears ONLY in Project Dashboard and per-project
    reports, NOT in accounting Journal Entries (item was already expensed at purchase time;
    creating a journal entry here would double-expense it). Partial fulfillment: if not all
    requested items are in stock, inventory_staff can fulfill available quantities first →
    status becomes partially_fulfilled → remaining items fulfilled later when restocked →
    status becomes fulfilled when all items' quantityFulfilled = quantityRequested. Error:
    admin rejects → project manager notified with rejection reason. Error: stock insufficient
    for a line item → that item blocked, available quantity shown, other items can proceed.

12. Public invoice sharing: Sales staff or admin sets Invoice.isPublished = true → system
    generates a unique publicToken (UUID) → invoice viewable at /invoice/<publicToken>
    without login → customer receives link via email or manual sharing → read-only view
    with digital signature option for acknowledgment. Error: unpublished invoice token →
    404 page.

13. Demo account access: Visitor clicks "Try Demo" on landing page → redirected to
    /demo/erp/dashboard → logged in as demo tenant_super_admin → demo banner shown at top
    of every page ("You are viewing a demo — data resets every 6 hours") → role switcher
    dropdown in demo banner allows switching to any role (admin, accountant, hr_manager,
    project_manager, sales_staff, inventory_staff, staff, cashier) → switching role
    instantly swaps the JWT to a pre-seeded demo user with that role → all modules
    accessible per role permissions. Restrictions: demo users cannot change passwords,
    cannot delete the demo tenant, cannot modify tenant settings, cannot export data,
    cannot create additional users. Error: demo tenant mid-reset → visitor sees
    "Demo is refreshing, please wait" page, auto-retries every 10 seconds.

14. E-Commerce purchase: Customer browses /<slug>/shop → adds products to cart (no login
    needed) → proceeds to checkout → must login or register → shipping address entered →
    selects Xendit payment method (GCash/Maya/card/bank) → Xendit payment processed →
    webhook confirms payment → EcommerceOrder created with status = paid → stock deducted
    → admin notified → order processed → customer notified at each status change →
    customer picks up or receives delivery → order completed. Customer tier discount
    applied automatically at checkout (VIP 10%, Dealer 12%, Regular 5% if ≥₱3,000
    with admin approval). Error: payment fails → order remains pending_payment →
    customer can retry. Error: stock insufficient → item removed from cart with notice.

15. Repair / Job Order: Customer brings device to shop → staff creates Job Order with
    14-char system ID (e.g. 20260430UPWLFM) → fills Unit Information (device type, brand,
    model, issue, accessories) → customer signs digital signature on intake form →
    printable PDF generated → device assigned to technician → diagnosis performed →
    if parts needed: staff creates Quotation from Job Order (uses standard markup
    computation) → customer approves from portal or in-person → parts deducted from
    inventory → repair performed → testing → marked ready for pickup → customer notified
    → customer picks up, signs release signature → job order closed. Error: customer
    declines repair quotation → job order can be closed (return device as-is) or revised
    quotation sent. Error: parts not in stock → quotation includes note, parts ordered
    via PO first.

## Modules + Features

### Public Landing Page
- Marketing homepage at / — SEO-optimized, server-side rendered
- Hero section: tagline, primary CTA ("Start Free Trial"), secondary CTA ("Try Demo")
- Features overview: module highlights with icons (Sales, Purchasing, Inventory, Projects,
  HR & Payroll, POS, Accounting, Support) — concise descriptions, not full feature lists
- Pricing section: live data from Plan entity (Free/Starter/Growth/Pro/Enterprise) via
  public tRPC endpoint (plan.listActive — no auth required, cached 5 minutes); displays
  monthlyPrice, annualPrice, features[], maxUsers, maxStorageGB per plan; annual/monthly
  toggle; Free plan shown with "Get Started" CTA (no payment, immediate access with
  restrictions listed); paid plans show "Start 7-Day Free Trial" CTA → /register with
  planId pre-selected (trial always on Starter regardless of plan selected — upgrade to
  chosen plan after trial or at any time); annual savings callout: "Save 2 months" badge
  on annual toggle; pricing page shows comparison table of what Free plan cannot do
  (no uploads, no scanning, no Projects) vs paid plans (all features)
- Testimonials section: placeholder cards (populated manually by platform_owner via CMS-like
  seed data or future admin UI — out of scope for v1, use hardcoded seed testimonials)
- Footer: company info, legal links (Terms, Privacy Policy — static pages), contact email,
  "Powered by Powerbyte I.T. Solutions" branding badge (visible on ALL pages — landing page,
  ERP app, POS terminal, customer portal, demo, public invoice view; links to
  powerbyte.app or Powerbyte's website; styled subtly — secondary text color, small font)
- Fully responsive: mobile-first layout; no sidebar; stacked sections

### Demo System
- Single shared demo tenant: slug = "demo", schema = t_demo, status = demo (new Tenant
  status value); pre-provisioned once, never deleted
- Demo login: no credentials required — clicking "Try Demo" on landing page auto-
  authenticates as demo tenant_super_admin and redirects to /demo/erp/dashboard
- Demo banner: persistent top banner on ALL pages within demo tenant — yellow/amber bar
  with text "You are viewing a demo — data resets every 6 hours" + role switcher dropdown
- Role switcher: dropdown in demo banner lists all tenant roles (tenant_super_admin, admin,
  accountant, hr_manager, project_manager, sales_staff, purchasing_staff,
  inventory_staff, staff, cashier, support_agent); selecting a role swaps the session to a
  pre-seeded demo user with that role; JWT re-issued instantly; page reloads with new
  permissions; customer role excluded (customer portal is a separate experience)
- Demo restrictions (enforced server-side, not just UI):
  - Cannot change any user password
  - Cannot delete demo tenant or modify tenant settings
  - Cannot create or delete users
  - Cannot export data (CSV/PDF/XLSX export buttons hidden + API blocked)
  - Cannot modify Plan or billing settings
  - Cannot access /powerbyte-admin/* (demo is tenant-only, not platform admin)
  - All email triggers suppressed (no SMTP calls in demo mode)
  - All push notification triggers suppressed in demo mode
  - File uploads allowed but cleared on reset
- Demo seed data: realistic sample data covering all modules — sample customers, vendors,
  products (with and without serial numbers), invoices (various statuses), projects with
  expenses and notes, employees with attendance records, POS sessions, support tickets,
  fund sources with transactions, journal entries, payroll runs; enough data to demonstrate
  dashboards, reports, and workflows meaningfully
- Demo reset (scheduled): BullMQ cron job every 6 hours (demo-reset queue) — drops and
  recreates demo schema → runs migrations → runs demo seed script → resets all demo user
  passwords to defaults; during reset (~30 seconds): middleware detects reset-in-progress
  flag in Valkey → serves "Demo is refreshing" page → auto-retries via client-side polling
  every 10 seconds; reset flag cleared when seed completes
- Demo analytics: optional — track demo usage (page views, role switches, time spent) via
  simple DemoAnalytics table in global schema for understanding prospect behavior; deferred
  to v2 if not needed at launch

### CRM / Sales
- Customer management: contact details, type (government/private/individual), credit
  limit/balance; multiple contact persons for government and private customers via
  CustomerContact entity; individual customers use their own contact info directly
- Customer detail page: tabbed/submenu layout showing ONLY the currently viewed
  customer's records; 8 submenus:
  1. Profile (default view) — company info, contact persons, credit summary
  2. Proposals & Quotations — all proposals + quotations for this customer
  3. Invoices — all invoices for this customer
  4. Subscriptions — all subscriptions for this customer
  5. Payments — all payments across this customer's invoices
  6. Credit Notes — Credit Manager (advances, applied, refunds)
  7. Projects — all projects where customerId matches
  8. Tickets — all support tickets for this customer
  NOTE: top-level standalone lists (all proposals, all invoices, etc.) still exist for
  global views — customer submenus are filtered views of the same data
- Credit Manager: advance payments, credit application to invoices, excess payment decisions,
  manual credit refunds; CustomerCreditAccount ledger; CustomerCreditTransaction immutable log
- Proposals & Quotations: unified menu showing both document types in one list with
  type indicator and filter; user can create either "New Proposal" or "New Quotation"
  - Proposal = pitch container: title, description (what the proposal is for / which
    project), file attachments (presentations, proposal letters — up to 50MB per file;
    allowed: jpeg, png, webp, pdf, docx, pptx), external links (Google Drive URLs etc.
    as alternative to direct upload via ProposalLink entity); status workflow
    (draft→sent→revised→accepted→declined)
  - Proposal detail submenus: Overview (title, description, status, customer),
    Files (uploaded documents + external links), Quotations (linked quotations with
    revision history), Revisions (full snapshot history of proposal scope changes)
  - Quotation = price document: Excel-like spreadsheet table organized into sections
    (default: Equipment Cost, Installation Materials, Labor & Mobilization — customizable
    per quotation); each section has configurable markup percentage columns (default:
    Dealer Markup 15%, Buffer 5%, PM 5%, Contractor 10%, VAT 12%); markup computed via
    golden formula: markedUpPrice = previousPrice / (1 - percentage / 100), applied
    incrementally left-to-right; final unit price editable for clean whole numbers;
    internal cost columns hidden from customer-facing output;
    can exist standalone (product-only quotes, no proposal needed) OR linked to a
    Proposal via proposalId; status workflow (draft→sent→revised→accepted→declined)
  - Quotation detail submenus: Overview (line items, totals, status, linked proposal
    if any), Revisions (full snapshot history of every version)
  - Revision tracking: full document snapshot per revision — ProposalRevision and
    QuotationRevision entities store complete content copy + revision number + revisedAt;
    previous versions never overwritten, always accessible
  - Invoice generation: Quotation accepted → draft Invoice auto-generated from line items;
    OR admin manually converts Quotation to Invoice; Proposal without Quotation can also
    be converted to Invoice manually by admin (blank draft, no line items pre-populated)
  - Relationships: one Proposal can have multiple Quotations; one Quotation links to at
    most one Proposal; Quotation can be created from within Proposal's Quotations submenu
    OR independently from the Proposals & Quotations menu
- Invoices: partial payments, Payment History tab, creditApplied tracking, balance = total -
  amountPaid - creditApplied; auto status transitions
  - Customer-Project constraint: every Invoice must have exactly 1 Customer; optionally 1
    Project; if projectId is set, the project's customerId MUST match the invoice's customerId
    (validated on create and update — prevents cross-customer project invoicing)
  - Digital signature: optional signature capture via canvas-based signature pad on invoice
    receipt; stores signatureUrl (PNG in R2/MinIO) and signedAt timestamp; available on both
    web and public invoice view
  - Public sharing: Invoice.isPublished flag + publicToken (UUID); published invoices
    viewable at /invoice/<publicToken> without authentication; read-only view includes
    line items, totals, payment status, and optional signature capture; best for sharing
    with customers who don't have an account
- Payments: method, FundSource, reference, excess handling (credit or refund)
- Subscriptions: billing cycle, descriptionTemplate with {{month}} {{date}} {{year}} vars,
  auto-generates draft invoice 3 days before nextBillingDate

### Purchasing
> **Build status (2026-06-15, see DECISIONS_LOG):** data-entry CRUD scaffolded (Vendor CRUD, PO drafts, Goods Receipt entry). Business logic — PO approval workflow / status beyond draft, auto-post to Inventory, auto-post to Accounting, tax auto-calc / 3-way match — is **HELD pending owner rules** (marked `// HOLD(owner-rule)` in code).
- Vendors: two types — ECommerceSeller (Shopee/Lazada/TikTok Shop/Zalora/FB Marketplace/
  other) and DirectSupplier (local or remote physical vendors)
- Purchase Orders (Direct Supplier flow): user fills PO form → adds line items with
  inline product search from existing inventory; if product not found, user types a new
  name → quick-add product form appears inline (modal/drawer within PO form — no
  navigation away from PO) to create the product on-the-fly with minimal required fields
  (name, SKU, type, category); new product immediately available in the PO line item;
  each PO is tied to a single Vendor; PO contains line items with quantity and unit cost
- Purchase Orders (E-Commerce flow): items are purchased on Shopee/Lazada/etc. FIRST
  (outside Orqafy) → user with purchasing_staff role pulls last purchases from platform
  (via API when available, or manual entry) → system suggests nearest matching product
  name from existing inventory using fuzzy search → if no match found or suggested match
  is wrong, user can manually link to any existing product regardless of name difference
  (e.g. Shopee name "30pcs PVC Spring Clip Saddle U CLIP 25MM" → linked to inventory
  product "PVC Pipe snap-on clamp 25mm" — user's judgment is final on product matching);
  if truly new product, same quick-add inline form as Direct Supplier flow
  - Item allocation at PO creation: each line item's quantity can be split across purposes:
    stock (inventory for resale), project_expense (assigned to a specific project),
    company_expense (office supplies, utilities); e.g. 10 pcs UPS → 8 for stock, 1 for
    Project X, 1 for company use; allocations defined at PO creation, executed at receiving
  - Allocation re-assignment: allocations can be changed after receiving — items marked as
    project_expense or company_expense can be re-assigned back to inventory stock for sale;
    inventory stock items can be taken out for project or company use at any time (uses
    the same approval workflow as Inventory Disbursement)
  - Approval for take-outs: project use → project_manager accepts/receives; company use →
    admin only accepts/receives; stock re-assignment (back to inventory) → inventory_staff
    or admin processes
  - Cost computation: discountedTotalCost (actual amount paid after e-commerce discounts)
    ÷ quantity = computedUnitCost; user can manually override unit cost per item to account
    for additional fees; items allocated to project_expense are costed at actual unit cost
    (NOT SRP/markup price); same for company_expense items
- Shipping Costs: multiple shipping cost entries per PO (common for Direct Supplier orders
  with multi-leg delivery chains, e.g. Lalamove pickup → Aguileon Cargo inter-city →
  local last-mile courier); each entry records: courier/logistics provider name, amount,
  receipt photo, FundSource used for payment
  - Shipping cost distribution: system suggests how to distribute total shipping cost
    across line items via two methods:
    (a) Equal share — total shipping ÷ total item quantity = same per-unit cost for all
    (b) Proportional by cost — each item gets shipping proportional to its share of the
        total order cost (e.g. item subtotal is 80% of PO total → gets 80% of shipping)
  - Suggested amounts appear as pre-filled editable textboxes per line item; user can
    accept suggestion, zero out specific items, increase/decrease any value manually;
    final distributed shipping cost per item added to unit cost → landedUnitCost
  - landedUnitCost = computedUnitCost + distributed shipping cost per unit
- Payment tracking: every payment in the purchase chain recorded with FundSource —
  payment to vendor (e-commerce or direct), payment to each courier/logistics provider;
  all listed in PO payment breakdown; each creates a FundTransaction
- Goods Receipt: ALL items enter inventory first regardless of allocation; photo uploads
  (items, waybills, parcels); stock auto-increment; costPrice update;
  ProductPurchaseHistory record;
  if product has requiresSerialNumber = true, each received unit must have a serial number
  entered → ProductSerialNumber record created with status: in_stock
  - Cost change decision: when new purchase cost differs from previous cost for the same
    product, system shows detailed comparison: "Previous: ₱100 unit + ₱30 shipping = ₱130
    landed (from Vendor A, received 2026-03-15). New: ₱95 unit + ₱20 shipping = ₱115
    landed (from Vendor B)." Admin chooses: Accept New Cost (update product costPrice to
    new landedUnitCost) OR Retain Previous Cost (keep existing costPrice unchanged; new
    purchase recorded in ProductPurchaseHistory but costPrice not updated). Reasons to
    retain: storage costs, slow-moving inventory, market price stability — avoid sudden
    price drops that hurt margins on existing stock. Decision logged in audit trail.
  - Allocation prompt at receiving: after confirming receipt, system notifies receiving
    staff of pending allocations ("2 pcs UPS marked for Project X, 1 pc for company use —
    process now?"); staff can immediately process the take-out (deduct from inventory →
    create ProjectExpense at costPrice with costType: inventory_consumed, or create company
    Expense at costPrice) OR defer allocation for later processing; project_manager must
    accept project-allocated items; admin must accept company-allocated items
  - All allocation take-outs create StockMovement (type: out) with appropriate
    referenceType (project_allocation or company_allocation)
- Purchase Invoices and Expenses with FundSource tracking
- Product purchase history: every product maintains full history of all purchases across
  all vendors (ProductPurchaseHistory); shows vendor name, platform, quantity, unit cost,
  shipping cost share, landed unit cost, date; filterable by vendor, platform, date range;
  used by cost change decision system to show comparison context
- Shopee API integration (optional — v2 or when Shopee developer account approved):
  pull purchase history from Shopee Open Platform API; auto-populate store name, item
  name, item image, order details into "Awaiting Receipt" queue; system suggests nearest
  matching product from inventory via fuzzy search; user confirms or manually links;
  reduces manual data entry and screenshot saving; manual entry always available as
  primary/fallback flow; API docs: https://open.shopee.com/developer-guide/4

### Inventory
- Products: physical and service types, costPrice = latest landed unit cost
  - Product dashboard: dedicated detail page per product with all fields; accessible from
    product list or after quick-add during PO to fill in missing information; submenus:
    Overview (all product details, pricing, stock levels), Purchase History (all purchases
    across vendors), Stock Movements (in/out/adjustment history), Serial Numbers (for
    serialized products)
  - Standard Pricing (3-tier markup — same golden formula as Quotations):
    Base = actual unit cost (supplier cost + shipping + additional expenses = costPrice)
    Tier 1: Dealer's Price / Discounted Price markup (e.g. 15%)
    Tier 2: Commissioner / Buffer markup (e.g. 5%)
    Tier 3: SRP / Government Price (includes 12% VAT)
    Formula per tier: markedUpPrice = previousPrice / (1 - percentage / 100)
    All three tiers configurable per product; cash basis only (no installment at product
    pricing level); used for: Invoices created without Quotation, POS sales — any direct
    sale uses the product's standard pricing tiers
  - Markup mode per tier: percentage_based OR ceiling_capped
    percentage_based: standard golden formula (e.g. 15% markup)
    ceiling_capped: percentage applies up to a maximum fixed amount; when the calculated
    markup exceeds the ceiling, the ceiling amount is used instead; e.g. "15% markup OR
    max ₱3,000 whichever is lower" → product at ₱5,000 = ₱750 markup (percentage wins);
    product at ₱50,000 = ₱3,000 markup (ceiling wins, not ₱7,500); useful for
    high-value products where percentage markup becomes unreasonably large
    Configurable per product per tier: markupMode (percentage|ceiling), markupPercentage,
    ceilingAmount (nullable — required when markupMode = ceiling)
  - NOTE on Quotation vs Standard Pricing: Quotation pricing is ALWAYS manual/editable —
    system may suggest product costs and fill the quotation table automatically, but all
    values are editable. User can add buffer costs, adjust unit cost, change markups.
    Standard Pricing is for direct sales (invoice without quotation, POS). When a
    Quotation is approved and converted to Invoice, the Invoice uses the Quotation's
    approved prices, NOT the product's standard pricing.
  - QR code and barcode generation per product: auto-generated (random unique code) or
    manually input by user based on product number/box label; printed as sticker labels;
    used for: receiving goods (scan to identify product), disbursing items (scan out),
    handing over items for project/company use, POS scanning, stock counts;
    scannable via smartphone camera (mobile app) or USB/Bluetooth scanner (web POS)
  - requiresSerialNumber flag: set at product creation; when true, every stock-in must
    register individual serial numbers (ProductSerialNumber) — serial numbers can be
    scanned via smartphone camera (OCR recognition of printed serial numbers) or via
    QR/barcode scanner if the serial is barcoded; every stock-out (POS sale, invoice,
    project disbursement, transfer, manual out) must select/scan specific serial numbers;
    system flags items requiring serial number scan before sale or handover with a
    prominent notification: "Item(s) in this invoice/POS/disbursement require serial
    number scanning before completion"; scanning via smartphone camera makes it easy to
    grab serial numbers without manual typing; when false, stock tracked by quantity only
- Categories with parent-child hierarchy
- ProductPurchaseHistory: unlimited vendor history with costs, filterable by vendor/platform/date
- Stock Movements: in/out/adjustment/transfer with reference tracking;
  for serialized products, each movement links to specific ProductSerialNumber records
- Warehouses and WarehouseStock per location
- Low-stock alerts at reorderLevel
- Serial Number Tracking: ProductSerialNumber entity tracks individual units for products
  with requiresSerialNumber = true; status lifecycle: in_stock → sold | disbursed_to_project
  | transferred | written_off; serial numbers scannable via barcode/QR or smartphone camera
  OCR on both web and mobile
- Inventory Disbursement: project manager requests items for a project → admin approves →
  items scanned out (barcode/QR or manual search; serial number required if applicable) →
  stock deducted → ProjectExpense created at actual purchase cost (from the specific PO's
  landedUnitCost, NOT the product's current costPrice if different) with costType:
  inventory_consumed → NO journal entry (prevents double-expensing; cost was journaled
  at purchase time)

### Projects
- Projects linked to Customers, with budget, milestones, tasks, time logs
- Project Dashboard (per-project view): summary of total expenses vs total invoiced revenue
  for the project; tasks by status (done, in-progress, scheduled with due dates); milestone
  completion progress; budget utilization percentage
- Invoices submenu: lists all Invoices where projectId matches this project; shows total
  count and sum of invoice amounts; navigates to full Invoice detail in CRM/Sales module
- Expenses submenu: lists all ProjectExpenses for this project; shows totals per
  ExpenseCategory; includes both directly-created project expenses AND expenses from the
  Expense module that have projectId set; ExpenseCategory selection required on all project
  expenses (predefined categories: installation_materials, transportation, meals,
  accommodation, equipment_rental, labor, permits_fees, communication, miscellaneous —
  extensible by tenant_super_admin/admin)
  - Expense receipt capture: every ProjectExpense supports optional receipt photo upload
    (camera capture on mobile, file upload on web)
  - Inventory-consumed expenses: created via InventoryDisbursement approval workflow;
    priced at costPrice; costType = inventory_consumed; shown in Project Dashboard and
    per-project reports ONLY — excluded from accounting P&L and journal entries because
    the cost was already expensed when the inventory was purchased
- Notes submenu: Notion-style block editor (BlockNote) per project; unlimited nested pages
  with parent-child hierarchy; supports headings, paragraphs, checklists (checkbox blocks),
  bullet/numbered lists, tables, code blocks, callouts; media uploads up to 50MB per file
  (images: jpeg/png/webp, documents: pdf, text: plain/csv/markdown) — viewable inline in
  the app; each note page is a ProjectNote with rich content stored as BlockNote JSON
  IMPORTANT: BlockNote is a React web library only — no React Native component exists.
  Web app: full BlockNote editor for creating and editing notes.
  Mobile app: read-only rendered view (BlockNote JSON → rendered React Native components
  via custom renderer); editing notes requires web app. Mobile can still view all content
  including checklists, images, and embedded files.
- Milestone submenu: create milestones with title, description, due date; milestones can
  group tasks via Task.milestoneId; completion auto-calculated (all linked tasks status =
  done → milestone marked complete) with manual override (admin/project_manager can mark
  complete or reopen regardless of task status); completedOverrideBy tracks who overrode
- Tasks submenu: project-scoped task list; multi-assignee (TaskAssignment join table —
  each task can be assigned to multiple employees with date+time due); subtasks via
  Task.parentTaskId (self-referencing hierarchy — unlimited depth); file attachments
  (TaskAttachment — images and documents); optional TaskStatusReport on completion
  (text notes + optional attachments documenting what was done)
- ProjectExpenses: linked to FundSource (custodian account) or CashAdvance for cost visibility
- Invoicing from project time logs or fixed budget

### Tasks
- Tasks: assignable to multiple employees via TaskAssignment join table, with date and time
  due selection; optional project link; priority; status Kanban
  - Multi-assignee: TaskAssignment (taskId, userId, assignedAt, assignedBy) replaces the
    previous single assignedTo field; notifications sent to ALL assignees on status changes
  - Subtasks: Task.parentTaskId enables self-referencing hierarchy; subtasks inherit the
    parent's projectId; each subtask independently assignable with its own due date, priority,
    and status; no depth limit but UI shows up to 3 levels for readability
  - File attachments: TaskAttachment entity; images and documents uploadable per task
  - Status reports: optional TaskStatusReport on task completion; text content + optional
    attachment URLs; useful for documenting work done, issues encountered, or handoff notes
- Task Dashboard: default home page for all tenant users; Kanban + Calendar toggle
- ToDos: personal task list per user; supports description (text), priority (low|medium|
  high), file attachments (images and documents via ToDoAttachment — max 10MB per file;
  Free plan: attachments blocked, upload button hidden + API returns 403)

### DTR / Attendance
- AttendanceRecord: GPS clock-in/out (office or project site), pending→approved workflow
- isSyncedFromOffline flag for mobile offline records
- Attendance: derived from approved records; HR manual adjustment
- Leave Requests: vacation, sick, emergency; approval workflow

### Banking & Finance
- FundSource: company financial accounts — each is a ledger-based account with full
  transaction history and running balance; types: cash_on_hand, e_wallet, bank, credit_card
  - Multiple Cash on Hand accounts supported: main store cash, petty cash, and individual
    custodian accounts assigned to employees (e.g. "Cash on Hand — Juan dela Cruz")
  - Custodian accounts: admin creates a FundSource of type cash_on_hand and assigns it to
    a specific user (assignedTo field); the custodian records their own expenses against it
    with optional receipt scanning; company funds, NOT personal money — custodian is
    responsible for recording every expense; accountant/admin can review all custodian
    accounts and transactions at any time
  - Bank accounts: name, institution, account number; multiple banks supported; real cash —
    balance cannot go below zero
  - E-wallets / virtual accounts: GCash, Maya, GoTyme, etc.; real cash — balance cannot
    go below zero
  - Credit cards: admin can create multiple credit card accounts; starts at ZERO balance
    (no upfront funding); when used for purchases/expenses, outstanding balance increases
    as a positive number displayed in matte red font (represents liability, NOT negative
    cash); real-cash accounts (cash, bank, e-wallet) show balances in normal font and
    cannot go below zero
  - Loan accounts: admin can create loan accounts representing borrowed money from banks,
    government agencies (SSS, Pag-IBIG), or private lenders; loan starts with the full
    loanAmount as real money received; has its own ledger but CANNOT be used to directly
    purchase or expense anything — restricted to 3 transaction types only:
    (1) Money Out To — transfer loan funds to company accounts (bank, cash, e-wallet);
        creates paired FundTransactions; loan currentBalance decreases
    (2) Money In — receive repayment from company accounts back into loan account;
        tracks how much principal has been repaid; outstandingBalance decreases
    (3) Payback To — final settlement to the lender; admin records the payback;
        loanStatus set to "paid", isActive = false, account disabled with "PAID" label;
        if interest was charged, excess over original loanAmount recorded as bank
        charges expense in the general ledger
    Loan outstandingBalance displayed in matte red font (same as credit card — both
    are liabilities); loan accounts visible in Fund Sources alongside other accounts
    but visually distinguished with a "Loan" badge
- Credit card as payment method:
  - Credit cards selectable as payment method for ALL purchases, expenses, POs, and
    operational costs (vehicle refueling, supplies, etc.) — same as any other account
  - Items paid via credit card are marked PAID (vendor is satisfied) and recorded in the
    credit card's own ledger as individual transactions
  - E-Commerce/Shopee purchases via credit card: PO pulls single transaction group from
    Shopee (one checkout = one PO regardless of how many items/sellers); total amount
    recorded in the credit card ledger with a clickable link to the PO number; each
    credit card ledger entry links back to its source (PO, Expense, ProjectExpense)
  - Bank fees / convenience fees: when the billing statement arrives, the actual billed
    amount may differ from the original charge (e.g. ₱1,000 purchase → ₱1,025 on
    statement = ₱25 bank fee); admin can add a bankFee amount to any credit card
    transaction after the fact; bankFee is recorded as a separate bank charges expense
    in the general ledger; the credit card outstandingBalance increases by the bankFee
  - This applies to ALL credit card transactions — PO purchases, company expenses,
    project expenses, online store payments, utilities — any charge can have a bank
    fee added when the billing statement reveals the actual amount
  - Accounting treatment: the expense IS recorded in the general ledger immediately as
    the appropriate expense type (Purchase Order expense, Company Expense, Project Expense)
    regardless of payment method — credit card usage does NOT defer expense recognition.
    What IS deferred is the cash outflow: no real cash has moved yet, only a credit
    liability was created. The credit card outstanding balance increases.
  - Credit card bill payment (selective multi-select):
    When the billing statement arrives, admin/accountant opens the credit card's
    transaction list → selects (multi-select checkboxes) the specific transactions that
    appear on THIS billing statement (not all — some recent transactions may not yet be
    on the statement) → system totals selected transactions → admin pays the total from
    any company account (bank, GCash, cash) → FundTransfer from paying account to credit
    card → credit card outstanding balance reduced → selected transactions marked as PAID
    with grayed-out styling + "PAID" badge; unpaid transactions remain active with normal
    styling; paid transactions are still clickable to view details (PO number, line items,
    bank fee breakdown); this replaces the previous "oldest-first" default approach with
    explicit user selection matching the actual billing statement
  - Installment conversion: admin can convert a credit card charge to installment plan;
    e.g. ₱100,000 purchase → ₱9,300/month × 12 months = ₱114,000 total; the ₱14,000
    excess is recorded as bank charges (interest/fees) expense in the general ledger;
    each monthly installment payment: debit from bank → credit to credit card outstanding
    → journal entry for principal portion + bank charges portion; installment tracker
    shows: original amount, monthly payment, months remaining (e.g. "4/12 paid"),
    total interest, remaining balance
  - CreditCardPayment entity handles: selective multi-transaction payment, bulk statement
    payment, installment payment; outstandingBalance tracked as liability until fully
    settled
- FundTransfer: transfer funds between any two FundSource accounts; creates paired
  FundTransactions (debit on source, credit on destination); used for: bank → custodian
  cash replenishment, cash → bank deposits, inter-account movements, credit card bill
  payments, loan disbursement to company accounts, loan repayment from company accounts,
  staff returning cash to company accounts, staff-to-staff transfers;
  custodians can initiate transfers FROM their own account; admin/accountant can initiate
  any transfer; requires approval for transfers above configurable threshold;
  loan accounts restricted: can only transfer TO company accounts (disbursement) or
  receive FROM company accounts (repayment) — no direct loan-to-loan or loan-to-custodian
- FundRequest: any custodian can request funds from any account; request goes to the
  account holder (if custodian) or admin/accountant (if company account); requestee can
  approve (auto-creates FundTransfer) or deny with reason; pending requests visible in
  Banking dashboard and sent as push notification
- FundTransaction: complete auditable ledger per fund source — every credit and debit in
  chronological order with running balance; prominent bank-statement-style UI per account;
  each transaction references its source (payment, expense, transfer, payroll, etc.);
  credit card and loan accounts show outstanding balance in matte red font (both are
  liabilities); running balance per account can be counter-checked against actual bank
  statements, physical cash counts, or e-wallet balances
- Payment recording: project_manager and above can receive client payments and record them
  against any FundSource (cash if physical, bank if cheque/transfer); staff-level payment
  recording only via POS module; payment links to Invoice with partial/full tracking
- Accounting rule for expenses: ALL expenses (PO purchases, company expenses, project
  expenses) are recorded in the general ledger at the time of the transaction regardless
  of payment method used. Credit card, cash, bank, e-wallet — the payment method only
  affects which FundSource account is debited/credited, NOT whether or when the expense
  is recognized. This ensures accurate P&L reporting.

### HR & Payroll
> **Build status (2026-06-15, see DECISIONS_LOG):** data-entry CRUD scaffolded (Payroll Run CRUD — create/edit/list/detail with status, period, currency; manual payslip line entry per employee on draft runs with gross/deductions/net form-level preview). Business logic — pay computation (gross/net/tax/PH statutory deductions SSS/PhilHealth/Pag-IBIG/withholding), approval/process/markPaid lifecycle, auto-calc from DTR/attendance, FundSource deduction, Journal Entry posting (Core Flow 8), cash-advance recovery — is **HELD pending owner rules** (marked `// HOLD(owner-rule)` in code).
- Employee linked to User (isEmployee toggle); read-only for employee, editable by admin/HR
- Cash Advances: project-linked or general; manual recovery per payroll run
- Payroll runs with payslips; FundSource deducted on release
- Cash advance recovery tracked per payroll via CashAdvanceRecovery records

### POS
- POSSession: open/close with opening/closing cash and FundSource
- POSSale with real-time stock deduction; for serialized products (requiresSerialNumber =
  true), cashier must scan/select serial numbers per unit sold → ProductSerialNumber status
  updated to sold
- Receipt generation

### Accounting
> **Build status (2026-06-15, see DECISIONS_LOG §A):** Chart of Accounts CRUD, Journal Entry drafts, **posting** (balanced + active-account + open-FY guards, DRAFT→POSTED, postedById, $transaction + audit), **reversal** (new mirror POSTED entry, reversalOfId, original stays POSTED), and **Trial Balance** page (per-account aggregation of POSTED lines, debit/credit/balance totals, isBalanced check) are **BUILT**. Still **HELD**: financial statements (P&L, balance sheet), GL rollup reports, auto-posting from invoices/purchasing/payroll, fiscal period/year close.
- Chart of Accounts: asset/liability/equity/income/expense
- Journal Entries auto-posted on every money movement (payments, expenses, payroll,
  cash advances, credit card payments, credit transactions)
  NOTE: ProjectExpenses with costType = inventory_consumed do NOT generate journal entries —
  these represent inventory items already expensed at purchase time; including them would
  double-expense the cost. They appear only in Project Dashboard and per-project reports.
- Tax Rates and Fiscal Years

### Support / Tickets
- Tickets: priority levels (low/medium/high/critical), linked to Customer and Project
- Internal and external comments; file attachments

### E-Commerce / Online Store (NEW)
- Public-facing product storefront at /<slug>/shop — displays products with
  isVisibleInEcommerce = true; product cards show name, ecommerceImages, ecommerceDescription,
  tier3Price (SRP); category filtering, search, product detail pages
- Shopping cart: add/remove products, quantity selection; cart persisted in browser
  localStorage for guests; requires login/registration to proceed to checkout
- Customer registration: customers can self-register for a portal account from the
  storefront; creates Customer record + User with role = customer; email verification
  required; links to existing Customer record if email matches
- Checkout: shipping address, payment method selection; order summary with line items,
  subtotal, VAT breakdown, total
- Customer tier pricing at checkout:
  - Regular: tier3Price (SRP); eligible for 5% discount on orders ≥₱3,000 (applied
    automatically, subject to admin approval before order is confirmed)
  - VIP: automatic 10% discount applied to all items, shown on invoice
  - Authorized Dealer/Installer: automatic 12% discount, shown on invoice
  - Walk-in POS (no account): always tier3Price, no discount
- Online payment via Xendit API: supports GCash, Maya, credit/debit cards, bank
  transfers, over-the-counter payments (7-Eleven, Cebuana); payment confirmation
  via Xendit webhook → order status updated → FundTransaction created → inventory
  deducted; for serialized products, serial numbers assigned at fulfillment (not checkout)
- Order management (admin side): order list with status tracking; order statuses:
  pending_payment → paid → processing → ready_for_pickup → shipped → delivered →
  completed; cancelled and refunded statuses; admin can manually update status;
  customer notified on every status change
- Order management (customer portal): customer sees all their orders with status,
  tracking info, payment confirmation, and order history
- Inventory integration: stock deducted on payment confirmation (not on cart add);
  out-of-stock products show "Out of Stock" badge on storefront; low-stock products
  show available quantity

### Repairs & Job Orders (NEW)
- Job Order creation: staff creates Job Order when customer brings device to shop;
  form based on Powerbyte's physical Job Order Request Form (digitized):
  - Job Order ID: system-generated 14-character alphanumeric code starting with date
    (format: YYYYMMDD + 6 random uppercase letters+digits, e.g. "20260430UPWLFM")
  - Client Information: linked to Customer entity (companyName, contactPerson, phone);
    if walk-in without existing account, quick-add customer inline
  - Unit Information: kindOfDevice (string — e.g. "Laptop", "Router", "Printer"),
    deviceBrand (string), deviceModel (string), issueDescription (text — "Issue or
    work to be done"), accessoriesIncluded (text — "Accessories & other parts included"),
    devicePhotos (nullable — photos of device at intake for condition documentation)
  - Receiving signature: signatureUrl (PNG — digital signature pad), receivedByName
    (printed name of person who delivered the device), receivedAt (date + time),
    receivedByStaffId (userId — staff who accepted the device)
  - Pickup signature: pickupSignatureUrl (nullable — signed when customer picks up),
    pickedUpByName (nullable), pickedUpAt (nullable — date + time),
    releasedByStaffId (nullable — staff who released the device)
  - Printable: Job Order form is printable as PDF (React-PDF) with all fields,
    signature areas, and Powerbyte branding for physical copy signing
- Job Order workflow:
  received → diagnosis → quotation_pending → customer_approved → in_repair →
  testing → ready_for_pickup → released → closed
  - Diagnosis: technician assigned, inspects device, documents findings
  - Quotation for parts: if parts need replacement, staff creates a quick Quotation
    directly from the Job Order (uses the same Quotation entity and markup computation;
    line items = parts needed from inventory); Quotation sent to customer for approval
  - Customer approval: customer approves/declines repair quotation from portal or
    in-person; if approved, status advances to in_repair; if declined, job order can
    be closed or revised
  - Parts from inventory: approved parts deducted from inventory (StockMovement out,
    referenceType: job_order); if serialized, serial numbers scanned/selected; cost
    recorded as job order expense at actual purchase cost
  - Repair tracking: technician logs work done, time spent, parts used
  - Testing: post-repair verification documented
  - Ready for pickup: customer notified (email + push if portal account exists)
  - Release: customer signs pickup on device (digital signature or physical form);
    staff confirms release; job order closed
- Job Order on Customer Portal: customer can view all their job orders, current status,
  diagnosis notes, quotation for parts (approve/decline), pickup readiness notification
- Admin dashboard integration: Job Order list with status filters, technician assignment,
  aging reports (how long each device has been in shop), parts cost per job order

### Customer Portal (expanded)
- Customer portal at /<slug>/portal — requires login (customer role)
- Portal dashboard: activity timeline (new invoice, repair status change, quotation sent,
  payment confirmed, order shipped), outstanding balance summary, recent orders
- Customer tier badge: displayed in portal header — Regular (default), VIP (gold badge),
  Authorized Dealer (blue badge); tier-specific pricing automatically applied
- Portal submenus:
  1. Dashboard — activity feed, outstanding balance, quick actions
  2. Online Orders — all e-commerce orders with status tracking, payment history,
     order details; Xendit payment status per order
  3. Invoices — admin-created invoices; view line items, payment status, credit applied,
     balance; online payment option via Xendit for outstanding invoices
  4. Proposals & Quotations — view proposals and quotations; accept/decline quotations
     directly from portal
  5. Repairs & Job Orders — all repair orders; view status, diagnosis notes, approve/
     decline repair quotations, pickup notification
  6. Projects — project status, milestones, task progress (read-only)
  7. Subscriptions — active subscriptions, billing schedule, payment history
  8. Payments & Credit — complete payment history across all types (invoices, orders,
     repairs); credit balance; make payments online via Xendit
  9. Support Tickets — create and track tickets
  10. Documents — shared files (signed proposals, receipts, warranty certificates,
      repair reports); admin uploads documents to customer's document library
  11. Profile — update contact info, change password, manage notification preferences
- Walk-in POS linkage: if a walk-in customer identifies themselves at POS (provides
  email or phone), staff can link the POS sale to their Customer record; POS purchase
  history then appears in portal under Online Orders with type = "in_store"

### Platform Admin (Powerbyte Internal)
- Tenant management: create, suspend, reactivate, delete, change plan, reset trial
  (resets trialEndsAt to now + 7 days, status back to trial), override plan (set any
  tenant to any plan for free — isOverridden flag, no billing generated)
- Plan management: Starter/Growth/Pro/Enterprise with pricing and feature flags
- TenantSubscription billing: auto-generates TenantInvoice before period end
- TenantPayment manual recording; 7-day grace period before suspension
- DLQ monitor: failed job count with replay UI
- TenantAuditLog for all platform-level actions
- Platform SMTP: configured via .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
  SMTP_FROM_ADDRESS, SMTP_FROM_NAME); used ONLY for platform-level emails (tenant welcome,
  billing reminders, suspension notices, password resets); never used for tenant-scoped emails

### Invoice Payments (Phase 7)

Invoices support partial payments. Each recorded payment is a `Payment` ledger row
(amount, method, optional fund source, recordedBy, paidAt) linked to the invoice.
Recording a payment updates the invoice `amountPaid` / `balance` and transitions
status: balance > 0 → `partially_paid`; balance == 0 → `paid`. Over-payment beyond the
outstanding balance is rejected. Per owner decision D1 (2026-06-14), when a fund source
is selected the payment AUTO-POSTS a Banking `income` transaction to that fund source
and increments its balance (referenceType `invoice_payment`), so every collected peso
traces to a fund source. `invoice.markPaid` settles the full outstanding balance in one
action as a convenience over `recordPayment`. Every payment writes an L5 AuditLog entry.

## Roles + Permissions

| Role | Can do | Cannot do |
|------|--------|-----------|
| platform_owner | Manage all tenants, plans, billing, DLQ replay; full platform admin | Access any tenant's ERP data |
| tenant_super_admin | Full access all ERP modules; assign any role; manage credit; approve attendance; approve inventory disbursements; manage expense categories | Access other tenants |
| admin | Full operational ERP; assign any role except tenant_super_admin; manage credit; approve attendance; approve inventory disbursement requests; manage expense categories | Delete core records |
| accountant | Accounting, Banking, Invoices, Payments, Expenses, Payroll; manage fund accounts and transfers; manage credit | HR management, user creation above staff; approve inventory disbursements |
| hr_manager | HR, Attendance, Leave, Cash Advances, Payroll, Banking | Create users above staff role; financial modules; approve inventory disbursements |
| project_manager | Projects, Tasks, Milestones, Time Logs, ProjectExpenses, Banking (own custodian accounts + receive client payments); approve on-site attendance; create inventory disbursement requests; manage project notes | HR, Accounting, Purchasing; approve own disbursement requests |
| sales_staff | Proposals & Quotations, Invoices, Subscriptions, Customers; record payments; manage customer credit; apply credit; process refunds; publish/unpublish invoices | HR, Banking (except own custodian account if assigned), Accounting |
| purchasing_staff | POs, Vendors, Goods Receipt, Shipping, Expenses | Modify Inventory directly; financial modules |
| inventory_staff | Products, Stock, Warehouses, Purchase History; process approved inventory disbursements (scan/deduct) | Purchasing write access; financial modules; approve disbursements |
| staff | Task Dashboard; DTR clock-in/out; own tasks and todos; mobile app; view assigned project notes (read-only) | Any financial module; create project notes |
| cashier | POS Terminal; Task Dashboard; fund source per session | Back-office ERP access |
| support_agent | Support Tickets full access; read-only Customer and Projects | Financial modules; HR |
| customer | Portal access: Dashboard, Online Orders, Invoices (with online payment via Xendit), Proposals & Quotations (accept/decline), Repairs & Job Orders (view status, approve/decline repair quotations), Projects (read-only), Subscriptions, Payments & Credit, Support Tickets, Documents, Profile; e-commerce storefront (browse, cart, checkout); view published invoices via public link | Any back-office feature |

NOTE: One role per user — strictly. Role is a single enum on User.role. Role entity is a
reference table (seeded, read-only at runtime) for admin UI display only. Actual RBAC
enforced via TypeScript enum in code. Tenants cannot define custom roles.

Mobile app access: staff, project_manager, hr_manager, admin, tenant_super_admin only.
isEmployee gates BOTH mobile app access AND presence of a linked Employee record. Both
conditions always in sync — toggling isEmployee creates/links Employee record automatically.

## Data Entities

Tenant: id, tenantName (slug: lowercase alphanumeric+hyphens 3–30 chars, globally unique),
  companyName, ownerEmail, ownerName, planId, status (trial|active|suspended|cancelled|demo),
  isDemoTenant (boolean, default false — true only for the single demo tenant; enforced
  unique constraint: at most one tenant with isDemoTenant = true),
  trialEndsAt (nullable — set to signup date + 7 days on new tenant creation),
  trialResetCount (integer, default 0 — incremented each time platform_owner resets trial),
  trialResetBy (nullable — userId of platform_owner who last reset the trial),
  trialResetAt (nullable — timestamp of last trial reset),
  schemaName (t_<slug_underscored>), createdAt
  [global public schema — platform level only]
  NOTE: demo tenant has slug = "demo", schemaName = "t_demo", status = "demo";
  it is pre-provisioned by the seed script and never created via /register.
  Trial flow: new signup → status = trial, planId = Starter, trialEndsAt = now + 7 days;
  during trial: full Starter plan access (5 users, 5 GB, all features); 2 days before
  trial ends: email reminder; trial expires: auto-downgraded to Free plan (status =
  active, planId = Free), data preserved but uploads/scanning/projects restricted;
  platform_owner can reset trial period at any time → trialEndsAt = now + 7 days,
  status back to trial, trialResetCount incremented; tenant can subscribe to any paid
  plan at any time during or after trial

Plan: id, name (Free|Starter|Growth|Pro|Enterprise), monthlyPrice, annualPrice,
  features[], maxUsers, maxStorageGB, isActive, sortOrder (integer — display order on
  pricing page), createdAt [global schema]
  NOTE: 5 plans total. Annual pricing = monthly × 10 (2-month discount equivalent —
  pay for 10 months, get 12). Platform_owner can adjust any plan's pricing from admin
  settings at any time. Plan pricing displayed on public landing page via cached
  plan.listActive endpoint.
  Free plan restrictions (enforced server-side, not just UI):
  - maxUsers: 3, maxStorageGB: 0 (no file uploads anywhere in the app)
  - No file upload endpoints — all upload API routes return 403 with message
    "Upgrade to a paid plan to upload files"
  - No camera/barcode/QR scanning features — disabled in mobile app and web
    (camera endpoints blocked, html5-qrcode and expo-camera scanner disabled)
  - No Projects module — /<slug>/erp/projects/* routes return 403 with redirect
    to upgrade page; only ToDo module available for task management
  - All other modules fully functional (CRM, Invoices, Purchasing manual entry,
    Inventory manual entry, POS, HR, Banking, Accounting, Support, E-Commerce,
    Job Orders)
  Paid plans (Starter/Growth/Pro/Enterprise): all features unlocked, no restrictions

TenantSubscription: id, tenantId, planId, billingCycle (monthly|annual),
  currentPeriodStart, currentPeriodEnd, status (active|past_due|cancelled|trial|free),
  isOverridden (boolean, default false — when true, billing is skipped; plan stays as
  set by platform_owner regardless of payment status),
  overriddenBy (nullable — userId of platform_owner who set the override),
  overrideReason (nullable — e.g. "Partner discount", "Beta tester", "Friend"),
  createdAt [global schema]
  NOTE: trial status = 7-day free trial on Starter plan; free status = permanent Free
  plan after trial expires (or chosen explicitly); overridden subscriptions show a badge
  in platform admin panel but function identically to paying tenants; platform_owner can
  override any tenant to any plan for free at any time

TenantInvoice: id, tenantId, subscriptionId, amount, status (draft|sent|paid|past_due|
  cancelled), dueDate, paidAt, generatedAt [global schema]

TenantPayment: id, tenantInvoiceId, amount, method, referenceNo, paidAt, recordedBy
  [global schema]

TenantAuditLog: id, tenantId, action, performedBy, notes, createdAt [global schema]

TenantSmtpConfig: id, tenantId (FK → Tenant, unique — one config per tenant),
  smtpHost (string, encrypted at rest), smtpPort (integer — 465 for SSL, 587 for TLS),
  smtpUser (string, encrypted at rest), smtpPassword (string, encrypted at rest),
  smtpFromAddress (string — e.g. invoices@clientcompany.com),
  smtpFromName (string — e.g. "Acme Corp ERP"), useTls (boolean, default true),
  isEnabled (boolean, default false — true only after successful test),
  verifiedAt (nullable — timestamp of last successful SMTP connection test),
  createdAt, updatedAt [global schema]
  NOTE: one per tenant; credentials encrypted at rest (AES-256 or platform encryption key);
  tenant_super_admin and admin can configure; "Test SMTP Connection" button sends a test
  email to the admin's own address before enabling; if not configured or isEnabled = false,
  tenant-scoped emails are queued but NOT sent — a persistent warning banner appears in
  tenant dashboard: "Configure SMTP settings to enable email notifications";
  platform-level emails (welcome, billing, suspension) always use Powerbyte's SMTP from
  platform .env — never tenant SMTP config

User: id, name, email, password (hashed), role (enum — single value), departmentId,
  isEmployee, isActive, createdAt [tenant schema]

Role: id, name, permissions[] — reference table only, seeded, read-only at runtime
  [tenant schema]

Department: id, name [tenant schema]

AuditLog: id, userId, action, module, recordId, timestamp [tenant schema]

Customer: id, companyName, email, phone, address, type (government|private|individual),
  customerTier (regular|vip|authorized_dealer — determines pricing and discount rules;
  regular: SRP pricing, eligible for 5% discount on orders ≥₱3,000 subject to admin
  approval; vip: automatic 10% discount on all invoices, VIP badge on portal;
  authorized_dealer: automatic 12% discount on all invoices, Dealer badge on portal),
  creditLimit (nullable — null=unlimited, 0=no facility), creditBalance (default 0),
  hasPortalAccount (boolean, default false — true when customer registers or is granted
  portal access; enables login to /<slug>/portal/*),
  portalUserId (nullable — FK to a User record in tenant schema with role = customer;
  created when customer registers for portal or admin enables portal access),
  createdAt
  NOTE: contactPerson field removed — replaced by CustomerContact entity for government
  and private customers; individual customers use Customer's own email/phone/address;
  customerTier affects pricing: regular gets tier3Price (SRP), vip gets tier3Price - 10%,
  authorized_dealer gets tier1Price (Dealer's Price) or tier3Price - 12% whichever is
  applicable; discount shown as line item on invoice; walk-in POS sales without
  customer account always use tier3Price (SRP) with no discount

CustomerContact: id, customerId, name, email (nullable), phone (nullable),
  position (nullable — e.g. "IT Director", "Procurement Head"), isPrimary (boolean,
  default false — at most one primary per customer), createdAt
  NOTE: multiple contacts allowed per customer; used for government and private customer
  types only; individual customers do not use this entity (they ARE the contact);
  UI hides "Add Contact Person" when customer type = individual

CustomerCreditAccount: id, customerId, totalCredited, totalUsed, totalRefunded,
  currentBalance, createdAt, updatedAt
  NOTE: one per customer; immutable ledger header; never deleted

CustomerCreditTransaction: id, customerId, type (advance_payment|excess_payment|
  credit_applied|credit_refunded), amount, referenceType, referenceId, invoiceId (nullable),
  notes, performedBy, createdAt
  NOTE: immutable ledger lines — never updated or deleted after creation

Proposal: id, customerId, title, description (text — what this proposal is for / which
  project it covers), terms (nullable), status (draft|sent|revised|accepted|declined),
  createdBy (userId), createdAt, updatedAt
  NOTE: Proposal is a pitch container — holds narrative scope, uploaded files/links,
  and linked Quotations. Does NOT contain line items or pricing (that's Quotation's job).
  Can be converted to Invoice manually by admin even without a Quotation (blank draft).

ProposalAttachment: id, proposalId, fileUrl (R2/MinIO path), fileName, fileSize (bytes),
  mimeType (image/jpeg|image/png|image/webp|application/pdf|
  application/vnd.openxmlformats-officedocument.wordprocessingml.document|
  application/vnd.openxmlformats-officedocument.presentationml.presentation),
  uploadedBy (userId), uploadedAt
  NOTE: max 50MB per file; same limit as ProjectNote attachments

ProposalLink: id, proposalId, url (string — external URL e.g. Google Drive link),
  title (string — display label), description (nullable), addedBy (userId), createdAt
  NOTE: alternative to direct file upload; allows linking to Google Drive, Dropbox,
  or any external URL without storing files on Orqafy's storage

ProposalRevision: id, proposalId, revisionNumber (integer — auto-incrementing per proposal),
  title (snapshot), description (snapshot), terms (snapshot), revisedBy (userId), revisedAt
  NOTE: full document snapshot per revision; created automatically when Proposal content
  is edited after status = sent; previous versions never overwritten

Quotation: id, customerId, proposalId (nullable — links to parent Proposal if created from
  one; null for standalone quotations), grandTotal (computed — sum of all sections' totals),
  validityDays (nullable — quote expiration period in days), terms (nullable),
  status (draft|sent|revised|accepted|declined), createdBy (userId), createdAt, updatedAt
  NOTE: can exist independently (standalone product-only quote) OR linked to a Proposal;
  on acceptance → draft Invoice auto-generated from final unit prices; admin can also
  manually convert to Invoice at any time; line items organized into sections with
  Excel-like markup computation; customer-facing output shows ONLY final unit price,
  qty, subtotal per item, and grand total — all markup columns and internal costs hidden

QuotationSection: id, quotationId, name (string — e.g. "Equipment Cost", "Installation
  Materials", "Labor & Mobilization"), sortOrder (integer), sectionSubtotal (computed —
  sum of all line items' finalSubtotal in this section), createdAt
  NOTE: default sections seeded on new quotation: Equipment Cost, Installation Materials,
  Labor & Mobilization; user can add/remove/rename sections per quotation; sections are
  orderable; some projects may only need one or two sections

QuotationMarkupColumn: id, quotationSectionId, label (string — e.g. "Dealer Markup",
  "Buffer", "PM", "Contractor", "VAT"), percentage (decimal), sortOrder (integer),
  isVat (boolean, default false — true only for the final VAT column; affects Invoice
  tax computation), createdAt
  NOTE: default columns seeded per section: Dealer Markup (15%), Buffer (5%), PM (5%),
  Contractor (10%), VAT (12%); user can add/remove/reorder markup columns per section;
  Labor section defaults Buffer and PM to 0% (or user removes them entirely);
  the golden formula is applied incrementally left-to-right:
  markedUpPrice = previousPrice / (1 - percentage / 100)
  This is a REVERSE-PERCENTAGE markup (NOT simple multiply); each column takes the
  previous column's result as input; first column uses base unit price as input

QuotationLineItem: id, quotationSectionId, lineNumber (integer — row order within section),
  itemName (string — specification / item name), qty (decimal), unit (string — e.g. "pcs",
  "lot", "set", "MDYS"), actualItemPrice (decimal, nullable — optional raw item cost),
  otherFees (decimal, nullable — optional additional fees), shippingFees (decimal, nullable
  — optional shipping/logistics cost), baseUnitPrice (computed — sum of actualItemPrice +
  otherFees + shippingFees; for Labor: computed differently, see laborComputation fields),
  baseAmount (computed — qty × baseUnitPrice),
  laborInstallers (integer, nullable — number of installers; Labor section only),
  laborDays (integer, nullable — number of days; Labor section only),
  laborRate (decimal, nullable — daily rate per installer; Labor section only),
  remarks (nullable — actual brand, model, or notes),
  supplierLink (nullable — supplier name or URL),
  finalUnitPrice (decimal — defaults to the last markup column's rounded-up result;
  EDITABLE by user to adjust to whole numbers for presentability, e.g. ₱525.85 → ₱530),
  finalSubtotal (computed — qty × finalUnitPrice), createdAt
  NOTE: for Labor section items, baseUnitPrice = laborInstallers × laborDays × laborRate
  (instead of sum of actualItemPrice + otherFees + shippingFees); the markup chain then
  applies to this computed base; internal cost columns (actualItemPrice, otherFees,
  shippingFees, laborInstallers, laborDays, laborRate, and ALL markup column intermediate
  values) are NEVER shown on customer-facing quotation output — customer sees only:
  itemName, qty, unit, finalUnitPrice, finalSubtotal

QuotationLineItemMarkup: id, quotationLineItemId, quotationMarkupColumnId,
  inputPrice (decimal — the price entering this markup stage), percentage (decimal —
  snapshot of the column's percentage at computation time), computedPrice (decimal —
  result of golden formula: inputPrice / (1 - percentage / 100)),
  roundedPrice (decimal — ROUNDUP of computedPrice to nearest whole number; rounding
  applied at Contractor stage and beyond, not on Dealer/Buffer/PM stages)
  NOTE: one record per line item per markup column; stores the intermediate computation
  result at each stage; enables full audit trail of how the final price was derived;
  when markup columns or percentages change, all QuotationLineItemMarkup records for
  affected line items are recomputed automatically

QuotationRevision: id, quotationId, revisionNumber (integer — auto-incrementing per
  quotation), snapshotData (JSON — full snapshot of all sections, markup columns, line
  items, and line item markups at this revision; complete document state), grandTotal
  (snapshot), terms (snapshot), revisedBy (userId), revisedAt
  NOTE: full document snapshot per revision; created automatically when Quotation content
  is edited after status = sent; previous versions never overwritten; all revisions
  accessible from both Quotation detail and parent Proposal's Quotations submenu;
  snapshotData contains the complete computation chain so any past version can be
  fully reconstructed and displayed exactly as it was

Invoice: id, customerId, proposalId (nullable), quotationId (nullable — links to the
  Quotation that generated this invoice; an invoice traces back to either a Proposal,
  a Quotation, or both), projectId (nullable), subscriptionId
  (nullable), lineItems[], subtotal, tax,
  total, amountPaid, creditApplied, balance, status (draft|sent|unpaid|partially_paid|
  overdue|paid), fundSourceId, dueDate, signatureUrl (nullable — PNG stored in R2/MinIO),
  signedAt (nullable — timestamp when signature was captured), isPublished (boolean,
  default false), publicToken (nullable — UUID, generated when isPublished set to true;
  immutable once created; never regenerated on re-publish), createdAt
  NOTE: balance = total - amountPaid - creditApplied
  CONSTRAINT: if projectId is set, Project.customerId MUST equal Invoice.customerId
  (validated on create and update; prevents cross-customer project invoicing)

Payment: id, tenantId, invoiceId, amount, currency, method (cash|bank_transfer|gcash|
  maya|card|xendit|credit), status (pending|completed|failed|refunded),
  referenceNumber (nullable), xenditPaymentId (nullable),
  fundSourceId (nullable — Phase 7: links the payment to the Banking fund source it
  posted to; set when D1 auto-post is used), recordedById (nullable — Phase 7: userId
  who recorded the payment), notes (nullable), paidAt, createdAt, updatedAt
  [global public schema; tenantId-scoped]
  NOTE (Phase 7 / D1): when fundSourceId is set, invoice.recordPayment auto-posts a
  Banking income FundTransaction (referenceType=invoice_payment, referenceId=Payment.id)
  to that fund source and bumps its currentBalance, in the same DB transaction.
  [Prior fields preserved for reference: referenceNo, balanceAfterPayment, excessAmount,
  excessHandling (credited_to_account|refunded|pending_decision), recordedBy — superseded
  by the above canonical schema as of Phase 7]

Subscription: id, customerId, planId, billingCycle (monthly|quarterly|annual),
  nextBillingDate, descriptionTemplate, status (active|paused|cancelled)

Vendor: id, type (direct_supplier|ecommerce_seller), name, createdAt

DirectSupplier: id, vendorId, companyOrPersonName, contactPerson, email, phone, address

ECommerceSeller: id, vendorId, platform (shopee|lazada|tiktok_shop|zalora|fb_marketplace|
  other), sellerName, profileUrl, createdAt

PurchaseOrder: id, vendorId, lineItems[], subtotal, status (draft|sent|confirmed|
  partially_received|received|cancelled), fundSourceId, expectedDate, approvedBy,
  approvedAt, createdAt

PurchaseOrderItem: id, purchaseOrderId, productId, productName, quantity, unitCost,
  discountedTotalCost (nullable — actual amount paid after e-commerce discounts for this
  line item; when set, computedUnitCost = discountedTotalCost / quantity),
  computedUnitCost (decimal — either unitCost or discountedTotalCost/qty),
  manualUnitCostOverride (nullable — user can manually set unit cost to account for
  additional fees; when set, overrides computedUnitCost for all downstream calculations),
  effectiveUnitCost (computed — manualUnitCostOverride ?? computedUnitCost),
  distributedShippingCost (decimal, default 0 — per-unit shipping cost from distribution;
  editable by user after system suggests), landedUnitCost (computed —
  effectiveUnitCost + distributedShippingCost),
  lineTotal (computed — quantity × effectiveUnitCost)

PurchaseOrderItemAllocation: id, purchaseOrderItemId, allocationType
  (stock|project_expense|company_expense), quantity (integer — how many units for this
  purpose; sum of all allocations for a PO item must equal PO item quantity),
  projectId (nullable — required when allocationType = project_expense; which project
  this allocation is for), actualUnitCostAtPurchase (decimal — snapshot of the
  PurchaseOrderItem's landedUnitCost at receiving time; this is the ACTUAL cost used for
  ProjectExpense and company Expense, NOT the product's current costPrice),
  notes (nullable), isProcessed (boolean, default false — set to true when allocation
  take-out is executed at receiving time),
  processedAt (nullable), processedBy (nullable — userId who executed the take-out),
  projectExpenseId (nullable — links to auto-created ProjectExpense when processed),
  expenseId (nullable — links to auto-created Expense when processed for company_expense),
  createdAt
  NOTE: allocations defined at PO creation time, but physical execution (inventory
  deduction + expense creation) happens at goods receipt time; stock allocations simply
  remain in inventory (no take-out needed); project_expense allocations create
  ProjectExpense at actualUnitCostAtPurchase (the real cost from THIS purchase order,
  NOT the product's current costPrice — even if admin chose to retain a higher previous
  cost for selling price purposes, project expenses always reflect actual purchase cost)
  with costType = inventory_consumed + StockMovement out; company_expense allocations
  create Expense at actualUnitCostAtPurchase + StockMovement out;
  receiving staff prompted to process pending allocations immediately or defer;
  allocation can be re-assigned after receiving: project/company items can return to
  stock; stock items can be taken out for project (project_manager accepts) or company
  use (admin accepts) at any time

ShippingCost: id, purchaseOrderId, logisticsProvider (string — courier name, e.g.
  "Lalamove", "Aguileon Cargo Express", "J&T Express"), amount (nullable — cost of this
  shipping leg), receiptPhotoUrl (nullable), fundSourceId (nullable — which account was
  used to pay this courier; creates FundTransaction on save),
  notes, addedBy, createdAt
  NOTE: multiple entries per PO allowed (multi-leg delivery chains common for Direct
  Supplier orders); total of all ShippingCost amounts = total shipping to distribute;
  each payment creates a FundTransaction referencing the PurchaseOrder

ShippingCostDistribution: id, purchaseOrderId, method (equal_share|proportional_by_cost),
  totalShippingCost (computed — sum of all ShippingCost amounts for this PO),
  distributedAt, distributedBy (userId)
  NOTE: system computes suggested per-item shipping costs based on selected method;
  equal_share: totalShippingCost ÷ totalQuantity = same per-unit cost for all items;
  proportional_by_cost: each item gets shipping proportional to (item lineTotal ÷ PO
  subtotal) × totalShippingCost; suggested values written to each PurchaseOrderItem's
  distributedShippingCost field as editable defaults; user can switch methods, manually
  override any item's value, or zero out specific items; re-running distribution
  recalculates all suggestions (does not override manually edited values unless user
  explicitly requests reset)

GoodsReceipt: id, purchaseOrderId, receivedBy, receivedAt, notes, photos (url[]),
  hasUnprocessedAllocations (boolean — computed; true when any linked
  PurchaseOrderItemAllocation has isProcessed = false and allocationType != stock)

GoodsReceiptItem: id, goodsReceiptId, purchaseOrderItemId, productId, quantityReceived

PurchaseInvoice: id, purchaseOrderId, vendorInvoiceNo, amount, fundSourceId,
  status (unpaid|paid), dueDate, createdAt

Expense: id, category (free-text string — general expense category for non-project expenses;
  kept for backward compatibility), amount, description, attachmentUrl, fundSourceId, projectId
  (nullable — if set, expense also appears in the project's Expenses submenu),
  expenseCategoryId (nullable FK → ExpenseCategory — required when projectId is set;
  for non-project expenses, category free-text field is used instead),
  submittedBy, status (draft|approved|rejected), createdAt

Product: id, name, sku, description, type (physical|service), costPrice (decimal — latest
  landed unit cost from most recent purchase), stock, reorderLevel, categoryId,
  barcodeValue (nullable — auto-generated random unique code or manually input by user
  based on product number/box label; used for scanning at receiving, disbursement, POS,
  stock counts), barcodeFormat (qr_code|barcode_128|barcode_ean13 — format for printed
  label generation),
  requiresSerialNumber (boolean, default false — when true, all stock-in and stock-out
  operations must track individual serial numbers via ProductSerialNumber; serial numbers
  scannable via smartphone camera OCR or barcode/QR scanner; set at product creation,
  changeable only when stock = 0),
  tier1MarkupMode (percentage|ceiling), tier1MarkupPercentage (decimal, default 15),
  tier1CeilingAmount (nullable — max markup amount when mode = ceiling),
  tier1Price (computed — Dealer's Price / Discounted Price; golden formula from costPrice),
  tier2MarkupMode (percentage|ceiling), tier2MarkupPercentage (decimal, default 5),
  tier2CeilingAmount (nullable),
  tier2Price (computed — Commissioner / Buffer price; golden formula from tier1Price),
  tier3MarkupMode (percentage|ceiling), tier3MarkupPercentage (decimal, default 12),
  tier3CeilingAmount (nullable),
  tier3Price (computed — SRP / Government Price with VAT; golden formula from tier2Price),
  isVisibleInEcommerce (boolean, default false — when true, product appears on the
  public-facing e-commerce storefront; admin controls which products are shown to
  customers online; products not flagged are internal/back-office inventory only),
  ecommerceDescription (nullable — extended description for storefront display;
  separate from internal description), ecommerceImages (nullable — String[] array
  of image URLs for storefront product gallery; separate from internal photos),
  isActive, createdAt
  tier1MarkupMode = ceiling; tier2 and tier3 chain from previous tier similarly;
  tier3Price is the default selling price for POS and invoices without quotation;
  tier1Price is the discounted/dealer price; all three tiers recalculate automatically
  when costPrice changes or markup settings are modified; for Quotation-based invoices,
  these standard prices are NOT used — Quotation's approved prices apply instead

ProductSerialNumber: id, productId, serialNumber (unique per product), status (in_stock|
  sold|disbursed_to_project|transferred|written_off), warehouseId,
  referenceType (nullable — goods_receipt|pos_sale|invoice|inventory_disbursement|
  stock_transfer|manual_write_off), referenceId (nullable), createdAt, updatedAt
  NOTE: one record per physical unit; serial number entered at goods receipt via
  smartphone camera OCR (recognizes printed serial numbers), QR/barcode scanner, or
  manual typing; system flags items requiring serial scan before sale/handover with
  prominent notification; status updated on every movement; full audit trail via
  referenceType/referenceId

Category: id, name, parentId

ProductPurchaseHistory: id, productId, purchaseOrderId, vendorId, vendorName, vendorType,
  platform, quantityReceived, unitCost, shippingCostShare, landedUnitCost, receivedAt

StockMovement: id, productId, type (in|out|adjustment|transfer), quantity, referenceType,
  referenceId, serialNumberIds (nullable — String[] Prisma native array of
  ProductSerialNumber IDs; populated only when product has requiresSerialNumber = true),
  notes, createdAt

Warehouse: id, name, location, isDefault

WarehouseStock: id, warehouseId, productId, quantity

InventoryDisbursement: id, projectId, requestedBy (userId — must be project_manager or
  above), approvedBy (nullable — userId, must be admin or tenant_super_admin),
  status (pending|approved|rejected|partially_fulfilled|fulfilled), rejectionReason
  (nullable), approvedAt (nullable), fulfilledAt (nullable), notes, createdAt
  NOTE: createdAt = request timestamp. Approval workflow — project_manager creates request;
  admin/tenant_super_admin approves; inventory_staff or admin processes the physical scan-out;
  project_manager CANNOT approve their own requests

InventoryDisbursementItem: id, inventoryDisbursementId, productId, quantityRequested,
  quantityFulfilled (default 0), unitCostAtDisbursement (costPrice at time of fulfillment —
  snapshot, not live reference), serialNumberIds (nullable — String[] Prisma native array of
  ProductSerialNumber IDs; populated only for serialized products), projectExpenseId
  (nullable — links to the auto-created ProjectExpense record), createdAt

Project: id, customerId, name, description, budget, startDate, endDate,
  status (draft|active|on_hold|completed|cancelled), managerId, createdAt

ProjectExpense: id, projectId, cashAdvanceId (nullable),
  inventoryDisbursementItemId (nullable — set when created from inventory disbursement),
  expenseCategoryId (FK → ExpenseCategory — required on all project expenses), amount,
  description, receiptUrl (nullable — receipt photo scanned via mobile app or uploaded
  via web; optional because some expenses like transportation may not have receipts),
  fundSourceId (nullable — null for inventory_consumed expenses since no fund movement;
  for direct expenses, references the custodian's or company's FundSource account),
  costType (direct|inventory_consumed — direct = normal expense with journal entry;
  inventory_consumed = from inventory disbursement, NO journal entry, project-only visibility),
  loggedBy, status (draft|approved|rejected), createdAt
  NOTE: costType = inventory_consumed expenses are EXCLUDED from Journal Entry creation
  and from P&L / accounting reports. They appear ONLY in Project Dashboard, per-project
  expense reports, and project profitability reports.
  NOTE: the old 'category' free-text field is removed — use expenseCategoryId (FK) instead.

ProjectNote: id, projectId, parentId (nullable — for nested pages; null = top-level note),
  title, content (JSON — BlockNote document format; stores all block types including
  checklists, headings, lists, tables, code, callouts), createdBy (userId),
  updatedBy (nullable — userId), sortOrder (integer — for manual reordering within parent),
  createdAt, updatedAt
  NOTE: unlimited nesting depth; content stored as BlockNote JSON for rich rendering;
  checklist state (checked/unchecked) persisted in the JSON content

ProjectNoteAttachment: id, projectNoteId, fileUrl (R2/MinIO path), fileName,
  fileSize (bytes), mimeType (image/jpeg|image/png|image/webp|application/pdf|
  text/plain|text/csv|text/markdown), uploadedBy (userId), uploadedAt
  NOTE: max 50MB per file; viewable inline in the app (images rendered, PDFs embedded,
  text files displayed with syntax highlighting where applicable)

Milestone: id, projectId, title, description (nullable), dueDate, isCompleted (boolean),
  isAutoCompleted (boolean — true when completion was calculated from task status;
  false when manually overridden), completedAt (nullable), completedOverrideBy
  (nullable — userId of who manually overrode auto-calculation), createdAt
  NOTE: auto-completion logic: when ALL tasks with milestoneId = this milestone have
  status = done → milestone automatically marked isCompleted = true, isAutoCompleted = true;
  if any linked task is reopened → milestone automatically unmarked;
  manual override: admin/project_manager can set isCompleted regardless of task status →
  isAutoCompleted = false, completedOverrideBy = userId

TimeLog: id, projectId, taskId, userId, hours, description, loggedAt

Task: id, title, description, projectId, milestoneId (nullable — links task to a milestone
  for grouping; milestone completion auto-calculated from linked tasks), parentTaskId
  (nullable — self-referencing for subtasks; null = top-level task; subtasks inherit
  parent's projectId), assignedBy (nullable — userId of who created the task; null if
  self-created),
  priority (low|medium|high), status (todo|in_progress|done|cancelled), dueDate (DateTime —
  includes both date and time for precise scheduling), createdAt
  NOTE: assignedTo removed — replaced by TaskAssignment join table for multi-assignee;
  subtask hierarchy has no depth limit but UI renders up to 3 levels for readability

TaskAssignment: id, taskId, userId, assignedAt, assignedBy (userId),
  removedAt (nullable — soft-delete timestamp; null = active assignment)
  NOTE: replaces the previous Task.assignedTo single field; one task can have multiple
  assignees; notifications sent to ALL assignees on task status changes; removing an
  assignment sets removedAt timestamp for audit trail — record is never hard-deleted

TaskAttachment: id, taskId, fileUrl (R2/MinIO path), fileName, fileSize (bytes),
  mimeType, uploadedBy (userId), uploadedAt
  NOTE: max 10MB per file (standard file upload limit); images and documents

TaskStatusReport: id, taskId, userId, content (text — what was done, issues, handoff notes),
  attachmentUrls (nullable — array of file URLs), createdAt
  NOTE: optional — created when a task is marked done; useful for accountability and
  knowledge transfer; one report per completion event (if task is reopened and re-completed,
  a new report is created)

ToDo: id, userId, title, description (nullable — text notes), priority (low|medium|high,
  default low), isCompleted, dueDate (nullable), createdAt

ToDoAttachment: id, todoId, fileUrl (R2/MinIO path), fileName, fileSize (bytes),
  mimeType (image/jpeg|image/png|image/webp|application/pdf), uploadedBy (userId),
  uploadedAt
  NOTE: max 10MB per file; multiple attachments per ToDo allowed; Free plan: all
  ToDoAttachment upload endpoints return 403 — same restriction as all other upload
  features across the app; paid plans: full upload access

AttendanceRecord: id, userId, date, clockInTime, clockInLat, clockInLng,
  clockInLocation (office|project_site), clockOutTime, clockOutLat, clockOutLng,
  workLocation, projectId, status (pending|approved|rejected), approvedBy, approvedAt,
  notes, isSyncedFromOffline (boolean), createdAt

FundSource: id, type (cash_on_hand|e_wallet|bank|credit_card|loan), name, institutionName
  (nullable — for bank/credit card/loan), accountNumber (nullable), assignedTo (nullable —
  userId; when set, this account is a custodian account held by the assigned user;
  null = company-wide account managed by admin/accountant only), currentBalance,
  creditLimit (nullable — credit card only), outstandingBalance (nullable — credit card
  and loan; for credit card = amount owed to bank from purchases; for loan = remaining
  loan balance to be repaid),
  loanAmount (nullable — loan only; original loan principal received),
  loanSource (nullable — loan only; who/where the loan is from, e.g. "BDO Personal Loan",
  "Owner Capital Injection", "SSS Salary Loan"),
  loanStatus (nullable — loan only; active|paid; when paid, isActive set to false with
  note "PAID"),
  isActive, createdAt
  NOTE: 5 account types with distinct behaviors:
  - cash_on_hand: real cash, balance starts at initial amount, cannot go below zero;
    multiple accounts allowed including custodian accounts
  - e_wallet: GCash, Maya, GoTyme etc.; real cash, cannot go below zero
  - bank: savings/checking; real cash, cannot go below zero
  - credit_card: starts at zero, increases (positive, displayed in matte red font) when
    used for purchases/expenses; represents liability; CAN be used directly for any
    purchase or expense (POs, Shopee, utilities, gasoline, etc.); has its own ledger
    showing every charge; settled via CreditCardPayment (straight, bulk, installment)
  - loan: starts at the loanAmount (real money received); has its own ledger but CANNOT
    be used to directly purchase or expense anything; only 3 transaction types allowed:
    (1) Money Out To — transfer loan funds to company accounts (bank, cash, e-wallet)
    (2) Money In — receive repayment transfers from company accounts back into loan
        account (to track how much has been repaid)
    (3) Payback To — final settlement payment to the loan provider; marks loan as PAID,
        loanStatus = paid, isActive = false; loan account disabled with "PAID" label
    Loan outstandingBalance = loanAmount - total repaid; displayed in matte red font
    (same as credit card — both represent liabilities)

FundTransfer: id, fromFundSourceId, toFundSourceId, amount, description (nullable),
  referenceNo (nullable), approvedBy (nullable — userId; required for transfers above
  a configurable threshold), transferredBy (userId), transferredAt, createdAt
  NOTE: creates paired FundTransactions — debit on source account, credit on destination;
  used for: bank → custodian cash replenishment, cash → bank deposits, inter-account
  movements, staff returning cash to company accounts, staff-to-staff transfers,
  credit card bill payments; any custodian can initiate a transfer FROM their own account
  to any company account or another custodian's account; accountant or admin can initiate
  any transfer; full audit trail via FundTransaction records

FundRequest: id, requestedBy (userId — who needs the funds), requestedFromFundSourceId
  (the account to pull funds from), requestedToFundSourceId (the account to receive funds),
  amount, purpose (string — reason for the fund request), status (pending|approved|denied),
  approvedBy (nullable — userId of the account holder or admin who approved),
  deniedBy (nullable), denialReason (nullable), fundTransferId (nullable — links to the
  auto-created FundTransfer when approved), createdAt, resolvedAt (nullable)
  NOTE: any custodian can request funds from any account; the request goes to the account
  holder (if custodian account) or admin/accountant (if company account); on approval,
  a FundTransfer is automatically created and executed; on denial, requester is notified
  with reason; pending requests visible in Banking dashboard and as push notification

FundTransaction: id, fundSourceId, type (credit|debit), amount, referenceType
  (payment|expense|fund_transfer|fund_request|payroll|cash_advance|credit_card_payment|
  pos_sale|purchase_order|loan_disbursement|loan_repayment|loan_payback|
  manual_adjustment), referenceId,
  description, details (nullable — text, extended notes about the transaction; e.g.
  for loan disbursement: "Transferred to BDO Savings for equipment purchase";
  for loan repayment: "Monthly payment 3/12 from BDO Savings";
  for loan payback: "Final settlement to BDO — loan fully paid"),
  balanceAfter, createdBy, createdAt
  NOTE: immutable ledger — never updated or deleted; balanceAfter provides running
  balance for bank-statement-style display; every money movement in the system creates
  a FundTransaction record; each account shows its own ledger with running balance
  that can be counter-checked against actual bank statements, physical cash counts,
  or e-wallet balances; loan accounts show only loan_disbursement (money out to company
  accounts), loan_repayment (money in from company accounts), and loan_payback (final
  settlement) transaction types

FundTransactionAttachment: id, fundTransactionId, fileUrl (R2/MinIO path), fileName,
  fileSize (bytes), mimeType (image/jpeg|image/png|image/webp|application/pdf),
  uploadedBy (userId), uploadedAt
  NOTE: max 10MB per file; multiple attachments per transaction allowed; used for:
  loan transaction proof (bank transfer receipts, promissory notes, payment confirmation
  screenshots, loan agreement documents, official receipts); also available on ALL
  transaction types across all account types (not just loans) for receipt/proof uploads;
  especially useful for loan accounts where every movement should have supporting
  documentation for audit purposes

CreditCardTransaction: id, creditCardFundSourceId, amount (decimal — original charge
  amount), bankFee (decimal, default 0 — convenience/processing fee added when billing
  statement arrives; recorded as separate bank charges expense in GL),
  totalBilled (computed — amount + bankFee), referenceType (purchase_order|expense|
  project_expense|ecommerce_order|pos_sale|other), referenceId,
  description (string — what was purchased/expensed),
  isPaid (boolean, default false — set to true when included in a CreditCardPayment;
  paid transactions grayed out with "PAID" badge in UI but still clickable to view
  details), paidAt (nullable), creditCardPaymentId (nullable — links to the
  CreditCardPayment record that settled this transaction), createdAt
  NOTE: one record per credit card charge; each transaction links to its source (PO,
  Expense, etc.) via clickable referenceId; bankFee can be added after the fact when
  billing statement reveals actual amount; totalBilled is what actually needs to be
  repaid; all transactions visible in the credit card's ledger view; paid transactions
  remain accessible for viewing PO details, line items, and bank fee breakdown

CreditCardPayment: id, creditCardFundSourceId, paidFromFundSourceId, amount (decimal —
  total amount being paid in this payment), paymentType (selective|bulk_statement|
  installment), coveredTransactionIds (String[] — array of CreditCardTransaction IDs
  being settled by this payment; selected via multi-select checkboxes matching the
  billing statement), statementPeriodStart (nullable), statementPeriodEnd (nullable),
  isInstallment (boolean, default false), installmentMonths (nullable — total months
  for installment plan, e.g. 12), monthlyAmount (nullable — computed or manual),
  totalInstallmentCost (nullable — monthlyAmount × installmentMonths),
  installmentBankCharges (nullable — totalInstallmentCost - originalAmount; recorded as
  bank charges expense in general ledger), installmentsPaid (integer, default 0 —
  incremented each time a monthly payment is made; display: "4/12 paid"),
  remainingBalance (computed — totalInstallmentCost - (monthlyAmount × installmentsPaid)),
  notes, createdBy, createdAt
  NOTE: selective payment is the primary mode — admin selects specific transactions from
  the credit card ledger that appear on the current billing statement → system totals
  them → pays from any company account; selected transactions marked isPaid = true;
  for installment plans, the original purchase amount is the expense; the excess
  (installmentBankCharges / interest) is a separate expense line in the general ledger;
  each monthly installment payment creates a FundTransfer from the paying account to
  the credit card, reducing outstandingBalance; installment tracker UI shows: original
  amount, monthly payment, months remaining, total interest paid, remaining balance

Employee: id, userId, employeeNo, position, department,
  employmentType (full_time|part_time|contractual), hireDate, salary, isActive

Attendance: id, employeeId, attendanceRecordId, date, hoursWorked,
  status (present|absent|late|half_day)

LeaveRequest: id, employeeId, type (vacation|sick|emergency), startDate, endDate,
  status (pending|approved|rejected), approvedBy

CashAdvance: id, employeeId, amount, fundSourceId, isProjectLinked, projectId, purpose,
  status (pending|approved|released|partially_recovered|fully_recovered),
  approvedBy, releasedAt, createdAt

CashAdvanceRecovery: id, cashAdvanceId, payrollId, amountDeducted, remainingBalance, createdAt

Payroll: id, periodStart, periodEnd, status (draft|approved|released)

Payslip: id, payrollId, employeeId, basicPay, deductions[], additions[],
  cashAdvanceDeductions[], netPay, fundSourceId

POSSession: id, cashierId, openedAt, closedAt, openingCash, closingCash, fundSourceId,
  status (open|closed)

POSSale: id, sessionId, customerId, lineItems[], subtotal, discount, tax, total,
  paymentMethod, fundSourceId, receiptNo, createdAt

POSSaleItem: id, saleId, productId, quantity, unitPrice, lineTotal,
  serialNumberIds (nullable — String[] Prisma native array of ProductSerialNumber IDs;
  populated only for serialized products)

Account: id, code, name, type (asset|liability|equity|income|expense), balance

JournalEntry: id, referenceType, referenceId, date, lines[], description, createdBy

JournalLine: id, journalEntryId, accountId, debit, credit

TaxRate: id, name (string — e.g. "VAT", "Withholding Tax", "Service Tax"), percentage
  (decimal), isDefault (boolean), isActive (boolean), createdAt
  NOTE: generalized tax system — not locked to Philippine BIR rates; admin per tenant can
  create, modify, and set default tax rates; default seed: VAT 12% (Philippine standard);
  additional rates configurable for other jurisdictions or special tax types

FiscalYear: id, name (string — e.g. "FY 2026"), startDate, endDate, isClosed (boolean),
  createdAt
  NOTE: configurable per tenant; default: calendar year Jan 1 – Dec 31; admin can set
  custom fiscal year periods (e.g. Apr 1 – Mar 31 for government clients); isClosed
  prevents new journal entries from being posted to a closed fiscal year

Ticket: id, customerId, projectId, subject, description,
  priority (low|medium|high|critical), status (open|in_progress|resolved|closed),
  assignedTo (userId — single assignee only; NOT multi-assignee like Tasks), createdAt

TicketComment: id, ticketId, authorId, message, isInternal, createdAt

TicketAttachment: id, ticketId, fileUrl, uploadedAt

ExpenseCategory: id, name (string — human-readable label), slug (string — snake_case
  unique identifier, e.g. installation_materials), isDefault (boolean — true for seeded
  categories; seeded defaults: installation_materials, transportation, meals, accommodation,
  equipment_rental, labor, permits_fees, communication, miscellaneous), isActive (boolean),
  createdAt [tenant schema]
  NOTE: this is a DATABASE TABLE (Prisma model), NOT a TypeScript enum. Foreign key from
  ProjectExpense.expenseCategoryId and Expense.expenseCategoryId. Tenant_super_admin and
  admin can add custom categories. Default categories cannot be deleted, only deactivated.

EcommerceOrder: id, customerId, orderNumber (string — auto-generated), lineItems[],
  subtotal, discountAmount (computed — based on customerTier: regular 5% if ≥₱3,000 and
  admin-approved, vip 10%, authorized_dealer 12%), discountType (nullable — tier_vip|
  tier_dealer|regular_threshold|none), tax, total, shippingAddress (text),
  paymentMethod (nullable — xendit payment method used), xenditPaymentId (nullable —
  Xendit transaction reference), paymentStatus (pending|paid|failed|refunded),
  orderStatus (pending_payment|paid|processing|ready_for_pickup|shipped|delivered|
  completed|cancelled|refunded), orderType (online|in_store — in_store for POS-linked
  orders), notes (nullable), createdAt, updatedAt
  NOTE: online orders created via storefront checkout; in_store orders created when
  POS staff links a sale to a customer account; stock deducted on payment confirmation;
  serialized products have serials assigned at fulfillment, not checkout

EcommerceOrderItem: id, orderId, productId, quantity, unitPrice (at time of order —
  snapshot), discount (per-unit discount based on customer tier), finalPrice (computed —
  unitPrice - discount), lineTotal (computed — quantity × finalPrice),
  serialNumberIds (nullable — assigned at fulfillment for serialized products)

JobOrder: id, customerId, jobOrderNumber (string — 14-char system-generated:
  YYYYMMDD + 6 random uppercase alphanumeric, e.g. "20260430UPWLFM"),
  kindOfDevice (string — e.g. "Laptop", "Router", "Printer", "Desktop PC"),
  deviceBrand (string), deviceModel (string), issueDescription (text — "Issue or work
  to be done"), accessoriesIncluded (text, nullable — "Accessories & other parts included"),
  devicePhotos (nullable — String[] array of photo URLs taken at intake),
  assignedTechnicianId (nullable — userId of assigned technician),
  diagnosisNotes (nullable — text from technician after inspection),
  repairNotes (nullable — text documenting work performed),
  quotationId (nullable — FK to Quotation if parts replacement needed; uses same
  Quotation entity and markup computation as standard quotations),
  partsUsed (nullable — JSON array of {productId, quantity, serialNumberIds, costAtUse}),
  laborHours (nullable — decimal, time spent on repair),
  totalPartsCost (computed — sum of partsUsed costs),
  totalLaborCost (nullable — laborHours × configured labor rate),
  totalCost (computed — totalPartsCost + totalLaborCost),
  receivedByName (string — printed name of person who delivered the device),
  receivedBySignatureUrl (nullable — PNG, digital signature at intake),
  receivedAt (DateTime — date + time of device handover),
  receivedByStaffId (userId — staff who accepted the device),
  pickedUpByName (nullable — printed name of person who picks up),
  pickupSignatureUrl (nullable — PNG, digital signature at release),
  pickedUpAt (nullable — DateTime, date + time of pickup),
  releasedByStaffId (nullable — userId of staff who released the device),
  status (received|diagnosis|quotation_pending|customer_approved|in_repair|
  testing|ready_for_pickup|released|closed|cancelled),
  customerApprovedAt (nullable), customerDeclinedAt (nullable),
  createdAt, updatedAt
  NOTE: Job Order form is printable as PDF via React-PDF with all fields, signature
  areas, and tenant branding; customer can approve/decline repair quotation from portal;
  parts deducted from inventory on approval (StockMovement out, referenceType: job_order);
  if serialized, serial numbers scanned at parts usage; job order ID format ensures
  uniqueness and includes date for easy sorting

CustomerDocument: id, customerId, title (string — display name), fileUrl (R2/MinIO
  path), fileName, fileSize (bytes), mimeType, documentType (proposal|receipt|warranty|
  repair_report|invoice|certificate|other), uploadedBy (userId — admin/staff who shared
  the document), uploadedAt
  NOTE: admin uploads documents to customer's document library; customer can view/download
  from portal Documents submenu; used for signed proposals, payment receipts, warranty
  certificates, repair completion reports

## Integrations
Nodemailer: SMTP email transport for all transactional emails — OSS (MIT license);
  platform-level emails (welcome, billing, suspension) use Powerbyte's SMTP credentials
  from platform .env; tenant-level emails (invoices, payroll, alerts, ticket updates,
  public invoice links) use each tenant's own SMTP credentials from TenantSmtpConfig;
  tenants without configured SMTP → emails queued but not sent, dashboard warning shown
Expo Push Notifications (FCM + APNs): mobile push for task assignments, approvals,
  DTR events, payroll, credit alerts, inventory disbursement approvals/rejections — no OSS
  equivalent for cross-platform push
Xendit: online payment gateway — two scopes:
  (1) Platform-level: Powerbyte's own Xendit account (API keys in CREDENTIALS.md / .env)
      used for collecting tenant subscription payments (TenantInvoice); this is the only
      Xendit account required at launch
  (2) Tenant-level (v2 / future): per-tenant Xendit API keys stored encrypted (similar to
      TenantSmtpConfig via TenantXenditConfig entity); enables each tenant's own e-commerce
      checkout and customer portal invoice payments; not required for v1 launch
  Supports: GCash, Maya, credit/debit cards, bank transfers, over-the-counter (7-Eleven,
  Cebuana); Xendit webhook for payment confirmation → order status update →
  FundTransaction creation; refund support: full and partial refunds via Xendit API;
  currency: PHP (₱) default but system accepts any currency (configurable per tenant);
  Xendit docs: https://docs.xendit.co — Paid
Cloudflare R2: production file storage (S3-compatible, zero egress fees) — Paid
  OSS alternative: self-hosted MinIO on prod VPS
Upstash: managed Valkey (Redis-compatible) for queue broker in production — Paid
  OSS alternative: self-hosted Valkey on VPS
Leaflet.js + OpenStreetMap: GPS pin display on web DTR attendance records — Free/OSS
React Native Maps + OpenStreetMap tiles: GPS display in mobile app — Free/OSS
React-PDF: server-side PDF generation for invoices, payslips, proposals — OSS
SheetJS: XLSX export for accounting and HR reports — OSS
BlockNote: block-based rich text editor for Project Notes (@blocknote/core +
  @blocknote/react, MPL-2.0 license — safe for commercial SaaS; XL packages NOT used) — OSS
Cloudflare Turnstile: bot protection on public forms (login, register, password reset,
  demo auto-login, public invoice signature) — Free (Managed mode, invisible challenge,
  1 widget per app); server-side validation via /siteverify API — Free/Paid
Shopee Open Platform API (optional — v2 or when developer account approved): pull purchase
  history, store names, item names, item images from Shopee seller/buyer account; auto-
  populate "Awaiting Receipt" queue in Purchase Orders; reduces manual data entry;
  API docs: https://open.shopee.com/developer-guide/4; requires Shopee developer account
  and API key; manual entry always available as primary/fallback — Paid (Shopee partner)

## Deployment Config
Environments: dev / staging / prod
Hosting:      VPS or Railway/Render (Docker Compose mono-server; K8s placeholder only)
Dev mode:     MODE A — WSL2 native (only supported mode — pre-locked)
Docker Hub:   enabled — hub_repo: bonitobonita24/orqafy

## Mobile Needs

**Native mobile app:** iOS + Android; Expo managed workflow; internal/enterprise
  distribution only — APK (Android) and IPA (iOS) via MDM or direct install link;
  NOT App Store or Play Store
**Auth mode (if native mobile):** persistent — users stay logged in between sessions;
  offline JWT valid even without active connection; required for offline DTR and task access

Offline-first:  yes
  - DTR clock-in/out: fully offline; native GPS; stored in WatermelonDB; auto-synced
  - Task viewing and status updates: offline; synced on reconnect; server wins on conflict
  - Payslip and leave balance: last-fetched cached; readable offline with notice
  - Expense submission: form offline; receipt photo stored locally; uploaded on reconnect
  - All other features require internet connection
Push notifications: yes — Expo Push Notifications (FCM + APNs)
  Triggers: task assigned, task status updated, attendance approved/rejected,
  leave approved/rejected, expense approved/rejected, payroll released,
  low-stock alert (admin + inventory_staff), cost change alert (admin),
  customer credit balance changed (sales_staff + accountant),
  excess payment decision required (sales_staff),
  inventory disbursement request created (admin + tenant_super_admin),
  inventory disbursement approved/rejected (project_manager who requested),
  fund request received (account holder or admin),
  fund request approved/denied (requester),
  ecommerce order placed (admin + inventory_staff),
  ecommerce order status changed (customer — paid, processing, shipped, delivered),
  job order status changed (customer — diagnosis complete, quotation ready, ready for pickup),
  job order parts quotation awaiting approval (customer)
Native features: GPS (DTR clock-in/out, works offline), Camera (expense receipt photos,
  task attachment photos), Barcode/QR Scanner (inventory disbursement scan-out, POS
  serialized product scan, goods receipt serial number entry — expo-camera built-in
  barcode scanning on mobile via CameraView barcodeScannerSettings, html5-qrcode on web),
  Biometrics (optional Face ID/Fingerprint for app unlock — NOT for auth)
Deep linking:   yes — push notification tap opens relevant screen directly:
  task notification → task detail, attendance → attendance record,
  expense → expense record, payroll → payslips, credit alert → customer credit tab,
  disbursement notification → disbursement detail,
  ecommerce order notification → portal order detail,
  job order notification → portal repair detail (customer) or job order detail (staff),
  fund request notification → fund request detail
Local DB:       WatermelonDB (offline storage and sync queue)

**Per-page mobile strategy (V31 — auto-classified, reviewed by user):**

| # | Page | Strategy | Notes |
|---|------|----------|-------|
| 1 | / (Public landing page) | Mobile First | Customer-facing, public URL |
| 2 | /login | Mobile First | Access from anywhere |
| 3 | /register | Mobile First | Customer-facing, public URL |
| 4 | /demo | Mobile First | Customer-facing, public URL |
| 5 | /invoice/\<publicToken\> | Mobile First | Customer-facing, public URL; signature capture |
| 6 | /terms | Mobile First | Customer-facing, public URL |
| 7 | /privacy | Mobile First | Customer-facing, public URL |
| 8 | /\<slug\>/erp/dashboard (Task Dashboard) | Mobile First | Home for all users including field staff; Kanban + Calendar |
| 9 | /\<slug\>/erp/crm/customers | Mobile Ready | Data table, back-office, admin/sales desk work |
| 10 | /\<slug\>/erp/crm/customers/\<id\> (Customer Profile) | Mobile Ready | Detail view with 8 submenus, back-office |
| 11 | /\<slug\>/erp/crm/customers/\<id\>/proposals | Mobile Ready | Customer-scoped proposals & quotations |
| 12 | /\<slug\>/erp/crm/customers/\<id\>/invoices | Mobile Ready | Customer-scoped invoices |
| 13 | /\<slug\>/erp/crm/customers/\<id\>/subscriptions | Mobile Ready | Customer-scoped subscriptions |
| 14 | /\<slug\>/erp/crm/customers/\<id\>/payments | Mobile Ready | Customer-scoped payments |
| 15 | /\<slug\>/erp/crm/customers/\<id\>/credit (Credit Notes) | Mobile Ready | Financial data, desk work |
| 16 | /\<slug\>/erp/crm/customers/\<id\>/projects | Mobile Ready | Customer-scoped projects |
| 17 | /\<slug\>/erp/crm/customers/\<id\>/tickets | Mobile Ready | Customer-scoped tickets |
| 18 | /\<slug\>/erp/crm/proposals (Proposals & Quotations) | Mobile Ready | Data table, back-office |
| 19 | /\<slug\>/erp/crm/proposals/\<id\> (Proposal detail) | Mobile Ready | Detail with submenus (Overview, Files, Quotations, Revisions) |
| 20 | /\<slug\>/erp/crm/proposals/\<id\>/files | Mobile Ready | File list + upload, desk work |
| 21 | /\<slug\>/erp/crm/proposals/\<id\>/quotations | Mobile Ready | Linked quotations list, desk work |
| 22 | /\<slug\>/erp/crm/proposals/\<id\>/revisions | Mobile Ready | Revision history, desk work |
| 23 | /\<slug\>/erp/crm/quotations/\<id\> (Quotation detail) | Mobile Ready | Detail with line items + revision history |
| 24 | /\<slug\>/erp/crm/quotations/\<id\>/revisions | Mobile Ready | Revision history, desk work |
| 25 | /\<slug\>/erp/crm/invoices | Mobile Ready | Data table 8+ columns, back-office |
| 26 | /\<slug\>/erp/crm/invoices/\<id\> (Invoice detail) | Mobile Ready | Detail view with tabs, back-office |
| 27 | /\<slug\>/erp/crm/subscriptions | Mobile Ready | Data table, back-office |
| 28 | /\<slug\>/erp/purchasing/vendors | Mobile Ready | Data table, back-office |
| 29 | /\<slug\>/erp/purchasing/purchase-orders | Mobile Ready | Data table, back-office |
| 30 | /\<slug\>/erp/purchasing/purchase-orders/\<id\> (PO detail) | Mobile Ready | Detail + line items + shipping costs, desk work |
| 31 | /\<slug\>/erp/purchasing/goods-receipts | Mobile Ready | Data table, back-office |
| 32 | /\<slug\>/erp/purchasing/goods-receipts/\<id\> (GR detail) | Mobile First | Photo capture, barcode scanning, field/warehouse work |
| 33 | /\<slug\>/erp/inventory/products | Mobile Ready | Data table, back-office |
| 34 | /\<slug\>/erp/inventory/products/\<id\> (Product detail) | Mobile Ready | Detail view, back-office |
| 35 | /\<slug\>/erp/inventory/stock-movements | Mobile Ready | Data table, back-office |
| 36 | /\<slug\>/erp/inventory/disbursements | Mobile Ready | Data table + approval workflow, desk work |
| 37 | /\<slug\>/erp/inventory/disbursements/\<id\> (Disbursement detail) | Mobile First | Barcode/QR scan-out, warehouse staff, field fulfillment |
| 38 | /\<slug\>/erp/inventory/warehouses | Mobile Ready | Settings-like, infrequent access |
| 39 | /\<slug\>/erp/projects | Mobile Ready | Data table, back-office |
| 40 | /\<slug\>/erp/projects/\<id\>/dashboard | Mobile Ready | Analytics, multi-chart layout |
| 41 | /\<slug\>/erp/projects/\<id\>/invoices | Mobile Ready | Data table, back-office |
| 42 | /\<slug\>/erp/projects/\<id\>/expenses | Mobile Ready | Data table, back-office |
| 43 | /\<slug\>/erp/projects/\<id\>/notes | Mobile Ready | Rich text editor (BlockNote), desk work |
| 44 | /\<slug\>/erp/projects/\<id\>/notes/\<noteId\> | Mobile Ready | Rich text editor, desk work; mobile = read-only |
| 45 | /\<slug\>/erp/projects/\<id\>/milestones | Mobile Ready | Data table, back-office |
| 46 | /\<slug\>/erp/projects/\<id\>/tasks | Mobile Ready | Data table + subtasks, back-office |
| 47 | /\<slug\>/erp/projects/\<id\>/time-logs | Mobile Ready | Data table, back-office |
| 48 | /\<slug\>/erp/projects/\<id\>/settings | Mobile Ready | Settings panel, infrequent |
| 49 | /\<slug\>/erp/hr/employees | Mobile Ready | Data table, HR desk work |
| 50 | /\<slug\>/erp/hr/attendance | Mobile Ready | Data table + map view, HR desk work |
| 51 | /\<slug\>/erp/hr/leave | Mobile Ready | Data table + approval, HR desk work |
| 52 | /\<slug\>/erp/hr/cash-advances | Mobile Ready | Data table, HR/finance desk work |
| 53 | /\<slug\>/erp/hr/payroll | Mobile Ready | Data table + payslips, HR desk work |
| 54 | /\<slug\>/erp/banking/fund-sources | Mobile Ready | Financial data, desk work |
| 55 | /\<slug\>/erp/banking/transactions | Mobile Ready | Data table, desk work |
| 56 | /\<slug\>/erp/banking/credit-card-payments | Mobile Ready | Financial data, desk work |
| 57 | /\<slug\>/erp/banking/fund-transfers | Mobile Ready | Data table, desk work |
| 58 | /\<slug\>/erp/banking/fund-requests | Mobile First | Custodians request/approve funds on the go |
| 59 | /\<slug\>/erp/banking/master-ledger | Mobile Ready | Centralized ledger, desk work |
| 60 | /\<slug\>/erp/accounting/chart-of-accounts | Mobile Ready | Data table, accountant desk work |
| 61 | /\<slug\>/erp/accounting/journal-entries | Mobile Ready | Data table, accountant desk work |
| 62 | /\<slug\>/erp/accounting/reports | Mobile Ready | Analytics, multi-chart, PDF/XLSX export |
| 63 | /\<slug\>/erp/support/tickets | Mobile Ready | Data table, back-office |
| 64 | /\<slug\>/erp/support/tickets/\<id\> (Ticket detail) | Mobile Ready | Detail + comments, back-office |
| 65 | /\<slug\>/erp/settings (Tenant settings) | Mobile Ready | Settings, infrequent, admin only |
| 66 | /\<slug\>/erp/settings/users | Mobile Ready | Data table, admin desk work |
| 67 | /\<slug\>/erp/settings/departments | Mobile Ready | Settings, infrequent |
| 68 | /\<slug\>/erp/settings/expense-categories | Mobile Ready | Settings, infrequent |
| 69 | /\<slug\>/erp/settings/smtp | Mobile Ready | Settings, infrequent |
| 70 | /\<slug\>/pos (POS Terminal) | Mobile First | Cashier interface, touch-first, used standing |
| 71 | /\<slug\>/shop (E-Commerce Storefront) | Mobile First | Public product catalog, cart, checkout |
| 72 | /\<slug\>/shop/product/\<id\> | Mobile First | Product detail page for storefront |
| 73 | /\<slug\>/shop/cart | Mobile First | Shopping cart, checkout flow |
| 74 | /\<slug\>/erp/job-orders | Mobile Ready | Job order list, admin management |
| 75 | /\<slug\>/erp/job-orders/\<id\> (Job Order detail) | Mobile First | Repair workflow, signatures, photos, parts |
| 76 | /\<slug\>/erp/ecommerce/orders | Mobile Ready | E-commerce order management, admin |
| 77 | /\<slug\>/portal (Customer portal) | Mobile First | Customer-facing, access from anywhere |
| 78 | /\<slug\>/portal/dashboard | Mobile First | Activity feed, outstanding balance |
| 79 | /\<slug\>/portal/orders | Mobile First | E-commerce orders + in-store linked |
| 80 | /\<slug\>/portal/invoices | Mobile First | Admin-created invoices, online payment |
| 81 | /\<slug\>/portal/proposals | Mobile First | View/accept/decline proposals & quotations |
| 82 | /\<slug\>/portal/repairs | Mobile First | Job orders, status tracking, approve parts |
| 83 | /\<slug\>/portal/projects | Mobile First | Project status, milestones (read-only) |
| 84 | /\<slug\>/portal/subscriptions | Mobile First | Active subscriptions, billing |
| 85 | /\<slug\>/portal/payments | Mobile First | Payment history, credit balance, pay online |
| 86 | /\<slug\>/portal/tickets | Mobile First | Create/track support tickets |
| 87 | /\<slug\>/portal/documents | Mobile First | Shared files, receipts, warranties |
| 88 | /\<slug\>/portal/profile | Mobile First | Contact info, password, notifications |
| 89 | /powerbyte-admin/tenants | Mobile Ready | Platform admin, desk work |
| 90 | /powerbyte-admin/plans | Mobile Ready | Platform admin, infrequent |
| 91 | /powerbyte-admin/billing | Mobile Ready | Platform admin, desk work |
| 92 | /powerbyte-admin/dlq | Mobile Ready | Platform admin, technical |
| 93 | /powerbyte-admin/audit-log | Mobile Ready | Platform admin, desk work |
| 94 | Orqafy Mobile — DTR clock-in/out | Mobile First | Field worker, GPS capture, offline-first |
| 95 | Orqafy Mobile — Task list + status | Mobile First | Field worker, on-site updates |
| 96 | Orqafy Mobile — Expense submission | Mobile First | Field worker, receipt photo capture |
| 97 | Orqafy Mobile — Payslip view | Mobile First | Employee self-service, read-only |

**Phase 4 implementation guidance (for Claude Code):**
- **Mobile First pages:** Design mobile layout first (375px baseline), progressively
  enhance for tablet (768px) and desktop (1024px+). Touch targets ≥44×44px minimum.
  Minimize cognitive load per screen. Simplified column counts. Single-column forms
  when viewport <768px.
- **Mobile Ready pages:** Design desktop layout first (1280px+ baseline), gracefully
  degrade to tablet (768px) and mobile (375px). Use shadcn/ui responsive patterns:
  horizontal scroll for wide tables, collapsible sidebars, drawer-based navigation on
  narrow viewports. Full functionality must remain accessible at all breakpoints.
- **BOTH strategies use shadcn/ui components** — the difference is breakpoint priority
  and initial design focus, NEVER the component library. Do not replace shadcn/ui with
  mobile-specific alternatives.
- **Tailwind breakpoint convention:** `sm:` (640px), `md:` (768px), `lg:` (1024px),
  `xl:` (1280px). Mobile First pages use base + `md:` enhancements. Mobile Ready pages
  use base + `max-md:` fallbacks or conditional rendering.

## Non-functional Requirements
Performance:    <200ms tRPC API response at 100 concurrent users per tenant
Uptime:         99.5% SLA for prod; staging downtime acceptable
Accessibility:  WCAG AA — color contrast ratios enforced on all text (already validated
                in DESIGN.md: Signal Green 12:1, Snow White 17:1, Parchment 10.5:1,
                Steel Slate 6.2:1 against Abyss Black); touch targets ≥44×44px on
                Mobile First pages; keyboard navigation on all interactive elements;
                aria-labels on icon-only buttons; focus-visible ring using Signal Green
Data retention: Financial + credit records: 7 years minimum; Attendance/DTR: 5 years;
                Support tickets: 3 years; Project notes: retained as long as project exists;
                Tenant schema on deletion: retained until retention period expires, then
                manually dropped by platform_owner
Compliance:     GDPR-aware (customer data exportable and deletable per tenant request);
                no HIPAA; no PCI-DSS scope (no card number storage)
Realtime:       SSE via Next.js route handlers for web dashboard (one-way server→client,
                no extra infra, tenant-scoped per JWT); tRPC + React Query polling for mobile
Visual Design:  See docs/DESIGN.md (VoltAgent aesthetic — dark carbon canvas + Emerald
                Signal Green accent; extracted from VoltAgent via VoltAgent/awesome-design-md).
                Implementation uses shadcn/ui. See docs/DECISIONS_LOG.md for the decision
                history (superseded: Linear + sunset orange `#F26419`).

## Tenancy Model
multi — subdirectory routing (orqafy.powerbyte.app/<tenant_slug>/erp)
NOT subdomain-based — no wildcard DNS required; no per-tenant SSL provisioning needed

Shared global data: yes — Tenant, Plan, TenantSubscription, TenantInvoice, TenantPayment,
  TenantAuditLog, platform_owner user record (all in public schema; accessible only to
  platform_owner and automated billing jobs; zero visibility to tenant users)

DB isolation exception: separate PostgreSQL schema per tenant for ALL ERP data — LOCKED
  Rationale: payroll, banking, GPS data sensitivity; schema boundary enforced at DB level
  not application level; no tenantId column on any ERP entity — schema IS the boundary
  Schema naming: t_<slug_underscored> (e.g. acme-corp → t_acme_corp)
  Prisma middleware switches search_path atomically per request
  Migration runner iterates all active schemas sequentially; failures per tenant are
  independent — do not affect other tenants
  Schema retained on deletion; manually dropped by platform_owner after retention period;
  never auto-dropped

Roles: tenant-scoped — user records and roles live inside each tenant's own schema;
  zero cross-tenant role inheritance or data visibility

## User-Facing URLs
/                                           public landing page (marketing, pricing, CTAs)
/pricing                                    anchor scroll to pricing section (or standalone
                                            pricing page if landing page is long)
/login                                      all users (platform and tenant)
/register                                   new tenant signup (optional ?plan=<planId> param)
/demo                                       auto-login to demo tenant → redirects to
                                            /demo/erp/dashboard (no credentials needed)
/invoice/<publicToken>                      public invoice view (no auth required — read-only
                                            with optional signature capture)
/terms                                      Terms of Service (static page)
/privacy                                    Privacy Policy (static page)
/powerbyte-admin/*                          platform_owner panel (global schema)
/<slug>/erp/dashboard                       Task Dashboard (home for all tenant users)
/<slug>/erp/crm/*                           Customers, Proposals & Quotations, Invoices,
                                            Subscriptions
/<slug>/erp/crm/customers/<id>              Customer detail — Profile tab (default)
/<slug>/erp/crm/customers/<id>/proposals    Customer submenu — Proposals & Quotations
/<slug>/erp/crm/customers/<id>/invoices     Customer submenu — Invoices
/<slug>/erp/crm/customers/<id>/subscriptions Customer submenu — Subscriptions
/<slug>/erp/crm/customers/<id>/payments     Customer submenu — Payments
/<slug>/erp/crm/customers/<id>/credit       Customer submenu — Credit Notes (Credit Manager)
/<slug>/erp/crm/customers/<id>/projects     Customer submenu — Projects
/<slug>/erp/crm/customers/<id>/tickets      Customer submenu — Tickets
/<slug>/erp/crm/proposals                   All Proposals & Quotations (global list)
/<slug>/erp/crm/proposals/<id>              Proposal detail — Overview tab
/<slug>/erp/crm/proposals/<id>/files        Proposal Files submenu
/<slug>/erp/crm/proposals/<id>/quotations   Proposal Quotations submenu
/<slug>/erp/crm/proposals/<id>/revisions    Proposal Revisions submenu
/<slug>/erp/crm/quotations/<id>             Quotation detail — Overview tab
/<slug>/erp/crm/quotations/<id>/revisions   Quotation Revisions submenu
/<slug>/erp/purchasing/*                    Vendors, POs, Goods Receipts, Shipping
/<slug>/erp/inventory/*                     Products, Stock, Warehouses, Serial Numbers,
                                            Inventory Disbursements
/<slug>/erp/projects/*                      Projects list
/<slug>/erp/projects/<id>/dashboard         Project Dashboard (expense vs income, tasks, milestones)
/<slug>/erp/projects/<id>/invoices          Project Invoices submenu
/<slug>/erp/projects/<id>/expenses          Project Expenses submenu
/<slug>/erp/projects/<id>/notes             Project Notes submenu (BlockNote editor)
/<slug>/erp/projects/<id>/notes/<noteId>    Individual note page (nested pages)
/<slug>/erp/projects/<id>/milestones        Project Milestones submenu
/<slug>/erp/projects/<id>/tasks             Project Tasks submenu (with subtasks)
/<slug>/erp/projects/<id>/time-logs         Project Time Logs
/<slug>/erp/projects/<id>/settings          Project settings (budget, dates, team)
/<slug>/erp/hr/*                            Employees, DTR, Leave, Cash Advances, Payroll
/<slug>/erp/banking/*                       Fund Sources, Transactions, Credit Card Payments,
                                            Fund Transfers, Fund Requests, Master Ledger
/<slug>/erp/accounting/*                    Chart of Accounts, Journal Entries, Reports
/<slug>/erp/support/*                       Tickets
/<slug>/erp/settings/*                      Tenant settings, Users, Departments,
                                            Expense Categories, SMTP Configuration
/<slug>/pos/*                               POS Terminal (cashier interface)
/<slug>/shop                                E-Commerce storefront (public browsing,
                                            login required for checkout)
/<slug>/shop/product/<id>                   Product detail page (storefront)
/<slug>/shop/cart                           Shopping cart + Xendit checkout
/<slug>/erp/job-orders                      Job Orders list (admin)
/<slug>/erp/job-orders/<id>                 Job Order detail (repair workflow, signatures)
/<slug>/erp/ecommerce/orders                E-Commerce order management (admin)
/<slug>/portal/*                            Customer self-service portal
/<slug>/portal/dashboard                    Portal dashboard (activity feed)
/<slug>/portal/orders                       Online orders + in-store linked
/<slug>/portal/invoices                     Invoices (view + pay online via Xendit)
/<slug>/portal/proposals                    Proposals & Quotations (accept/decline)
/<slug>/portal/repairs                      Repairs & Job Orders (status + approve parts)
/<slug>/portal/projects                     Project status (read-only)
/<slug>/portal/subscriptions                Subscriptions + billing schedule
/<slug>/portal/payments                     Payment history + credit + pay online
/<slug>/portal/tickets                      Support tickets (create/track)
/<slug>/portal/documents                    Shared documents library
/<slug>/portal/profile                      Profile + notification preferences
/api/trpc/*                                 tRPC API handler (web + mobile)

Stage: https://orqafy-staging.powerbyte.app/<slug>/...
Prod:  https://orqafy.powerbyte.app/<slug>/...

## Access Control
Public routes:    /, /pricing, /login, /register, /demo, /invoice/<publicToken>,
                  /terms, /privacy, /api/trpc/plan.listActive (public pricing endpoint),
                  /<slug>/shop (public browsing — checkout requires login),
                  /<slug>/shop/product/<id> (public product detail)
Protected routes: all /<slug>/erp/*, /<slug>/pos/*, /<slug>/portal/*,
                  /powerbyte-admin/*
Admin-only:       /powerbyte-admin/* — platform_owner JWT only; any other role → 403
                  /<slug>/erp/hr/* — hr_manager, admin, tenant_super_admin
                  /<slug>/erp/accounting/* — accountant, admin, tenant_super_admin
                  /<slug>/erp/settings/* — admin, tenant_super_admin
                  /<slug>/erp/banking/* — accountant, hr_manager, project_manager,
                    admin, tenant_super_admin
                  /<slug>/erp/crm/customers/*/credit — sales_staff, accountant,
                    admin, tenant_super_admin
                  /<slug>/erp/inventory/disbursements — project_manager (create),
                    admin + tenant_super_admin (approve), inventory_staff (process)
                  /<slug>/pos/* — cashier, admin, tenant_super_admin
                  /<slug>/portal/* — customer role only; own records only
                  /<slug>/erp/projects/*/notes — project_manager, admin,
                    tenant_super_admin (full CRUD); staff (read-only on assigned projects)

Mobile: same JWT in Authorization header; tenantSlug from JWT scopes all API calls;
  suspended tenant → 403 + suspension screen on all mobile API calls
Session rules: tenant session valid only for own /<slug>/* path; cross-tenant → 403;
  suspended tenant → suspension screen everywhere; platform_owner → /powerbyte-admin/* only

## Data Sensitivity
PII stored:       yes — Customer (name, email, phone, address, credit balance),
                  Employee (name, email, salary, hire date, employment type),
                  User (name, email, hashed password),
                  AttendanceRecord (GPS lat/lng at clock-in and clock-out),
                  Payslip (salary, deductions, net pay),
                  CashAdvance (amount, purpose),
                  Invoice digital signatures (signatureUrl — PII if customer signs)
Financial data:   yes — invoices, payments, fund source balances, payroll, credit
                  transactions, journal entries
Credentials:      yes — TenantSmtpConfig (smtpHost, smtpUser, smtpPassword — all encrypted
                  at rest; visible only to tenant_super_admin and admin in Settings;
                  smtpPassword never returned in API responses — write-only field)
Health data:      no
Audit required:   all create/update/delete, login/logout, role assignments, failed
                  logins, credit limit changes, credit transactions, inventory
                  disbursement requests/approvals/rejections, invoice publish/unpublish,
                  serial number movements, SMTP config changes (create/update/test),
                  tenant management actions (TenantAuditLog for platform; AuditLog per
                  tenant schema)
GDPR/compliance:  customer data exportable and deletable per tenant request;
                  mobile offline data encrypted via device keychain/secure enclave,
                  wiped on logout or app uninstall; GPS coordinates visible to
                  admin/hr_manager/project_manager only — never staff or customer roles;
                  salary/payroll data: hr_manager, accountant, admin, tenant_super_admin only;
                  digital signature data (signatureUrl) deletable on customer request

## Security Requirements
Rate limiting:    public: 10/min per IP (auth/signup); api: 120/min per tenant
                  (tenantSlug+userId); upload: 20/min per user; mobile sync: 60/min per user
CORS origins:     dev: localhost:[Phase 3 port]; staging: https://orqafy-staging.powerbyte.app;
                  prod: https://orqafy.powerbyte.app
Security layers:  L3 RBAC + L5 AuditLog + L6 Prisma guardrails always active
                  L1 tenant context (ctx.tenantId per request) + L2 shared-schema + tenant_id
                  isolation + L4 PgBouncer pool limits — all active
                  NOTE: L2 uses shared-schema multi-tenancy + tenant_id column (framework
                  default) — every ERP entity carries tenant_id, scoped via ctx.tenantId;
                  separate-schema isolation applies only to payroll/banking
Additional:       CSRF SameSite=Lax (web) — tRPC + SameSite=Lax inherently CSRF-resistant
                  (Lax preferred over Strict to avoid breaking email link navigation,
                  e.g. customer clicking invoice link from email would force re-login
                  with Strict; Lax allows GET navigation while blocking cross-origin POST);
                  JWT Authorization header (mobile);
                  all PII + financial data encrypted at rest; bcrypt password hashing;
                  suspended tenant: all web sessions and mobile JWTs invalidated immediately;
                  HTTP security headers + DOMPurify sanitizer scaffolded by Phase 4;
                  Cloudflare Turnstile (V27): server-side validation on all public form
                  submissions — /login, /register, password reset, /demo auto-login, public
                  invoice signature (/invoice/<publicToken>/sign); cf-turnstile-response
                  token validated via POST to https://challenges.cloudflare.com/turnstile/v0/
                  siteverify before processing; failed validation → 403 + "verification
                  failed" message; dev uses test keys (always passes); staging uses test keys;
                  prod uses real site key + secret from .env.prod;
                  SSRF prevention (V28): server-side URL validation on any user-provided URLs
                  — block private IP ranges, localhost, metadata endpoints;
                  Session invalidation (V28): JWT invalidated on role change or tenant switch;
                  Public invoice route (/invoice/<publicToken>): rate-limited separately
                  (30/min per IP); no auth required but read-only; signature submission
                  rate-limited (5/min per IP per token);
                  Demo tenant: /demo auto-login rate-limited (30/min per IP); ALL write
                  mutations blocked on demo tenant except role-switching — this includes
                  but is not limited to: user password change, user create/delete, tenant
                  settings update, data export, plan/billing modification, customer
                  create/edit, invoice create, PO create, product edit, expense create,
                  fund transfer, etc.; demo JWT has isDemoTenant: true claim for
                  fast middleware checks (single check blocks all mutations);
                  demo role-switch endpoint rate-limited (60/min per IP)

## Environments Needed
dev / stage / prod

## Domain / Base URL Expectations
Dev:   http://localhost:[port assigned by Phase 3 — do not specify a number here]
Stage: https://orqafy-staging.powerbyte.app
Prod:  https://orqafy.powerbyte.app

## Reporting & Dashboards

### Platform Super Admin Dashboard (platform_owner only)
KPIs: total tenants by status (active/trial/suspended/cancelled), MRR,
  upcoming and overdue TenantInvoices, recent signups, plan distribution,
  churn rate, DLQ failed job count with replay UI
Charts: Bar (MRR trend), Pie (plan distribution), Table (tenant list, overdue invoices)
Export: CSV, XLSX

### Tenant Main Dashboard
KPIs: Invoices Awaiting Payment (count + amount), Partially Paid Invoices,
  Projects In Progress, Tasks Not Finished, Invoice/Proposal status overview,
  Outstanding/Past Due/Paid totals, Active Subscriptions + next billing,
  Fund Source Balances (all accounts including custodian accounts),
  Custodian Accounts Summary (per-holder balance and recent transactions),
  Credit Card Outstanding Balance per card, Pending Excess Payment Decisions (count),
  Pending Inventory Disbursement Approvals (count)
Charts: Bar (revenue by period), Pie (invoice status), Table
Export: none (module reports handle exports)

### Project Dashboard (per-project — /<slug>/erp/projects/<id>/dashboard)
KPIs: Total Expenses (direct + inventory_consumed, broken down by ExpenseCategory),
  Total Invoiced Revenue (sum of invoices linked to project), Profit/Loss
  (invoiced revenue - total expenses at cost), Budget Utilization
  (total expenses / project budget × 100%), Tasks by Status (todo/in_progress/done/
  cancelled counts), Overdue Tasks (count + list), Milestones completed vs total,
  Upcoming task due dates (next 7 days)
Charts: Bar (expenses by category), Pie (task status distribution),
  Line (cumulative expenses over time), Table (recent expenses, upcoming tasks)
Export: CSV, PDF (project summary report)

### Tenant Module Reports
- Sales: revenue by period, top customers, aging receivables, partial payment tracking,
  subscription MRR, customer credit balances, total credited vs used vs refunded,
  pending excess decisions — Bar + Line + Table — CSV/PDF/XLSX
- Purchasing: PO volume, PO spending by vendor, PO spending by period, landed vs raw cost,
  PO line item detail with allocation breakdown (stock/project/company) — Bar + Table —
  CSV/XLSX
- Inventory: stock valuation at cost (total value based on costPrice × stock qty),
  stock valuation at SRP (total value based on tier3Price × stock qty), movement history,
  low-stock, vendor purchase history per product, serial number audit trail (for serialized
  products), disbursement history by project — Table — CSV/XLSX
- Projects: profitability (revenue vs expenses at actual purchase cost), time vs budget,
  milestone completion, expenses by category, inventory consumed (at actual purchase cost —
  informational, not in P&L), direct expenses — Bar + Table — CSV/PDF/XLSX
- Income vs Expense: date-range-selectable report; Income = all payments received (invoice
  payments, POS sales); Expense = operational expenses ONLY (company expenses, project
  direct expenses, salaries, utilities, bank charges); Purchase Orders are EXCLUDED from
  expenses (inventory assets, not operational expense); shows net income/loss for the
  period — Bar + Line + Table — CSV/PDF/XLSX
- Master Ledger: centralized chronological view of ALL FundTransactions across ALL accounts
  in a single list; regardless of account type, transaction type, or transfer direction —
  every money movement visible in one unified timeline; filterable by date range, account,
  transaction type; shows: timestamp, account name, type (credit/debit), amount, reference,
  description, running balance per account — Table — CSV/XLSX
- Fund Accounts: per-account ledger (bank-statement style), custodian account ledgers,
  fund transfer history, fund request history (approved/denied), account balances by holder,
  balance reconciliation view (system balance vs actual balance input for counter-checking)
  — Table — CSV/XLSX
- Banking: credit card transaction + settlement history, installment tracker summary,
  cash flow (inflows vs outflows by period) — Table + Line — CSV/XLSX
- POS: daily sales, cash reconciliation, top products, serial numbers sold
  — Bar + Table — CSV/PDF/XLSX
- Accounting: P&L, Balance Sheet, Cash Flow, Trial Balance, Tax Summary
  NOTE: inventory_consumed ProjectExpenses are EXCLUDED from all accounting reports;
  Purchase Orders are treated as asset acquisitions, NOT expenses in P&L
  — Table — PDF/XLSX
- HR: attendance (Leaflet map on web), leave balance, payroll cost, cash advance recovery
  — Table — CSV/XLSX
- Support: ticket volume, resolution time, open by priority — Bar + Table — CSV

## Infrastructure Notes
Docker Compose services (dev + stage): postgres + pgbouncer, valkey, minio,
  mailhog (dev only), web (Next.js — port assigned by Phase 3),
  worker (BullMQ single shared worker — tenantSlug in every job payload;
  Prisma switches schema per job execution)
Docker Hub publishing: enabled — hub_repo: bonitobonita24/orqafy
pgAdmin: included on all environments — credentials auto-generated by Phase 3
CREDENTIALS.md: generated by Phase 3 — master credentials list for all envs, gitignored;
  first admin account: username webmaster; all AI-generated passwords 22-char minimum
  (openssl); created by pnpm db:seed
Spec stress-test: Phase 2.7 runs automatically before Phase 3 — catches PRODUCT.md gaps early
Vibe test: enabled by default — Phase 2.7 vibe_test runs as part of stress-test gate
Context7: enabled — append "use context7" to any Cline task involving external libraries
  (Next.js, Prisma, Auth.js, tRPC, Valkey) to prevent deprecated API hallucinations
Komodo deployment (Scenario 32 — V27 model):
  Staging and prod use same compose YAML but different COMPOSE_PROJECT_NAME — complete
  service isolation; postgres, valkey, minio never shared between staging and prod even
  on same server.
  Staging: auto_update: true — Komodo polls Docker Hub for new :staging-latest digests;
    auto-redeploys on new image. No webhooks needed.
  Production: auto_update: false — human clicks Deploy in Komodo UI after verifying staging.
    Docker Hub is the handoff point. GitHub Actions never contacts Komodo directly.
  Traefik reverse proxy (V27): staging and prod app services use Traefik labels for automatic
    HTTPS routing. App service no longer exposes host ports — Traefik routes via Docker
    internal network. TRAEFIK_NETWORK=proxy (locked decision). Dev compose unchanged
    (direct port mapping). .env.staging/.env.prod: TRAEFIK_NETWORK=proxy + APP_DOMAIN vars.
Security: HTTP security headers + rate limiter + DOMPurify sanitizer scaffolded by Phase 4
Cloudflare Turnstile (V27 — bot protection): enabled by default on all public forms;
  Managed mode (invisible challenge); 1 widget per app; FREE tier (prod domain as hostname,
  dev + staging use official Cloudflare test keys — no account needed for dev).
  Protected pages: /login, /register, password reset, /demo (auto-login), public invoice
  signature submission. NOT protected: authenticated pages (rate limiting handles those).
  Server-side validation mandatory — client widget alone provides no protection.
  Dev uses test site key: 1x00000000000000000000AA / test secret: 1x0000000000000000000000000000000AA
AWS path when ready: RDS (postgres), S3 (storage), ElastiCache (valkey) —
  update .env.{env} only, zero code changes; email remains per-tenant SMTP (no SES needed)

Production external services:
  PostgreSQL  → Railway or Supabase (managed)
  Valkey      → Upstash (managed; OSS alt: self-hosted Valkey on VPS)
  Storage     → Cloudflare R2 (S3-compatible, zero egress; OSS alt: MinIO on VPS)
  Email       → Per-tenant SMTP (each tenant configures own SMTP credentials);
                 platform emails use Powerbyte SMTP from .env;
                 Nodemailer creates transporter dynamically per tenant
  Push        → Expo Push Notifications / FCM + APNs (no OSS equivalent)
  Bot protect → Cloudflare Turnstile (free tier — managed mode)
  Hosting     → Railway, Render, or VPS + Docker Compose; K8s disabled by default

Background jobs (BullMQ — 23 queues, one per job type, DLQ on every queue):
  tenant-provisioning, tenant-billing, invoice-processing, subscription-billing,
  inventory-alerts, goods-receipt, payment-processing, credit-processing,
  expense-processing, cash-advance, credit-card-payment, payroll-processing,
  shipping-cost-recalc, mobile-sync, pdf-generation, report-export,
  notifications, payroll-reminder, inventory-disbursement, demo-reset,
  ecommerce-order-processing, xendit-webhook-processing, job-order-notifications
  All retries: 3x exponential backoff from 5s; DLQ required on every queue
  demo-reset: cron schedule every 6 hours (0 */6 * * *); drops demo schema, recreates,
    runs migrations + demo seed; sets reset-in-progress flag in Valkey during execution;
    clears flag on completion; NO retry on failure — platform_owner notified instead
  Worker placement: packages/jobs (definitions + typed payloads) +
    apps/worker (runtime worker process)

## File Uploads
Types: image/jpeg, image/png, image/webp, application/pdf — max 10MB per file
Exception: ProjectNote attachments — max 50MB per file; additional allowed types:
  text/plain, text/csv, text/markdown (viewable inline in app)
Invoice signatures: image/png only — max 1MB (canvas-generated signature image)
Store originals: yes; image variants: none (CSS/RN Image scales on client)
Paths: <tenant_slug>/receipts/<type>/<id>/<filename>;
  <tenant_slug>/documents/proposals/<id>/<filename>;
  <tenant_slug>/tickets/<id>/<filename>;
  <tenant_slug>/projects/<project_id>/notes/<note_id>/<filename>;
  <tenant_slug>/projects/<project_id>/tasks/<task_id>/<filename>;
  <tenant_slug>/invoices/<id>/signature.png;
  <tenant_slug>/job-orders/<id>/device-photos/<filename>;
  <tenant_slug>/job-orders/<id>/intake-signature.png;
  <tenant_slug>/job-orders/<id>/pickup-signature.png;
  <tenant_slug>/ecommerce/products/<id>/<filename>;
  <tenant_slug>/transactions/<id>/<filename>;
  <tenant_slug>/customers/<id>/documents/<filename>
Mobile: expense photos via pre-signed R2 URL; offline → stored in WatermelonDB,
  uploaded on reconnect

Realtime events (SSE on web; React Query polling on mobile):
  Task Dashboard, Invoice status/balance/creditApplied, Payment History,
  Customer credit balance, Pending excess payment decisions, DTR approvals,
  Dashboard KPIs, Inventory stock levels, Fund source balances, Support ticket updates,
  Low-stock alerts, Cost change alerts, Custodian account balances, Tenant suspension notices,
  Inventory disbursement status (pending/approved/rejected/fulfilled),
  Project Notes updates (new/edited notes within a project),
  Serial number status changes,
  E-commerce order status changes (pending→paid→processing→shipped→delivered),
  Job order status changes (received→diagnosis→repair→ready_for_pickup→released),
  Fund request status (pending/approved/denied),
  Credit card transaction updates (new charge, bankFee added, isPaid changed)

## Tech Stack Preferences
Frontend framework:        Next.js (single unified app — all routes in one app;
                           no nginx; no separate deployables)
API style:                 tRPC
ORM / DB layer:            Prisma (schema-switching middleware;
                           search_path switched atomically per request)
Auth provider:             Auth.js v5 (default — internal/single-org apps)
Auth strategy:             authjs
Primary database:          PostgreSQL (multi-schema, shared DB instance,
                           PgBouncer for connection pooling)
Cache / queue:             Valkey + BullMQ (single shared worker;
                           tenantSlug in every job payload)
File storage:              MinIO (dev) / Cloudflare R2 (prod)
Email dev:                 MailHog (local SMTP sink — catches all emails without sending)
Email prod:                Nodemailer (MIT, OSS) — SMTP transport; platform emails via
                           Powerbyte SMTP credentials in .env; tenant emails via each
                           tenant's TenantSmtpConfig credentials; per-tenant transporter
                           created dynamically; no third-party email service required
UI component library:      shadcn/ui + Tailwind CSS (locked — no alternatives)
Chart library:             shadcn/ui Chart (Recharts) — used in all dashboards, module
                           reports, and analytics displays (Bar, Pie, Line charts)
Map library:               Leaflet.js + OpenStreetMap (simple pin/marker display — GPS
                           clock-in maps in HR attendance; free, no API key)
Data tables:               shadcn/ui Data Table (TanStack Table) — used across all modules
                           for customer lists, invoices, stock movements, payroll, etc.
Complex UI components:     Kibo UI (Kanban board for Task Dashboard; file dropzone for
                           receipt uploads, task/note attachments, goods receipt photos)
Icon set:                  lucide-react (shadcn/ui default — no other icon libraries)
Rich text editor:          BlockNote (@blocknote/core + @blocknote/react — MPL-2.0;
                           core packages only, NO XL packages; used for Project Notes)
Mobile framework:          Expo managed workflow
Mobile UI library:         React Native Reusables + NativeWind
Mobile local DB:           WatermelonDB
Mobile push:               Expo Push Notifications (FCM + APNs)
Barcode/QR scanning:       expo-camera built-in barcode scanning (mobile — uses CameraView
                           with barcodeScannerSettings prop; the old expo-barcode-scanner
                           package was removed in SDK 51, do NOT use it) / html5-qrcode
                           (web) — used for inventory serial number tracking, disbursement
                           scan-out, POS serialized product sales, goods receipt serial entry
Signature capture:         react-signature-canvas (web) / react-native-signature-canvas
                           (mobile) — used for invoice receipt signatures
PDF generation:            React-PDF
Maps (web):                Leaflet.js + OpenStreetMap (free, no API key)
Maps (mobile):             React Native Maps + OpenStreetMap tiles
Exports:                   CSV native / React-PDF / SheetJS (XLSX)
Realtime (web):            SSE via Next.js route handlers (tenant-scoped per JWT)
Realtime (mobile):         tRPC invalidation + React Query polling
Bot protection:            Cloudflare Turnstile (free tier, Managed mode — invisible
                           challenge on public forms; @marsidev/react-turnstile for Next.js
                           client widget; server validates via /siteverify API)
Payment gateway:           Xendit (GCash, Maya, credit/debit cards, bank transfers,
                           over-the-counter; webhook for payment confirmation;
                           per-tenant API keys encrypted; docs: https://docs.xendit.co)
Reverse proxy (prod):      Traefik (V27 — automatic HTTPS via Let's Encrypt; Docker labels
                           on app service; TRAEFIK_NETWORK=proxy locked decision; dev
                           compose unchanged — direct port mapping)

## Design Identity
Brand feel:         professional / enterprise-grade
Target aesthetic:   Dense, data-first UI — information-rich layouts with minimal
                    whitespace. Reference: Linear, Notion, modern SaaS ERP dashboard.
                    Clean typography, structured tables and cards, sidebar navigation.
                    Functional over decorative.
Landing page:       Different aesthetic from the ERP app — marketing-oriented, spacious,
                    modern SaaS landing page style. Hero with gradient/illustration,
                    feature cards with icons, pricing table with toggle, social proof
                    section. Reference: Linear.app marketing site, Vercel.com, Cal.com.
                    Mobile-responsive. Must feel premium and trustworthy to convert
                    visitors into trial signups or demo users.
Demo banner:        Amber/yellow persistent top bar (~40px height), text: "You are viewing
                    a demo — data resets every 6 hours", role switcher dropdown aligned
                    right. Must not interfere with sidebar or main navigation.
Industry category:  SaaS / Business ERP
Dark mode required: optional toggle (user can switch; system preference respected)
Key constraint:     Internal tool density — optimised for power users who spend full
                    workdays in the app; prioritise data density and keyboard-friendliness
                    over onboarding-style simplicity
Theming approach:   shadcn/ui CSS variables (--primary, --secondary, etc.) — customized in
                    globals.css. Reference: https://ui.shadcn.com/docs/theming
                    Dark mode: https://ui.shadcn.com/docs/dark-mode

## Out of Scope
- No public API: no external developer API access or API key management in v1
- No multi-language / i18n support: English only in v1
- No AI/ML features: no predictive analytics, no AI assistant, no smart suggestions
- No white-label / custom branding per tenant: all tenants use the Orqafy brand
- No two-factor authentication (2FA): email/password only in v1; 2FA deferred
- No mobile App Store / Play Store distribution: internal MDM distribution only
- No Kubernetes orchestration: Docker Compose mono-server only; K8s scaffold is placeholder
- No real-time collaboration features: no multi-user live document editing or chat
- No SMS notifications: push and email only; no SMS gateway integration in v1
- No real-time collaborative editing on Project Notes: single-user editing only;
  no Yjs/CRDT sync (deferred to v2 if needed)
- No custom tenant-defined roles: single enum, seeded reference table; tenants cannot create
  custom roles in v1
- No subdomain-based tenancy: subdirectory routing only (orqafy.powerbyte.app/<slug>/erp);
  no wildcard DNS or per-tenant SSL
- No HIPAA or PCI-DSS compliance: no health data stored; no credit card numbers stored
  (fund source references only); compliance certifications deferred
- No real-time WebSocket: SSE (web) + React Query polling (mobile) only in v1;
  WebSocket upgrade deferred to v2 when collaborative editing is added
