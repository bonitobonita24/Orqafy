import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// In-app notifications are stored in Valkey (Redis) as JSON lists keyed by userId.
// No persistent Notification model exists in the Prisma schema — this uses ephemeral storage.
export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        unreadOnly: z.boolean().optional(),
      })
    )
    .query(() => {
      // Notifications are ephemeral — real implementation reads from Valkey.
      // Returning empty array as placeholder until Valkey integration is wired.
      return {
        items: [] as Array<{
          id: string;
          type: string;
          title: string;
          body: string;
          isRead: boolean;
          createdAt: Date;
          metadata: Record<string, unknown> | null;
        }>,
        unreadCount: 0,
      };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(() => {
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(() => {
    return { success: true };
  }),

  unreadCount: protectedProcedure.query(() => {
    return { count: 0 };
  }),
});
