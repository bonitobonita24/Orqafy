import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

const CUSTOMER_TIERS = ["regular", "vip", "authorized_dealer"] as const;

export const crmRouter = createTRPCRouter({
  // ── Customer ─────────────────────────────────────────────────────────────

  customerList: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isActive: z.boolean().optional(),
        tier: z.enum(CUSTOMER_TIERS).optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.tier !== undefined ? { tier: input.tier } : {}),
      };
      const [items, total] = await Promise.all([
        db.customer.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { companyName: "asc" },
        }),
        db.customer.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  customerById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const customer = await db.customer.findUnique({ where: { id: input.id } });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      return customer;
    }),

  customerCreate: writeProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        companyName: z.string().max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().length(2).default("PH"),
        taxId: z.string().max(50).optional(),
        tier: z.enum(CUSTOMER_TIERS).default("regular"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.customer.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          companyName: input.companyName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          province: input.province ?? null,
          postalCode: input.postalCode ?? null,
          country: input.country,
          taxId: input.taxId ?? null,
          tier: input.tier,
          notes: input.notes ?? null,
          isActive: true,
          portalEnabled: false,
        },
      });
    }),

  customerUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        companyName: z.string().max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        taxId: z.string().max(50).optional(),
        tier: z.enum(CUSTOMER_TIERS).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.customer.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.province !== undefined ? { province: data.province } : {}),
          ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
          ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
          ...(data.tier !== undefined ? { tier: data.tier } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
    }),

  customerToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customer.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),

  // ── CustomerContact ───────────────────────────────────────────────────────

  contactList: protectedProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.customerContact.findMany({
        where: { customerId: input.customerId },
        orderBy: { isPrimary: "desc" },
      });
    }),

  contactCreate: writeProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return db.customerContact.create({
        data: {
          customerId: input.customerId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          position: input.position ?? null,
          isPrimary: input.isPrimary,
        },
      });
    }),

  contactUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.customerContact.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerContact.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.position !== undefined ? { position: data.position } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        },
      });
    }),

  contactDelete: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customerContact.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerContact.delete({ where: { id: input.id } });
    }),

  // ── CustomerCreditAccount ─────────────────────────────────────────────────

  creditGet: protectedProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.customerCreditAccount.findUnique({
        where: { customerId: input.customerId },
      });
    }),

  creditUpsert: writeProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        creditLimit: z.number().min(0),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.customerCreditAccount.upsert({
        where: { customerId: input.customerId },
        create: {
          customerId: input.customerId,
          creditLimit: input.creditLimit,
          isActive: input.isActive ?? true,
        },
        update: {
          creditLimit: input.creditLimit,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    }),

  creditToggleActive: writeProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customerCreditAccount.findUnique({
        where: { customerId: input.customerId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerCreditAccount.update({
        where: { customerId: input.customerId },
        data: { isActive: !existing.isActive },
      });
    }),
});
