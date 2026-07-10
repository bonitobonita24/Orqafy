import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// ── Tenant-ownership guards (close cross-tenant IDOR on FK/record writes) ───
async function assertProductInTenant(id: string, tenantId: string): Promise<void> {
  const found = await db.product.findFirst({ where: { id, tenantId } });
  if (found === null) throw new TRPCError({ code: "NOT_FOUND" });
}

async function assertWarehouseInTenant(id: string, tenantId: string): Promise<void> {
  const found = await db.warehouse.findFirst({ where: { id, tenantId } });
  if (found === null) throw new TRPCError({ code: "NOT_FOUND" });
}

async function assertCategoryInTenant(id: string, tenantId: string): Promise<void> {
  const found = await db.category.findFirst({ where: { id, tenantId } });
  if (found === null) throw new TRPCError({ code: "NOT_FOUND" });
}

export const inventoryRouter = createTRPCRouter({
  // ── Products ──────────────────────────────────────────────────────────────
  productList: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        categoryId: z.string().min(1).optional(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.search !== undefined && input.search !== ""
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" as const } },
                { sku: { contains: input.search, mode: "insensitive" as const } },
                { barcode: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.product.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { name: "asc" },
        }),
        db.product.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  productById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const item = await db.product.findUnique({ where: { id: input.id } });
      if (item === null) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  productCreate: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(500),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        categoryId: z.string().min(1).optional(),
        unit: z.string().max(50).default("pcs"),
        baseCost: z.number().min(0).default(0),
        reorderLevel: z.number().int().min(0).optional(),
        reorderQuantity: z.number().int().min(0).optional(),
        isSerialTracked: z.boolean().default(false),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      if (input.categoryId !== undefined) {
        await assertCategoryInTenant(input.categoryId, ctx.tenantId);
      }
      return db.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            description: input.description ?? null,
            categoryId: input.categoryId ?? null,
            unit: input.unit,
            baseCost: input.baseCost,
            reorderLevel: input.reorderLevel ?? null,
            reorderQuantity: input.reorderQuantity ?? null,
            isSerialTracked: input.isSerialTracked,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Product",
          entityId: created.id,
          before: null,
          after: { id: created.id, name: created.name, sku: created.sku, unit: created.unit, isActive: created.isActive },
        });
        return created;
      });
    }),

  productUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(500).optional(),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        categoryId: z.string().min(1).optional(),
        unit: z.string().max(50).optional(),
        baseCost: z.number().min(0).optional(),
        reorderLevel: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const existing = await db.product.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      if (rest.categoryId !== undefined) {
        await assertCategoryInTenant(rest.categoryId, ctx.tenantId);
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            ...(rest.name !== undefined ? { name: rest.name } : {}),
            ...(rest.sku !== undefined ? { sku: rest.sku } : {}),
            ...(rest.barcode !== undefined ? { barcode: rest.barcode } : {}),
            ...(rest.description !== undefined ? { description: rest.description } : {}),
            ...(rest.categoryId !== undefined ? { categoryId: rest.categoryId } : {}),
            ...(rest.unit !== undefined ? { unit: rest.unit } : {}),
            ...(rest.baseCost !== undefined ? { baseCost: rest.baseCost } : {}),
            ...(rest.reorderLevel !== undefined ? { reorderLevel: rest.reorderLevel } : {}),
            ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Product",
          entityId: id,
          before: { id: existing.id, name: existing.name, sku: existing.sku, unit: existing.unit, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, sku: updated.sku, unit: updated.unit, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  productToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.product.findUnique({ where: { id: input.id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id: input.id },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Product",
          entityId: input.id,
          before: { id: existing.id, name: existing.name, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  // ── Categories ────────────────────────────────────────────────────────────
  categoryList: protectedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      return db.category.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  categoryCreate: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        slug: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        parentId: z.string().min(1).optional(),
        sortOrder: z.number().int().min(0).default(0),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId !== undefined) {
        await assertCategoryInTenant(input.parentId, ctx.tenantId);
      }
      return db.$transaction(async (tx) => {
        const created = await tx.category.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            slug: input.slug,
            description: input.description ?? null,
            parentId: input.parentId ?? null,
            sortOrder: input.sortOrder,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Category",
          entityId: created.id,
          before: null,
          after: { id: created.id, name: created.name, slug: created.slug, isActive: created.isActive },
        });
        return created;
      });
    }),

  categoryUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(200).optional(),
        slug: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        parentId: z.string().min(1).optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const existing = await db.category.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      if (rest.parentId !== undefined) {
        await assertCategoryInTenant(rest.parentId, ctx.tenantId);
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id },
          data: {
            ...(rest.name !== undefined ? { name: rest.name } : {}),
            ...(rest.slug !== undefined ? { slug: rest.slug } : {}),
            ...(rest.description !== undefined ? { description: rest.description } : {}),
            ...(rest.parentId !== undefined ? { parentId: rest.parentId } : {}),
            ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
            ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Category",
          entityId: id,
          before: { id: existing.id, name: existing.name, slug: existing.slug, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, slug: updated.slug, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  categoryToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.category.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id: input.id },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Category",
          entityId: input.id,
          before: { id: existing.id, name: existing.name, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  // ── Warehouses ────────────────────────────────────────────────────────────
  warehouseList: protectedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      return db.warehouse.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        orderBy: { name: "asc" },
      });
    }),

  warehouseCreate: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        code: z.string().min(1).max(50),
        address: z.string().max(500).optional(),
        isDefault: z.boolean().default(false),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      return db.$transaction(async (tx) => {
        const created = await tx.warehouse.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            code: input.code,
            address: input.address ?? null,
            isDefault: input.isDefault,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Warehouse",
          entityId: created.id,
          before: null,
          after: { id: created.id, name: created.name, code: created.code, isDefault: created.isDefault, isActive: created.isActive },
        });
        return created;
      });
    }),

  warehouseUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(200).optional(),
        code: z.string().min(1).max(50).optional(),
        address: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const existing = await db.warehouse.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.$transaction(async (tx) => {
        const updated = await tx.warehouse.update({
          where: { id },
          data: {
            ...(rest.name !== undefined ? { name: rest.name } : {}),
            ...(rest.code !== undefined ? { code: rest.code } : {}),
            ...(rest.address !== undefined ? { address: rest.address } : {}),
            ...(rest.isDefault !== undefined ? { isDefault: rest.isDefault } : {}),
            ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Warehouse",
          entityId: id,
          before: { id: existing.id, name: existing.name, code: existing.code, isDefault: existing.isDefault, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, code: updated.code, isDefault: updated.isDefault, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  warehouseToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.warehouse.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.$transaction(async (tx) => {
        const updated = await tx.warehouse.update({
          where: { id: input.id },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Warehouse",
          entityId: input.id,
          before: { id: existing.id, name: existing.name, isActive: existing.isActive },
          after: { id: updated.id, name: updated.name, isActive: updated.isActive },
        });
        return updated;
      });
    }),

  // ── Stock levels ──────────────────────────────────────────────────────────
  stockList: protectedProcedure
    .input(
      z.object({
        warehouseId: z.string().min(1).optional(),
        productId: z.string().min(1).optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      return db.warehouseStock.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
          ...(input.productId !== undefined ? { productId: input.productId } : {}),
        },
        include: {
          warehouse: true,
          product: true,
        },
        orderBy: { product: { name: "asc" } },
      });
    }),

  // ── Stock Movements ───────────────────────────────────────────────────────
  stockMovementList: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        productId: z.string().min(1).optional(),
        warehouseId: z.string().min(1).optional(),
        type: z.enum(["in", "out", "adjustment", "transfer"]).optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.warehouseId !== undefined
          ? {
              OR: [
                { fromWarehouseId: input.warehouseId },
                { toWarehouseId: input.warehouseId },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.stockMovement.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: { product: true, fromWarehouse: true, toWarehouse: true },
          orderBy: { createdAt: "desc" },
        }),
        db.stockMovement.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  stockMovementById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const item = await db.stockMovement.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: { product: true, fromWarehouse: true, toWarehouse: true },
      });
      if (item === null) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  stockMovementCreate: writeProcedure
    .input(
      z.object({
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        productId: z.string().min(1),
        quantity: z.number().positive(),
        fromWarehouseId: z.string().min(1).optional(),
        toWarehouseId: z.string().min(1).optional(),
        notes: z.string().optional(),
        referenceType: z.string().optional(),
        referenceId: z.string().optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (input.type === "in" && input.toWarehouseId === undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "toWarehouseId required for type 'in'" });
      }
      if (input.type === "out" && input.fromWarehouseId === undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "fromWarehouseId required for type 'out'" });
      }
      if (input.type === "transfer" && (input.fromWarehouseId === undefined || input.toWarehouseId === undefined)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Both fromWarehouseId and toWarehouseId required for type 'transfer'" });
      }
      if (input.type === "adjustment" && input.fromWarehouseId === undefined && input.toWarehouseId === undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "At least one warehouse required for type 'adjustment'" });
      }
      await assertProductInTenant(input.productId, ctx.tenantId);
      if (input.fromWarehouseId !== undefined) {
        await assertWarehouseInTenant(input.fromWarehouseId, ctx.tenantId);
      }
      if (input.toWarehouseId !== undefined) {
        await assertWarehouseInTenant(input.toWarehouseId, ctx.tenantId);
      }
      return db.$transaction(async (tx) => {
        const created = await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            type: input.type,
            productId: input.productId,
            quantity: input.quantity,
            fromWarehouseId: input.fromWarehouseId ?? null,
            toWarehouseId: input.toWarehouseId ?? null,
            notes: input.notes ?? null,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            createdById: ctx.userId,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "StockMovement",
          entityId: created.id,
          before: null,
          after: { id: created.id, type: created.type, productId: created.productId, quantity: Number(created.quantity), fromWarehouseId: created.fromWarehouseId, toWarehouseId: created.toWarehouseId },
        });
        return created;
      });
    }),

  stockTransfer: writeProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        fromWarehouseId: z.string().min(1),
        toWarehouseId: z.string().min(1),
        notes: z.string().optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (input.fromWarehouseId === input.toWarehouseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source and destination warehouses must differ" });
      }
      await assertProductInTenant(input.productId, ctx.tenantId);
      await assertWarehouseInTenant(input.fromWarehouseId, ctx.tenantId);
      await assertWarehouseInTenant(input.toWarehouseId, ctx.tenantId);
      return db.$transaction(async (tx) => {
        const created = await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            type: "transfer",
            productId: input.productId,
            quantity: input.quantity,
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            notes: input.notes ?? null,
            referenceType: null,
            referenceId: null,
            createdById: ctx.userId,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "StockMovement",
          entityId: created.id,
          before: null,
          after: { id: created.id, type: created.type, productId: created.productId, quantity: Number(created.quantity), fromWarehouseId: created.fromWarehouseId, toWarehouseId: created.toWarehouseId },
        });
        return created;
      });
    }),

  stockAdjustment: writeProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        quantity: z.number(),
        warehouseId: z.string().min(1),
        notes: z.string().min(1),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      await assertProductInTenant(input.productId, ctx.tenantId);
      await assertWarehouseInTenant(input.warehouseId, ctx.tenantId);
      return db.$transaction(async (tx) => {
        const created = await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            type: "adjustment",
            productId: input.productId,
            quantity: Math.abs(input.quantity),
            fromWarehouseId: input.quantity < 0 ? input.warehouseId : null,
            toWarehouseId: input.quantity >= 0 ? input.warehouseId : null,
            notes: input.notes,
            referenceType: null,
            referenceId: null,
            createdById: ctx.userId,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "StockMovement",
          entityId: created.id,
          before: null,
          after: { id: created.id, type: created.type, productId: created.productId, quantity: Number(created.quantity), fromWarehouseId: created.fromWarehouseId, toWarehouseId: created.toWarehouseId },
        });
        return created;
      });
    }),
});
