// receipt-route.test.ts — POST /api/sync/expenses/[serverId]/receipt
//
// Covers:
//   (a) auth failure -> 401
//   (b) auth throws unexpectedly -> 500, generic message, error logged
//   (c) rate-limited -> 429
//   (d) demo tenant -> 403
//   (e) RBAC denied -> 403
//   (f) malformed serverId (not a cuid) -> 404 (never leaks id occupancy)
//   (g) expense not found / cross-tenant -> 404, upload never attempted
//   (h) already has a receipt -> 200 no-op, upload never attempted (idempotent)
//   (i) non-image contentType -> 400, upload never attempted
//   (j) oversize bodyBase64 -> 400, upload never attempted
//   (k) happy path -> 200, performDirectUpload called with entityType
//       "expense" + the expense id, expense.receiptUrl updated to the
//       returned storageKey
//   (l) performDirectUpload throws FORBIDDEN (quota) -> 403, expense not updated
//   (m) performDirectUpload throws BAD_REQUEST (backend failure) -> 400, expense not updated

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";
import type * as DemoGuardModule from "@/server/sync/demo-guard";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockAssertNotDemoTenant,
  mockCheckMatrixGrant,
  mockExpenseFindFirst,
  mockExpenseUpdate,
  mockPerformDirectUpload,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockAssertNotDemoTenant: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockExpenseFindFirst: vi.fn(),
  mockExpenseUpdate: vi.fn(),
  mockPerformDirectUpload: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/server/sync/bearer-context", () => ({
  resolveSyncBearerContext: mockResolveSyncBearerContext,
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    mobile_sync: { check: mockRateLimitCheck },
  },
}));

vi.mock("@/server/sync/demo-guard", async () => {
  const actual = await vi.importActual<typeof DemoGuardModule>("@/server/sync/demo-guard");
  return {
    ...actual,
    assertNotDemoTenant: mockAssertNotDemoTenant,
  };
});

vi.mock("@/server/sync/matrix-check", () => ({
  checkMatrixGrant: mockCheckMatrixGrant,
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    expense: { findFirst: mockExpenseFindFirst, update: mockExpenseUpdate },
  },
}));

vi.mock("@/server/storage/direct-upload", () => ({
  performDirectUpload: mockPerformDirectUpload,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError },
}));

import { POST } from "../receipt/route";

const BEARER_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roleId: "role-1",
  roles: ["Operator"],
  isDemoTenant: false,
};

const VALID_EXPENSE_ID = "clexpense000000000000001";

