// Non-tRPC: manual auth required (security.md L11) — read-only endpoint
// backing the mobile expense-creation category PICKER (owner decision: the
// mobile client sends a real `expenseCategoryId`, resolved from this list,
// rather than free-text). Mirrors the security posture of
// /api/sync/[entityType]/route.ts:
//   - Manual bearer auth via resolveSyncBearerContext (tRPC bypassed).
//   - RBAC enforced via the SAME `expenses` matrix tRPC uses (`view`),
//     matching `expensesViewProcedure.categories` on the tRPC surface.
//   - Rate-limited via the `mobile_sync` tier, keyed by userId (post-auth).
//   - Tenant-scoped: only the caller's own tenant's ACTIVE categories.
//   - No demo-tenant guard needed — this is a read, not a write.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth — same generic-401 contract as the sync route.
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (expense-categories)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  // 2. Rate limit — keyed by a real userId, not a spoofable header.
  try {
    rateLimiters.mobile_sync.check(bearer.userId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return jsonError(429, "Too many requests. Try again later.");
    }
    throw err;
  }

  // 3. RBAC — same matrix + feature the web `expenses.categories` query
  //    uses, action "view".
  const allowed = await checkMatrixGrant({
    tenantId: bearer.tenantId,
    roleId: bearer.roleId,
    feature: "expenses",
    action: "view",
  });
  if (!allowed) {
    return jsonError(403, "Access denied.");
  }

  // 4. Tenant-scoped, active-only category list for the picker.
  const categories = await prisma.expenseCategory.findMany({
    where: { tenantId: bearer.tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(categories);
}
