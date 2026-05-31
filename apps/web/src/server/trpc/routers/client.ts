import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";
import { sanitizePlainText } from "@/server/lib/sanitize";

const customerInput = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  taxId: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const clientRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(200).default(50), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const searchClause = input.search !== undefined && input.search !== ""
        ? {
            OR: [
              { firstName: { contains: input.search, mode: "insensitive" as const } },
              { lastName: { contains: input.search, mode: "insensitive" as const } },
              { companyName: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const where = { tenantId: ctx.tenantId, ...searchClause };
      const [items, total] = await Promise.all([
        db.customer.findMany({ where, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: { lastName: "asc" } }),
        db.customer.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const item = await db.customer.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(customerInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return db.customer.create({
        data: {
          tenantId: ctx.tenantId,
          firstName: sanitizePlainText(input.firstName),
          lastName: sanitizePlainText(input.lastName),
          companyName: input.companyName !== undefined ? sanitizePlainText(input.companyName) : null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          province: input.province ?? null,
          postalCode: input.postalCode ?? null,
          taxId: input.taxId ?? null,
          notes: input.notes !== undefined ? sanitizePlainText(input.notes) : null,
        },
      });
    }),

  update: writeProcedure
    .input(customerInput.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { id, ...rest } = input;
      const existing = await db.customer.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.update({
        where: { id },
        data: {
          ...(rest.firstName !== undefined ? { firstName: sanitizePlainText(rest.firstName) } : {}),
          ...(rest.lastName !== undefined ? { lastName: sanitizePlainText(rest.lastName) } : {}),
          ...(rest.companyName !== undefined ? { companyName: rest.companyName !== "" ? sanitizePlainText(rest.companyName) : null } : {}),
          ...(rest.email !== undefined ? { email: rest.email ?? null } : {}),
          ...(rest.phone !== undefined ? { phone: rest.phone ?? null } : {}),
          ...(rest.address !== undefined ? { address: rest.address ?? null } : {}),
          ...(rest.city !== undefined ? { city: rest.city ?? null } : {}),
          ...(rest.province !== undefined ? { province: rest.province ?? null } : {}),
          ...(rest.postalCode !== undefined ? { postalCode: rest.postalCode ?? null } : {}),
          ...(rest.taxId !== undefined ? { taxId: rest.taxId ?? null } : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes !== "" ? sanitizePlainText(rest.notes) : null } : {}),
        },
      });
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const existing = await db.customer.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.delete({ where: { id: input.id } });
    }),
});
