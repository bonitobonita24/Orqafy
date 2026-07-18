/**
 * demo-accounting.ts
 *
 * Enriches the DEMO tenant's Accounting module with actual journal activity.
 * `provisionTenantFinancials` (tenant-financials.ts) already seeds the PH SME
 * Chart of Accounts + AccountingSettings + a default VAT TaxRate + one open
 * FiscalYear for every tenant — but it creates ZERO JournalEntry/JournalLine
 * rows, so the journal-entries list, trial-balance, and general-ledger pages
 * are empty for a fresh demo tenant. This file seeds a small, BALANCED set of
 * realistic PH-context journal entries against that already-provisioned COA.
 *
 * ── SAFE TO RE-RUN (idempotent) ─────────────────────────────────────────────
 * Guarded by a per-tenant count of JournalEntry: if any journal entry already
 * exists for the tenant, the whole block is skipped.
 *
 * ── HOW FK TARGETS ARE RESOLVED ─────────────────────────────────────────────
 * Never hardcoded. The open FiscalYear and every Account are resolved by
 * query (Account by tenantId+code from the PH SME COA seeded by
 * tenant-financials.ts). If an expected account code is missing, a sensible
 * fallback is picked from whatever accounts of the same `type` exist so the
 * seed never crashes on a differently-configured tenant.
 *
 * TypeScript strict: no `any`. Decimal debit/credit fields are passed as
 * fixed(2) plain numeric STRINGS via money() — Prisma accepts strings for
 * Decimal columns, avoiding JS float drift. Every JournalLine set for a given
 * JournalEntry sums to equal total debits and credits (double-entry balanced).
 *
 * Wired into src/seed/index.ts (or demo-showcase orchestration) after
 * provisionTenantFinancials has run for the tenant; also importable directly.
 */

import type { PrismaClient } from '@prisma/client';
import { money, daysAgo, at, num } from './demo-seed-utils';

// ── Chart-of-Accounts codes this file depends on (from PH_SME_CHART_OF_ACCOUNTS) ──
// Falls back by `type` if a tenant's COA doesn't have the exact code.
const ACCOUNT_CODE = {
  cash: '1100', // Cash and Cash Equivalents (asset)
  ar: '1200', // Accounts Receivable (asset)
  inventory: '1300', // Inventory (asset)
  inputVat: '1350', // Input VAT (asset)
  ap: '2100', // Accounts Payable (liability)
  taxesPayable: '2400', // Taxes Payable — used as Output VAT credit (liability)
  ownersCapital: '3100', // Owner's Capital (equity)
  salesRevenue: '4100', // Sales Revenue (revenue)
  purchases: '5100', // Purchases / COGS (expense)
  salariesExpense: '6100', // Salaries Expense (expense)
  utilitiesExpense: '6300', // Utilities Expense (expense)
} as const;

type AccountKey = keyof typeof ACCOUNT_CODE;

interface ResolvedAccount {
  id: string;
  type: string;
}

/** One balanced double-entry line: positive = debit this account, negative = credit. */
interface PlannedLine {
  account: AccountKey;
  amount: number; // positive => debit, negative => credit
  description?: string;
}

interface PlannedEntry {
  daysAgoOffset: number;
  description: string;
  status: 'draft' | 'posted' | 'void';
  lines: PlannedLine[];
}

