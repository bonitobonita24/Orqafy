import type { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

/**
 * Finance RULES D-2 (R4) — seed a standard PH SME Chart of Accounts + fiscal year +
 * default VAT tax rate + cited 2025 PH statutory rates for a tenant, then auto-set the
 * five AccountingSettings default accounts so GR→JE auto-post (and payroll JE) works
 * out-of-the-box. See DECISIONS_LOG "Finance RULES D-2".
 *
 * Shared by the demo seed (packages/db/src/seed/index.ts) AND tenant provisioning
 * (apps/worker/src/processors/tenant-provisioning.ts) so both paths produce an
 * identical, ready-to-post accounting baseline.
 *
 * Idempotent:
 *  - accounts / tax_rates / fiscal_years insert with ON CONFLICT DO NOTHING (tenant-schema tables)
 *  - statutory_rates created only for types not already present (public table)
 *  - accounting_settings upserted; default-account ids only filled when currently null
 *    (never clobbers an owner's manual remap on re-run).
 *
 * Chart/tax/fiscal-year tables live in the per-tenant Postgres schema (cloned via
 * createTenantSchema's `LIKE public.<t> INCLUDING ALL`), so they are seeded with raw
 * SQL into "${schemaName}".*. AccountingSettings + StatutoryRate are public, tenant-scoped
 * by tenantId, so they use the Prisma client directly.
 */

export interface ProvisionTenantFinancialsInput {
  tenantId: string;
  /** Tenant Postgres schema name, e.g. `t_demo` (from toSchemaName). */
  schemaName: string;
}

/** Standard PH SME Chart of Accounts (D-2 R4). `key` flags accounts used for default mapping. */
interface SeedAccount {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isGroup: boolean;
  parentCode?: string;
  /** Maps this account into an AccountingSettings default slot. */
  mapKey?: 'inventory' | 'ap' | 'expense' | 'inputVat';
}

export const PH_SME_CHART_OF_ACCOUNTS: readonly SeedAccount[] = [
  // Assets
  { code: '1000', name: 'Assets', type: 'asset', isGroup: true },
  { code: '1100', name: 'Cash and Cash Equivalents', type: 'asset', isGroup: false, parentCode: '1000' },
  { code: '1200', name: 'Accounts Receivable', type: 'asset', isGroup: false, parentCode: '1000' },
  { code: '1300', name: 'Inventory', type: 'asset', isGroup: false, parentCode: '1000', mapKey: 'inventory' },
  { code: '1350', name: 'Input VAT', type: 'asset', isGroup: false, parentCode: '1000', mapKey: 'inputVat' },
  { code: '1400', name: 'Prepaid Expenses', type: 'asset', isGroup: false, parentCode: '1000' },
  { code: '1500', name: 'Fixed Assets', type: 'asset', isGroup: false, parentCode: '1000' },
  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'liability', isGroup: true },
  { code: '2100', name: 'Accounts Payable', type: 'liability', isGroup: false, parentCode: '2000', mapKey: 'ap' },
  { code: '2200', name: 'Credit Card Payable', type: 'liability', isGroup: false, parentCode: '2000' },
  { code: '2300', name: 'Loans Payable', type: 'liability', isGroup: false, parentCode: '2000' },
  { code: '2400', name: 'Taxes Payable', type: 'liability', isGroup: false, parentCode: '2000' },
  { code: '2500', name: 'Statutory Payables', type: 'liability', isGroup: false, parentCode: '2000' },
  { code: '2600', name: 'Withholding Tax Payable', type: 'liability', isGroup: false, parentCode: '2000' },
  // Equity
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true },
  { code: '3100', name: "Owner's Capital", type: 'equity', isGroup: false, parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', type: 'equity', isGroup: false, parentCode: '3000' },
  // Revenue
  { code: '4000', name: 'Revenue', type: 'revenue', isGroup: true },
  { code: '4100', name: 'Sales Revenue', type: 'revenue', isGroup: false, parentCode: '4000' },
  { code: '4200', name: 'Service Revenue', type: 'revenue', isGroup: false, parentCode: '4000' },
  { code: '4300', name: 'Other Income', type: 'revenue', isGroup: false, parentCode: '4000' },
  // Cost of Goods Sold / Purchases — default expense account for company/project allocations
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', isGroup: true },
  { code: '5100', name: 'Purchases', type: 'expense', isGroup: false, parentCode: '5000', mapKey: 'expense' },
  { code: '5200', name: 'Materials Cost', type: 'expense', isGroup: false, parentCode: '5000' },
  { code: '5300', name: 'Shipping Cost', type: 'expense', isGroup: false, parentCode: '5000' },
  // Operating Expenses
  { code: '6000', name: 'Operating Expenses', type: 'expense', isGroup: true },
  { code: '6100', name: 'Salaries Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6200', name: 'Rent Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6300', name: 'Utilities Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6400', name: 'Office Supplies Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6500', name: 'Depreciation Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6600', name: 'Marketing Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6700', name: 'Professional Fees', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6800', name: 'Insurance Expense', type: 'expense', isGroup: false, parentCode: '6000' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'expense', isGroup: false, parentCode: '6000' },
] as const;

/** Cited 2025 PH statutory rate defaults (mirror of the demo seed; DECISIONS_LOG §C / D-2 R7). */
export const PH_STATUTORY_RATES_2025: ReadonlyArray<{ type: string; config: unknown; source: string }> = [
  {
    type: 'sss',
    config: { totalRate: 0.15, employeeRate: 0.05, employerRate: 0.1, mscFloor: 5000, mscCeiling: 35000 },
    source:
      'SSS Circular 2024-006 — 15% contribution rate eff. Jan 2025; MSC PHP 5,000–35,000 (incl. WISP/MPF above 20,000)',
  },
  {
    type: 'philhealth',
    config: { premiumRate: 0.05, employeeRate: 0.025, floor: 10000, ceiling: 100000 },
    source:
      'PhilHealth (Universal Health Care Act) — 5% premium, salary floor PHP 10,000 / ceiling 100,000 (2024/2025 schedule)',
  },
  {
    type: 'pagibig',
    config: { employeeRate: 0.02, employerRate: 0.02, compensationCap: 10000 },
    source: 'HDMF (Pag-IBIG) Circular — EE 2% / ER 2%, compensation cap PHP 10,000 (max EE PHP 200)',
  },
  {
    type: 'withholding',
    config: {
      frequency: 'monthly',
      brackets: [
        { lower: 0, baseTax: 0, rate: 0 },
        { lower: 20833, baseTax: 0, rate: 0.15 },
        { lower: 33333, baseTax: 1875, rate: 0.2 },
        { lower: 66667, baseTax: 8541.8, rate: 0.25 },
        { lower: 166667, baseTax: 33541.8, rate: 0.3 },
        { lower: 666667, baseTax: 183541.8, rate: 0.35 },
      ],
    },
    source: 'BIR Revenue Regulations (TRAIN Law) — revised withholding tax table eff. 2023 onward (monthly)',
  },
];

const q = (s: string): string => s.replace(/'/g, "''");

export async function provisionTenantFinancials(
  prisma: PrismaClient,
  input: ProvisionTenantFinancialsInput,
): Promise<{ accountsSeeded: number; statutorySeeded: number }> {
  const { tenantId, schemaName } = input;

  // ── Default VAT tax rate (12%) — tenant-schema table ──
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".tax_rates (id, tenant_id, name, code, rate, is_default, is_active, created_at, updated_at)
    VALUES ('${createId()}', '${tenantId}', 'VAT', 'vat-12', 12.00, true, true, NOW(), NOW())
    ON CONFLICT (tenant_id, code) DO NOTHING
  `);

  // ── Current-year fiscal year (open) — tenant-schema table ──
  const year = new Date().getFullYear();
  const fyId = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}".fiscal_years (id, tenant_id, name, start_date, end_date, is_closed, created_at, updated_at)
    VALUES ('${fyId}', '${tenantId}', 'FY ${year}', '${year}-01-01', '${year}-12-31', false, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `);
  // Resolve the open FY id (may already exist from a prior run / ON CONFLICT no-op).
  const fyRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
    SELECT id FROM "${schemaName}".fiscal_years
    WHERE tenant_id = '${tenantId}' AND is_closed = false
    ORDER BY start_date DESC LIMIT 1
  `);
  const resolvedFiscalYearId = fyRows[0]?.id ?? null;

  // ── Chart of Accounts — tenant-schema table ──
  const accountIds: Record<string, string> = {};
  const mapAccountIds: Partial<Record<'inventory' | 'ap' | 'expense' | 'inputVat', string>> = {};
  for (const acct of PH_SME_CHART_OF_ACCOUNTS) {
    const id = createId();
    accountIds[acct.code] = id;
    const parentId = acct.parentCode !== undefined ? accountIds[acct.parentCode] ?? null : null;
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".accounts (id, tenant_id, code, name, type, is_system, parent_id, is_active, created_at, updated_at)
      VALUES ('${id}', '${tenantId}', '${acct.code}', '${q(acct.name)}', '${acct.type}', ${acct.isGroup}, ${parentId !== null ? `'${parentId}'` : 'NULL'}, true, NOW(), NOW())
      ON CONFLICT (tenant_id, code) DO NOTHING
    `);
  }
  // Resolve actual account ids by code (covers the case where rows pre-existed via ON CONFLICT).
  const acctRows = await prisma.$queryRawUnsafe<Array<{ id: string; code: string }>>(`
    SELECT id, code FROM "${schemaName}".accounts WHERE tenant_id = '${tenantId}'
  `);
  const idByCode = new Map(acctRows.map((r) => [r.code, r.id]));
  for (const acct of PH_SME_CHART_OF_ACCOUNTS) {
    if (acct.mapKey !== undefined) {
      const resolved = idByCode.get(acct.code);
      if (resolved !== undefined) mapAccountIds[acct.mapKey] = resolved;
    }
  }

  // ── Statutory rates (PH 2025, cited) — public table, only missing types ──
  const existingRates = await prisma.statutoryRate.findMany({ where: { tenantId } });
  const haveTypes = new Set(existingRates.map((r) => r.type));
  let statutorySeeded = 0;
  for (const r of PH_STATUTORY_RATES_2025) {
    if (haveTypes.has(r.type)) continue;
    await prisma.statutoryRate.create({
      data: {
        tenantId,
        type: r.type,
        config: r.config as object,
        source: r.source,
        effectiveFrom: new Date('2025-01-01'),
        isActive: true,
      },
    });
    statutorySeeded += 1;
  }

  // ── AccountingSettings — public table; auto-map the 5 defaults (fill only when null) ──
  const existing = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  const fillIfNull = (current: string | null | undefined, seeded: string | undefined): string | null =>
    current != null && current !== '' ? current : seeded ?? null;

  await prisma.accountingSettings.upsert({
    where: { tenantId },
    update: {
      defaultInventoryAccountId: fillIfNull(existing?.defaultInventoryAccountId, mapAccountIds.inventory),
      defaultApAccountId: fillIfNull(existing?.defaultApAccountId, mapAccountIds.ap),
      defaultExpenseAccountId: fillIfNull(existing?.defaultExpenseAccountId, mapAccountIds.expense),
      defaultInputVatAccountId: fillIfNull(existing?.defaultInputVatAccountId, mapAccountIds.inputVat),
      defaultFiscalYearId: fillIfNull(existing?.defaultFiscalYearId, resolvedFiscalYearId ?? undefined),
    },
    create: {
      tenantId,
      defaultInventoryAccountId: mapAccountIds.inventory ?? null,
      defaultApAccountId: mapAccountIds.ap ?? null,
      defaultExpenseAccountId: mapAccountIds.expense ?? null,
      defaultInputVatAccountId: mapAccountIds.inputVat ?? null,
      defaultFiscalYearId: resolvedFiscalYearId,
    },
  });

  return { accountsSeeded: PH_SME_CHART_OF_ACCOUNTS.length, statutorySeeded };
}
