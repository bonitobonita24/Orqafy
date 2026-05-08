import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

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
    .query(async ({ input }) => {
      const where = {
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
    .query(async ({ input }) => {
      const item = await db.account.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
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
    .mutation(async ({ input }) => {
      return db.account.create({
        data: {
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
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        subtype: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.account.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.account.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.subtype !== undefined ? { subtype: data.subtype } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });
    }),

  toggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.account.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.account.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
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
    .query(async ({ input }) => {
      const where = {
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
    .query(async ({ input }) => {
      const item = await db.journalEntry.findUnique({
        where: { id: input.id },
        include: { lines: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
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
      const entryCount = await db.journalEntry.count();
      const entryNumber = `JE-${String(entryCount + 1).padStart(4, "0")}`;

      return db.journalEntry.create({
        data: {
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
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    }),

  post: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.journalEntry.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
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

  reverse: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.journalEntry.findUnique({
        where: { id: input.id },
        include: { lines: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "posted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only posted journal entries can be reversed.",
        });
      }

      const entryCount = await db.journalEntry.count();
      const entryNumber = `JE-${String(entryCount + 1).padStart(4, "0")}`;

      const reversal = await db.journalEntry.create({
        data: {
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
    .query(async ({ input }) => {
      const where = {
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
    .query(async ({ input }) => {
      const item = await db.fiscalYear.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      return db.fiscalYear.create({
        data: {
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
    .query(async ({ input }) => {
      const where = {
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
    .query(async ({ input }) => {
      const item = await db.taxRate.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
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
    .mutation(async ({ input }) => {
      return db.taxRate.create({
        data: {
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
