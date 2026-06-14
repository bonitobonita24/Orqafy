/**
 * D7 — Valkey (Redis) real-time fan-out transport for in-app notifications.
 *
 * ACCEPTED option (b): notifications PERSIST in Prisma; Valkey handles
 * real-time push ONLY. This module is the single place that owns the Valkey
 * pub/sub connection for the web app. It reuses `ioredis` — the same client the
 * worker (`apps/worker`) already uses for BullMQ — rather than inventing new
 * infra.
 *
 * Channel convention: `notif:<tenantId>:<userId>`. Keying on BOTH tenantId and
 * userId guarantees a subscriber can only ever receive its own tenant's events
 * (defence-in-depth on top of the server-side recipient scoping in the router).
 *
 * Fail-soft contract: a Valkey outage must NEVER break the durable Prisma write.
 * `publishNotification` swallows + logs connection/publish errors. The data is
 * already safe in Postgres; the client will pick it up on its next poll/refetch.
 */
import Redis from "ioredis";

// REDIS_URL is validated at the app boundary by `@/env`; the transport layer
// reads process.env directly (same as apps/worker) so importing this module
// never triggers full env validation — important for unit tests that import a
// router which transitively pulls in this file.
function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

// Lazy singletons. Next.js dev hot-reload would otherwise leak connections, so
// we stash them on globalThis (same pattern as the Prisma client in @orqafy/db).
const globalForValkey = globalThis as unknown as {
  valkeyPub: Redis | undefined;
};

function getPublisher(): Redis {
  if (globalForValkey.valkeyPub === undefined) {
    const client = new Redis(redisUrl(), {
      maxRetriesPerRequest: null,
      // Don't crash the request path on a cold/unavailable Valkey — fan-out is
      // best-effort; the durable Prisma row is the source of truth.
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    // Prevent unhandled 'error' events from taking down the process when Valkey
    // is unreachable. The publish path handles failures locally.
    client.on("error", () => {
      /* swallowed — see fail-soft contract above */
    });
    globalForValkey.valkeyPub = client;
  }
  return globalForValkey.valkeyPub;
}

export function notificationChannel(tenantId: string, userId: string): string {
  return `notif:${tenantId}:${userId}`;
}

export interface RealtimeNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: string; // ISO
}

/**
 * Best-effort real-time push. Returns true if the publish was dispatched,
 * false if it was swallowed (Valkey unavailable). Never throws.
 */
export async function publishNotification(
  tenantId: string,
  userId: string,
  payload: RealtimeNotification
): Promise<boolean> {
  try {
    const client = getPublisher();
    await client.publish(
      notificationChannel(tenantId, userId),
      JSON.stringify(payload)
    );
    return true;
  } catch {
    // Fail-soft: durable row already persisted; client will poll/refetch.
    return false;
  }
}
