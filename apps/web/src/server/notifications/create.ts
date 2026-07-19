/**
 * D7 — `createNotification`: the single server helper other code uses to emit an
 * in-app notification. It PERSISTS (Prisma, durable), FANS OUT in real-time
 * (Valkey, D7) and FANS OUT to the recipient's mobile devices (Expo push,
 * D-push) — all additive to the same durable row.
 *
 * Tenant correctness: the caller MUST pass `tenantId` (always from a trusted
 * server context — `ctx.tenantId`). The row is written with that tenant_id and
 * both fan-out paths are scoped to tenant+user, so a notification can never
 * leak across tenants.
 *
 * Both fan-outs are best-effort and never block the durable write (see
 * valkey.ts and push.ts) — this runs on the request path (no BullMQ worker
 * hop needed; both transports are already fire-and-forget + fail-soft).
 */
import { prisma } from "@orqafy/db";
import type { Prisma } from "@prisma/client";
import { publishNotification } from "./valkey";
import { sendPushToUser } from "./push";
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

  // Best-effort mobile push fan-out to every device the recipient registered.
  // Payload is kept minimal (ids only) — the device resolves detail on open.
  void sendPushToUser({
    tenantId: input.tenantId,
    userId: input.recipientUserId,
    title: notification.title,
    body: notification.body,
    data: { notificationId: notification.id, category: notification.category },
  });

  return { id: notification.id };
}
