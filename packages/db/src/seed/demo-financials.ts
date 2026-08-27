/**
 * demo-financials.ts
 *
 * Seeds realistic financial transaction data (customers, paid invoices,
 * approved expenses) for the demo tenant so the Reports/Dashboard charts
 * render with data.
 *
 * ── WHY public schema, not t_demo ──────────────────────────────────────────
 * The app's tRPC routers (report/invoice/dashboard) use the GLOBAL unscoped
 * Prisma client (`import { prisma as db } from "@orqafy/db"`), which reads the
 * `public` schema and isolates by `tenant_id`. createTenantPrisma()/search_path
 * is only referenced in tests, never at runtime. So all rows MUST go into the
 * `public` tables with an explicit tenant_id = the demo tenant. (The t_demo
 * schema is vestigial at runtime; an earlier version of this script seeded it
 * by mistake and the data was invisible to the app.)
 *
 * Invoice/Expense/Customer/ExpenseCategory are all @@schema("public") models,
 * so we use the Prisma ORM directly (type-safe; Decimal money fields passed as
 * numeric strings — never JS floats).
 *
 * SAFE TO RE-RUN: idempotent. Customers de-duped by company name; invoices and
 * expenses de-duped by their DEMO-* number prefix via a count-guard + per-row
 * existence check. Also clears the stray t_demo financial rows from the prior
 * (buggy) run so they don't cause confusion.
 *
 * Run (packages/db/.env already has the right DIRECT URL on port 42941):
 *   cd packages/db && pnpm exec tsx src/seed/demo-financials.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a Philippine-peso amount as a fixed(2) numeric STRING (no float drift). */
function phpAmount(min: number, max: number): string {
  const cents = randomBetween(min * 100, max * 100);
  return (cents / 100).toFixed(2);
}

const DEMO_EXPENSE_CATEGORIES: Array<{ name: string; code: string }> = [
  { name: 'Office Supplies', code: 'office-supplies' },
  { name: 'Travel & Transport', code: 'travel-transport' },
  { name: 'Utilities', code: 'utilities' },
  { name: 'Software & Subscriptions', code: 'software-subscriptions' },
  { name: 'Marketing', code: 'marketing' },
  { name: 'Professional Services', code: 'professional-services' },
  { name: 'Equipment & Maintenance', code: 'equipment-maintenance' },
  { name: 'Meals & Entertainment', code: 'meals-entertainment' },
  { name: 'Miscellaneous', code: 'miscellaneous' },
];

