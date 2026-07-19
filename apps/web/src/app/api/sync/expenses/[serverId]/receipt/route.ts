// Non-tRPC: manual auth required (security.md L11) — the receipt-image
// upload leg of mobile expense sync. This is a SECOND call, separate from
// POST /api/sync/expenses (which creates the expense with `receiptUrl:
// null` — see server/sync/handlers/expenses.ts): the mobile client syncs
// the expense first to obtain a server id, then — once it has a compressed
// local receipt photo ready — POSTs it here. Keeping receipt upload
// separate means a receipt failure (bad connection mid-upload, quota,
// backend hiccup) never blocks the expense record itself from syncing.
//
// Reuses the SAME quota-check / backend-resolve / Attachment + MediaObject
// + audit-log write path as the web tRPC `storage.uploadDirect` mutation
// (server/trpc/routers/storage.ts), via the shared
// `performDirectUpload` (server/storage/direct-upload.ts).
//
// Security posture — mirrors /api/sync/[entityType]/route.ts exactly:
//   - Manual bearer auth via resolveSyncBearerContext (tRPC bypassed).
//   - Rate-limited via the `mobile_sync` tier, keyed by userId (post-auth).
//   - Demo tenants are read-only here exactly as they are over tRPC.
//   - RBAC enforced via the SAME data-driven matrix tRPC uses — feature
//     "expenses", action "create" (mirrors SYNC_MATRIX_ACTION.expenses.create
//     in server/sync/handlers.ts: mobile expense creation is gated on
//     expenses:create, and attaching that expense's receipt is the same
//     capability, not a separate "update" grant).
//   - The `[serverId]` path segment must resolve to a REAL Expense owned by
//     the caller's tenant — cross-tenant / non-existent ids both return the
//     SAME generic 404 (never 403 — that would leak id occupancy).
//   - Idempotent: if the expense already has a receipt attached
//     (`receiptUrl !== null`), a retried POST is a no-op that returns the
//     existing key without re-uploading or creating a duplicate Attachment.
//   - Errors are mapped to generic messages — no Prisma/internal detail
//     ever reaches the client (security.md "PRODUCTION ERROR HANDLING").
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@orqafy/db";
import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { assertNotDemoTenant, DemoTenantWriteError } from "@/server/sync/demo-guard";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { performDirectUpload } from "@/server/storage/direct-upload";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";

// Node runtime required: Prisma + the storage backend (Telegram fetch / S3
// SDK) are not supported on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receipts are photos — restrict to the 3 image types the storage layer's
// magic-byte check (packages/storage/src/magic.ts) can verify, rather than
// the full `uploadDirect` entity allow-list. Same 72_000_000-char cap as
// `uploadDirect`'s `bodyBase64` (server/trpc/routers/storage.ts).
const receiptUploadSchema = z
  .object({
    filename: z.string().min(1).max(255),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    bodyBase64: z.string().min(1).max(72_000_000),
  })
  .strict();

const cuidSchema = z.string().cuid();

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
): Promise<NextResponse> {
  const { serverId } = await params;

  // 1. Auth — resolves tenant/role fresh from the DB. Generic 401 on any
  //    failure, same contract as the sibling sync routes.
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (expense receipt)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  // 2. Rate limit — after auth so it's keyed by a real userId.
  try {
    rateLimiters.mobile_sync.check(bearer.userId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return jsonError(429, "Too many requests. Try again later.");
    }
    throw err;
  }

  // 3. Demo tenants are read-only, identically to every tRPC writeProcedure.
  try {
    assertNotDemoTenant(bearer.isDemoTenant);
  } catch (err) {
    if (err instanceof DemoTenantWriteError) {
      return jsonError(403, err.message);
    }
    throw err;
  }

  // 4. RBAC — same matrix + feature the mobile expense-creation handler
  //    uses (SYNC_MATRIX_ACTION.expenses.create), action "create".
  const allowed = await checkMatrixGrant({
    tenantId: bearer.tenantId,
    roleId: bearer.roleId,
    feature: "expenses",
    action: "create",
  });
  if (!allowed) {
    return jsonError(403, "Access denied.");
  }

  // 5. The path segment must resolve to a real Expense owned by this
  //    tenant. A malformed id and a genuinely-missing/cross-tenant id both
  //    fall through to the SAME 404 below.
  const idCheck = cuidSchema.safeParse(serverId);
  if (!idCheck.success) {
    return jsonError(404, "Not found");
  }

  let expense: { id: string; receiptUrl: string | null } | null;
  try {
    expense = await prisma.expense.findFirst({
      where: { id: idCheck.data, tenantId: bearer.tenantId },
      select: { id: true, receiptUrl: true },
    });
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected error looking up expense (receipt)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (expense === null) {
    return jsonError(404, "Not found");
  }

  // 6. Idempotency — a retried upload for an expense that already has a
  //    receipt attached is a no-op: return the existing key without
  //    re-uploading or creating a duplicate Attachment/MediaObject. This is
  //    simpler than a MobileSyncOp ledger entry here: unlike `create`
  //    (which needs a client-generated id to dedupe on before any server id
  //    exists), a receipt attaches to an ALREADY-synced expense, so the
  //    expense's own `receiptUrl` column IS the natural idempotency marker.
  if (expense.receiptUrl !== null) {
    return NextResponse.json({ ok: true, storageKey: expense.receiptUrl });
  }

  // 7. Parse + validate body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }
  const parsed = receiptUploadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(400, "Invalid request body.");
  }

  // 8. Upload — shared with the web tRPC `storage.uploadDirect` mutation.
  let result;
  try {
    result = await performDirectUpload({
      tenantId: bearer.tenantId,
      tenantSlug: bearer.tenantSlug,
      userId: bearer.userId,
      entityType: "expense",
      entityId: expense.id,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      bodyBase64: parsed.data.bodyBase64,
    });
  } catch (err) {
    if (err instanceof TRPCError) {
      const status = err.code === "FORBIDDEN" ? 403 : 400;
      return jsonError(status, err.message);
    }
    logger.error({ err }, "mobile-sync: unexpected error uploading expense receipt");
    return jsonError(500, "Something went wrong. Please try again.");
  }

  // 9. Attach the uploaded key to the expense. Deliberately a separate write
  //    from performDirectUpload's own transaction — the upload (external
  //    network I/O) can never be transactional with a DB write anyway (see
  //    direct-upload.ts's comment), and step 6 above makes THIS write itself
  //    idempotent on retry (a second POST after this line succeeds is a
  //    pure no-op; a crash before this line lands is caught by the
  //    orphan-Attachment note below, which is an accepted, documented gap
  //    shared with every other performDirectUpload caller).
  await prisma.expense.update({
    where: { id: expense.id },
    data: { receiptUrl: result.storageKey },
  });

  return NextResponse.json({ ok: true, storageKey: result.storageKey });
}
