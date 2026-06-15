import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

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
      const existing = await loadJournalEntryForTenant(input.id, ctx, true) as typeof existing & { lines: Array<{ accountId: string; debit: unknown; credit: unknown }> };
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

  // HOLD(owner-rule): posting journals to ledger — requires owner to define posting rules,
  // GL rollup strategy, and fiscal period validation. Do not implement until owner supplies rules.
  post: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadJournalEntryForTenant(input.id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft journal entries can be posted.",
        });
      }
      return db.journalEntry.update({
        where: { id: input.id },
        data: {
          status: "posted",
          postedAt: new Date(),
        },
      });
    }),

  // HOLD(owner-rule): journal reversal — requires posted status (linked to posting rules above).
  // Reversal creates a counter-entry and marks original void. Hold until posting rules are defined.
  reverse: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.journalEntry.findUnique({
        where: { id: input.id },
        include: { lines: true },
      });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (existing.status !== "posted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only posted journal entries can be reversed.",
        });
      }

      const entryCount = await db.journalEntry.count({ where: { tenantId: ctx.tenantId } });
      const entryNumber = `JE-${String(entryCount + 1).padStart(4, "0")}`;

      const reversal = await db.journalEntry.create({
        data: {
          tenantId: ctx.tenantId,
          entryNumber,
          fiscalYearId: existing.fiscalYearId,
          date: new Date(),
          description: `Reversal of ${existing.description}`,
          referenceType: "reversal",
          referenceId: existing.id,
          status: "posted",
          postedAt: new Date(),
          createdById: ctx.userId ?? "system",
          lines: {
            create: existing.lines.map((line) => ({
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

      await db.journalEntry.update({
        where: { id: existing.id },
        data: { status: "void" },
      });

      return reversal;
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

export const accountingRouter = createTRPCRouter({
  account: accountRouter,
  journalEntry: journalEntryRouter,
  fiscalYear: fiscalYearRouter,
  taxRate: taxRateRouter,
});
