import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";
import { sanitizePlainText } from "@/server/lib/sanitize";

const projectInput = z.object({
  name: z.string().min(1).max(200),
  customerId: z.string().cuid().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
  budget: z.number().positive().optional(),
});

export const projectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(200).default(50), customerId: z.string().cuid().optional(), status: z.string().optional() }))
    .query(async ({ input }) => {
      const where = {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.project.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.project.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      const item = await db.project.findUnique({
        where: { id: input.id },
        include: { expenses: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(projectInput)
    .mutation(async ({ input, ctx }) => {
      if (input.customerId !== undefined) {
        const customer = await db.customer.findUnique({ where: { id: input.customerId } });
        if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Customer not found." });
      }
      const projectNumber = `PRJ-${Date.now()}`;
      return db.project.create({
        data: {
          name: sanitizePlainText(input.name),
          customerId: input.customerId ?? null,
          description: input.description !== undefined ? sanitizePlainText(input.description) : null,
          status: input.status,
          startDate: input.startDate ?? null,
          targetEndDate: input.targetEndDate ?? null,
          budget: input.budget ?? null,
          projectNumber,
          managerId: ctx.userId,
        },
      });
    }),

  update: writeProcedure
    .input(projectInput.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const existing = await db.project.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.project.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: sanitizePlainText(rest.name) } : {}),
          ...(rest.customerId !== undefined ? { customerId: rest.customerId ?? null } : {}),
          ...(rest.description !== undefined ? { description: rest.description !== "" ? sanitizePlainText(rest.description) : null } : {}),
          ...(rest.status !== undefined ? { status: rest.status } : {}),
          ...(rest.startDate !== undefined ? { startDate: rest.startDate ?? null } : {}),
          ...(rest.targetEndDate !== undefined ? { targetEndDate: rest.targetEndDate ?? null } : {}),
          ...(rest.budget !== undefined ? { budget: rest.budget ?? null } : {}),
        },
      });
    }),
});
