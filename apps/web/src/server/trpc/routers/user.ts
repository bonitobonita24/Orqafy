import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

export const userRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        db.user.findMany({
          where: { tenantId: ctx.tenantId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            isActive: true,
            createdAt: true,
            role: { select: { name: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.user.count({ where: { tenantId: ctx.tenantId } }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          tenantId: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          isActive: true,
          createdAt: true,
          role: { select: { name: true } },
        },
      });
      if (!user || user.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      const { tenantId: _, ...result } = user;
      return result;
    }),

  deactivate: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({ where: { id: input.id }, select: { id: true, tenantId: true } });
      if (!user || user.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      return db.user.update({
        where: { id: input.id },
        data: { isActive: false, securityVersion: { increment: 1 } },
        select: { id: true },
      });
    }),
});
