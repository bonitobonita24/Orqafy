import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// ── Sequence helpers ──────────────────────────────────────────────────────────

async function generatePoNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PO-${yy}${mm}-`;
  const last = await db.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  const seq = last
    ? parseInt(last.poNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function generateGrNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `GR-${yy}${mm}-`;
  const last = await db.goodsReceipt.findFirst({
    where: { grNumber: { startsWith: prefix } },
    orderBy: { grNumber: "desc" },
    select: { grNumber: true },
  });
  const seq = last
    ? parseInt(last.grNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── Tenant-scoped PO loader ───────────────────────────────────────────────────

async function loadPoForTenant(
  id: string,
  ctx: { tenantId: string },
): Promise<NonNullable<Awaited<ReturnType<typeof db.purchaseOrder.findUnique>>>> {
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
  }
  return po;
}

// ── Tenant-scoped GR loader ───────────────────────────────────────────────────

async function loadGrForTenant(
  id: string,
  ctx: { tenantId: string },
): Promise<NonNullable<Awaited<ReturnType<typeof db.goodsReceipt.findUnique>>>> {
  const gr = await db.goodsReceipt.findUnique({ where: { id } });
  if (!gr || gr.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Goods receipt not found" });
  }
  return gr;
}

// ── Tenant-scoped Vendor loader ───────────────────────────────────────────────

async function loadVendorForTenant(
  id: string,
  ctx: { tenantId: string },
): Promise<NonNullable<Awaited<ReturnType<typeof db.vendor.findUnique>>>> {
  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor || vendor.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
  }
  return vendor;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const allocationSchema = z.object({
  type: z.enum(["stock", "project_expense", "company_expense"]),
  quantity: z.number().positive(),
  projectId: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
});

const poItemSchema = z.object({
  productId: z.string().min(1).optional(),
  description: z.string().min(1).max(1000),
  unit: z.string().max(50).default("pcs"),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int().min(0).default(0),
  allocations: z.array(allocationSchema).optional(),
});

// ── Vendor sub-router ─────────────────────────────────────────────────────────

export const vendorRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
        type: z.enum(["direct", "ecommerce"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.search !== undefined && input.search !== ""
          ? {
              OR: [
                { companyName: { contains: input.search, mode: "insensitive" as const } },
                { contactName: { contains: input.search, mode: "insensitive" as const } },
                { email: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.vendor.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { companyName: "asc" },
        }),
        db.vendor.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return loadVendorForTenant(input.id, ctx);
    }),

  create: writeProcedure
    .input(
      z.object({
        type: z.enum(["direct", "ecommerce"]).default("direct"),
        companyName: z.string().min(1).max(500),
        contactName: z.string().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().max(2).default("PH"),
        taxId: z.string().max(50).optional(),
        platformUrl: z.string().url().optional(),
        platformName: z.string().max(200).optional(),
        paymentTerms: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.$transaction(async (tx) => {
        const created = await tx.vendor.create({
          data: {
            tenantId: ctx.tenantId,
            type: input.type,
            companyName: input.companyName,
            ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.address !== undefined ? { address: input.address } : {}),
            ...(input.city !== undefined ? { city: input.city } : {}),
            ...(input.province !== undefined ? { province: input.province } : {}),
            ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
            country: input.country,
            ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
            ...(input.platformUrl !== undefined ? { platformUrl: input.platformUrl } : {}),
            ...(input.platformName !== undefined ? { platformName: input.platformName } : {}),
            ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Vendor",
          entityId: created.id,
          before: null,
          after: { id: created.id, companyName: created.companyName, type: created.type },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        type: z.enum(["direct", "ecommerce"]).optional(),
        companyName: z.string().min(1).max(500).optional(),
        contactName: z.string().max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().max(2).optional(),
        taxId: z.string().max(50).optional(),
        platformUrl: z.string().url().optional(),
        platformName: z.string().max(200).optional(),
        paymentTerms: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const existing = await loadVendorForTenant(id, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.vendor.update({
          where: { id },
          data: {
            ...(rest.type !== undefined ? { type: rest.type } : {}),
            ...(rest.companyName !== undefined ? { companyName: rest.companyName } : {}),
            ...(rest.contactName !== undefined ? { contactName: rest.contactName } : {}),
            ...(rest.email !== undefined ? { email: rest.email } : {}),
            ...(rest.phone !== undefined ? { phone: rest.phone } : {}),
            ...(rest.address !== undefined ? { address: rest.address } : {}),
            ...(rest.city !== undefined ? { city: rest.city } : {}),
            ...(rest.province !== undefined ? { province: rest.province } : {}),
            ...(rest.postalCode !== undefined ? { postalCode: rest.postalCode } : {}),
            ...(rest.country !== undefined ? { country: rest.country } : {}),
            ...(rest.taxId !== undefined ? { taxId: rest.taxId } : {}),
            ...(rest.platformUrl !== undefined ? { platformUrl: rest.platformUrl } : {}),
            ...(rest.platformName !== undefined ? { platformName: rest.platformName } : {}),
            ...(rest.paymentTerms !== undefined ? { paymentTerms: rest.paymentTerms } : {}),
            ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
            ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Vendor",
          entityId: id,
          before: { companyName: existing.companyName, type: existing.type, isActive: existing.isActive },
          after: { companyName: updated.companyName, type: updated.type, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  deactivate: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadVendorForTenant(input.id, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.vendor.update({ where: { id: input.id }, data: { isActive: false } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Vendor",
          entityId: input.id,
          before: { isActive: existing.isActive },
          after: { isActive: false },
        });
        return updated;
      });
    }),
});

// ── Purchase Order sub-router ─────────────────────────────────────────────────

export const poRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
        vendorId: z.string().min(1).optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.search !== undefined && input.search !== ""
          ? {
              OR: [
                { poNumber: { contains: input.search, mode: "insensitive" as const } },
                { vendor: { companyName: { contains: input.search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.purchaseOrder.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          include: {
            vendor: { select: { id: true, companyName: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.purchaseOrder.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const po = await db.purchaseOrder.findUnique({
        where: { id: input.id },
        include: {
          vendor: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, name: true, sku: true } },
              allocations: true,
            },
          },
          goodsReceipts: {
            orderBy: { createdAt: "desc" },
            select: { id: true, grNumber: true, status: true, receivedAt: true },
          },
        },
      });
      if (!po || po.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      return po;
    }),

  create: writeProcedure
    .input(
      z.object({
        vendorId: z.string().min(1),
        expectedDelivery: z.string().datetime().optional(),
        currency: z.string().max(3).default("PHP"),
        notes: z.string().max(2000).optional(),
        items: z.array(poItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await db.vendor.findUnique({ where: { id: input.vendorId } });
      if (vendor === null) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });

      // Validate allocations: sum per item, type-specific ID requirements
      for (const item of input.items) {
        if (item.allocations !== undefined && item.allocations.length > 0) {
          const allocSum = item.allocations.reduce((s, a) => s + a.quantity, 0);
          if (Math.abs(allocSum - item.quantity) > 1e-6) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Allocations must sum to item quantity",
            });
          }
          for (const alloc of item.allocations) {
            if (alloc.type === "stock" && alloc.warehouseId === undefined) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Stock allocation requires warehouseId",
              });
            }
            if (alloc.type === "project_expense" && alloc.projectId === undefined) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Project expense allocation requires projectId",
              });
            }
          }
        }
      }

      const poNumber = await generatePoNumber();

      // Calculate totals
      let subtotal = 0;
      for (const item of input.items) {
        subtotal += item.quantity * item.unitPrice;
      }
      const totalAmount = subtotal;

      return db.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.create({
          data: {
            tenantId: ctx.tenantId,
            poNumber,
            vendorId: input.vendorId,
            createdById: ctx.userId,
            status: "draft",
            subtotal,
            taxAmount: 0,
            totalAmount,
            currency: input.currency,
            ...(input.expectedDelivery !== undefined
              ? { expectedDelivery: new Date(input.expectedDelivery) }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });

        for (const item of input.items) {
          const totalPrice = item.quantity * item.unitPrice;
          const created = await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              tenantId: ctx.tenantId,
              ...(item.productId !== undefined ? { productId: item.productId } : {}),
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice,
              sortOrder: item.sortOrder,
            },
          });

          if (item.allocations !== undefined && item.allocations.length > 0) {
            for (const alloc of item.allocations) {
              await tx.purchaseOrderItemAllocation.create({
                data: {
                  itemId: created.id,
                  tenantId: ctx.tenantId,
                  type: alloc.type,
                  quantity: alloc.quantity,
                  ...(alloc.projectId !== undefined ? { projectId: alloc.projectId } : {}),
                  ...(alloc.warehouseId !== undefined ? { warehouseId: alloc.warehouseId } : {}),
                },
              });
            }
          }
        }

        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "PurchaseOrder",
          entityId: po.id,
          before: null,
          after: { id: po.id, poNumber: po.poNumber, vendorId: po.vendorId, status: po.status, totalAmount: po.totalAmount },
        });
        return tx.purchaseOrder.findUnique({
          where: { id: po.id },
          include: { items: { include: { allocations: true } } },
        });
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        vendorId: z.string().min(1).optional(),
        expectedDelivery: z.string().datetime().optional(),
        currency: z.string().max(3).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const po = await loadPoForTenant(input.id, ctx);
      if (po.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft POs can be edited" });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id: input.id },
          data: {
            ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
            ...(input.expectedDelivery !== undefined
              ? { expectedDelivery: new Date(input.expectedDelivery) }
              : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "PurchaseOrder",
          entityId: input.id,
          before: { vendorId: po.vendorId, currency: po.currency, notes: po.notes },
          after: { vendorId: updated.vendorId, currency: updated.currency, notes: updated.notes },
        });
        return updated;
      });
    }),

  submit: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const po = await loadPoForTenant(input.id, ctx);
      if (po.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft POs can be submitted" });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id: input.id },
          data: { status: "pending_approval" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "PurchaseOrder",
          entityId: input.id,
          before: { status: po.status },
          after: { status: "pending_approval" },
        });
        return updated;
      });
    }),

  approve: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const allowedRoles = ["Administrator", "Purchasing Manager", "admin"];
      if (!ctx.roles.some((r) => allowedRoles.includes(r))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient role to approve POs" });
      }
      const po = await loadPoForTenant(input.id, ctx);
      if (po.status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending_approval POs can be approved" });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id: input.id },
          data: {
            status: "approved",
            approvedById: ctx.userId,
            approvedAt: new Date(),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "PurchaseOrder",
          entityId: input.id,
          before: { status: po.status, approvedById: po.approvedById },
          after: { status: "approved", approvedById: ctx.userId },
        });
        return updated;
      });
    }),

  markOrdered: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const po = await loadPoForTenant(input.id, ctx);
      if (po.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved POs can be marked as ordered" });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id: input.id },
          data: { status: "ordered", orderedAt: new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "PurchaseOrder",
          entityId: input.id,
          before: { status: po.status },
          after: { status: "ordered" },
        });
        return updated;
      });
    }),

  cancel: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const po = await loadPoForTenant(input.id, ctx);
      const cancellable = ["draft", "pending_approval", "approved"];
      if (!cancellable.includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PO cannot be cancelled in its current status" });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id: input.id },
          data: { status: "cancelled" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "PurchaseOrder",
          entityId: input.id,
          before: { status: po.status },
          after: { status: "cancelled" },
        });
        return updated;
      });
    }),
});

// ── Goods Receipt sub-router ──────────────────────────────────────────────────

export const goodsReceiptRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        purchaseOrderId: z.string().min(1).optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.purchaseOrderId !== undefined ? { purchaseOrderId: input.purchaseOrderId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.goodsReceipt.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          include: {
            purchaseOrder: { select: { id: true, poNumber: true } },
            receivedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.goodsReceipt.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await loadGrForTenant(input.id, ctx);
      const gr = await db.goodsReceipt.findUnique({
        where: { id: input.id },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, vendor: { select: { id: true, companyName: true } } },
          },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
        },
      });
      if (gr === null) throw new TRPCError({ code: "NOT_FOUND" });
      return gr;
    }),

  create: writeProcedure
    .input(
      z.object({
        purchaseOrderId: z.string().min(1),
        notes: z.string().max(2000).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().min(1).optional(),
              description: z.string().min(1).max(1000),
              quantityExpected: z.number().positive(),
              quantityReceived: z.number().min(0),
              quantityRejected: z.number().min(0).default(0),
              notes: z.string().max(500).optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await loadPoForTenant(input.purchaseOrderId, ctx);
      const po = await db.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: {
          items: {
            include: { allocations: true },
          },
        },
      });
      if (po === null) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
      const receivable = ["approved", "ordered", "partially_received"];
      if (!receivable.includes(po.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Purchase order is not in a receivable state",
        });
      }

      const grNumber = await generateGrNumber();

      return db.$transaction(async (tx) => {
        const gr = await tx.goodsReceipt.create({
          data: {
            tenantId: ctx.tenantId,
            grNumber,
            purchaseOrderId: input.purchaseOrderId,
            receivedById: ctx.userId,
            status: "accepted",
            receivedAt: new Date(),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });

        for (const grItem of input.items) {
          await tx.goodsReceiptItem.create({
            data: {
              tenantId: ctx.tenantId,
              goodsReceiptId: gr.id,
              ...(grItem.productId !== undefined ? { productId: grItem.productId } : {}),
              description: grItem.description,
              quantityExpected: grItem.quantityExpected,
              quantityReceived: grItem.quantityReceived,
              quantityRejected: grItem.quantityRejected,
              ...(grItem.notes !== undefined ? { notes: grItem.notes } : {}),
            },
          });

          // Only process allocations when something was actually received
          if (grItem.quantityReceived <= 0) continue;

          // Find matching PO item by productId or description to get allocations
          const matchingPoItem = po.items.find((poi) => {
            if (grItem.productId !== undefined && poi.productId !== null) {
              return poi.productId === grItem.productId;
            }
            return poi.description === grItem.description;
          });

          if (matchingPoItem === undefined || matchingPoItem.allocations.length === 0) continue;

          const totalAllocQty = matchingPoItem.allocations.reduce(
            (sum, a) => sum + Number(a.quantity),
            0
          );
          if (totalAllocQty <= 0) continue;

          for (const alloc of matchingPoItem.allocations) {
            const proportion = Number(alloc.quantity) / totalAllocQty;
            const allocatedQty = grItem.quantityReceived * proportion;

            if (alloc.type === "stock") {
              // Only create stock movement when productId is available
              const productId = grItem.productId ?? matchingPoItem.productId;
              if (productId === null || productId === undefined) continue;

              await tx.stockMovement.create({
                data: {
                  tenantId: ctx.tenantId,
                  productId,
                  type: "in",
                  quantity: allocatedQty,
                  ...(alloc.warehouseId !== undefined && alloc.warehouseId !== null
                    ? { toWarehouseId: alloc.warehouseId }
                    : {}),
                  referenceType: "goods_receipt",
                  referenceId: gr.id,
                  createdById: ctx.userId,
                },
              });

              // Mark allocation as processed
              await tx.purchaseOrderItemAllocation.update({
                where: { id: alloc.id },
                data: { processedAt: new Date() },
              });
            } else if (alloc.type === "project_expense") {
              if (alloc.projectId === null || alloc.projectId === undefined) continue;

              // Calculate expense amount proportionally from PO item unit price
              const expenseAmount = allocatedQty * Number(matchingPoItem.unitPrice);

              await tx.projectExpense.create({
                data: {
                  tenantId: ctx.tenantId,
                  projectId: alloc.projectId,
                  type: "inventory_consumed",
                  description: grItem.description,
                  amount: expenseAmount,
                  currency: po.currency,
                  referenceType: "goods_receipt",
                  referenceId: gr.id,
                },
              });

              await tx.purchaseOrderItemAllocation.update({
                where: { id: alloc.id },
                data: { processedAt: new Date() },
              });
            }
            // company_expense: skip in Phase 1
          }

          // Update PO item quantityReceived
          const newQtyReceived =
            Number(matchingPoItem.quantityReceived) + grItem.quantityReceived;
          await tx.purchaseOrderItem.update({
            where: { id: matchingPoItem.id },
            data: { quantityReceived: newQtyReceived },
          });
        }

        // Recompute PO status based on received quantities
        const updatedItems = (await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: input.purchaseOrderId },
        })) ?? [];
        const allReceived = updatedItems.every(
          (i) => Number(i.quantityReceived) >= Number(i.quantity)
        );
        const anyReceived = updatedItems.some((i) => Number(i.quantityReceived) > 0);
        const newPoStatus = allReceived
          ? "received"
          : anyReceived
            ? "partially_received"
            : po.status;

        await tx.purchaseOrder.update({
          where: { id: input.purchaseOrderId },
          data: { status: newPoStatus },
        });

        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "GoodsReceipt",
          entityId: gr.id,
          before: null,
          after: { id: gr.id, grNumber: gr.grNumber, purchaseOrderId: gr.purchaseOrderId, status: gr.status },
        });
        return tx.goodsReceipt.findUnique({
          where: { id: gr.id },
          include: { items: true },
        });
      });
    }),
});

// ── Composed purchasing router ────────────────────────────────────────────────

export const purchasingRouter = createTRPCRouter({
  vendor: vendorRouter,
  po: poRouter,
  goodsReceipt: goodsReceiptRouter,
});
