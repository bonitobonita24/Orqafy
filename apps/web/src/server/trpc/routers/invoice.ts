import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure, publicProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { rateLimiters } from "@/server/lib/rate-limit";
import { sanitizePlainText } from "@/server/lib/sanitize";

async function loadInvoiceForTenant(id: string, ctx: { tenantId: string }) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
  }
  return invoice;
}

const PAYMENT_METHODS = ["cash", "bank_transfer", "gcash", "maya", "card", "xendit", "credit"] as const;

/**
 * F2 (Phase 7) — record a partial or full payment against an invoice.
 *
 * Within a single transaction:
 *  1. creates a `Payment` ledger row (amount, method, fundSource, recordedBy),
 *  2. updates the invoice's `amountPaid` / `balance` and transitions status to
 *     `partially_paid` (balance > 0) or `paid` (balance == 0),
 *  3. D1 — when a `fundSourceId` is supplied, auto-posts a Banking `income`
 *     FundTransaction against that fund source and bumps its currentBalance,
 *  4. writes an L5 AuditLog row.
 *
 * Over-payment (amount > outstanding balance) is rejected.
 */
async function recordInvoicePayment(args: {
  invoiceId: string;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  fundSourceId?: string;
  paidAt?: Date;
  notes?: string;
  referenceNumber?: string;
  ctx: { tenantId: string; userId: string };
}) {
  const { invoiceId, amount, method, fundSourceId, paidAt, notes, referenceNumber, ctx } = args;

  const invoice = await loadInvoiceForTenant(invoiceId, ctx);
  if (invoice.status === "void" || invoice.status === "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot record a payment on a void or cancelled invoice." });
  }
  if (invoice.status === "draft") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Send the invoice before recording a payment." });
  }
  if (invoice.status === "paid") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already fully paid." });
  }

  const total = parseFloat(invoice.totalAmount.toString());
  const alreadyPaid = parseFloat(invoice.amountPaid.toString());
  const outstanding = Math.round((total - alreadyPaid) * 100) / 100;
  if (amount > outstanding) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Payment exceeds outstanding balance of ${outstanding}.`,
    });
  }

  const newAmountPaid = Math.round((alreadyPaid + amount) * 100) / 100;
  const newBalance = Math.round((total - newAmountPaid) * 100) / 100;
  const nextStatus = newBalance <= 0 ? "paid" : "partially_paid";
  const when = paidAt ?? new Date();

  // D1 — validate the fund source belongs to this tenant before any write.
  let fundSource: Awaited<ReturnType<typeof db.fundSource.findUnique>> = null;
  if (fundSourceId !== undefined) {
    fundSource = await db.fundSource.findUnique({ where: { id: fundSourceId } });
    if (!fundSource || fundSource.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Fund source not found." });
    }
  }

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        amount,
        currency: invoice.currency,
        method,
        status: "completed",
        ...(referenceNumber !== undefined && referenceNumber !== ""
          ? { referenceNumber: sanitizePlainText(referenceNumber) }
          : {}),
        ...(fundSourceId !== undefined ? { fundSourceId } : {}),
        recordedById: ctx.userId,
        ...(notes !== undefined && notes !== "" ? { notes: sanitizePlainText(notes) } : {}),
        paidAt: when,
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        balance: newBalance,
        status: nextStatus,
        ...(nextStatus === "paid" ? { paidAt: when } : {}),
      },
    });

    // D1 — auto-post a Banking income transaction to the linked fund source.
    if (fundSource !== null) {
      const newFundBalance =
        Math.round((parseFloat(fundSource.currentBalance.toString()) + amount) * 100) / 100;
      await tx.fundTransaction.create({
        data: {
          tenantId: ctx.tenantId,
          fundSourceId: fundSource.id,
          type: "income",
          amount,
          runningBalance: newFundBalance,
          description: `Invoice payment — ${invoice.invoiceNumber}`,
          referenceType: "invoice_payment",
          referenceId: payment.id,
          transactionDate: when,
          createdById: ctx.userId,
        },
      });
      await tx.fundSource.update({
        where: { id: fundSource.id },
        data: { currentBalance: newFundBalance },
      });
    }

    await writeAuditLog(tx, {
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoice.id,
      before: { status: invoice.status, amountPaid: alreadyPaid, balance: total - alreadyPaid },
      after: {
        status: nextStatus,
        amountPaid: newAmountPaid,
        balance: newBalance,
        paymentId: payment.id,
        fundSourceId: fundSource?.id ?? null,
      },
    });

    return { invoice: updatedInvoice, payment };
  });
}

const lineItemInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const invoiceInput = z.object({
  customerId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  dueDate: z.date(),
  notes: z.string().max(1000).optional(),
  lineItems: z.array(lineItemInput).min(1).max(50),
});

export const invoiceRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.string().optional(),
        customerId: z.string().cuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const where = {
        tenantId: ctx.tenantId,
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      };
      const [items, total] = await Promise.all([
        db.invoice.findMany({
          where,
          include: {
            customer: { select: { firstName: true, lastName: true, companyName: true } },
            project: { select: { name: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.invoice.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await loadInvoiceForTenant(input.id, { tenantId: ctx.tenantId });
      const item = await db.invoice.findUnique({
        where: { id: input.id },
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true, phone: true } },
          project: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  // Public page — viewed by client without login via unique token
  // publicToken is unique secret — no tenant check needed
  publicView: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimiters.public_invoice.check(ip);
      const invoice = await db.invoice.findUnique({
        where: { publicToken: input.token },
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
          project: { select: { name: true } },
        },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        notes: invoice.notes,
        lineItems: invoice.lineItems,
        customer: invoice.customer,
        project: invoice.project,
        createdAt: invoice.createdAt,
      };
    }),

  create: writeProcedure
    .input(invoiceInput)
    .mutation(async ({ input, ctx }) => {
      const customer = await db.customer.findUnique({ where: { id: input.customerId } });
      if (!customer || customer.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Customer not found." });
      }

      const subtotal = input.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const invoiceNumber = `INV-${Date.now()}`;
      const publicToken = crypto.randomUUID();

      return db.invoice.create({
        data: {
          invoiceNumber,
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          ...(input.projectId !== undefined ? { projectId: input.projectId ?? null } : {}),
          dueDate: input.dueDate,
          notes: input.notes !== undefined && input.notes !== "" ? sanitizePlainText(input.notes) : null,
          lineItems: input.lineItems,
          subtotal,
          totalAmount: subtotal,
          publicToken,
          createdById: ctx.userId,
          status: "draft",
        },
      });
    }),

  update: writeProcedure
    .input(invoiceInput.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const existing = await loadInvoiceForTenant(id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be edited." });
      }

      const subtotal =
        rest.lineItems !== undefined
          ? rest.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
          : undefined;

      return db.invoice.update({
        where: { id },
        data: {
          ...(rest.customerId !== undefined ? { customerId: rest.customerId } : {}),
          ...(rest.projectId !== undefined ? { projectId: rest.projectId ?? null } : {}),
          ...(rest.dueDate !== undefined ? { dueDate: rest.dueDate } : {}),
          ...(rest.notes !== undefined
            ? { notes: rest.notes !== "" ? sanitizePlainText(rest.notes) : null }
            : {}),
          ...(rest.lineItems !== undefined && subtotal !== undefined
            ? { lineItems: rest.lineItems, subtotal, totalAmount: subtotal }
            : {}),
        },
      });
    }),

  markSent: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadInvoiceForTenant(input.id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be marked as sent." });
      }
      return db.invoice.update({
        where: { id: input.id },
        data: { status: "sent", issuedAt: new Date() },
      });
    }),

  // F2 (Phase 7) — record a partial or full payment. Drives the
  // partially_paid / paid lifecycle and (D1) auto-posts a Banking income
  // transaction when a fund source is supplied.
  recordPayment: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        amount: z.number().positive(),
        method: z.enum(PAYMENT_METHODS),
        fundSourceId: z.string().cuid().optional(),
        paidAt: z.date().optional(),
        referenceNumber: z.string().max(255).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return recordInvoicePayment({
        invoiceId: input.id,
        amount: input.amount,
        method: input.method,
        ...(input.fundSourceId !== undefined ? { fundSourceId: input.fundSourceId } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
        ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ctx: { tenantId: ctx.tenantId, userId: ctx.userId },
      });
    }),

  // Thin "pay full balance" convenience over recordPayment (F2). Settles the
  // entire outstanding balance in one call.
  markPaid: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        paidAt: z.date().optional(),
        method: z.enum(PAYMENT_METHODS).default("cash"),
        fundSourceId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await loadInvoiceForTenant(input.id, ctx);
      if (existing.status !== "sent" && existing.status !== "partially_paid" && existing.status !== "overdue") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only sent, overdue, or partially-paid invoices can be marked as paid.",
        });
      }
      const outstanding =
        Math.round(
          (parseFloat(existing.totalAmount.toString()) - parseFloat(existing.amountPaid.toString())) * 100,
        ) / 100;
      return recordInvoicePayment({
        invoiceId: input.id,
        amount: outstanding,
        method: input.method,
        ...(input.fundSourceId !== undefined ? { fundSourceId: input.fundSourceId } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
        ctx: { tenantId: ctx.tenantId, userId: ctx.userId },
      });
    }),

  void: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadInvoiceForTenant(input.id, ctx);
      if (existing.status === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Paid invoices cannot be voided." });
      }
      return db.invoice.update({
        where: { id: input.id },
        data: { status: "void" },
      });
    }),
});
