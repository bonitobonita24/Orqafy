// Mobile-sync handler for `dtr_entries` (attendance clock-in / clock-out).
// RBAC feature: "dtr" (ENTITY_FEATURE_MAP, handlers.ts) — the route already
// ran the matrix check against `action` ("create" | "update") before this
// handler is dispatched; see the RBAC-grant finding in the worker's report
// re: `dtr:update` coverage for non-HR mobile roles.
//
// Reuses the SAME business rules as the `dtr` tRPC router
// (server/trpc/routers/dtr.ts attendanceClockIn/attendanceClockOut) —
// re-implemented here (not extracted into a shared function) because the
// router's procedures are tightly coupled to tRPC's writeProcedure/ctx
// shape and a clean extraction would have required changing their call
// signature, risking drift in the router's own tests. The write logic
// below is intentionally a line-for-line mirror of the router's.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma, writeAuditLog } from "@orqafy/db";
import type { SyncHandler } from "@/server/sync/handlers";
import { findSyncOp, recordSyncOp } from "@/server/sync/idempotency";

const ENTITY_TYPE = "dtr_entries";

const clockInSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

const clockOutSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

// Local-day window (UTC midnight) — matches dtr.ts startOfTodayUtc exactly,
// so a mobile clock-in and a web clock-in collide on the same @@unique
// ([employeeId, date]) row.
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function handleClockIn(
  ctx: { tenantId: string; userId: string },
  employeeId: string,
  clientId: string,
  data: unknown,
): Promise<{ serverId: string }> {
  const parsed = clockInSchema.parse(data);
  const today = startOfTodayUtc();

  // Same-day collision: unlike the web router (which throws CONFLICT), a
  // mobile push-sync retry — including one that shows up under a NEW local
  // clientId because the app restarted before the first attempt's response
  // landed — is exactly the "already applied" case. Treat it as idempotent
  // success: return the existing record's id (and record the op, so a
  // retry of THIS clientId short-circuits at the route next time, without
  // hitting this handler again).
  const existingToday = await prisma.attendanceRecord.findFirst({
    where: { employeeId, date: today },
  });
  if (existingToday) {
    await prisma.mobileSyncOp.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        entityType: ENTITY_TYPE,
        clientId,
        action: "create",
        serverId: existingToday.id,
      },
    });
    return { serverId: existingToday.id };
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.attendanceRecord.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId,
        date: today,
        clockIn: new Date(),
        clockInLat: parsed.lat,
        clockInLng: parsed.lng,
        status: "present",
      },
    });
    await writeAuditLog(tx, {
      userId: ctx.userId,
      action: "CREATE",
      entity: "AttendanceRecord",
      entityId: created.id,
      before: null,
      after: {
        employeeId: created.employeeId,
        date: created.date.toISOString(),
        clockIn: created.clockIn?.toISOString() ?? null,
        status: created.status,
      },
    });
    await recordSyncOp(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.userId, entityType: ENTITY_TYPE, clientId, action: "create" },
      created.id,
    );
    return { serverId: created.id };
  });
}

async function handleClockOut(
  ctx: { tenantId: string; userId: string },
  clientId: string,
  data: unknown,
): Promise<{ serverId: string }> {
  const parsed = clockOutSchema.parse(data);

  // The clock-out sync op is keyed to the SAME clientId as the clock-in
  // that opened this attendance session (the mobile client's local DTR-entry
  // row is stable across the create -> update lifecycle). Resolve the
  // server-side AttendanceRecord id via the recorded create op — NOT "any
  // open entry" (which would be ambiguous the moment an employee has more
  // than one open/attention-needed row historically).
  const createdServerId = await findSyncOp({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    entityType: ENTITY_TYPE,
    clientId,
    action: "create",
  });
  if (createdServerId === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No matching clock-in found for this entry.",
    });
  }

  const before = await prisma.attendanceRecord.findUnique({ where: { id: createdServerId } });
  if (!before || before.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Attendance record not found." });
  }

  if (before.clockOut != null) {
    // Already closed — a genuine data race (two update sync ops for the
    // same clientId in flight before either's transaction committed the
    // MobileSyncOp record the route's idempotency short-circuit relies on).
    // Return success without re-recording (the winning transaction already
    // recorded the op; recording again here would violate the op's unique
    // constraint).
    return { serverId: before.id };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.attendanceRecord.update({
      where: { id: before.id },
      data: {
        clockOut: new Date(),
        clockOutLat: parsed.lat,
        clockOutLng: parsed.lng,
      },
    });
    await writeAuditLog(tx, {
      userId: ctx.userId,
      action: "UPDATE",
      entity: "AttendanceRecord",
      entityId: updated.id,
      before: {
        employeeId: before.employeeId,
        clockOut: before.clockOut?.toISOString() ?? null,
        status: before.status,
      },
      after: {
        employeeId: updated.employeeId,
        clockOut: updated.clockOut?.toISOString() ?? null,
        status: updated.status,
      },
    });
    await recordSyncOp(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.userId, entityType: ENTITY_TYPE, clientId, action: "update" },
      updated.id,
    );
    return { serverId: updated.id };
  });
}

export const dtrEntriesHandler: SyncHandler = async ({ ctx, action, clientId, data }) => {
  // Resolve the caller's own Employee record — clock-in/clock-out are
  // always self-service (the mobile app never clocks in on behalf of
  // another employee). A user account with no linked Employee record is a
  // clear misconfiguration, not a silent no-op.
  const employee = await prisma.employee.findUnique({ where: { userId: ctx.userId } });
  if (!employee || employee.tenantId !== ctx.tenantId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No employee record is linked to this account.",
    });
  }

  if (action === "create") {
    return handleClockIn(ctx, employee.id, clientId, data);
  }
  return handleClockOut(ctx, clientId, data);
};
