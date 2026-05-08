import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

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
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const existing = await db.product.findUnique({ where: { id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.product.update({
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
    }),

  productToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.product.findUnique({ where: { id: input.id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.product.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),

  // ── Categories ────────────────────────────────────────────────────────────
  categoryList: protectedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).default({}))
    .query(async ({ input }) => {
      return db.category.findMany({
        where: {
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
      })
    )
    .mutation(async ({ input }) => {
      return db.category.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder,
        },
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
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const existing = await db.category.findUnique({ where: { id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.category.update({
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
    }),

  categoryToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.category.findUnique({ where: { id: input.id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.category.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),

  // ── Warehouses ────────────────────────────────────────────────────────────
  warehouseList: protectedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).default({}))
    .query(async ({ input }) => {
      return db.warehouse.findMany({
        where: {
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
      })
    )
    .mutation(async ({ input }) => {
      return db.warehouse.create({
        data: {
          name: input.name,
          code: input.code,
          address: input.address ?? null,
          isDefault: input.isDefault,
        },
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
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const existing = await db.warehouse.findUnique({ where: { id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.warehouse.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.code !== undefined ? { code: rest.code } : {}),
          ...(rest.address !== undefined ? { address: rest.address } : {}),
          ...(rest.isDefault !== undefined ? { isDefault: rest.isDefault } : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        },
      });
    }),

  warehouseToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.warehouse.findUnique({ where: { id: input.id } });
      if (existing === null) throw new TRPCError({ code: "NOT_FOUND" });
      return db.warehouse.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
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
    .query(async ({ input }) => {
      return db.warehouseStock.findMany({
        where: {
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
});