const EXPENSE_DESCRIPTIONS = [
  'Office supplies purchase',
  'Team lunch meeting',
  'Software subscription renewal',
  'Travel reimbursement',
  'Equipment repair',
  'Marketing materials',
  'Internet service bill',
  'Fuel and transportation',
  'Training seminar registration',
  'Printing and photocopying',
  'Courier and delivery fees',
  'Utilities bill',
  'Cleaning services',
  'Security services',
  'Office furniture',
];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('💰 Seeding demo financial data into PUBLIC schema (tenant-scoped)…');

  // ── 1. Resolve demo tenant ─────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!demoTenant) {
    throw new Error(
      'Demo tenant not found — run the main seed first: pnpm exec tsx src/seed/index.ts'
    );
  }
  const tenantId = demoTenant.id;
  console.log(`  ✅ Demo tenant resolved (id: ${tenantId})`);

  // ── 2. Resolve a user (createdBy / approvedBy FK target) ──────────────────
  const adminUser = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) {
    throw new Error('No active user found in demo tenant — run the main seed first.');
  }
  const userId = adminUser.id;
  console.log(`  ✅ Using user ${adminUser.email} as creator/approver`);

  // ── 3. Cleanup stray t_demo financial rows from the prior (buggy) run ─────
  // Best-effort; ignore if the t_demo schema/tables are absent.
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "t_demo"."invoices" WHERE invoice_number LIKE 'DEMO-INV-%'`
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "t_demo"."expenses" WHERE expense_number LIKE 'DEMO-EXP-%'`
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "t_demo"."customers" WHERE first_name = 'Demo' AND last_name = 'Customer'`
    );
    console.log('  🧹 Cleared stray t_demo financial rows from prior run');
  } catch {
    console.log('  ℹ️  No t_demo financial rows to clear (or schema absent) — ok');
  }

  // ── 4. Guard: skip if public already seeded ────────────────────────────────
  const existingInvCount = await prisma.invoice.count({
    where: { tenantId, invoiceNumber: { startsWith: 'DEMO-INV-' } },
  });
  const existingExpCount = await prisma.expense.count({
    where: { tenantId, expenseNumber: { startsWith: 'DEMO-EXP-' } },
  });
  if (existingInvCount >= 25 && existingExpCount >= 30) {
    console.log(
      `  ⏭  Public already seeded (${existingInvCount} invoices, ${existingExpCount} expenses). Nothing to do.`
    );
    await verify(tenantId);
    return;
  }

  // ── 5. Ensure demo customers exist (public, tenant-scoped) ────────────────
  const customerNames = [
    'Reyes Construction Corp.',
    'Santos IT Solutions',
    'Dela Cruz Trading',
    'Mendoza & Associates Law',
    'Garcia Marine Services',
    'Bautista Real Estate',
    'Cruz Logistics Inc.',
  ];

  const existingCustomers = await prisma.customer.findMany({
    where: { tenantId, companyName: { in: customerNames } },
    select: { id: true, companyName: true },
  });
  const existingCustomerNames = new Set(existingCustomers.map(c => c.companyName));

  for (const name of customerNames) {
    if (existingCustomerNames.has(name)) continue;
    await prisma.customer.create({
      data: {
        id: createId(),
        tenantId,
        companyName: name,
        firstName: 'Demo',
        lastName: 'Customer',
        country: 'PH',
        tier: 'regular',
        isActive: true,
        portalEnabled: false,
      },
    });
  }

  const allCustomers = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    take: 20,
  });
  if (allCustomers.length === 0) {
    throw new Error('No customers found after seeding — check public.customers.');
  }
  const customerIds = allCustomers.map(c => c.id);
  console.log(`  ✅ ${customerIds.length} customers available in public`);

  // ── 6. Ensure expense categories exist (public, tenant-scoped) ────────────
  // The 9 main-seed categories live only in t_demo; create a fresh public set.
  const existingCats = await prisma.expenseCategory.findMany({
    where: { tenantId, code: { in: DEMO_EXPENSE_CATEGORIES.map(c => c.code) } },
    select: { id: true, code: true },
  });
  const existingCatCodes = new Set(existingCats.map(c => c.code));

  let sortOrder = 0;
  for (const cat of DEMO_EXPENSE_CATEGORIES) {
    if (existingCatCodes.has(cat.code)) continue;
    await prisma.expenseCategory.create({
      data: {
        id: createId(),
        tenantId,
        name: cat.name,
        code: cat.code,
        isActive: true,
        sortOrder: sortOrder++,
      },
    });
  }

  const allCategories = await prisma.expenseCategory.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (allCategories.length === 0) {
    throw new Error('No expense categories found after seeding — check public.expense_categories.');
  }
  const categoryIds = allCategories.map(c => c.id);
  console.log(`  ✅ ${categoryIds.length} expense categories available in public`);

  // ── 7. Seed PAID invoices (status='paid', paid_at over last 90d) ──────────
  console.log('  📄 Seeding paid invoices…');
  let invoiceSeeded = 0;
  for (let i = 1; i <= 35; i++) {
    const invoiceNumber = `DEMO-INV-${String(i).padStart(4, '0')}`;
    const already = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    if (already) continue;

    const subtotal = phpAmount(3_000, 70_000);
    const taxAmount = (parseFloat(subtotal) * 0.12).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(taxAmount)).toFixed(2);
    const paidDaysAgo = randomBetween(1, 89);
    const paidAt = daysAgo(paidDaysAgo);
    const issuedAt = daysAgo(paidDaysAgo + randomBetween(7, 21));
    const dueDate = daysAgo(paidDaysAgo - randomBetween(0, 5));

    await prisma.invoice.create({
      data: {
        id: createId(),
        tenantId,
        invoiceNumber,
        customerId: customerIds[i % customerIds.length]!,
        createdById: userId,
        // Public share token (parity with invoice.create) so the D-4 public
        // invoice view + Copy-share-link are demoable on seeded invoices.
        publicToken: createId(),
        status: 'paid',
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(total),
        amountPaid: new Prisma.Decimal(total),
        balance: new Prisma.Decimal('0.00'),
        currency: 'PHP',
        dueDate,
        issuedAt,
        paidAt,
        lineItems: [],
      },
    });
    invoiceSeeded++;
  }
  console.log(`  ✅ ${invoiceSeeded} paid invoices seeded`);

  // ── 8. Seed APPROVED expenses (status='approved', date over last 90d) ─────
  console.log('  🧾 Seeding approved expenses…');
  let expenseSeeded = 0;
  for (let i = 1; i <= 45; i++) {
    const expenseNumber = `DEMO-EXP-${String(i).padStart(4, '0')}`;
    const already = await prisma.expense.findUnique({ where: { expenseNumber } });
    if (already) continue;

    const amount = phpAmount(500, 15_000);
    const expenseDaysAgo = randomBetween(1, 89);
    const date = daysAgo(expenseDaysAgo);
    const approvedAt = daysAgo(expenseDaysAgo - randomBetween(1, 3));

    await prisma.expense.create({
      data: {
        id: createId(),
        tenantId,
        expenseNumber,
        expenseCategoryId: categoryIds[i % categoryIds.length]!,
        createdById: userId,
        approvedById: userId,
        description: EXPENSE_DESCRIPTIONS[i % EXPENSE_DESCRIPTIONS.length]!,
        amount: new Prisma.Decimal(amount),
        currency: 'PHP',
        date,
        status: 'approved',
        approvedAt,
      },
    });
    expenseSeeded++;
  }
  console.log(`  ✅ ${expenseSeeded} approved expenses seeded`);

  // ── 9. Verify (querying exactly as the app does) ──────────────────────────
  await verify(tenantId);
}

/**
 * Verify by querying public the way the app's routers do:
 *   report.revenueByPeriod  → invoice.findMany({ tenantId, status:'paid', paidAt in range })
 *   report.expensesByCategory → expense.groupBy({ tenantId, status:'approved', date in range })
 */
async function verify(tenantId: string) {
  console.log('\n📊 Verification (public schema, tenant-scoped — as the app reads):');

  const start = daysAgo(90);
  const end = new Date();

  const paidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'paid', paidAt: { gte: start, lte: end } },
    select: { totalAmount: true, paidAt: true },
  });
  const approvedExpenses = await prisma.expense.findMany({
    where: { tenantId, status: 'approved', date: { gte: start, lte: end } },
    select: { amount: true, date: true },
  });

  const revenue = paidInvoices.reduce((s, r) => s + Number(r.totalAmount), 0);
  const expenses = approvedExpenses.reduce((s, r) => s + Number(r.amount), 0);

  const invDates = paidInvoices
    .map(r => r.paidAt!)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const expDates = approvedExpenses
    .map(r => r.date)
    .sort((a, b) => a.getTime() - b.getTime());

  const fmt = (n: number) =>
    '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const dateStr = (d?: Date) => (d ? d.toISOString().slice(0, 10) : 'n/a');

  console.log(`  Paid invoices (last 90d):     ${paidInvoices.length}  |  Revenue: ${fmt(revenue)}`);
  console.log(`    paid_at range:              ${dateStr(invDates[0])} → ${dateStr(invDates[invDates.length - 1])}`);
  console.log(`  Approved expenses (last 90d): ${approvedExpenses.length}  |  Total: ${fmt(expenses)}`);
  console.log(`    date range:                ${dateStr(expDates[0])} → ${dateStr(expDates[expDates.length - 1])}`);
  console.log(`  Net income:                   ${fmt(revenue - expenses)}`);

  if (paidInvoices.length === 0 || approvedExpenses.length === 0) {
    console.warn('\n  ⚠️  One of the datasets is empty — charts would still be blank!');
  } else {
    console.log('\n  ✅ public.invoices + public.expenses populated — charts will render.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error('❌ demo-financials seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