export async function seedAccounting(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Journal entries already seeded. Skipping.');
    return;
  }

  // ── Resolve the open fiscal year (provisionTenantFinancials seeds exactly one, unclosed) ──
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { tenantId, isClosed: false },
    orderBy: { startDate: 'desc' },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!fiscalYear) {
    console.log(
      '  ⏭  No open fiscal year for tenant — run provisionTenantFinancials first. Skipping accounting seed.',
    );
    return;
  }

  // ── Resolve an admin/creator user (any active tenant user works) ──
  const creator = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!creator) {
    console.log('  ⏭  No active user for tenant — run the main seed first. Skipping accounting seed.');
    return;
  }
  const createdById = creator.id;

  // ── Resolve every account this file needs, by code first, falling back by type ──
  const allAccounts = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, code: true, type: true },
  });

  const byCode = new Map(allAccounts.map((a) => [a.code, a]));
  const byType = new Map<string, ResolvedAccount[]>();
  for (const a of allAccounts) {
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }

  /** Type each ACCOUNT_CODE key resolves to, for a sane fallback when the code is missing. */
  const TYPE_FOR_KEY: Record<AccountKey, string> = {
    cash: 'asset',
    ar: 'asset',
    inventory: 'asset',
    inputVat: 'asset',
    ap: 'liability',
    taxesPayable: 'liability',
    ownersCapital: 'equity',
    salesRevenue: 'revenue',
    purchases: 'expense',
    salariesExpense: 'expense',
    utilitiesExpense: 'expense',
  };

  const resolved: Partial<Record<AccountKey, ResolvedAccount>> = {};
  for (const key of Object.keys(ACCOUNT_CODE) as AccountKey[]) {
    const code = ACCOUNT_CODE[key];
    const exact = byCode.get(code);
    if (exact) {
      resolved[key] = exact;
      continue;
    }
    const fallbackPool = byType.get(TYPE_FOR_KEY[key]) ?? [];
    const fallback = fallbackPool[0];
    if (fallback) {
      resolved[key] = fallback;
    }
  }

  const missing = (Object.keys(ACCOUNT_CODE) as AccountKey[]).filter((k) => !resolved[k]);
  if (missing.length > 0) {
    console.log(
      `  ⏭  Chart of Accounts incomplete for tenant (missing: ${missing.join(', ')}) — run provisionTenantFinancials first. Skipping accounting seed.`,
    );
    return;
  }
  const acct = resolved as Record<AccountKey, ResolvedAccount>;

  // ── Plan 8 balanced journal entries: opening balances, sales, purchase, payroll, bank/cash ──
  const plans: PlannedEntry[] = [
    {
      daysAgoOffset: 60,
      description: "Opening balances — Owner's capital contribution",
      status: 'posted',
      lines: [
        { account: 'cash', amount: 500000, description: 'Initial cash contribution' },
        { account: 'ownersCapital', amount: -500000, description: "Owner's capital" },
      ],
    },
    {
      daysAgoOffset: 45,
      description: 'Sale of goods to customer — DEMO-INV series (VAT-inclusive)',
      status: 'posted',
      lines: [
        { account: 'ar', amount: 89600, description: 'Accounts receivable (VAT-inclusive)' },
        { account: 'salesRevenue', amount: -80000, description: 'Sales revenue' },
        { account: 'taxesPayable', amount: -9600, description: 'Output VAT (12%)' },
      ],
    },
    {
      daysAgoOffset: 38,
      description: 'Purchase of inventory on credit from supplier (VAT-inclusive)',
      status: 'posted',
      lines: [
        { account: 'inventory', amount: 44800, description: 'Inventory received' },
        { account: 'inputVat', amount: 5376, description: 'Input VAT (12%)' },
        { account: 'ap', amount: -50176, description: 'Accounts payable to supplier' },
      ],
    },
    {
      daysAgoOffset: 30,
      description: 'Collection of accounts receivable — bank deposit',
      status: 'posted',
      lines: [
        { account: 'cash', amount: 89600, description: 'Customer payment received' },
        { account: 'ar', amount: -89600, description: 'AR settled' },
      ],
    },
    {
      daysAgoOffset: 24,
      description: 'Payroll accrual — semi-monthly payroll run',
      status: 'posted',
      lines: [
        { account: 'salariesExpense', amount: 185000, description: 'Gross salaries expense' },
        { account: 'cash', amount: -185000, description: 'Net pay disbursed' },
      ],
    },
    {
      daysAgoOffset: 18,
      description: 'Payment of accounts payable to supplier',
      status: 'posted',
      lines: [
        { account: 'ap', amount: 50176, description: 'AP settled' },
        { account: 'cash', amount: -50176, description: 'Bank payment' },
      ],
    },
    {
      daysAgoOffset: 10,
      description: 'Utility bill payment — electricity and water',
      status: 'posted',
      lines: [
        { account: 'utilitiesExpense', amount: 14250, description: 'Utilities expense' },
        { account: 'cash', amount: -14250, description: 'Bank payment' },
      ],
    },
    {
      daysAgoOffset: 4,
      description: 'Sale of goods to customer — pending review (not yet posted)',
      status: 'draft',
      lines: [
        { account: 'ar', amount: 33600, description: 'Accounts receivable (VAT-inclusive)' },
        { account: 'salesRevenue', amount: -30000, description: 'Sales revenue' },
        { account: 'taxesPayable', amount: -3600, description: 'Output VAT (12%)' },
      ],
    },
    {
      daysAgoOffset: 2,
      description: 'Purchase of office consumables — awaiting approval',
      status: 'draft',
      lines: [
        { account: 'purchases', amount: 8960, description: 'Consumables purchase' },
        { account: 'inputVat', amount: 1075.2, description: 'Input VAT (12%)' },
        { account: 'ap', amount: -10035.2, description: 'Accounts payable' },
      ],
    },
  ];

  let seededCount = 0;
  let reversedCount = 0;

  for (let i = 0; i < plans.length; i++) {
    const plan = at(plans, i);
    const entryDate = daysAgo(plan.daysAgoOffset);

    // Guard the entry date within the resolved fiscal year window.
    const clampedDate =
      entryDate < fiscalYear.startDate
        ? fiscalYear.startDate
        : entryDate > fiscalYear.endDate
          ? fiscalYear.endDate
          : entryDate;

    const totalDebit = plan.lines
      .filter((l) => l.amount > 0)
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredit = plan.lines
      .filter((l) => l.amount < 0)
      .reduce((sum, l) => sum + Math.abs(l.amount), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `demo-accounting: unbalanced planned entry "${plan.description}" (debit ${totalDebit} != credit ${totalCredit})`,
      );
    }

    const entry = await prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber: `DEMO-JE-${num(i + 1)}`,
        fiscalYearId: fiscalYear.id,
        date: clampedDate,
        description: plan.description,
        status: plan.status,
        createdById,
        postedAt: plan.status === 'posted' ? clampedDate : null,
        postedById: plan.status === 'posted' ? createdById : null,
        lines: {
          create: plan.lines.map((l) => ({
            tenantId,
            accountId: acct[l.account].id,
            debit: l.amount > 0 ? money(l.amount) : money(0),
            credit: l.amount < 0 ? money(Math.abs(l.amount)) : money(0),
            description: l.description ?? plan.description,
          })),
        },
      },
    });
    seededCount++;

    // Reverse the last posted entry (utilities payment) as a `void` demo, so both
    // the reversal-of relation and a void-status row are exercised in the UI.
    if (i === plans.length - 3 && plan.status === 'posted') {
      await prisma.journalEntry.create({
        data: {
          tenantId,
          entryNumber: `DEMO-JE-${num(i + 1)}-REV`,
          fiscalYearId: fiscalYear.id,
          date: daysAgo(Math.max(plan.daysAgoOffset - 1, 0)),
          description: `Reversal of: ${plan.description}`,
          status: 'void',
          createdById,
          reversalOfId: entry.id,
          lines: {
            create: plan.lines.map((l) => ({
              tenantId,
              accountId: acct[l.account].id,
              // Reversal flips the original debit/credit direction.
              debit: l.amount < 0 ? money(Math.abs(l.amount)) : money(0),
              credit: l.amount > 0 ? money(l.amount) : money(0),
              description: `Reversal: ${l.description ?? plan.description}`,
            })),
          },
        },
      });
      reversedCount++;
    }
  }

  console.log(
    `  ✅ Accounting: ${seededCount} journal entries (${plans.filter((p) => p.status === 'posted').length} posted + ${plans.filter((p) => p.status === 'draft').length} draft)${reversedCount > 0 ? ` + ${reversedCount} void reversal` : ''}`,
  );
}
