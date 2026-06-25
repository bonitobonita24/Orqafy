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
 *  - accounts / tax_rates de-duped on the (tenant_id, code) unique key; fiscal_years
 *    de-duped on (tenant_id, name) via a pre-check (no DB unique key exists).
 *  - statutory_rates created only for types not already present.
 *  - accounting_settings upserted; default-account ids only filled when currently null
 *    (never clobbers an owner's manual remap on re-run).
 *
 * ── WHY public schema, not the per-tenant schema ───────────────────────────────
 * Account / TaxRate / FiscalYear / AccountingSettings / StatutoryRate / JournalEntry
 * are all `@@schema("public")` models, isolated by `tenant_id`. The app's tRPC routers
 * and server components read them via the GLOBAL unscoped Prisma client (search_path =
 * public); createTenantPrisma()/SET search_path is referenced only in tests, never at
 * runtime. So every row MUST land in the `public` tables with an explicit tenant_id —
 * rows written into the vestigial t_<slug> schema are invisible to the app. (See the
 * matching rationale in packages/db/src/seed/demo-financials.ts.) We therefore seed via
 * the Prisma ORM directly — type-safe, and the right schema by construction.
 */

export interface ProvisionTenantFinancialsInput {
  tenantId: string;
  /**
   * Tenant Postgres schema name, e.g. `t_demo` (from toSchemaName). Retained for
   * call-site compatibility / future per-schema needs; the finance baseline itself
   * is seeded into the `public` schema tenant-scoped by tenantId (see file header).
   */
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

export async function provisionTenantFinancials(
  prisma: PrismaClient,
  input: ProvisionTenantFinancialsInput,
): Promise<{ accountsSeeded: number; statutorySeeded: number }> {
  const { tenantId } = input;

  // ── Default VAT tax rate (12%) — public table, tenant-scoped, de-duped on (tenant_id, code) ──
  await prisma.taxRate.upsert({
    where: { tenantId_code: { tenantId, code: 'vat-12' } },
    update: {},
    create: {
      id: createId(),
      tenantId,
      name: 'VAT',
      code: 'vat-12',
      rate: 12.0,
      type: 'percentage',
      isDefault: true,
      isActive: true,
    },
  });

  // ── Current-year fiscal year (open) — public table; no DB unique key, so guard on (tenant_id, name) ──
  const year = new Date().getFullYear();
  const fyName = `FY ${year}`;
  const existingFy = await prisma.fiscalYear.findFirst({
    where: { tenantId, name: fyName },
    select: { id: true },
  });
  const resolvedFiscalYearId =
    existingFy?.id ??
    (
      await prisma.fiscalYear.create({
        data: {
          id: createId(),
          tenantId,
          name: fyName,
          startDate: new Date(`${year}-01-01`),
          endDate: new Date(`${year}-12-31`),
          isClosed: false,
        },
        select: { id: true },
      })
    ).id;

  // ── Chart of Accounts — public table, tenant-scoped, de-duped on (tenant_id, code) ──
  // Two passes so parent_id can reference the parent's resolved id within this tenant.
  const accountIds: Record<string, string> = {};
  const mapAccountIds: Partial<Record<'inventory' | 'ap' | 'expense' | 'inputVat', string>> = {};
  for (const acct of PH_SME_CHART_OF_ACCOUNTS) {
    const id = createId();
    const parentId = acct.parentCode !== undefined ? accountIds[acct.parentCode] ?? null : null;
    const row = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: acct.code } },
      update: {},
      create: {
        id,
        tenantId,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        isSystem: acct.isGroup,
        parentId,
        isActive: true,
      },
      select: { id: true },
    });
    // Use the resolved id (covers the pre-existing-row case) so children reference the real parent.
    accountIds[acct.code] = row.id;
  }
  for (const acct of PH_SME_CHART_OF_ACCOUNTS) {
    if (acct.mapKey !== undefined) {
      const resolved = accountIds[acct.code];
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
