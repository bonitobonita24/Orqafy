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

const TRANSACTION_TYPES = [
  "deposit",
  "withdrawal",
  "transfer_in",
  "transfer_out",
  "expense",
  "income",
  "refund",
  "adjustment",
  "loan_disbursement",
  "loan_repayment",
  "loan_payback",
  "credit_card_charge",
  "credit_card_payment",
] as const;

// Real-cash types that require sufficient balance before debit
const REAL_CASH_TYPES = ["cash_on_hand", "bank", "e_wallet"] as const;
type RealCashType = (typeof REAL_CASH_TYPES)[number];

function isRealCashType(type: string): type is RealCashType {
  return (REAL_CASH_TYPES as readonly string[]).includes(type);
}

const transactionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        fundSourceId: z.string().min(1).optional(),
        type: z.enum(TRANSACTION_TYPES).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.fundSourceId !== undefined ? { fundSourceId: input.fundSourceId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.dateFrom !== undefined || input.dateTo !== undefined
          ? {
              transactionDate: {
                ...(input.dateFrom !== undefined ? { gte: new Date(input.dateFrom) } : {}),
                ...(input.dateTo !== undefined ? { lte: new Date(input.dateTo) } : {}),
              },
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.fundTransaction.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { transactionDate: "desc" },
        }),
        db.fundTransaction.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const item = await db.fundTransaction.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  recordIncome: writeProcedure
    .input(
      z.object({
        fundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        category: z.string().optional(),
        referenceType: z.string().optional(),
        referenceId: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await db.fundSource.findUnique({ where: { id: input.fundSourceId } });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      const newBalance = parseFloat(source.currentBalance.toString()) + input.amount;

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.fundSourceId,
            type: "income",
            amount: input.amount,
            runningBalance: newBalance,
            description: input.description ?? null,
            category: input.category ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            transactionDate: input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date(),
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.fundSourceId },
          data: { currentBalance: newBalance },
        });
        return transaction;
      });
    }),

  recordExpense: writeProcedure
    .input(
      z.object({
        fundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        category: z.string().optional(),
        referenceType: z.string().optional(),
        referenceId: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await db.fundSource.findUnique({ where: { id: input.fundSourceId } });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      if (isRealCashType(source.type)) {
        const currentBalance = parseFloat(source.currentBalance.toString());
        if (currentBalance < input.amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance",
          });
        }
      }

      const newBalance = parseFloat(source.currentBalance.toString()) - input.amount;

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.fundSourceId,
            type: "expense",
            amount: input.amount,
            runningBalance: newBalance,
            description: input.description ?? null,
            category: input.category ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            transactionDate: input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date(),
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.fundSourceId },
          data: { currentBalance: newBalance },
        });
        return transaction;
      });
    }),

  transfer: writeProcedure
    .input(
      z.object({
        fromFundSourceId: z.string().min(1),
        toFundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.fromFundSourceId === input.toFundSourceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot transfer to the same fund source",
        });
      }

      const [fromSource, toSource] = await Promise.all([
        db.fundSource.findUnique({ where: { id: input.fromFundSourceId } }),
        db.fundSource.findUnique({ where: { id: input.toFundSourceId } }),
      ]);
      if (!fromSource || !toSource) throw new TRPCError({ code: "NOT_FOUND" });

      if (isRealCashType(fromSource.type)) {
        const currentBalance = parseFloat(fromSource.currentBalance.toString());
        if (currentBalance < input.amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance",
          });
        }
      }

      const fromNewBalance = parseFloat(fromSource.currentBalance.toString()) - input.amount;
      const toNewBalance = parseFloat(toSource.currentBalance.toString()) + input.amount;
      const txDate = input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date();

      return db.$transaction(async (tx) => {
        const outTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.fromFundSourceId,
            type: "transfer_out",
            amount: input.amount,
            runningBalance: fromNewBalance,
            description: input.description ?? null,
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        const inTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.toFundSourceId,
            type: "transfer_in",
            amount: input.amount,
            runningBalance: toNewBalance,
            description: input.description ?? null,
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        const transfer = await tx.fundTransfer.create({
          data: {
            fromTransactionId: outTx.id,
            toTransactionId: inTx.id,
            amount: input.amount,
            description: input.description ?? null,
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.fromFundSourceId },
          data: { currentBalance: fromNewBalance },
        });
        await tx.fundSource.update({
          where: { id: input.toFundSourceId },
          data: { currentBalance: toNewBalance },
        });
        return { outTx, inTx, transfer };
      });
    }),

  recordCreditCardCharge: writeProcedure
    .input(
      z.object({
        fundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        category: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await db.fundSource.findUnique({ where: { id: input.fundSourceId } });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      if (source.type !== "credit_card") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fund source must be of type credit_card",
        });
      }

      const currentOutstanding = parseFloat(
        (source.outstandingBalance ?? "0").toString()
      );
      const newOutstanding = currentOutstanding + input.amount;

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.fundSourceId,
            type: "credit_card_charge",
            amount: input.amount,
            runningBalance: newOutstanding,
            description: input.description ?? null,
            category: input.category ?? null,
            referenceType: null,
            referenceId: null,
            transactionDate: input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date(),
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.fundSourceId },
          data: { outstandingBalance: newOutstanding },
        });
        return transaction;
      });
    }),

  payCreditCard: writeProcedure
    .input(
      z.object({
        payerFundSourceId: z.string().min(1),
        creditCardFundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [payer, creditCard] = await Promise.all([
        db.fundSource.findUnique({ where: { id: input.payerFundSourceId } }),
        db.fundSource.findUnique({ where: { id: input.creditCardFundSourceId } }),
      ]);
      if (!payer || !creditCard) throw new TRPCError({ code: "NOT_FOUND" });

      if (creditCard.type !== "credit_card") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target fund source must be of type credit_card",
        });
      }

      if (isRealCashType(payer.type)) {
        const payerBalance = parseFloat(payer.currentBalance.toString());
        if (payerBalance < input.amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance in payer fund source",
          });
        }
      }

      const payerNewBalance = parseFloat(payer.currentBalance.toString()) - input.amount;
      const ccOutstanding = parseFloat(
        (creditCard.outstandingBalance ?? "0").toString()
      );
      const ccNewOutstanding = Math.max(0, ccOutstanding - input.amount);
      const txDate = input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date();

      return db.$transaction(async (tx) => {
        const payerTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.payerFundSourceId,
            type: "expense",
            amount: input.amount,
            runningBalance: payerNewBalance,
            description: input.description ?? "Credit card payment",
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        const ccTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.creditCardFundSourceId,
            type: "credit_card_payment",
            amount: input.amount,
            runningBalance: ccNewOutstanding,
            description: input.description ?? "Credit card payment",
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.payerFundSourceId },
          data: { currentBalance: payerNewBalance },
        });
        await tx.fundSource.update({
          where: { id: input.creditCardFundSourceId },
          data: { outstandingBalance: ccNewOutstanding },
        });
        return { payerTx, ccTx };
      });
    }),

  loanMoneyOutTo: writeProcedure
    .input(
      z.object({
        loanFundSourceId: z.string().min(1),
        receiverFundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [loanSource, receiverSource] = await Promise.all([
        db.fundSource.findUnique({ where: { id: input.loanFundSourceId } }),
        db.fundSource.findUnique({ where: { id: input.receiverFundSourceId } }),
      ]);
      if (!loanSource || !receiverSource) throw new TRPCError({ code: "NOT_FOUND" });

      if (loanSource.type !== "loan") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source fund source must be of type loan",
        });
      }

      const loanBalance = parseFloat(
        (loanSource.loanBalance ?? loanSource.loanPrincipal ?? "0").toString()
      );
      const receiverBalance = parseFloat(receiverSource.currentBalance.toString());
      const receiverNewBalance = receiverBalance + input.amount;
      const txDate = input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date();

      return db.$transaction(async (tx) => {
        const loanTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.loanFundSourceId,
            type: "loan_disbursement",
            amount: input.amount,
            runningBalance: loanBalance,
            description: input.description ?? null,
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        const receiverTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.receiverFundSourceId,
            type: "income",
            amount: input.amount,
            runningBalance: receiverNewBalance,
            description: input.description ?? "Loan disbursement",
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.receiverFundSourceId },
          data: { currentBalance: receiverNewBalance },
        });
        return { loanTx, receiverTx };
      });
    }),

  loanMoneyIn: writeProcedure
    .input(
      z.object({
        payerFundSourceId: z.string().min(1),
        loanFundSourceId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [payer, loanSource] = await Promise.all([
        db.fundSource.findUnique({ where: { id: input.payerFundSourceId } }),
        db.fundSource.findUnique({ where: { id: input.loanFundSourceId } }),
      ]);
      if (!payer || !loanSource) throw new TRPCError({ code: "NOT_FOUND" });

      if (loanSource.type !== "loan") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target fund source must be of type loan",
        });
      }

      if (isRealCashType(payer.type)) {
        const payerBalance = parseFloat(payer.currentBalance.toString());
        if (payerBalance < input.amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient balance in payer fund source",
          });
        }
      }

      const payerNewBalance = parseFloat(payer.currentBalance.toString()) - input.amount;
      const loanBalance = parseFloat(
        (loanSource.loanBalance ?? loanSource.loanPrincipal ?? "0").toString()
      );
      const newLoanBalance = Math.max(0, loanBalance - input.amount);
      const txDate = input.transactionDate !== undefined ? new Date(input.transactionDate) : new Date();

      return db.$transaction(async (tx) => {
        const payerTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.payerFundSourceId,
            type: "expense",
            amount: input.amount,
            runningBalance: payerNewBalance,
            description: input.description ?? "Loan repayment",
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        const loanTx = await tx.fundTransaction.create({
          data: {
            fundSourceId: input.loanFundSourceId,
            type: "loan_repayment",
            amount: input.amount,
            runningBalance: newLoanBalance,
            description: input.description ?? "Loan repayment",
            category: null,
            referenceType: null,
            referenceId: null,
            transactionDate: txDate,
            createdById: ctx.userId,
          },
        });
        await tx.fundSource.update({
          where: { id: input.payerFundSourceId },
          data: { currentBalance: payerNewBalance },
        });
        await tx.fundSource.update({
          where: { id: input.loanFundSourceId },
          data: { loanBalance: newLoanBalance },
        });
        return { payerTx, loanTx };
      });
    }),
});

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

  transaction: transactionRouter,
});
