// route.test.ts — POST /api/sync/[entityType]
//
// Covers:
//   (a) unknown entityType -> 404 (auth never called)
//   (b) auth failure -> 401, generic message
//   (c) rate-limited -> 429
//   (d) delete action -> 400, specific message
//   (e) malformed body -> 400
//   (f) demo tenant -> 403
//   (g) RBAC denied -> 403
//   (h) idempotency hit -> 200 with stored serverId, handler never called
//   (i) unimplemented handler -> 501
//   (j) handler throws an unexpected error -> 500, generic message, error logged

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type * as DemoGuardModule from "@/server/sync/demo-guard";
import type * as HandlersModule from "@/server/sync/handlers";

// The mocked modules below: bearer-context.ts is mocked wholesale (it
// transitively imports @orqafy/db via prisma, which needs a running
// DATABASE_URL to even construct) — same reasoning applies to
// matrix-check/idempotency. demo-guard's real class is tiny and
// dependency-free so it's kept real via importActual.
const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockAssertNotDemoTenant,
  mockCheckMatrixGrant,
  mockFindSyncOp,
  mockLoggerError,
  mockHandler,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockAssertNotDemoTenant: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockFindSyncOp: vi.fn(),
  mockLoggerError: vi.fn(),
  mockHandler: vi.fn(),
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

vi.mock("@/server/sync/idempotency", () => ({
  findSyncOp: mockFindSyncOp,
}));

vi.mock("@/server/sync/handlers", async () => {
  const actual = await vi.importActual<typeof HandlersModule>("@/server/sync/handlers");
  return {
    ...actual,
    syncHandlers: {
      ...actual.syncHandlers,
      tasks: mockHandler,
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError },
}));

import { POST } from "../route";
import { DemoTenantWriteError } from "@/server/sync/demo-guard";
import { TRPCError } from "@trpc/server";

const BEARER_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roleId: "role-1",
  roles: ["Operator"],
  isDemoTenant: false,
};

function makeRequest(
  entityType: string,
  body: unknown,
): { req: NextRequest; params: Promise<{ entityType: string }> } {
  const req = new NextRequest(`http://localhost/api/sync/${entityType}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return { req, params: Promise.resolve({ entityType }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockAssertNotDemoTenant.mockImplementation((isDemo: boolean) => {
    if (isDemo) throw new DemoTenantWriteError();
  });
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockFindSyncOp.mockResolvedValue(null);
  mockHandler.mockResolvedValue({ serverId: "server-1" });
});

describe("POST /api/sync/[entityType]", () => {
  it("returns 404 for an unknown entity type without touching auth", async () => {
    const { req, params } = makeRequest("invoices", { action: "create", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    expect(mockResolveSyncBearerContext).not.toHaveBeenCalled();
  });

  it("returns a generic 401 when bearer auth fails (resolves null — missing/invalid/expired token, deactivated user, or stale securityVersion)", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns a generic 500 when bearer resolution throws unexpectedly (never a leaked error)", async () => {
    mockResolveSyncBearerContext.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
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
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(429);
  });

  it("rejects the delete action with 400", async () => {
    const { req, params } = makeRequest("tasks", { action: "delete", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/delete/i);
    expect(mockCheckMatrixGrant).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed body", async () => {
    const { req, params } = makeRequest("tasks", { action: "create" }); // missing entityId
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a demo tenant write", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce({ ...BEARER_CTX, isDemoTenant: true });
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockCheckMatrixGrant).not.toHaveBeenCalled();
  });

  it("returns 403 when the RBAC matrix denies the grant", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockFindSyncOp).not.toHaveBeenCalled();
  });

  it("short-circuits on an idempotency hit — returns stored serverId, never calls the handler", async () => {
    mockFindSyncOp.mockResolvedValueOnce("server-already-applied");
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { serverId: string };
    expect(body).toEqual({ serverId: "server-already-applied" });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 501 when a handler throws SyncHandlerNotImplementedError (all 3 entities are implemented as of this route's dispatch table, but the mapping must stay live for any future entity added to SYNC_ENTITY_TYPES ahead of its handler)", async () => {
    const actual = await vi.importActual<typeof HandlersModule>("@/server/sync/handlers");
    mockHandler.mockRejectedValueOnce(new actual.SyncHandlerNotImplementedError("tasks"));
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(501);
  });

  it("maps an unexpected handler error to a generic 500 and logs it", async () => {
    mockHandler.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("dispatches to the correct handler with the resolved ctx on success", async () => {
    const { req, params } = makeRequest("tasks", { action: "update", entityId: "c1", data: { title: "x" } });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith({
      ctx: {
        tenantId: "tenant-1",
        userId: "user-1",
        roles: ["Operator"],
        roleId: "role-1",
      },
      action: "update",
      clientId: "c1",
      data: { title: "x" },
    });
  });

  it("gates DTR clock-out (action=update) with dtr:create, NOT dtr:update (web self-service parity)", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false); // deny → 403 before the real handler runs
    const { req, params } = makeRequest("dtr_entries", { action: "update", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "dtr", action: "create" }),
    );
  });

  it("returns 400 for an unsupported (entityType, action) combo (tasks are pull-first — no mobile create)", async () => {
    const { req, params } = makeRequest("tasks", { action: "create", entityId: "c1", data: {} });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(mockCheckMatrixGrant).not.toHaveBeenCalled();
  });
});
