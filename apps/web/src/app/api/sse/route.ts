// Non-tRPC: Server-Sent Events for real-time in-app notifications.
// Auth is verified manually — SSE cannot go through tRPC transport.
// Phase 8 will wire this to Valkey pub/sub keyed by userId.
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.id === "") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO(Phase 8): subscribe to Valkey channel `${userId}:notifications`
  //   and stream events to this SSE connection.
  const stream = new ReadableStream({
    start(controller) {
      // Send initial keep-alive comment
      controller.enqueue(": connected\n\n");

      // Heartbeat every 25 s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        controller.close();
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
