import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

// D7 — in-app notifications. ACCEPTED option (b): durable Prisma `Notification`
// model + Valkey real-time fan-out. Every procedure is tenant + recipient
// scoped server-side (where: { tenantId, recipientUserId }) so notifications
// never leak across tenants or between users.
export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().nullish(),
        unreadOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        recipientUserId: ctx.userId,
        ...(input.unreadOnly === true ? { readAt: null } : {}),
      };

      const rows = await db.notification.findMany({
        where,
        // Unread-first, then most-recent. readAt null sorts first under "asc".
        orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
        take: input.limit + 1,
        ...(input.cursor !== undefined && input.cursor !== null
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      });

      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        const next = rows.pop();
        nextCursor = next?.id;
      }

      const unreadCount = await db.notification.count({
        where: { tenantId: ctx.tenantId, recipientUserId: ctx.userId, readAt: null },
      });

      return {
        items: rows.map((n) => ({
          id: n.id,
          category: n.category,
          title: n.title,
          body: n.body,
          payload: n.payload,
          isRead: n.readAt !== null,
          createdAt: n.createdAt,
        })),
        unreadCount,
        nextCursor,
      };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.notification.count({
      where: { tenantId: ctx.tenantId, recipientUserId: ctx.userId, readAt: null },
    });
    return { count };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      // updateMany with the tenant + recipient predicate guarantees a caller can
      // only ever mark THEIR OWN notification read — a cross-tenant or
      // cross-user id simply matches zero rows.
      const result = await db.notification.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId, recipientUserId: ctx.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return { success: true, updated: result.count };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db.notification.updateMany({
      where: { tenantId: ctx.tenantId, recipientUserId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: result.count };
  }),
});
