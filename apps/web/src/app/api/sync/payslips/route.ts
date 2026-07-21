// Non-tRPC: manual auth required (security.md L11) — read-only DOWN-SYNC
// endpoint feeding the mobile Payslips screen.
//
// PII NOTE: payslips are financial personal data. Tenant scoping ALONE is not
// sufficient — the query is additionally bound to the caller's own Employee
// record (Employee.userId is @unique), so a worker can never read a colleague's
// payslip within the same tenant. Draft payrolls are excluded: a worker must not
// see a payslip that is still being computed.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";
import { serializePayslipForPull } from "@/server/sync/serializers/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Payroll states whose payslips are final enough to show a worker. */
const RELEASED_PAYROLL_STATUSES = ["approved", "paid"] as const;

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (payslips pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  try {
    // 2. Rate limit
    try {
      rateLimiters.mobile_sync.check(bearer.userId);
    } catch (err) {
      if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
        return jsonError(429, "Too many requests. Try again later.");
      }
      throw err;
    }

    // 3. RBAC
    const allowed = await checkMatrixGrant({
      tenantId: bearer.tenantId,
      roleId: bearer.roleId,
      feature: "payroll",
      action: "view",
    });
    if (!allowed) {
      return jsonError(403, "Access denied.");
    }

    // 4. Tenant-scoped + own-employee-only + released payrolls only.
    //    Only the period fields are needed off Payroll — select, don't hydrate
    //    the whole financial record (PII minimization).
    // orderBy is REQUIRED: down-sync full-replaces the local table, so an
    // unordered `take: 500` would let Postgres return an arbitrary window of
    // rows — any local row outside that window gets destroyed on the phone,
    // and a different arbitrary window on the next pull would flap rows in
    // and out. Ordering makes the truncation stable and predictable.
    const payslips = await prisma.payslip.findMany({
      where: {
        tenantId: bearer.tenantId,
        employee: { userId: bearer.userId },
        payroll: { status: { in: [...RELEASED_PAYROLL_STATUSES] } },
      },
      include: {
        payroll: { select: { periodStart: true, periodEnd: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 500,
    });

    return NextResponse.json({
      records: payslips.map((slip) => serializePayslipForPull(slip, bearer.userId)),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected error (payslips pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
}
