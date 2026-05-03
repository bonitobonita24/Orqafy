import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

export const inventoryRouter = createTRPCRouter({
  // ── Products ──────────────────────────────────────────────────────────────
  listProducts: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        categoryId: z.string().cuid().optional(),
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
          include: {
            category: { select: { name: true } },
            warehouseStocks: {
              include: { warehouse: { select: { name: true } } },
            },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { name: "asc" },
        }),
        db.product.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  productById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      const item = await db.product.findUnique({
        where: { id: input.id },
        include: {
          category: true,
          warehouseStocks: { include: { warehouse: true } },
          serialNumbers: { where: { status: "in_stock" } },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  createProduct: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(500),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        categoryId: z.string().cuid().optional(),
        unit: z.string().max(50).default("pcs"),
        baseCost: z.number().min(0).default(0),
        reorderLevel: z.number().int().min(0).optional(),
        reorderQuantity: z.number().int().min(0).optional(),
        isSerialTracked: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return db.product.create({
        data: {
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
    }),

  updateProduct: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(500).optional(),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        categoryId: z.string().cuid().optional(),
        unit: z.string().max(50).optional(),
        baseCost: z.number().min(0).optional(),
        reorderLevel: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const existing = await db.product.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.product.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.sku !== undefined ? { sku: rest.sku ?? null } : {}),
          ...(rest.barcode !== undefined ? { barcode: rest.barcode ?? null } : {}),
          ...(rest.description !== undefined ? { description: rest.description ?? null } : {}),
          ...(rest.categoryId !== undefined ? { categoryId: rest.categoryId ?? null } : {}),
          ...(rest.unit !== undefined ? { unit: rest.unit } : {}),
          ...(rest.baseCost !== undefined ? { baseCost: rest.baseCost } : {}),
          ...(rest.reorderLevel !== undefined ? { reorderLevel: rest.reorderLevel ?? null } : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        },
      });
    }),

  // ── Categories ────────────────────────────────────────────────────────────
  categories: protectedProcedure.query(async () => {
    return db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }),

  // ── Warehouses ────────────────────────────────────────────────────────────
  warehouses: protectedProcedure.query(async () => {
    return db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }),

  // ── Stock movements ───────────────────────────────────────────────────────
  listMovements: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        productId: z.string().cuid().optional(),
        type: z.enum(["in", "out", "adjustment", "transfer"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      };
      const [items, total] = await Promise.all([
        db.stockMovement.findMany({
          where,
          include: {
            product: { select: { name: true, sku: true } },
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            createdBy: { select: { firstName: true, lastName: true, displayName: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.stockMovement.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  createMovement: writeProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        quantity: z.number().positive(),
        fromWarehouseId: z.string().cuid().optional(),
        toWarehouseId: z.string().cuid().optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const product = await db.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new TRPCError({ code: "BAD_REQUEST", message: "Product not found." });
      return db.stockMovement.create({
        data: {
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          fromWarehouseId: input.fromWarehouseId ?? null,
          toWarehouseId: input.toWarehouseId ?? null,
          notes: input.notes ?? null,
          createdById: ctx.userId,
        },
      });
    }),

  // ── Stock levels ──────────────────────────────────────────────────────────
  stockLevels: protectedProcedure
    .input(
      z.object({
        warehouseId: z.string().cuid().optional(),
        lowStock: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.warehouseStock.findMany({
        where: {
          ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        },
        include: {
          product: {
            select: { name: true, sku: true, reorderLevel: true, unit: true },
          },
          warehouse: { select: { name: true } },
        },
        orderBy: { product: { name: "asc" } },
      });
    }),
});
