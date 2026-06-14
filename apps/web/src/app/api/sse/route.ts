// Non-tRPC: Server-Sent Events for real-time in-app notifications.
// Auth is verified manually — SSE cannot go through tRPC transport.
//
// D7: this streams the Valkey channel `notif:<tenantId>:<userId>` to the
// connected client. A notification published by `createNotification` (see
// server/notifications/valkey.ts) arrives here and is forwarded as an SSE
// `data:` frame. The bell client refetches `notification.list` on each frame.
//
// A dedicated subscriber connection is used per request: an ioredis connection
// in subscriber mode cannot issue other commands, so it must not be the shared
// publisher singleton.
import { type NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import { auth } from "@/server/auth";
import { notificationChannel } from "@/server/notifications/valkey";

// REDIS_URL is validated at the app boundary by `@/env`; read process.env here
// (same as apps/worker) to keep the transport layer free of import-time env
// validation.
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// SSE must run on the Node runtime (ioredis uses Node net sockets) and never be
// statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const tenantId = session?.user?.tenantId;
  if (userId === undefined || userId === "" || tenantId === undefined || tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = notificationChannel(tenantId, userId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string): void => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* connection already closed */
        }
      };

      send(": connected\n\n");

      // Dedicated subscriber connection for this client.
      const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: false });
      sub.on("error", () => {
        /* fail-soft: client still has poll-based refetch as a fallback */
      });
      void sub.subscribe(channel);
      sub.on("message", (_chan, message) => {
        send(`data: ${message}\n\n`);
      });

      // Heartbeat every 25 s to keep the connection alive through proxies.
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        void sub.quit().catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
