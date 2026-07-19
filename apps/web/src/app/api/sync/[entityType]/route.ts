// Non-tRPC: manual auth required (security.md L11) — mobile push-sync
// endpoint. The Expo app queues offline mutations locally (WatermelonDB)
// and POSTs them here on reconnect (apps/mobile/src/sync/queue.ts).
//
// Security posture:
//   - Manual bearer auth via resolveSyncBearerContext (tRPC bypassed — no
//     middleware chain). Verifies the Authorization: Bearer <jwt> header
//     via the REAL mobile-JWT verifier (server/auth/mobile-jwt.ts, signed
//     with the dedicated MOBILE_JWT_SECRET) and re-resolves
//     tenantId/roleId/roles/isDemoTenant fresh from the DB by userId —
//     never trusted from the request body, and stale (deactivated user /
//     bumped securityVersion) tokens are rejected — same contract as the
//     tRPC bearer path (server/trpc/context.ts).
//   - RBAC enforced via the SAME data-driven matrix tRPC uses
//     (checkMatrixGrant → hasPermission), keyed off entityType→FeatureKey.
//   - Demo tenants are read-only here exactly as they are over tRPC
//     (assertNotDemoTenant).
//   - Idempotent: (tenantId, userId, entityType, clientId, action) is a
//     unique key (MobileSyncOp) — a retried POST returns the previously
//     stored serverId without re-running the mutation.
//   - `delete` is out of scope for v1 — rejected with 400 before reaching
//     any handler.
//   - Errors are mapped to generic messages — no Prisma/internal detail
//     ever reaches the client (security.md "PRODUCTION ERROR HANDLING").
//   - Rate-limited via the `mobile_sync` tier, keyed by userId (post-auth).

import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { assertNotDemoTenant, DemoTenantWriteError } from "@/server/sync/demo-guard";
import {
  ENTITY_FEATURE_MAP,
  isSyncEntityType,
  SYNC_MATRIX_ACTION,
  SyncHandlerNotImplementedError,
  syncHandlers,
  type SyncAction,
} from "@/server/sync/handlers";
import { findSyncOp } from "@/server/sync/idempotency";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";

// Node runtime required: Prisma is not supported on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepts `delete` at the schema level (it IS a valid client-side action —
// apps/mobile's WatermelonDB sync queue can emit it) purely so the route can
// tell "malformed body" (400, generic) apart from "delete, deliberately
// unsupported" (400, specific message) below — never silently coerced away.
const requestSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]),
    entityId: z.string().min(1),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityType: string }> },
): Promise<NextResponse> {
  const { entityType } = await params;

  if (!isSyncEntityType(entityType)) {
    return jsonError(404, "Unknown sync entity type.");
  }

  // 1. Auth — resolves tenant/role fresh from the DB. Generic 401 on any
  //    failure (missing header, bad signature, expired, deactivated user,
  //    stale securityVersion). resolveSyncBearerContext never throws.
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  // 2. Rate limit — after auth so it's keyed by a real userId, not a
  //    spoofable header.
  try {
    rateLimiters.mobile_sync.check(bearer.userId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return jsonError(429, "Too many requests. Try again later.");
    }
    throw err;
  }

  // 3. Parse + validate body. `delete` is a valid client-side action
  //    (WatermelonDB sync queue) but explicitly rejected server-side for
  //    v1 — 400, not silently ignored, so the mobile client's retry logic
  //    doesn't spin forever on a permanently-unsupported action.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(400, "Invalid request body.");
  }
  if (parsed.data.action === "delete") {
    return jsonError(400, "The delete action is not supported.");
  }
  const action: SyncAction = parsed.data.action;
  const clientId = parsed.data.entityId;
  const { data } = parsed.data;

  // 4. Demo tenants are read-only, identically to every tRPC writeProcedure.
  try {
    assertNotDemoTenant(bearer.isDemoTenant);
  } catch (err) {
    if (err instanceof DemoTenantWriteError) {
      return jsonError(403, err.message);
    }
    throw err;
  }

  // 5. RBAC — mirror the EXACT web tRPC procedure gating (SYNC_MATRIX_ACTION),
  //    NOT the raw sync action. DTR clock-out (`update`) is self-service →
  //    dtr:create (web parity), never dtr:update (approve/reject).
  const feature = ENTITY_FEATURE_MAP[entityType];
  const matrixAction = SYNC_MATRIX_ACTION[entityType][action];
  if (matrixAction === undefined) {
    return jsonError(400, `The ${action} action is not supported for ${entityType}.`);
  }
  const allowed = await checkMatrixGrant({
    tenantId: bearer.tenantId,
    roleId: bearer.roleId,
    feature,
    action: matrixAction,
  });
  if (!allowed) {
    return jsonError(403, "Access denied.");
  }

  // 6. Idempotency short-circuit — a retried POST for an already-applied
  //    op returns the stored serverId without touching the handler.
  const existingServerId = await findSyncOp({
    tenantId: bearer.tenantId,
    userId: bearer.userId,
    entityType,
    clientId,
    action,
  });
  if (existingServerId !== null) {
    return NextResponse.json({ serverId: existingServerId });
  }

  // 7. Dispatch to the per-entity handler (stubbed until W2/W3 land).
  try {
    const handler = syncHandlers[entityType];
    const result = await handler({
      ctx: {
        tenantId: bearer.tenantId,
        userId: bearer.userId,
        roles: bearer.roles,
        roleId: bearer.roleId,
      },
      action,
      clientId,
      data,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SyncHandlerNotImplementedError) {
      return jsonError(501, "This sync entity is not implemented yet.");
    }
    logger.error({ err, entityType, action }, "mobile-sync: handler error");
    return jsonError(500, "Something went wrong. Please try again.");
  }
}
