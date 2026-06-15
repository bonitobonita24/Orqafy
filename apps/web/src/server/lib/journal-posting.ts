/**
 * Shared Journal Entry auto-post helpers — DECISIONS_LOG §A/§B/§C.
 *
 * Resolves default GL accounts from AccountingSettings and creates a POSTED
 * journal entry inside an existing Prisma transaction. Used by both the
 * goods-receipt flow (DR Inventory/Expense, CR AP) and payroll
 * (DR salaries+employer-statutory, CR cash + statutory payables).
 *
 * If required default-account mapping is unset, callers receive a clear
 * BAD_REQUEST directing the owner to configure AccountingSettings.
 */
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface JournalPostLine {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string | null;
}

/**
 * Resolve required default accounts + fiscal year from AccountingSettings.
 * `need` lists which mapping keys must be present for this post.
 * Throws BAD_REQUEST with a configuration hint when anything is missing.
 */
export async function resolveAccountingDefaults(
  tx: Tx,
  tenantId: string,
  need: Array<"inventory" | "ap" | "expense" | "fiscalYear">,
): Promise<{
  inventoryAccountId: string | null;
  apAccountId: string | null;
  expenseAccountId: string | null;
  fiscalYearId: string | null;
}> {
  const settings = await tx.accountingSettings.findUnique({ where: { tenantId } });
  const map = {
    inventoryAccountId: settings?.defaultInventoryAccountId ?? null,
    apAccountId: settings?.defaultApAccountId ?? null,
    expenseAccountId: settings?.defaultExpenseAccountId ?? null,
    fiscalYearId: settings?.defaultFiscalYearId ?? null,
  };
  const missing: string[] = [];
  if (need.includes("inventory") && map.inventoryAccountId == null) missing.push("default Inventory account");
  if (need.includes("ap") && map.apAccountId == null) missing.push("default Accounts Payable account");
  if (need.includes("expense") && map.expenseAccountId == null) missing.push("default Expense account");
  if (need.includes("fiscalYear") && map.fiscalYearId == null) missing.push("default Fiscal Year");
  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot auto-post journal entry: ${missing.join(", ")} not configured. Set these in Accounting → Settings (default account mapping).`,
    });
  }
  return map;
}

/** Generate the next sequential journal entry number for a tenant within the tx. */
export async function nextEntryNumber(tx: Tx, tenantId: string): Promise<string> {
  const count = await tx.journalEntry.count({ where: { tenantId } });
  return `JE-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Create a POSTED journal entry with the given lines inside an existing tx.
 * Validates ≥2 lines and Σdebit == Σcredit (§A post precondition). The fiscal
 * year is validated as OPEN and the entry date within range by the caller's
 * resolved fiscalYearId (we re-check open/closed here defensively).
 */
export async function postJournalEntryTx(
  tx: Tx,
  args: {
    tenantId: string;
    userId: string;
    fiscalYearId: string;
    date: Date;
    description: string;
    referenceType: string;
    referenceId: string;
    lines: JournalPostLine[];
  },
): Promise<{ id: string; entryNumber: string }> {
  const lines = args.lines.filter((l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0);
  if (lines.length < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Journal entry requires at least 2 lines." });
  }
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  if (totalDebit !== totalCredit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Journal entry is unbalanced (debit ${totalDebit} ≠ credit ${totalCredit}).`,
    });
  }

  const fy = await tx.fiscalYear.findUnique({ where: { id: args.fiscalYearId } });
  if (!fy || fy.tenantId !== args.tenantId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Configured default fiscal year not found for this tenant." });
  }
  if (fy.isClosed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot auto-post to a closed fiscal year." });
  }

  // All referenced accounts must exist, belong to tenant, and be active.
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await tx.account.findMany({ where: { id: { in: accountIds }, tenantId: args.tenantId } });
  if (accounts.length !== accountIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "One or more mapped accounts not found for this tenant." });
  }
  const inactive = accounts.filter((a) => !a.isActive);
  if (inactive.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot post to inactive account(s): ${inactive.map((a) => a.name).join(", ")}`,
    });
  }

  const entryNumber = await nextEntryNumber(tx, args.tenantId);
  const created = await tx.journalEntry.create({
    data: {
      tenantId: args.tenantId,
      entryNumber,
      fiscalYearId: args.fiscalYearId,
      date: args.date,
      description: args.description,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      status: "posted",
      postedAt: new Date(),
      postedById: args.userId,
      createdById: args.userId,
      lines: {
        create: lines.map((l) => ({
          tenantId: args.tenantId,
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          description: l.description ?? null,
        })),
      },
    },
  });
  return { id: created.id, entryNumber };
}
