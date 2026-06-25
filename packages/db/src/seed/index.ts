import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';
import { STANDARD_ROLES } from './roles';
import { provisionTenantFinancials } from '../helpers/tenant-financials';

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

  // ── Roles (canonical set shared with tenant provisioning — see ./roles.ts) ──
  const roleData = STANDARD_ROLES;

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
  // The demo schema mirrors public's table structure via CREATE TABLE ... LIKE.
  // It MUST be rebuilt from public on every seed run: a schema snapshotted before
  // a later migration (e.g. departments.tenant_id) goes stale and the tenant-scoped
  // INSERTs below fail with "column ... does not exist". Since t_demo holds only
  // regenerable dev demo data (the seed is idempotent downstream), the safe,
  // drift-proof fix is to DROP + recreate it from the current public schema.
  // Guarded to ONLY ever touch t_demo — never public.
  const schemaName = 't_demo';
  if (schemaName !== 't_demo') {
    throw new Error('Refusing to drop a non-demo schema');
  }

  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
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
  console.log(
    `  ✅ Schema "${schemaName}" rebuilt from public with ${tables.length} tables`
  );

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

  // ── Default warehouse ──
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".warehouses (id, tenant_id, name, code, is_default, is_active, created_at, updated_at)
    VALUES ('${createId()}', '${demoTenant.id}', 'Main Warehouse', 'main-warehouse', true, true, NOW(), NOW())
    ON CONFLICT (tenant_id, code) DO NOTHING
  `);
  console.log('  ✅ Default warehouse seeded');

  // ── Finance baseline (D-2 R4): VAT tax rate + open fiscal year + PH SME Chart of
  //   Accounts + cited 2025 statutory rates, with the 5 AccountingSettings default
  //   accounts auto-mapped. Shared with tenant provisioning so demo == real tenants. ──
  const fin = await provisionTenantFinancials(prisma, {
    tenantId: demoTenant.id,
    schemaName,
  });
  console.log(
    `  ✅ Finance baseline seeded (${fin.accountsSeeded} accounts, ${fin.statutorySeeded} statutory rates, defaults auto-mapped)`,
  );

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
