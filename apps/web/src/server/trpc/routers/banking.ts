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

async function loadFundSourceForTenant(id: string, ctx: { tenantId: string }) {
  const fs = await db.fundSource.findUnique({ where: { id } });
  if (!fs || fs.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fund source not found" });
  }
  return fs;
}

const transactionRouter = createTRPCRouter({
  // Phase 2b: aggregate dashboard data for the banking overview.
  // Sums real-cash sources (cash_on_hand + bank + e_wallet), credit-card
  // outstanding, loan balances, plus this-month income/expense and the most
  // recent 10 transactions across all sources.
  summary: protectedProcedure.query(async ({ ctx }) => {
    const allSources = await db.fundSource.findMany({
      where: { isActive: true, tenantId: ctx.tenantId },
      select: {
        id: true,
        type: true,
        currentBalance: true,
        outstandingBalance: true,
        loanBalance: true,
        loanPrincipal: true,
      },
    });

    let cashTotal = 0;
    let creditCardOutstanding = 0;
    let loanBalanceTotal = 0;
    for (const s of allSources) {
      if (s.type === "cash_on_hand" || s.type === "bank" || s.type === "e_wallet") {
        cashTotal += parseFloat(s.currentBalance.toString());
      } else if (s.type === "credit_card") {
        creditCardOutstanding += parseFloat((s.outstandingBalance ?? "0").toString());
      } else if (s.type === "loan") {
        loanBalanceTotal += parseFloat(
          (s.loanBalance ?? s.loanPrincipal ?? "0").toString()
        );
      }
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthTxs = await db.fundTransaction.findMany({
      where: { tenantId: ctx.tenantId, transactionDate: { gte: monthStart } },
      select: { type: true, amount: true },
    });

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    for (const t of monthTxs) {
      const amt = parseFloat(t.amount.toString());
      if (t.type === "income" || t.type === "refund") {
        thisMonthIncome += amt;
      } else if (t.type === "expense") {
        thisMonthExpense += amt;
      }
    }

    const recentTransactions = await db.fundTransaction.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { transactionDate: "desc" },
      take: 10,
      include: {
        fundSource: { select: { id: true, name: true, type: true } },
      },
    });

    return {
      cashTotal,
      creditCardOutstanding,
      loanBalance: loanBalanceTotal,
      thisMonthIncome,
      thisMonthExpense,
      recentTransactions,
    };
  }),

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
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
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
    .query(async ({ input, ctx }) => {
      const item = await db.fundTransaction.findUnique({ where: { id: input.id } });
      if (!item || item.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
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
      const source = await loadFundSourceForTenant(input.fundSourceId, ctx);

      const newBalance = parseFloat(source.currentBalance.toString()) + input.amount;

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            tenantId: ctx.tenantId,
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
      const source = await loadFundSourceForTenant(input.fundSourceId, ctx);

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
            tenantId: ctx.tenantId,
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
        loadFundSourceForTenant(input.fromFundSourceId, ctx),
        loadFundSourceForTenant(input.toFundSourceId, ctx),
      ]);

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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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
      const source = await loadFundSourceForTenant(input.fundSourceId, ctx);

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
            tenantId: ctx.tenantId,
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
        loadFundSourceForTenant(input.payerFundSourceId, ctx),
        loadFundSourceForTenant(input.creditCardFundSourceId, ctx),
      ]);

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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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
        loadFundSourceForTenant(input.loanFundSourceId, ctx),
        loadFundSourceForTenant(input.receiverFundSourceId, ctx),
      ]);

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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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
        loadFundSourceForTenant(input.payerFundSourceId, ctx),
        loadFundSourceForTenant(input.loanFundSourceId, ctx),
      ]);

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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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

  // Phase 2b: refund — money returned TO us (e.g. vendor refund). Behaves
  // like income but tagged type=refund and optionally linked to the original
  // outgoing transaction via referenceId.
  recordRefund: writeProcedure
    .input(
      z.object({
        fundSourceId: z.string().min(1),
        amount: z.number().positive(),
        originalTransactionId: z.string().min(1).optional(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await loadFundSourceForTenant(input.fundSourceId, ctx);

      const newBalance = parseFloat(source.currentBalance.toString()) + input.amount;

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            tenantId: ctx.tenantId,
            fundSourceId: input.fundSourceId,
            type: "refund",
            amount: input.amount,
            runningBalance: newBalance,
            description: input.description ?? null,
            category: null,
            referenceType: input.originalTransactionId !== undefined ? "refund" : null,
            referenceId: input.originalTransactionId ?? null,
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

  // Phase 2b: manual adjustment — corrects balance discrepancies (e.g. cash
  // count off vs ledger). Delta can be positive or negative; reason is required
  // for audit trail. Restricted to real-cash types (cash_on_hand, bank,
  // e_wallet) — credit cards and loans need their own reconciliation paths.
  recordAdjustment: writeProcedure
    .input(
      z.object({
        fundSourceId: z.string().min(1),
        delta: z.number().refine((n) => n !== 0, {
          message: "Adjustment delta must be non-zero",
        }),
        reason: z.string().trim().min(1),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const source = await loadFundSourceForTenant(input.fundSourceId, ctx);

      if (!isRealCashType(source.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Adjustments are only supported on real-cash fund sources (cash_on_hand, bank, e_wallet).",
        });
      }

      const currentBalance = parseFloat(source.currentBalance.toString());
      const newBalance = currentBalance + input.delta;

      if (newBalance < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Adjustment would drive balance negative.",
        });
      }

      return db.$transaction(async (tx) => {
        const transaction = await tx.fundTransaction.create({
          data: {
            tenantId: ctx.tenantId,
            fundSourceId: input.fundSourceId,
            type: "adjustment",
            amount: Math.abs(input.delta),
            runningBalance: newBalance,
            description: input.reason,
            category: input.delta > 0 ? "adjustment_credit" : "adjustment_debit",
            referenceType: null,
            referenceId: null,
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
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
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
    .query(async ({ input, ctx }) => {
      const item = await db.fundSource.findUnique({ where: { id: input.id } });
      if (!item || item.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
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
    .mutation(async ({ input, ctx }) => {
      return db.fundSource.create({
        data: {
          tenantId: ctx.tenantId,
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await loadFundSourceForTenant(id, ctx);
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
    .mutation(async ({ input, ctx }) => {
      const existing = await loadFundSourceForTenant(input.id, ctx);
      return db.fundSource.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),

  transaction: transactionRouter,
});
