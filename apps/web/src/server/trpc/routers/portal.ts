import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, portalProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

// Customer-facing data router (W3a) — Invoices, Orders, Repairs, Dashboard.
// CARDINAL RULE (every procedure below): filter on BOTH
// `tenantId: ctx.tenantId` AND `customerId: ctx.customerId`. `customerId`
// comes ONLY from portalProcedure's ctx (never trusted from client input —
// there is no `customerId` input field anywhere in this router). `byId`
// procedures return NOT_FOUND (never FORBIDDEN) for a row that exists but
// belongs to a different customer/tenant, so a caller can never distinguish
// "not mine" from "doesn't exist" (enumeration-resistant, same posture as
// invoice.ts's loadInvoiceForTenant / storefront.ts's getOrderById).

const cuid = z.string().cuid();

// Orders considered "active" (not yet delivered/cancelled/refunded) for the
// dashboard's activeCount tile.
const ACTIVE_ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped"] as const;
// Repairs considered "open" (not yet released or cancelled) for the
// dashboard's openCount tile.
const OPEN_REPAIR_STATUSES = [
  "received",
  "diagnosing",
  "quoted",
  "approved",
  "in_progress",
  "testing",
  "completed",
] as const;

const invoicesRouter = createTRPCRouter({
  list: portalProcedure.query(({ ctx }) => {
    return db.invoice.findMany({
      where: { tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
        balance: true,
        dueDate: true,
        issuedAt: true,
        currency: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: portalProcedure.input(z.object({ id: cuid })).query(async ({ ctx, input }) => {
    const invoice = await db.invoice.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        amountPaid: true,
        balance: true,
        currency: true,
        dueDate: true,
        issuedAt: true,
        paidAt: true,
        lineItems: true,
        notes: true,
        createdAt: true,
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            referenceNumber: true,
            paidAt: true,
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });
    if (invoice === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    return invoice;
  }),
});

const ordersRouter = createTRPCRouter({
  list: portalProcedure.query(({ ctx }) => {
    return db.ecommerceOrder.findMany({
      where: { tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        trackingNumber: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: portalProcedure.input(z.object({ id: cuid })).query(async ({ ctx, input }) => {
    const order = await db.ecommerceOrder.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        taxAmount: true,
        shippingAmount: true,
        discountAmount: true,
        totalAmount: true,
        currency: true,
        trackingNumber: true,
        shippingAddress: true,
        notes: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });
    if (order === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }
    return order;
  }),
});

const repairsRouter = createTRPCRouter({
  list: portalProcedure.query(({ ctx }) => {
    return db.jobOrder.findMany({
      where: { tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        jobOrderNumber: true,
        status: true,
        deviceType: true,
        deviceBrand: true,
        deviceModel: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: portalProcedure.input(z.object({ id: cuid })).query(async ({ ctx, input }) => {
    const jobOrder = await db.jobOrder.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId, customerId: ctx.customerId },
      select: {
        id: true,
        jobOrderNumber: true,
        status: true,
        priority: true,
        deviceType: true,
        deviceBrand: true,
        deviceModel: true,
        serialNumber: true,
        reportedIssue: true,
        diagnosis: true,
        estimatedCost: true,
        actualCost: true,
        laborCost: true,
        currency: true,
        warranty: true,
        completedAt: true,
        releasedAt: true,
        createdAt: true,
        parts: {
          select: { id: true, description: true, quantity: true, unitPrice: true, totalPrice: true },
        },
        serviceLines: {
          select: { id: true, description: true, hours: true, rate: true, amount: true },
        },
      },
    });
    if (jobOrder === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Repair not found" });
    }
    return jobOrder;
  }),
});

const dashboardRouter = createTRPCRouter({
  summary: portalProcedure.query(async ({ ctx }) => {
    const where = { tenantId: ctx.tenantId, customerId: ctx.customerId };
    const [invoiceCount, unpaidInvoices, orderCount, activeOrderCount, repairCount, openRepairCount] =
      await Promise.all([
        db.invoice.count({ where }),
        db.invoice.findMany({
          where: { ...where, balance: { gt: 0 } },
          select: { balance: true },
        }),
        db.ecommerceOrder.count({ where }),
        db.ecommerceOrder.count({ where: { ...where, status: { in: [...ACTIVE_ORDER_STATUSES] } } }),
        db.jobOrder.count({ where }),
        db.jobOrder.count({ where: { ...where, status: { in: [...OPEN_REPAIR_STATUSES] } } }),
      ]);

    const outstandingBalance =
      Math.round(unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance.toString()), 0) * 100) / 100;

    return {
      invoices: { count: invoiceCount, outstandingBalance },
      orders: { count: orderCount, activeCount: activeOrderCount },
      repairs: { count: repairCount, openCount: openRepairCount },
    };
  }),
});

export const portalRouter = createTRPCRouter({
  invoices: invoicesRouter,
  orders: ordersRouter,
  repairs: repairsRouter,
  dashboard: dashboardRouter,
});
