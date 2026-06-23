/**
 * demo-financials.ts
 *
 * Seeds realistic financial transaction data (invoices + expenses) into the
 * t_demo tenant schema so the Reports page charts render with data.
 *
 * SAFE TO RE-RUN: idempotent via ON CONFLICT DO NOTHING on invoice_number /
 * expense_number, and a count-guard that skips if data already looks healthy.
 *
 * Run:
 *   cd packages/db
 *   DATABASE_URL='postgresql://orqafy_348f4262350601402a2a57:<pw>@localhost:42941/orqafy_dev?schema=public' \
 *     pnpm exec tsx src/seed/demo-financials.ts
 *
 * Or simply (the packages/db/.env already has the right direct URL):
 *   cd packages/db && pnpm exec tsx src/seed/demo-financials.ts
 */

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const SCHEMA = 't_demo';

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

/** Returns a Philippine-peso amount string (no float precision issues). */
function phpAmount(min: number, max: number): string {
  const cents = randomBetween(min * 100, max * 100);
  return (cents / 100).toFixed(2);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('💰 Seeding demo financial data (invoices + expenses)…');

  // ── 1. Resolve demo tenant ─────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });
  if (!demoTenant) {
    throw new Error(
      'Demo tenant not found — run the main seed first: pnpm exec tsx src/seed/index.ts'
    );
  }
  const tenantId = demoTenant.id;
  console.log(`  ✅ Demo tenant resolved (id: ${tenantId})`);

  // ── 2. Resolve a user to act as createdBy / approvedBy ────────────────────
  // Users are in public.users (@@schema("public")), so Prisma ORM targets them
  // directly without caring about the current search_path.
  const adminUser = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) {
    throw new Error('No active user found in demo tenant — run the main seed first.');
  }
  const userId = adminUser.id;
  console.log(`  ✅ Using user ${adminUser.email} as creator/approver`);

  // ── 3. Switch search_path to t_demo for all subsequent raw SQL ─────────────
  await prisma.$executeRawUnsafe(`SET search_path TO "${SCHEMA}", public`);

  // ── 4. Guard: skip if already seeded ──────────────────────────────────────
  // Use $queryRawUnsafe so the schema name is interpolated as an identifier,
  // not bound as a parameterized value (which would produce `"$1"."invoices"`).
  const existingInvoices = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT count(*)::text AS count FROM "${SCHEMA}"."invoices" WHERE invoice_number LIKE 'DEMO-INV-%'`
  );
  const existingExpenses = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT count(*)::text AS count FROM "${SCHEMA}"."expenses" WHERE expense_number LIKE 'DEMO-EXP-%'`
  );
  const invCount = parseInt(existingInvoices[0]?.count ?? '0', 10);
  const expCount = parseInt(existingExpenses[0]?.count ?? '0', 10);
  if (invCount >= 25 && expCount >= 30) {
    console.log(
      `  ⏭  Already seeded (${invCount} invoices, ${expCount} expenses). Nothing to do.`
    );
    await verify();
    return;
  }

  // ── 5. Ensure demo customers exist ────────────────────────────────────────
  // Customers live in t_demo.customers (table copy of public.customers).
  // We upsert by checking existing first, then INSERT ON CONFLICT DO NOTHING.
  const demoCustomers: Array<{ id: string; name: string }> = [
    { id: createId(), name: 'Reyes Construction Corp.' },
    { id: createId(), name: 'Santos IT Solutions' },
    { id: createId(), name: 'Dela Cruz Trading' },
    { id: createId(), name: 'Mendoza & Associates Law' },
    { id: createId(), name: 'Garcia Marine Services' },
    { id: createId(), name: 'Bautista Real Estate' },
    { id: createId(), name: 'Cruz Logistics Inc.' },
  ];

  // Check which customer company names already exist to avoid duplicates on re-run
  const nameList = demoCustomers.map(c => `'${c.name.replace(/'/g, "''")}'`).join(', ');
  const existingCustomers = await prisma.$queryRawUnsafe<Array<{ id: string; company_name: string }>>(
    `SELECT id, company_name FROM "${SCHEMA}"."customers" WHERE company_name IN (${nameList})`
  );
  const existingNames = new Set(existingCustomers.map(c => c.company_name));

  for (const c of demoCustomers) {
    if (existingNames.has(c.name)) continue;
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${SCHEMA}".customers (
        id, tenant_id, company_name, first_name, last_name,
        country, tier, is_active, portal_enabled, created_at, updated_at
      ) VALUES (
        '${c.id}', '${tenantId}', '${c.name.replace(/'/g, "''")}',
        'Demo', 'Customer',
        'PH', 'regular', true, false, NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `);
  }

  // Re-query to get final list of customer IDs (includes pre-existing ones)
  const allCustomers = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${SCHEMA}"."customers" WHERE tenant_id = '${tenantId}' LIMIT 20`
  );
  if (allCustomers.length === 0) {
    throw new Error('No customers found after seeding — check t_demo.customers INSERT.');
  }
  console.log(`  ✅ ${allCustomers.length} customers available in t_demo`);

  const customerIds = allCustomers.map(c => c.id);

  // ── 6. Resolve expense category IDs ───────────────────────────────────────
  const allCategories = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "${SCHEMA}"."expense_categories"
     WHERE tenant_id = '${tenantId}' AND is_active = true
     ORDER BY sort_order`
  );
  if (allCategories.length === 0) {
    throw new Error('No expense categories found — run the main seed first.');
  }
  console.log(`  ✅ ${allCategories.length} expense categories available`);

  const categoryIds = allCategories.map(c => c.id);

  // ── 7. Seed PAID invoices ─────────────────────────────────────────────────
  // revenue chart: status = 'paid', filter on paid_at in last 90 days
  console.log('  📄 Seeding paid invoices…');

  const invoiceData: Array<{
    id: string;
    number: string;
    customerId: string;
    daysAgoPaid: number;
    subtotal: string;
    taxAmount: string;
    total: string;
  }> = [];

  for (let i = 1; i <= 35; i++) {
    const sub = phpAmount(3_000, 70_000);
    const tax = (parseFloat(sub) * 0.12).toFixed(2);
    const total = (parseFloat(sub) + parseFloat(tax)).toFixed(2);
    // Spread across last 90 days — cluster more invoices in recent months
    const paidDaysAgo = randomBetween(1, 89);
    invoiceData.push({
      id: createId(),
      number: `DEMO-INV-${String(i).padStart(4, '0')}`,
      customerId: customerIds[i % customerIds.length]!,
      daysAgoPaid: paidDaysAgo,
      subtotal: sub,
      taxAmount: tax,
      total,
    });
  }

  let invoiceSeeded = 0;
  for (const inv of invoiceData) {
    const paidAt = daysAgo(inv.daysAgoPaid);
    const issuedAt = daysAgo(inv.daysAgoPaid + randomBetween(7, 21));
    const dueDate = daysAgo(inv.daysAgoPaid - randomBetween(0, 5));
    const paidAtStr = paidAt.toISOString();
    const issuedAtStr = issuedAt.toISOString();
    const dueDateStr = dueDate.toISOString();

    await prisma.$executeRawUnsafe(`
      INSERT INTO "${SCHEMA}".invoices (
        id, tenant_id, invoice_number, customer_id, created_by_id,
        status, subtotal, tax_amount, total_amount, amount_paid, balance,
        currency, due_date, issued_at, paid_at,
        line_items, created_at, updated_at
      ) VALUES (
        '${inv.id}', '${tenantId}', '${inv.number}', '${inv.customerId}', '${userId}',
        'paid', ${inv.subtotal}, ${inv.taxAmount}, ${inv.total}, ${inv.total}, 0.00,
        'PHP', '${dueDateStr}', '${issuedAtStr}', '${paidAtStr}',
        '[]', NOW(), NOW()
      )
      ON CONFLICT (invoice_number) DO NOTHING
    `);
    invoiceSeeded++;
  }
  console.log(`  ✅ ${invoiceSeeded} paid invoices seeded`);

  // ── 8. Seed APPROVED expenses ─────────────────────────────────────────────
  // expenses chart: status = 'approved', filter on date in last 90 days
  console.log('  🧾 Seeding approved expenses…');

  const expenseDescriptions = [
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

  let expenseSeeded = 0;
  for (let i = 1; i <= 45; i++) {
    const amount = phpAmount(500, 15_000);
    const expenseDaysAgo = randomBetween(1, 89);
    const expenseDate = daysAgo(expenseDaysAgo);
    const approvedAt = daysAgo(expenseDaysAgo - randomBetween(1, 3));
    const expenseDateStr = expenseDate.toISOString().split('T')[0]; // Date-only (@@db.Date)
    const approvedAtStr = approvedAt.toISOString();
    const catId = categoryIds[i % categoryIds.length]!;
    const desc = expenseDescriptions[i % expenseDescriptions.length]!;
    const expNum = `DEMO-EXP-${String(i).padStart(4, '0')}`;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "${SCHEMA}".expenses (
        id, tenant_id, expense_number, expense_category_id, created_by_id, approved_by_id,
        description, amount, currency, date, status, approved_at,
        created_at, updated_at
      ) VALUES (
        '${createId()}', '${tenantId}', '${expNum}', '${catId}', '${userId}', '${userId}',
        '${desc.replace(/'/g, "''")}', ${amount}, 'PHP', '${expenseDateStr}', 'approved', '${approvedAtStr}',
        NOW(), NOW()
      )
      ON CONFLICT (expense_number) DO NOTHING
    `);
    expenseSeeded++;
  }
  console.log(`  ✅ ${expenseSeeded} approved expenses seeded`);

  // ── 9. Verify and report ──────────────────────────────────────────────────
  await verify();
}

