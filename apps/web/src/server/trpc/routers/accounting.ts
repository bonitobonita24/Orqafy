import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// Accountant-scoped write procedure — blocks demo tenants AND enforces Accountant/Administrator role
const accountantWriteProcedure = writeProcedure.use(({ ctx, next }) => {
  const allowed = ["Administrator", "Accountant"];
  if (!ctx.roles.some((r) => allowed.includes(r))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires Administrator or Accountant role." });
  }
  return next({ ctx });
});

async function loadAccountForTenant(id: string, ctx: { tenantId: string }) {
  const a = await db.account.findUnique({ where: { id } });
  if (!a || a.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }
  return a;
}

async function loadJournalEntryForTenant(
  id: string,
  ctx: { tenantId: string },
  includeLines = false
) {
  const je = await db.journalEntry.findUnique({
    where: { id },
    ...(includeLines ? { include: { lines: true } } : {}),
  });
  if (!je || je.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Journal entry not found" });
  }
  return je;
}

async function loadFiscalYearForTenant(id: string, ctx: { tenantId: string }) {
  const fy = await db.fiscalYear.findUnique({ where: { id } });
  if (!fy || fy.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fiscal year not found" });
  }
  return fy;
}

async function loadTaxRateForTenant(id: string, ctx: { tenantId: string }) {
  const tr = await db.taxRate.findUnique({ where: { id } });
  if (!tr || tr.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tax rate not found" });
  }
  return tr;
}

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
const JOURNAL_ENTRY_STATUSES = ["draft", "posted", "void"] as const;
const TAX_RATE_TYPES = ["percentage", "fixed"] as const;

const accountRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        type: z.enum(ACCOUNT_TYPES).optional(),
        isActive: z.boolean().optional(),
        parentId: z.string().min(1).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.parentId != null && input.parentId !== '') {
        await loadAccountForTenant(input.parentId, ctx);
      }
      const where = {
        tenantId: ctx.tenantId,
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      };
      const [items, total] = await Promise.all([
        db.account.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { code: "asc" },
        }),
        db.account.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return loadAccountForTenant(input.id, ctx);
    }),

  create: writeProcedure
    .input(
      z.object({
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(255),
        type: z.enum(ACCOUNT_TYPES),
        subtype: z.string().max(100).optional(),
        parentId: z.string().min(1).optional(),
        description: z.string().max(1000).optional(),
        isSystem: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.parentId != null && input.parentId !== '') {
        await loadAccountForTenant(input.parentId, ctx);
      }
      return db.$transaction(async (tx) => {
        const created = await tx.account.create({
          data: {
            tenantId: ctx.tenantId,
            code: input.code,
            name: input.name,
            type: input.type,
            subtype: input.subtype ?? null,
            parentId: input.parentId ?? null,
            description: input.description ?? null,
            isSystem: input.isSystem,
            isActive: true,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Account",
          entityId: created.id,
          before: null,
          after: { code: created.code, name: created.name, type: created.type },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        subtype: z.string().max(100).optional(),
        parentId: z.string().min(1).nullable().optional(),
        description: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, parentId, ...data } = input;
      const existing = await loadAccountForTenant(id, ctx);
      if (parentId != null && parentId !== '') {
        await loadAccountForTenant(parentId, ctx);
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.account.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.subtype !== undefined ? { subtype: data.subtype } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(parentId !== undefined ? { parentId } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Account",
          entityId: id,
          before: { name: existing.name, subtype: existing.subtype },
          after: { name: updated.name, subtype: updated.subtype },
        });
        return updated;
      });
    }),

  toggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadAccountForTenant(input.id, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.account.update({
          where: { id: input.id },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: existing.isActive ? "DEACTIVATE" : "ACTIVATE",
          entity: "Account",
          entityId: input.id,
          before: { isActive: existing.isActive },
          after: { isActive: updated.isActive },
        });
        return updated;
      });
    }),
});

const journalEntryLineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
});

const journalEntryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        fiscalYearId: z.string().min(1).optional(),
        status: z.enum(JOURNAL_ENTRY_STATUSES).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.fiscalYearId !== undefined ? { fiscalYearId: input.fiscalYearId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.journalEntry.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { date: "desc" },
          include: { lines: true },
        }),
        db.journalEntry.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const item = await db.journalEntry.findUnique({
        where: { id: input.id },
        include: { lines: true },
      });
      if (!item || item.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(
      z.object({
        fiscalYearId: z.string().min(1),
        date: z.string().min(1),
        description: z.string().min(1).max(1000),
        referenceType: z.string().max(100).optional(),
        referenceId: z.string().min(1).optional(),
        lines: z.array(journalEntryLineSchema).min(2),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await loadFiscalYearForTenant(input.fiscalYearId, ctx);
      const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
      const accounts = await db.account.findMany({ where: { id: { in: accountIds }, tenantId: ctx.tenantId } });
      if (accounts.length !== accountIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const entryCount = await db.journalEntry.count({ where: { tenantId: ctx.tenantId } });
      const entryNumber = `JE-${String(entryCount + 1).padStart(4, "0")}`;

      return db.$transaction(async (tx) => {
        const created = await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryNumber,
            fiscalYearId: input.fiscalYearId,
            date: new Date(input.date),
            description: input.description,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            status: "draft",
            createdById: ctx.userId ?? "system",
            lines: {
              create: input.lines.map((line) => ({
                tenantId: ctx.tenantId,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                description: line.description ?? null,
              })),
            },
          },
          include: { lines: true },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "JournalEntry",
          entityId: created.id,
          before: null,
          after: { entryNumber: created.entryNumber, status: created.status, description: created.description },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        date: z.string().min(1).optional(),
        description: z.string().min(1).max(1000).optional(),
        lines: z.array(journalEntryLineSchema).min(2).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await loadJournalEntryForTenant(input.id, ctx, true) as Awaited<ReturnType<typeof loadJournalEntryForTenant>> & { lines: Array<{ accountId: string; debit: unknown; credit: unknown }> };
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft journal entries can be edited.",
        });
      }
      if (input.lines !== undefined) {
        const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
        const accounts = await db.account.findMany({ where: { id: { in: accountIds }, tenantId: ctx.tenantId } });
        if (accounts.length !== accountIds.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
        }
      }
      return db.$transaction(async (tx) => {
        if (input.lines !== undefined) {
          await tx.journalLine.deleteMany({ where: { journalEntryId: input.id } });
        }
        const updated = await tx.journalEntry.update({
          where: { id: input.id },
          data: {
            ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.lines !== undefined
              ? {
                  lines: {
                    create: input.lines.map((line) => ({
                      tenantId: ctx.tenantId,
                      accountId: line.accountId,
                      debit: line.debit,
                      credit: line.credit,
                      description: line.description ?? null,
                    })),
                  },
                }
              : {}),
          },
          include: { lines: true },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "JournalEntry",
          entityId: input.id,
          before: { description: existing.description },
          after: { description: updated.description },
        });
        return updated;
      });
    }),

  post: accountantWriteProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      // Load entry with lines (tenant-scoped)
      const existing = await loadJournalEntryForTenant(input.id, ctx, true) as Awaited<ReturnType<typeof loadJournalEntryForTenant>> & {
        lines: Array<{ accountId: string; debit: unknown; credit: unknown }>;
      };

      // Guard: must be draft
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft journal entries can be posted." });
      }

      const lines = (existing as { lines: Array<{ accountId: string; debit: unknown; credit: unknown }> }).lines;

      // Guard: ≥2 lines
      if (lines.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Journal entry must have at least 2 lines." });
      }

      // Guard: balanced (Σdebit == Σcredit)
      const sumDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const sumCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(sumDebit - sumCredit) > 0.001) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unbalanced entry: debits ${sumDebit.toFixed(2)} ≠ credits ${sumCredit.toFixed(2)}.`,
        });
      }

      // Guard: all accounts active
      const accountIds = [...new Set(lines.map((l) => l.accountId))];
      const accounts = await db.account.findMany({
        where: { id: { in: accountIds }, tenantId: ctx.tenantId },
      });
      const inactive = accounts.filter((a) => !a.isActive);
      if (inactive.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Accounts inactive: ${inactive.map((a) => a.name).join(", ")}`,
        });
      }

      // Guard: fiscal year open and entry date within range
      const fy = await loadFiscalYearForTenant(existing.fiscalYearId, ctx);
      if (fy.isClosed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot post to a closed fiscal year." });
      }
      const entryDate = existing.date;
      if (entryDate < fy.startDate || entryDate > fy.endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entry date is outside the fiscal year range.",
        });
      }

      return db.$transaction(async (tx) => {
        const updated = await tx.journalEntry.update({
          where: { id: input.id },
          data: { status: "posted", postedAt: new Date(), postedById: ctx.userId },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "POST",
          entity: "JournalEntry",
          entityId: input.id,
          before: { status: "draft" },
          after: { status: "posted", postedAt: updated.postedAt },
        });
        return updated;
      });
    }),

  reverse: accountantWriteProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadJournalEntryForTenant(input.id, ctx, true) as Awaited<ReturnType<typeof loadJournalEntryForTenant>> & {
        lines: Array<{ accountId: string; debit: unknown; credit: unknown; description: string | null }>;
      };

      // Guard: must be posted
      if (existing.status !== "posted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only posted entries can be reversed." });
      }

      // Guard: not already reversed
      const alreadyReversed = await db.journalEntry.findFirst({
        where: { reversalOfId: input.id, tenantId: ctx.tenantId },
      });
      if (alreadyReversed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This entry has already been reversed." });
      }

      const lines = (existing as { lines: Array<{ accountId: string; debit: unknown; credit: unknown; description: string | null }> }).lines;
      const entryCount = await db.journalEntry.count({ where: { tenantId: ctx.tenantId } });
      const entryNumber = `JE-${String(entryCount + 1).padStart(4, "0")}`;

      return db.$transaction(async (tx) => {
        const reversal = await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryNumber,
            fiscalYearId: existing.fiscalYearId,
            date: new Date(),
            description: `Reversal of ${existing.description}`,
            referenceType: "reversal",
            referenceId: existing.id,
            reversalOfId: existing.id,
            status: "posted",
            postedAt: new Date(),
            postedById: ctx.userId,
            createdById: ctx.userId ?? "system",
            lines: {
              create: lines.map((line) => ({
                tenantId: ctx.tenantId,
                accountId: line.accountId,
                debit: Number(line.credit),
                credit: Number(line.debit),
                description: line.description,
              })),
            },
          },
          include: { lines: true },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "REVERSE",
          entity: "JournalEntry",
          entityId: input.id,
          before: { status: "posted" },
          after: { reversedBy: reversal.id },
        });
        // NOTE: original stays POSTED — do NOT update its status
        return reversal;
      });
    }),

  trialBalance: protectedProcedure
    .input(z.object({ fiscalYearId: z.string().min(1).optional() }))
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        journalEntry: {
          status: "posted" as const,
          tenantId: ctx.tenantId,
          ...(input.fiscalYearId !== undefined ? { fiscalYearId: input.fiscalYearId } : {}),
        },
      };
      const lines = await db.journalLine.findMany({
        where,
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      });

      // Aggregate per account
      const byAccount = new Map<string, { account: { id: string; code: string; name: string; type: string }; debit: number; credit: number }>();
      for (const line of lines) {
        const existing = byAccount.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 };
        byAccount.set(line.accountId, {
          account: line.account,
          debit: existing.debit + Number(line.debit),
          credit: existing.credit + Number(line.credit),
        });
      }

      const rows = Array.from(byAccount.values())
        .map((r) => ({ ...r, balance: r.debit - r.credit }))
        .sort((a, b) => a.account.code.localeCompare(b.account.code));

      const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
      return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
    }),

  generalLedger: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        fiscalYearId: z.string().min(1).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      await loadAccountForTenant(input.accountId, ctx);
      const where = {
        tenantId: ctx.tenantId,
        accountId: input.accountId,
        journalEntry: {
          status: "posted" as const,
          tenantId: ctx.tenantId,
          ...(input.fiscalYearId !== undefined ? { fiscalYearId: input.fiscalYearId } : {}),
        },
      };
      const [lines, total] = await Promise.all([
        db.journalLine.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { journalEntry: { date: "asc" } },
          include: {
            journalEntry: {
              select: { id: true, entryNumber: true, date: true, description: true },
            },
          },
        }),
        db.journalLine.count({ where }),
      ]);
      return { lines, total, page: input.page, limit: input.limit };
    }),
});

const fiscalYearRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isClosed: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.isClosed !== undefined ? { isClosed: input.isClosed } : {}),
      };
      const [items, total] = await Promise.all([
        db.fiscalYear.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { startDate: "desc" },
        }),
        db.fiscalYear.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return loadFiscalYearForTenant(input.id, ctx);
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.fiscalYear.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          isClosed: false,
        },
      });
    }),
});

const taxRateRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };
      const [items, total] = await Promise.all([
        db.taxRate.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { name: "asc" },
        }),
        db.taxRate.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return loadTaxRateForTenant(input.id, ctx);
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        code: z.string().min(1).max(20),
        rate: z.number().min(0).max(100),
        type: z.enum(TAX_RATE_TYPES),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.taxRate.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          code: input.code,
          rate: input.rate,
          type: input.type,
          isDefault: input.isDefault,
          isActive: true,
        },
      });
    }),
});

// ── Accounting settings sub-router (default GL account mapping for JE auto-post) ──
const settingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const existing = await db.accountingSettings.findUnique({ where: { tenantId: ctx.tenantId } });
    if (existing) return existing;
    // Surface a stable default-shaped object even before first save.
    return {
      tenantId: ctx.tenantId,
      poApprovalThreshold: 10000,
      defaultInventoryAccountId: null,
      defaultApAccountId: null,
      defaultExpenseAccountId: null,
      defaultFiscalYearId: null,
    };
  }),

  update: accountantWriteProcedure
    .input(
      z.object({
        poApprovalThreshold: z.number().min(0).optional(),
        defaultInventoryAccountId: z.string().nullable().optional(),
        defaultApAccountId: z.string().nullable().optional(),
        defaultExpenseAccountId: z.string().nullable().optional(),
        defaultFiscalYearId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate referenced accounts/fiscal year belong to this tenant.
      const checkAccount = async (id: string | null | undefined) => {
        if (id == null || id === "") return;
        await loadAccountForTenant(id, ctx);
      };
      await checkAccount(input.defaultInventoryAccountId);
      await checkAccount(input.defaultApAccountId);
      await checkAccount(input.defaultExpenseAccountId);
      if (input.defaultFiscalYearId != null && input.defaultFiscalYearId !== "") {
        await loadFiscalYearForTenant(input.defaultFiscalYearId, ctx);
      }

      const emptyToNull = (v: string | null | undefined): string | null =>
        v === undefined || v === null || v === "" ? null : v;
      const data = {
        ...(input.poApprovalThreshold !== undefined ? { poApprovalThreshold: input.poApprovalThreshold } : {}),
        ...(input.defaultInventoryAccountId !== undefined
          ? { defaultInventoryAccountId: emptyToNull(input.defaultInventoryAccountId) }
          : {}),
        ...(input.defaultApAccountId !== undefined ? { defaultApAccountId: emptyToNull(input.defaultApAccountId) } : {}),
        ...(input.defaultExpenseAccountId !== undefined
          ? { defaultExpenseAccountId: emptyToNull(input.defaultExpenseAccountId) }
          : {}),
        ...(input.defaultFiscalYearId !== undefined
          ? { defaultFiscalYearId: emptyToNull(input.defaultFiscalYearId) }
          : {}),
      };

      return db.$transaction(async (tx) => {
        const before = await tx.accountingSettings.findUnique({ where: { tenantId: ctx.tenantId } });
        const updated = await tx.accountingSettings.upsert({
          where: { tenantId: ctx.tenantId },
          update: data,
          create: { tenantId: ctx.tenantId, ...data },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: before ? "UPDATE" : "CREATE",
          entity: "AccountingSettings",
          entityId: updated.id,
          before: before
            ? {
                defaultInventoryAccountId: before.defaultInventoryAccountId,
                defaultApAccountId: before.defaultApAccountId,
                defaultExpenseAccountId: before.defaultExpenseAccountId,
                defaultFiscalYearId: before.defaultFiscalYearId,
              }
            : null,
          after: {
            defaultInventoryAccountId: updated.defaultInventoryAccountId,
            defaultApAccountId: updated.defaultApAccountId,
            defaultExpenseAccountId: updated.defaultExpenseAccountId,
            defaultFiscalYearId: updated.defaultFiscalYearId,
          },
        });
        return updated;
      });
    }),
});

export const accountingRouter = createTRPCRouter({
  account: accountRouter,
  journalEntry: journalEntryRouter,
  fiscalYear: fiscalYearRouter,
  taxRate: taxRateRouter,
  settings: settingsRouter,
});
