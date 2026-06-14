import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Demo tenant (must exist before roles/users — they reference tenantId) ──
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Orqafy Demo',
      slug: 'demo',
      schemaName: 't_demo',
      status: 'demo',
      maxUsers: 999,
      currency: 'PHP',
      timezone: 'Asia/Manila',
      locale: 'en-PH',
    },
  });
  console.log(`  ✅ Demo tenant created (id: ${demoTenant.id})`);

  // ── Roles ──
  const roleData = [
    { name: 'Platform Owner', slug: 'platform_owner', isSystem: true, sortOrder: 0, permissions: ['*'] },
    { name: 'Tenant Super Admin', slug: 'tenant_super_admin', isSystem: true, sortOrder: 1, permissions: ['tenant.*'] },
    { name: 'Admin', slug: 'admin', isSystem: true, sortOrder: 2, permissions: ['tenant.read', 'tenant.write', 'users.*', 'reports.*', 'settings.*'] },
    { name: 'Accountant', slug: 'accountant', isSystem: false, sortOrder: 3, permissions: ['accounting.*', 'banking.*', 'invoicing.*', 'reports.financial'] },
    { name: 'HR Manager', slug: 'hr_manager', isSystem: false, sortOrder: 4, permissions: ['hr.*', 'payroll.*', 'attendance.*', 'reports.hr'] },
    { name: 'Project Manager', slug: 'project_manager', isSystem: false, sortOrder: 5, permissions: ['projects.*', 'tasks.*', 'reports.project'] },
    { name: 'Sales Staff', slug: 'sales_staff', isSystem: false, sortOrder: 6, permissions: ['crm.*', 'proposals.*', 'quotations.*', 'invoices.read', 'invoices.create'] },
    { name: 'Purchasing Staff', slug: 'purchasing_staff', isSystem: false, sortOrder: 7, permissions: ['purchasing.*', 'vendors.*', 'inventory.read'] },
    { name: 'Inventory Staff', slug: 'inventory_staff', isSystem: false, sortOrder: 8, permissions: ['inventory.*', 'warehouse.*', 'goods_receipt.*'] },
    { name: 'Staff', slug: 'staff', isSystem: false, sortOrder: 9, permissions: ['tasks.read', 'tasks.update_own', 'attendance.own', 'leave.own', 'payslip.own'] },
    { name: 'Cashier', slug: 'cashier', isSystem: false, sortOrder: 10, permissions: ['pos.*', 'payments.create', 'fund_sources.read'] },
    { name: 'Support Agent', slug: 'support_agent', isSystem: false, sortOrder: 11, permissions: ['support.*', 'customers.read'] },
    { name: 'Customer', slug: 'customer', isSystem: true, sortOrder: 12, permissions: ['portal.own'] },
  ] as const;

  const roles: Record<string, string> = {};
  for (const r of roleData) {
    const role = await prisma.role.upsert({
      where: { tenantId_slug: { tenantId: demoTenant.id, slug: r.slug } },
      update: {},
      create: {
        name: r.name,
        slug: r.slug,
        tenantId: demoTenant.id,
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
        permissions: JSON.stringify(r.permissions),
      },
    });
    roles[r.slug] = role.id;
  }
  console.log(`  ✅ ${roleData.length} roles seeded`);

  // ── Plans ──
  const planData = [
    { name: 'Free', slug: 'free', maxUsers: 3, maxStorageMb: 500, priceMonthly: 0, priceYearly: 0, sortOrder: 0, features: { modules: ['crm-sales', 'inventory', 'invoicing'] } },
    { name: 'Starter', slug: 'starter', maxUsers: 10, maxStorageMb: 5_000, priceMonthly: 1_499, priceYearly: 14_990, sortOrder: 1, features: { modules: ['crm-sales', 'inventory', 'invoicing', 'purchasing', 'projects', 'tasks'] } },
    { name: 'Growth', slug: 'growth', maxUsers: 25, maxStorageMb: 20_000, priceMonthly: 3_499, priceYearly: 34_990, sortOrder: 2, features: { modules: ['crm-sales', 'inventory', 'invoicing', 'purchasing', 'projects', 'tasks', 'hr-payroll', 'accounting', 'pos'] } },
    { name: 'Pro', slug: 'pro', maxUsers: 100, maxStorageMb: 100_000, priceMonthly: 7_999, priceYearly: 79_990, sortOrder: 3, features: { modules: ['*'], ecommerce: true, customerPortal: true } },
    { name: 'Enterprise', slug: 'enterprise', maxUsers: 9999, maxStorageMb: 500_000, priceMonthly: 0, priceYearly: 0, sortOrder: 4, features: { modules: ['*'], ecommerce: true, customerPortal: true, customDomain: true, dedicatedSupport: true } },
  ];

  for (const p of planData) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        maxUsers: p.maxUsers,
        maxStorageMb: p.maxStorageMb,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        sortOrder: p.sortOrder,
        features: p.features,
      },
    });
  }
  console.log(`  ✅ ${planData.length} plans seeded`);

  // ── Create demo tenant schema + seed tenant-scoped data ──
  const schemaName = 't_demo';
  const schemaExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = ${schemaName}
    ) AS "exists"
  `;

  if (schemaExists[0]?.exists !== true) {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN (
          'tenants', 'plans', 'tenant_subscriptions', 'tenant_invoices',
          'tenant_payments', 'tenant_smtp_configs', 'tenant_xendit_configs',
          'tenant_audit_logs', '_prisma_migrations'
        )
    `;

    for (const { tablename } of tables) {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${schemaName}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`
      );
    }
    console.log(`  ✅ Schema "${schemaName}" created with ${tables.length} tables`);
  } else {
    console.log(`  ℹ️  Schema "${schemaName}" already exists — skipping creation`);
  }

  // Switch to demo schema for tenant-scoped seeding
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);

  // ── Webmaster admin account ──
  const webmasterPassword = process.env['WEBMASTER_PASSWORD'];
  if (webmasterPassword === undefined || webmasterPassword.length === 0) {
    throw new Error(
      'WEBMASTER_PASSWORD env var is required. Set it from CREDENTIALS.md "First Admin Account" section.'
    );
  }
  const passwordHash = await bcrypt.hash(webmasterPassword, 12);

  const superAdminRoleId = roles['tenant_super_admin'];
  if (superAdminRoleId === undefined) {
    throw new Error('tenant_super_admin role not found');
  }

  // Webmaster lives in public.users (User model is @@schema("public")).
  // Prisma upsert respects @@schema mapping, so this targets public regardless of current search_path.
  await prisma.user.upsert({
    where: { email: 'webmaster@orqafy.local' },
    update: {},
    create: {
      email: 'webmaster@orqafy.local',
      passwordHash,
      firstName: 'Web',
      lastName: 'Master',
      displayName: 'webmaster',
      roleId: superAdminRoleId,
      tenantId: demoTenant.id,
      isActive: true,
      securityVersion: 1,
    },
  });
  console.log('  ✅ Webmaster account seeded (webmaster@orqafy.local)');

  // ── DEV-ONLY standardized login accounts ──
  // Owner directive: predictable weak credentials for local development ONLY.
  // GATED on APP_ENV so staging/prod seeds NEVER create these. The seed reads
  // env via process.env (tsx loads packages/db/.env, which is the dev env file
  // and intentionally omits APP_ENV — absent ⇒ development). Any non-dev value
  // (staging/production) skips this block entirely.
  const appEnv = process.env['APP_ENV'] ?? 'development';
  const isDevEnv = appEnv !== 'staging' && appEnv !== 'production';
  if (isDevEnv) {
    // admin@mail.com / admin — full tenant super admin (same role as webmaster)
    const devAdminHash = await bcrypt.hash('admin', 12);
    await prisma.user.upsert({
      where: { email: 'admin@mail.com' },
      update: { passwordHash: devAdminHash, isActive: true },
      create: {
        email: 'admin@mail.com',
        passwordHash: devAdminHash,
        firstName: 'Dev',
        lastName: 'Admin',
        displayName: 'admin',
        roleId: superAdminRoleId,
        tenantId: demoTenant.id,
        isActive: true,
        securityVersion: 1,
      },
    });

    // user@mail.com / user — lowest normal internal role (Staff)
    const staffRoleId = roles['staff'];
    if (staffRoleId === undefined) {
      throw new Error('staff role not found');
    }
    const devUserHash = await bcrypt.hash('user', 12);
    await prisma.user.upsert({
      where: { email: 'user@mail.com' },
      update: { passwordHash: devUserHash, isActive: true },
      create: {
        email: 'user@mail.com',
        passwordHash: devUserHash,
        firstName: 'Dev',
        lastName: 'User',
        displayName: 'user',
        roleId: staffRoleId,
        tenantId: demoTenant.id,
        isActive: true,
        securityVersion: 1,
      },
    });
    console.log(
      `  ✅ DEV-ONLY accounts seeded (admin@mail.com / user@mail.com) [APP_ENV=${appEnv}]`
    );
  } else {
    console.log(
      `  ⏭️  DEV-ONLY accounts skipped (APP_ENV=${appEnv} — staging/prod never gets weak creds)`
    );
  }

  // ── Departments ──
  const deptData = [
    'Executive', 'Sales', 'Purchasing', 'Finance', 'Human Resources',
    'Inventory', 'Projects', 'Support', 'Operations',
  ];
  for (const name of deptData) {
    const code = name.toLowerCase().replace(/ /g, '-');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".departments (id, tenant_id, name, code, is_active, created_at, updated_at)
      VALUES ('${createId()}', '${demoTenant.id}', '${name}', '${code}', true, NOW(), NOW())
      ON CONFLICT (tenant_id, code) DO NOTHING
    `);
  }
  console.log(`  ✅ ${deptData.length} departments seeded`);

  // ── ExpenseCategories ──
  const expenseCats = [
    'Office Supplies', 'Utilities', 'Travel & Transportation',
    'Meals & Entertainment', 'Communication', 'Professional Services',
    'Repairs & Maintenance', 'Marketing & Advertising', 'Miscellaneous',
  ];
  for (let i = 0; i < expenseCats.length; i++) {
    const name = expenseCats[i] as string;
    const code = name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".expense_categories (id, tenant_id, name, code, is_active, sort_order, created_at, updated_at)
      VALUES ('${createId()}', '${demoTenant.id}', '${name}', '${code}', true, ${i}, NOW(), NOW())
      ON CONFLICT (tenant_id, code) DO NOTHING
    `);
  }
  console.log(`  ✅ ${expenseCats.length} expense categories seeded`);

  // ── TaxRate (VAT 12%) ──
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".tax_rates (id, tenant_id, name, code, rate, is_default, is_active, created_at, updated_at)
    VALUES ('${createId()}', '${demoTenant.id}', 'VAT', 'vat-12', 12.00, true, true, NOW(), NOW())
    ON CONFLICT (tenant_id, code) DO NOTHING
  `);
  console.log('  ✅ Default tax rate (VAT 12%) seeded');

  // ── Default warehouse ──
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".warehouses (id, tenant_id, name, code, is_default, is_active, created_at, updated_at)
    VALUES ('${createId()}', '${demoTenant.id}', 'Main Warehouse', 'main-warehouse', true, true, NOW(), NOW())
    ON CONFLICT (tenant_id, code) DO NOTHING
  `);
  console.log('  ✅ Default warehouse seeded');

  // ── FiscalYear (current year) ──
  const year = new Date().getFullYear();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".fiscal_years (id, tenant_id, name, start_date, end_date, is_closed, created_at, updated_at)
    VALUES ('${createId()}', '${demoTenant.id}', 'FY ${year}', '${year}-01-01', '${year}-12-31', false, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `);
  console.log(`  ✅ Fiscal year FY ${year} seeded`);

  // ── Chart of Accounts (basic structure) ──
  const accounts = [
    { code: '1000', name: 'Assets', type: 'asset', isGroup: true },
    { code: '1100', name: 'Cash and Cash Equivalents', type: 'asset', isGroup: false, parentCode: '1000' },
    { code: '1200', name: 'Accounts Receivable', type: 'asset', isGroup: false, parentCode: '1000' },
    { code: '1300', name: 'Inventory', type: 'asset', isGroup: false, parentCode: '1000' },
    { code: '1400', name: 'Prepaid Expenses', type: 'asset', isGroup: false, parentCode: '1000' },
    { code: '1500', name: 'Fixed Assets', type: 'asset', isGroup: false, parentCode: '1000' },
    { code: '2000', name: 'Liabilities', type: 'liability', isGroup: true },
    { code: '2100', name: 'Accounts Payable', type: 'liability', isGroup: false, parentCode: '2000' },
    { code: '2200', name: 'Credit Card Payable', type: 'liability', isGroup: false, parentCode: '2000' },
    { code: '2300', name: 'Loans Payable', type: 'liability', isGroup: false, parentCode: '2000' },
    { code: '2400', name: 'Taxes Payable', type: 'liability', isGroup: false, parentCode: '2000' },
    { code: '3000', name: 'Equity', type: 'equity', isGroup: true },
    { code: '3100', name: "Owner's Capital", type: 'equity', isGroup: false, parentCode: '3000' },
    { code: '3200', name: 'Retained Earnings', type: 'equity', isGroup: false, parentCode: '3000' },
    { code: '4000', name: 'Revenue', type: 'revenue', isGroup: true },
    { code: '4100', name: 'Sales Revenue', type: 'revenue', isGroup: false, parentCode: '4000' },
    { code: '4200', name: 'Service Revenue', type: 'revenue', isGroup: false, parentCode: '4000' },
    { code: '4300', name: 'Other Income', type: 'revenue', isGroup: false, parentCode: '4000' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'expense', isGroup: true },
    { code: '5100', name: 'Materials Cost', type: 'expense', isGroup: false, parentCode: '5000' },
    { code: '5200', name: 'Shipping Cost', type: 'expense', isGroup: false, parentCode: '5000' },
    { code: '6000', name: 'Operating Expenses', type: 'expense', isGroup: true },
    { code: '6100', name: 'Salaries and Wages', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6200', name: 'Rent Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6300', name: 'Utilities Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6400', name: 'Office Supplies Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6500', name: 'Depreciation Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6600', name: 'Marketing Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6700', name: 'Professional Fees', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6800', name: 'Insurance Expense', type: 'expense', isGroup: false, parentCode: '6000' },
    { code: '6900', name: 'Miscellaneous Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  ];

  const accountIds: Record<string, string> = {};
  for (const acct of accounts) {
    const id = createId();
    accountIds[acct.code] = id;
    const parentId = acct.parentCode !== undefined ? accountIds[acct.parentCode] ?? null : null;
    const safeName = acct.name.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".accounts (id, tenant_id, code, name, type, is_system, parent_id, is_active, created_at, updated_at)
      VALUES ('${id}', '${demoTenant.id}', '${acct.code}', '${safeName}', '${acct.type}', ${acct.isGroup}, ${parentId !== null ? `'${parentId}'` : 'NULL'}, true, NOW(), NOW())
      ON CONFLICT (tenant_id, code) DO NOTHING
    `);
  }
  console.log(`  ✅ ${accounts.length} chart of accounts entries seeded`);

  // Reset search_path
  await prisma.$executeRawUnsafe('SET search_path TO public');

  console.log('\n✅ Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