async function verify() {
  console.log('\n📊 Verification:');

  const ninety = daysAgo(90).toISOString();
  const now = new Date().toISOString();
  const ninetyDate = ninety.split('T')[0]!;
  const nowDate = now.split('T')[0]!;

  const invStats = await prisma.$queryRawUnsafe<
    Array<{ count: string; total_revenue: string; earliest: string; latest: string }>
  >(
    `SELECT
      count(*)::text AS count,
      COALESCE(SUM(total_amount), 0)::text AS total_revenue,
      MIN(paid_at)::text AS earliest,
      MAX(paid_at)::text AS latest
    FROM "${SCHEMA}"."invoices"
    WHERE status = 'paid'
      AND paid_at >= '${ninety}'::timestamptz
      AND paid_at <= '${now}'::timestamptz`
  );

  const expStats = await prisma.$queryRawUnsafe<
    Array<{ count: string; total_expenses: string; earliest: string; latest: string }>
  >(
    `SELECT
      count(*)::text AS count,
      COALESCE(SUM(amount), 0)::text AS total_expenses,
      MIN(date)::text AS earliest,
      MAX(date)::text AS latest
    FROM "${SCHEMA}"."expenses"
    WHERE status = 'approved'
      AND date >= '${ninetyDate}'::date
      AND date <= '${nowDate}'::date`
  );

  const inv = invStats[0]!;
  const exp = expStats[0]!;
  const revenue = parseFloat(inv.total_revenue ?? '0');
  const expenses = parseFloat(exp.total_expenses ?? '0');

  console.log(`  Paid invoices (last 90d):    ${inv.count}  |  Revenue: ₱${revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
  console.log(`  Date range:                  ${inv.earliest?.slice(0, 10) ?? 'n/a'} → ${inv.latest?.slice(0, 10) ?? 'n/a'}`);
  console.log(`  Approved expenses (last 90d):${exp.count}  |  Total: ₱${expenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
  console.log(`  Date range:                  ${exp.earliest?.slice(0, 10) ?? 'n/a'} → ${exp.latest?.slice(0, 10) ?? 'n/a'}`);
  console.log(`  Net income:                  ₱${(revenue - expenses).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);

  if (parseInt(inv.count, 10) === 0) {
    console.warn('\n  ⚠️  No paid invoices found in range — charts will still be empty!');
  } else {
    console.log('\n  ✅ Charts should now render with data.');
  }

  // Reset search_path
  await prisma.$executeRawUnsafe('SET search_path TO public');
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
