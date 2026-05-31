import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure, publicProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";
import { rateLimiters } from "@/server/lib/rate-limit";
import { sanitizePlainText } from "@/server/lib/sanitize";

async function loadInvoiceForTenant(id: string, ctx: { tenantId: string }) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
  }
  return invoice;
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

  markPaid: writeProcedure
    .input(z.object({ id: z.string().cuid(), paidAt: z.date().optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadInvoiceForTenant(input.id, ctx);
      if (existing.status !== "sent") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent invoices can be marked as paid." });
      }
      return db.invoice.update({
        where: { id: input.id },
        data: { status: "paid", paidAt: input.paidAt ?? new Date() },
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
