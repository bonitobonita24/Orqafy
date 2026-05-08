import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

const FUND_SOURCE_TYPES = [
  "cash_on_hand",
  "e_wallet",
  "bank",
  "credit_card",
  "loan",
] as const;

export const bankingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isActive: z.boolean().optional(),
        type: z.enum(FUND_SOURCE_TYPES).optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      };
      const [items, total] = await Promise.all([
        db.fundSource.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { name: "asc" },
        }),
        db.fundSource.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const item = await db.fundSource.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(FUND_SOURCE_TYPES),
        initialBalance: z.number().default(0),
        currency: z.string().length(3).default("PHP"),
        bankName: z.string().max(255).optional(),
        accountNumber: z.string().max(100).optional(),
        creditLimit: z.number().positive().optional(),
        loanProvider: z.string().max(255).optional(),
        loanPrincipal: z.number().positive().optional(),
        loanInterestRate: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.fundSource.create({
        data: {
          name: input.name,
          type: input.type,
          currentBalance: input.initialBalance,
          currency: input.currency,
          bankName: input.bankName ?? null,
          accountNumber: input.accountNumber ?? null,
          creditLimit: input.creditLimit ?? null,
          loanProvider: input.loanProvider ?? null,
          loanPrincipal: input.loanPrincipal ?? null,
          loanInterestRate: input.loanInterestRate ?? null,
          isActive: true,
        },
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        bankName: z.string().max(255).optional(),
        accountNumber: z.string().max(100).optional(),
        creditLimit: z.number().positive().optional(),
        loanProvider: z.string().max(255).optional(),
        loanPrincipal: z.number().positive().optional(),
        loanInterestRate: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.fundSource.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.fundSource.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
          ...(data.accountNumber !== undefined ? { accountNumber: data.accountNumber } : {}),
          ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
          ...(data.loanProvider !== undefined ? { loanProvider: data.loanProvider } : {}),
          ...(data.loanPrincipal !== undefined ? { loanPrincipal: data.loanPrincipal } : {}),
          ...(data.loanInterestRate !== undefined ? { loanInterestRate: data.loanInterestRate } : {}),
        },
      });
    }),

  toggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.fundSource.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.fundSource.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),
});
