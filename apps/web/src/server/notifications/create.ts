/**
 * D7 — `createNotification`: the single server helper other code uses to emit an
 * in-app notification. It both PERSISTS (Prisma, durable) and FANS OUT (Valkey,
 * real-time) per the accepted option (b).
 *
 * Tenant correctness: the caller MUST pass `tenantId` (always from a trusted
 * server context — `ctx.tenantId`). The row is written with that tenant_id and
 * the real-time event is published to the tenant+user-scoped channel, so a
 * notification can never leak across tenants.
 *
 * Fan-out is best-effort and never blocks the durable write (see valkey.ts).
 */
import { prisma } from "@orqafy/db";
import type { Prisma } from "@prisma/client";
import { publishNotification } from "./valkey";
import { type NotificationCategory } from "./categories";

export interface CreateNotificationInput {
  tenantId: string;
  recipientUserId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  const notification = await prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      category: input.category,
      title: input.title,
      body: input.body,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    },
    select: { id: true, category: true, title: true, body: true, payload: true, createdAt: true },
  });

  // Best-effort real-time push to the recipient's tenant-scoped channel.
  void publishNotification(input.tenantId, input.recipientUserId, {
    id: notification.id,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
    createdAt: notification.createdAt.toISOString(),
  });

  return { id: notification.id };
}
