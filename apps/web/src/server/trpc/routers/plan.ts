import { prisma } from "@orqafy/db";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const planRouter = createTRPCRouter({
  listActive: publicProcedure.query(async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return { plans };
  }),
});
