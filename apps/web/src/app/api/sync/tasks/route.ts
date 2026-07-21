// Non-tRPC: manual auth required (security.md L11) — read-only DOWN-SYNC
// endpoint feeding the mobile Tasks screen. Mirrors the security posture of
// /api/sync/[entityType]/route.ts and /api/sync/expense-categories/route.ts:
//   - Manual bearer auth via resolveSyncBearerContext (tRPC bypassed).
//   - RBAC via the SAME `tasks` matrix feature the web tRPC surface uses.
//   - Rate-limited via the `mobile_sync` tier, keyed by userId (post-auth).
//   - Tenant-scoped AND restricted to the caller's own assignments.
//   - No demo-tenant guard — this is a read, not a write.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";
import { serializeTaskForPull } from "@/server/sync/serializers/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth — generic-401 contract, no enumeration surface.
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (tasks pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  try {
    // 2. Rate limit — keyed by a real userId, not a spoofable header.
    try {
      rateLimiters.mobile_sync.check(bearer.userId);
    } catch (err) {
      if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
        return jsonError(429, "Too many requests. Try again later.");
      }
      throw err;
    }

    // 3. RBAC — same matrix feature/action the web tasks list uses.
    const allowed = await checkMatrixGrant({
      tenantId: bearer.tenantId,
      roleId: bearer.roleId,
      feature: "tasks",
      action: "view",
    });
    if (!allowed) {
      return jsonError(403, "Access denied.");
    }

    // 4. Tenant-scoped + assigned-to-me. Task has no `assignedTo` scalar;
    //    assignment lives in the TaskAssignment join table.
    // orderBy is REQUIRED: down-sync full-replaces the local table, so an
    // unordered `take: 500` would let Postgres return an arbitrary window of
    // rows — any local row outside that window gets destroyed on the phone,
    // and a different arbitrary window on the next pull would flap rows in
    // and out. Ordering makes the truncation stable and predictable.
    const tasks = await prisma.task.findMany({
      where: {
        tenantId: bearer.tenantId,
        assignments: { some: { userId: bearer.userId } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 500,
    });

    return NextResponse.json({
      records: tasks.map((task) => serializeTaskForPull(task, bearer.userId)),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected error (tasks pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
}