function makeRequest(
  serverId: string,
  body: Record<string, unknown> | null = {
    filename: "receipt.jpg",
    contentType: "image/jpeg",
    bodyBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
  },
): { req: NextRequest; params: Promise<{ serverId: string }> } {
  const req = new NextRequest(
    `http://localhost/api/sync/expenses/${serverId}/receipt`,
    {
      method: "POST",
      ...(body !== null ? { body: JSON.stringify(body) } : {}),
    },
  );
  return { req, params: Promise.resolve({ serverId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockAssertNotDemoTenant.mockImplementation((isDemo: boolean) => {
    if (isDemo) {
      throw new Error("should use real DemoTenantWriteError via importActual");
    }
  });
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockExpenseFindFirst.mockResolvedValue({ id: VALID_EXPENSE_ID, receiptUrl: null });
  mockExpenseUpdate.mockResolvedValue({ id: VALID_EXPENSE_ID, receiptUrl: "acme/expense/x/receipt.jpg" });
  mockPerformDirectUpload.mockResolvedValue({
    id: "clattach00000000000001",
    storageKey: "acme/expense/x/receipt.jpg",
    backend: "telegram",
  });
});

describe("POST /api/sync/expenses/[serverId]/receipt", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns a generic 500 when bearer resolution throws unexpectedly", async () => {
    mockResolveSyncBearerContext.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(429);
  });

  it("returns 403 for a demo tenant", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce({ ...BEARER_CTX, isDemoTenant: true });
    const actual = await vi.importActual<typeof DemoGuardModule>("@/server/sync/demo-guard");
    mockAssertNotDemoTenant.mockImplementationOnce((isDemo: boolean) => {
      actual.assertNotDemoTenant(isDemo);
    });
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockExpenseFindFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when the RBAC matrix denies the grant", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "expenses",
      action: "create",
    });
    expect(mockExpenseFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed (non-cuid) serverId, never touching the DB", async () => {
    const { req, params } = makeRequest("not-a-cuid");
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    expect(mockExpenseFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense does not exist or belongs to another tenant", async () => {
    mockExpenseFindFirst.mockResolvedValueOnce(null);
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    expect(mockExpenseFindFirst).toHaveBeenCalledWith({
      where: { id: VALID_EXPENSE_ID, tenantId: "tenant-1" },
      select: { id: true, receiptUrl: true },
    });
    expect(mockPerformDirectUpload).not.toHaveBeenCalled();
  });

  it("is idempotent: a retried upload for an expense that already has a receipt is a no-op", async () => {
    mockExpenseFindFirst.mockResolvedValueOnce({
      id: VALID_EXPENSE_ID,
      receiptUrl: "acme/expense/x/already-there.jpg",
    });
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; storageKey: string };
    expect(body).toEqual({ ok: true, storageKey: "acme/expense/x/already-there.jpg" });
    expect(mockPerformDirectUpload).not.toHaveBeenCalled();
    expect(mockExpenseUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-image contentType at the Zod layer, never attempting an upload", async () => {
    const { req, params } = makeRequest(VALID_EXPENSE_ID, {
      filename: "receipt.pdf",
      contentType: "application/pdf",
      bodyBase64: Buffer.from("x").toString("base64"),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(mockPerformDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects an oversize bodyBase64, never attempting an upload", async () => {
    const { req, params } = makeRequest(VALID_EXPENSE_ID, {
      filename: "receipt.jpg",
      contentType: "image/jpeg",
      bodyBase64: "a".repeat(72_000_001),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(mockPerformDirectUpload).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body", async () => {
    const req = new NextRequest(`http://localhost/api/sync/expenses/${VALID_EXPENSE_ID}/receipt`, {
      method: "POST",
      body: "{not json",
    });
    const res = await POST(req, { params: Promise.resolve({ serverId: VALID_EXPENSE_ID }) });
    expect(res.status).toBe(400);
  });

  it("happy path: uploads via performDirectUpload with entityType 'expense' + the expense id, and sets receiptUrl", async () => {
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; storageKey: string };
    expect(body).toEqual({ ok: true, storageKey: "acme/expense/x/receipt.jpg" });

    expect(mockPerformDirectUpload).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      tenantSlug: "acme",
      userId: "user-1",
      entityType: "expense",
      entityId: VALID_EXPENSE_ID,
      filename: "receipt.jpg",
      contentType: "image/jpeg",
      bodyBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
    });

    expect(mockExpenseUpdate).toHaveBeenCalledWith({
      where: { id: VALID_EXPENSE_ID },
      data: { receiptUrl: "acme/expense/x/receipt.jpg" },
    });
  });

  it("maps a FORBIDDEN (quota) error from performDirectUpload to 403 and never updates the expense", async () => {
    mockPerformDirectUpload.mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Storage quota exceeded." }),
    );
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockExpenseUpdate).not.toHaveBeenCalled();
  });

  it("maps a BAD_REQUEST (backend failure) error from performDirectUpload to 400 and never updates the expense", async () => {
    mockPerformDirectUpload.mockRejectedValueOnce(
      new TRPCError({ code: "BAD_REQUEST", message: "Upload failed." }),
    );
    const { req, params } = makeRequest(VALID_EXPENSE_ID);
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(mockExpenseUpdate).not.toHaveBeenCalled();
  });
});
