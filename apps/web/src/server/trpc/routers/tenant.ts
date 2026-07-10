import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

export const tenantRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { id: true, name: true, slug: true, isActive: true, plan: true, timezone: true, currency: true, logoUrl: true },
    });
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
    return tenant;
  }),

  updateSettings: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        timezone: z.string().optional(),
        currency: z.string().length(3).optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      return db.tenant.update({
        where: { id: ctx.tenantId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
        },
        select: { id: true, name: true, slug: true },
      });
    }),
});
