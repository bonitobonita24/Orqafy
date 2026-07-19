/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * dtr_entries mobile-sync handler tests.
 *
 * Covers:
 *  1. clock-in (create): resolves employee from ctx.userId, creates record,
 *     writes audit log, records the sync op, returns serverId
 *  2. clock-in: no linked Employee record -> BAD_REQUEST
 *  3. clock-in: same-day collision -> idempotent success (existing id, no
 *     new AttendanceRecord row created)
 *  4. clock-out (update): resolves the AttendanceRecord via the create op's
 *     clientId->serverId mapping, updates, writes audit log, records op
 *  5. clock-out: no matching create op -> BAD_REQUEST
 *  6. clock-out: mapped record belongs to a different tenant -> NOT_FOUND
 *  7. clock-out: already clocked out -> idempotent success, no double-write
 *  8. tenant isolation: employee row belongs to a different tenant -> BAD_REQUEST
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEmployeeFindUnique,
  mockAttendanceFindFirst,
  mockAttendanceFindUnique,
  mockAttendanceCreate,
  mockAttendanceUpdate,
  mockAuditLogCreate,
  mockSyncOpCreate,
  mockSyncOpFindUnique,
} = vi.hoisted(() => ({
  mockEmployeeFindUnique: vi.fn(),
  mockAttendanceFindFirst: vi.fn(),
  mockAttendanceFindUnique: vi.fn(),
  mockAttendanceCreate: vi.fn(),
  mockAttendanceUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockSyncOpCreate: vi.fn(),
  mockSyncOpFindUnique: vi.fn(),
}));

function makeMockDb() {
  return {
    employee: { findUnique: mockEmployeeFindUnique },
    attendanceRecord: {
      findFirst: mockAttendanceFindFirst,
      findUnique: mockAttendanceFindUnique,
      create: mockAttendanceCreate,
      update: mockAttendanceUpdate,
    },
    auditLog: { create: mockAuditLogCreate },
    mobileSyncOp: { create: mockSyncOpCreate, findUnique: mockSyncOpFindUnique },
  };
}

vi.mock("@orqafy/db", () => {
  const mockDb = makeMockDb();
  return {
    prisma: {
      ...mockDb,
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

import { dtrEntriesHandler } from "@/server/sync/handlers/dtr-entries";

const CTX = { tenantId: "tenant-A", userId: "user-1", roles: ["Operator"], roleId: "role-1" };

const EMPLOYEE = { id: "emp-1", tenantId: "tenant-A", userId: "user-1" };

const ATTENDANCE = {
  id: "att-1",
  tenantId: "tenant-A",
  employeeId: "emp-1",
  date: new Date(),
  clockIn: new Date("2026-07-19T08:00:00Z"),
  clockOut: null as Date | null,
  status: "present",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSyncOpFindUnique.mockResolvedValue(null);
});

describe("dtrEntriesHandler — clock-in (create)", () => {
  it("resolves the employee, creates the record, writes audit + sync-op, returns serverId", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockAttendanceFindFirst.mockResolvedValueOnce(null);
    mockAttendanceCreate.mockResolvedValueOnce(ATTENDANCE);

    const result = await dtrEntriesHandler({
      ctx: CTX,
      action: "create",
      clientId: "local-1",
      data: { lat: 14.5995, lng: 120.9842 },
    });

    expect(result).toEqual({ serverId: "att-1" });
    expect(mockEmployeeFindUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    const createData = (mockAttendanceCreate.mock.calls[0] as any)[0].data;
    expect(createData.tenantId).toBe("tenant-A");
    expect(createData.employeeId).toBe("emp-1");
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
  });

  it("throws BAD_REQUEST when the caller has no linked Employee record", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(null);

    await expect(
      dtrEntriesHandler({ ctx: CTX, action: "create", clientId: "local-1", data: { lat: 0, lng: 0 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockAttendanceCreate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the Employee record belongs to a different tenant", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce({ ...EMPLOYEE, tenantId: "tenant-B" });

    await expect(
      dtrEntriesHandler({ ctx: CTX, action: "create", clientId: "local-1", data: { lat: 0, lng: 0 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("treats a same-day collision as idempotent success — returns existing id, never creates a new row", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockAttendanceFindFirst.mockResolvedValueOnce(ATTENDANCE); // already clocked in today

    const result = await dtrEntriesHandler({
      ctx: CTX,
      action: "create",
      clientId: "local-1",
      data: { lat: 0, lng: 0 },
    });

    expect(result).toEqual({ serverId: "att-1" });
    expect(mockAttendanceCreate).not.toHaveBeenCalled();
    expect(mockSyncOpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-A",
        userId: "user-1",
        entityType: "dtr_entries",
        clientId: "local-1",
        action: "create",
        serverId: "att-1",
      }),
    });
  });
});

describe("dtrEntriesHandler — clock-out (update)", () => {
  it("resolves the record via the create op's clientId, updates, writes audit + sync-op", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockSyncOpFindUnique.mockResolvedValueOnce({ serverId: "att-1" });
    mockAttendanceFindUnique.mockResolvedValueOnce(ATTENDANCE);
    mockAttendanceUpdate.mockResolvedValueOnce({ ...ATTENDANCE, clockOut: new Date() });

    const result = await dtrEntriesHandler({
      ctx: CTX,
      action: "update",
      clientId: "local-1",
      data: { lat: 14.5995, lng: 120.9842 },
    });

    expect(result).toEqual({ serverId: "att-1" });
    expect(mockSyncOpFindUnique).toHaveBeenCalledWith({
      where: {
        tenantId_userId_entityType_clientId_action: {
          tenantId: "tenant-A",
          userId: "user-1",
          entityType: "dtr_entries",
          clientId: "local-1",
          action: "create",
        },
      },
      select: { serverId: true },
    });
    expect(mockAttendanceUpdate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
  });

  it("throws BAD_REQUEST when no matching create op exists for this clientId", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockSyncOpFindUnique.mockResolvedValueOnce(null);

    await expect(
      dtrEntriesHandler({ ctx: CTX, action: "update", clientId: "local-unknown", data: { lat: 0, lng: 0 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockAttendanceFindUnique).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the mapped record belongs to a different tenant", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockSyncOpFindUnique.mockResolvedValueOnce({ serverId: "att-1" });
    mockAttendanceFindUnique.mockResolvedValueOnce({ ...ATTENDANCE, tenantId: "tenant-B" });

    await expect(
      dtrEntriesHandler({ ctx: CTX, action: "update", clientId: "local-1", data: { lat: 0, lng: 0 } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns idempotent success without a double-write when already clocked out", async () => {
    mockEmployeeFindUnique.mockResolvedValueOnce(EMPLOYEE);
    mockSyncOpFindUnique.mockResolvedValueOnce({ serverId: "att-1" });
    mockAttendanceFindUnique.mockResolvedValueOnce({
      ...ATTENDANCE,
      clockOut: new Date("2026-07-19T17:00:00Z"),
    });

    const result = await dtrEntriesHandler({
      ctx: CTX,
      action: "update",
      clientId: "local-1",
      data: { lat: 0, lng: 0 },
    });

    expect(result).toEqual({ serverId: "att-1" });
    expect(mockAttendanceUpdate).not.toHaveBeenCalled();
    expect(mockSyncOpCreate).not.toHaveBeenCalled();
  });
});
