/**
 * Phase 8 Batch 1 Item 2: platform-admin + tenant onboarding
 *
 * Covers:
 *  1. platformProcedure — rejects non-platform-owner sessions
 *  2. registration.validateSlug — format rules + reserved words
 *  3. registration.createTenant — creates Tenant record + dispatches BullMQ job
 *  4. platform.listTenants — requires Platform Owner role
 *  5. platform.suspendTenant — requires Platform Owner role
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Modules under test — none of these files exist yet (RED: import will fail)
// ---------------------------------------------------------------------------
import { platformProcedure } from "@/server/trpc/trpc";
import { platformRouter } from "@/server/trpc/routers/platform";
import { registrationRouter } from "@/server/trpc/routers/registration";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

// ---------------------------------------------------------------------------
// Mock heavy dependencies so unit tests don't need real DB / Redis
// ---------------------------------------------------------------------------
vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plan: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tenantAuditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
  createTenantPrisma: vi.fn(() => ({
    user: { findFirst: vi.fn() },
    $disconnect: vi.fn(),
  })),
}));

vi.mock("@orqafy/jobs", () => ({
  createQueues: vi.fn(() => ({
    tenantProvisioning: {
      add: vi.fn().mockResolvedValue({ id: "job-123" }),
    },
  })),
  QUEUE_NAMES: { TENANT_PROVISIONING: "tenant-provisioning" },
}));

// ---------------------------------------------------------------------------
// Context factory helpers
// ---------------------------------------------------------------------------
import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function platformOwnerCtx() {
  return {
    req: makeReq(),
    userId: "platform-user-1",
    roles: ["Platform Owner"],
    tenantSlug: "platform",
    tenantId: "platform-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function regularUserCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"],
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

// ---------------------------------------------------------------------------
// 1. platformProcedure access control
// ---------------------------------------------------------------------------
describe("platformProcedure", () => {
  it("exists as an export from trpc.ts", () => {
    expect(platformProcedure).toBeDefined();
  });

  it("allows Platform Owner through", async () => {
    const router = createTRPCRouter({
      ping: platformProcedure.query(() => "pong"),
    });
    const caller = createCallerFactory(router)(platformOwnerCtx());
    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("rejects a regular authenticated user with FORBIDDEN", async () => {
    const router = createTRPCRouter({
      ping: platformProcedure.query(() => "pong"),
    });
    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(caller.ping()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects an unauthenticated session with UNAUTHORIZED", async () => {
    const router = createTRPCRouter({
      ping: platformProcedure.query(() => "pong"),
    });
    const caller = createCallerFactory(router)(unauthenticatedCtx());
    await expect(caller.ping()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ---------------------------------------------------------------------------
// 2. registration.validateSlug
// ---------------------------------------------------------------------------
describe("registration.validateSlug", () => {
  const router = createTRPCRouter({ registration: registrationRouter });
  const getCaller = (ctx = unauthenticatedCtx()) =>
    createCallerFactory(router)(ctx);

  it("accepts a valid slug", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null);

    const result = await getCaller().registration.validateSlug({ slug: "acme-corp" });
    expect(result.available).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("rejects slugs shorter than 3 characters", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "ab" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3/);
  });

  it("rejects slugs longer than 63 characters", async () => {
    const long = "a".repeat(64);
    const result = await getCaller().registration.validateSlug({ slug: long });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/63/);
  });

  it("rejects slugs with uppercase letters", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "AcmeCorp" });
    expect(result.valid).toBe(false);
  });

  it("rejects slugs with spaces", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "acme corp" });
    expect(result.valid).toBe(false);
  });

  it("rejects slugs starting with a hyphen", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "-acme" });
    expect(result.valid).toBe(false);
  });

  it("rejects reserved slugs: platform", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "platform" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  it("rejects reserved slugs: demo", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "demo" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  it("rejects reserved slugs: admin", async () => {
    const result = await getCaller().registration.validateSlug({ slug: "admin" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });

  it("returns available: false when slug is already taken", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ id: "existing" } as never);

    const result = await getCaller().registration.validateSlug({ slug: "taken-slug" });
    expect(result.valid).toBe(true);
    expect(result.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. registration.createTenant
// ---------------------------------------------------------------------------
describe("registration.createTenant", () => {
  const router = createTRPCRouter({ registration: registrationRouter });
  const getCaller = () => createCallerFactory(router)(unauthenticatedCtx());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Tenant record with status 'provisioning'", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null); // slug available
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({
      id: "plan-starter",
      slug: "starter",
    } as never);
    vi.mocked(prisma.tenant.create).mockResolvedValue({
      id: "new-tenant-id",
      slug: "newco",
      name: "New Co",
      schemaName: "t_newco",
      status: "provisioning",
    } as never);

    const result = await getCaller().registration.createTenant({
      slug: "newco",
      name: "New Co",
      plan: "starter",
      ownerEmail: "owner@newco.com",
      ownerName: "Alice",
      ownerPassword: "Secure123!@#",
    });

    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "newco",
          name: "New Co",
          status: "provisioning",
        }),
      }),
    );
    expect(result.tenantId).toBe("new-tenant-id");
  });

  it("dispatches a tenantProvisioning BullMQ job", async () => {
    const { prisma } = await import("@orqafy/db");
    const { createQueues } = await import("@orqafy/jobs");

    vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({ id: "plan-starter", slug: "starter" } as never);
    vi.mocked(prisma.tenant.create).mockResolvedValue({
      id: "new-tenant-id",
      slug: "newco",
      name: "New Co",
      schemaName: "t_newco",
      status: "provisioning",
    } as never);

    await getCaller().registration.createTenant({
      slug: "newco",
      name: "New Co",
      plan: "starter",
      ownerEmail: "owner@newco.com",
      ownerName: "Alice",
      ownerPassword: "Secure123!@#",
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const queues = vi.mocked(createQueues).mock.results[0]?.value as {
      tenantProvisioning: { add: ReturnType<typeof vi.fn> };
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(queues?.tenantProvisioning.add).toHaveBeenCalledWith(
      "provision-tenant",
      expect.objectContaining({
        tenantSlug: "newco",
        tenantName: "New Co",
        plan: "starter",
      }),
    );
  });

  it("rejects an already-taken slug with BAD_REQUEST", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ id: "existing" } as never);

    await expect(
      getCaller().registration.createTenant({
        slug: "taken",
        name: "Taken Corp",
        plan: "starter",
        ownerEmail: "x@x.com",
        ownerName: "X",
        ownerPassword: "Secure123!@#",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a reserved slug with BAD_REQUEST", async () => {
    await expect(
      getCaller().registration.createTenant({
        slug: "platform",
        name: "Hacker Corp",
        plan: "starter",
        ownerEmail: "x@x.com",
        ownerName: "X",
        ownerPassword: "Secure123!@#",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an invalid plan with BAD_REQUEST", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue(null); // plan not found

    await expect(
      getCaller().registration.createTenant({
        slug: "validslug",
        name: "Valid Corp",
        plan: "nonexistent-plan",
        ownerEmail: "x@x.com",
        ownerName: "X",
        ownerPassword: "Secure123!@#",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 4. platform.listTenants — requires Platform Owner
// ---------------------------------------------------------------------------
describe("platform.listTenants", () => {
  const router = createTRPCRouter({ platform: platformRouter });

  it("returns tenant list to Platform Owner", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      { id: "t1", slug: "acme", name: "Acme", status: "active" },
    ] as never);

    const caller = createCallerFactory(router)(platformOwnerCtx());
    const result = await caller.platform.listTenants({});
    expect(result.tenants).toHaveLength(1);
    expect(result.tenants[0]?.slug).toBe("acme");
  });

  it("rejects regular user with FORBIDDEN", async () => {
    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(caller.platform.listTenants({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects unauthenticated with UNAUTHORIZED", async () => {
    const caller = createCallerFactory(router)(unauthenticatedCtx());
    await expect(caller.platform.listTenants({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ---------------------------------------------------------------------------
// 5. platform.suspendTenant — requires Platform Owner
// ---------------------------------------------------------------------------
describe("platform.suspendTenant", () => {
  const router = createTRPCRouter({ platform: platformRouter });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suspends an active tenant and writes audit log", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue({
      id: "t1",
      slug: "acme",
      name: "Acme",
      status: "active",
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({
      id: "t1",
      slug: "acme",
      status: "suspended",
    } as never);
    vi.mocked(prisma.tenantAuditLog.create).mockResolvedValue({} as never);

    const caller = createCallerFactory(router)(platformOwnerCtx());
    const result = await caller.platform.suspendTenant({
      tenantId: "t1",
      reason: "Payment failed",
    });

    expect(result.success).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "suspended" }),
      }),
    );
    expect(prisma.tenantAuditLog.create).toHaveBeenCalled();
  });

  it("rejects regular user with FORBIDDEN", async () => {
    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(
      caller.platform.suspendTenant({ tenantId: "t1", reason: "test" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND for unknown tenant", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null);

    const caller = createCallerFactory(router)(platformOwnerCtx());
    await expect(
      caller.platform.suspendTenant({ tenantId: "ghost-id", reason: "test" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
