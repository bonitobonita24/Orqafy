/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type * as OrqafyDb from "@orqafy/db";

// ── Mocks (declared before importing the router under test) ────────────────
// vi.mock(...) factories are hoisted above imports/const declarations, so the
// mock object itself must be created via vi.hoisted (same pattern as
// customer-tenant-parity.test.ts's mockDb) — a plain top-level const would
// throw "Cannot access before initialization" once the factory runs.
const mockDb = vi.hoisted(() => ({
  customer: { findUnique: vi.fn(), update: vi.fn() },
  customerPortalInvite: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  role: { findFirst: vi.fn() },
  rolePermission: { findUnique: vi.fn() },
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      ...mockDb,
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

import { customerPortalRouter } from "@/server/trpc/routers/customer-portal";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ customerPortal: customerPortalRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: (_h: string): string | null => null } } as unknown as NextRequest;
}

function staffCtx(overrides: Record<string, unknown> = {}) {
  return {
    req: makeReq(),
    userId: "staff-1",
    roles: ["Custom Role"],
    roleId: "role-1",
    tenantSlug: "acme",
    tenantId: "tenant-acme",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
    ...overrides,
  };
}

function publicCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
  };
}

function grantCrmUpdate() {
  mockDb.role.findFirst.mockResolvedValue({ id: "role-1", tenantId: "tenant-acme", name: "Custom Role" });
  mockDb.rolePermission.findUnique.mockResolvedValue({ view: true, create: true, update: true, delete: true });
}

const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customerPortal router — staff", () => {
  it("invite: creates a hashed-token invite row and returns a raw acceptUrl", async () => {
    grantCrmUpdate();
    mockDb.customer.findUnique.mockResolvedValue({
      id: "ckcust1000000000000000001",
      tenantId: "tenant-acme",
      portalEmail: "client@acme.test",
      portalEnabled: false,
    });
    mockDb.customerPortalInvite.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.customerPortalInvite.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "invite-1", ...data, consumedAt: null, createdAt: new Date(), updatedAt: new Date() }),
    );

    const caller = createCaller(staffCtx());
    const result = await caller.customerPortal.invite({ customerId: "ckcust1000000000000000001" });

    expect(result.inviteId).toBe("invite-1");
    expect(result.acceptUrl).toMatch(/^\/acme\/portal\/accept\?token=/);
    const rawToken = result.acceptUrl.split("token=")[1]!;
    expect(rawToken).toMatch(RAW_TOKEN_RE);

    // The persisted row stores only the HASH, never the raw token.
    const createCall = mockDb.customerPortalInvite.create.mock.calls[0]![0];
    expect(createCall.data.tokenHash).not.toBe(rawToken);
    expect(createCall.data.tokenHash).toBe(crypto.createHash("sha256").update(rawToken).digest("hex"));
    expect(createCall.data.email).toBe("client@acme.test");
    expect(createCall.data.tenantId).toBe("tenant-acme");
    expect(createCall.data.createdById).toBe("staff-1");

    // Prior unconsumed invites for this customer are invalidated first.
    expect(mockDb.customerPortalInvite.deleteMany).toHaveBeenCalledWith({
      where: { customerId: "ckcust1000000000000000001", tenantId: "tenant-acme", consumedAt: null },
    });
  });

  it("invite: customer belonging to a DIFFERENT tenant → NOT_FOUND", async () => {
    grantCrmUpdate();
    mockDb.customer.findUnique.mockResolvedValue({
      id: "ckcust2000000000000000002",
      tenantId: "tenant-OTHER",
      portalEmail: "other@other.test",
    });

    const caller = createCaller(staffCtx());
    await expect(caller.customerPortal.invite({ customerId: "ckcust2000000000000000002" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.customerPortalInvite.create).not.toHaveBeenCalled();
  });

  it("disable: bumps customerSecurityVersion and turns portalEnabled off", async () => {
    grantCrmUpdate();
    mockDb.customer.findUnique.mockResolvedValue({
      id: "ckcust1000000000000000001",
      tenantId: "tenant-acme",
      portalEnabled: true,
    });
    mockDb.customer.update.mockResolvedValue({ id: "ckcust1000000000000000001", portalEnabled: false });
    mockDb.customerPortalInvite.deleteMany.mockResolvedValue({ count: 0 });

    const caller = createCaller(staffCtx());
    const result = await caller.customerPortal.disable({ customerId: "ckcust1000000000000000001" });

    expect(result.portalEnabled).toBe(false);
    expect(mockDb.customer.update).toHaveBeenCalledWith({
      where: { id: "ckcust1000000000000000001" },
      data: { portalEnabled: false, customerSecurityVersion: { increment: 1 } },
    });
  });

  it("disable: SECURITY REGRESSION — purges outstanding unconsumed invites in the same transaction", async () => {
    grantCrmUpdate();
    mockDb.customer.findUnique.mockResolvedValue({
      id: "ckcust1000000000000000001",
      tenantId: "tenant-acme",
      portalEnabled: true,
    });
    mockDb.customer.update.mockResolvedValue({ id: "ckcust1000000000000000001", portalEnabled: false });
    mockDb.customerPortalInvite.deleteMany.mockResolvedValue({ count: 1 });

    const caller = createCaller(staffCtx());
    await caller.customerPortal.disable({ customerId: "ckcust1000000000000000001" });

    expect(mockDb.customerPortalInvite.deleteMany).toHaveBeenCalledWith({
      where: { customerId: "ckcust1000000000000000001", tenantId: "tenant-acme", consumedAt: null },
    });
  });

  it("resetPassword: bumps security version AND issues a fresh invite", async () => {
    grantCrmUpdate();
    mockDb.customer.findUnique.mockResolvedValue({
      id: "ckcust1000000000000000001",
      tenantId: "tenant-acme",
      portalEmail: "client@acme.test",
    });
    mockDb.customer.update.mockResolvedValue({ id: "ckcust1000000000000000001" });
    mockDb.customerPortalInvite.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.customerPortalInvite.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "invite-2", ...data, consumedAt: null, createdAt: new Date(), updatedAt: new Date() }),
    );

    const caller = createCaller(staffCtx());
    const result = await caller.customerPortal.resetPassword({ customerId: "ckcust1000000000000000001" });

    expect(result.inviteId).toBe("invite-2");
    expect(mockDb.customer.update).toHaveBeenCalledWith({
      where: { id: "ckcust1000000000000000001" },
      data: { customerSecurityVersion: { increment: 1 } },
    });
    expect(mockDb.customerPortalInvite.create).toHaveBeenCalled();
  });
});

describe("customerPortal router — public", () => {
  it("acceptInvite: valid unconsumed/unexpired token returns minimal safe info", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      tenantId: "tenant-acme",
      email: "client@acme.test",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockDb.customer.findUnique.mockResolvedValue({
      firstName: "Jane",
      lastName: "Doe",
      companyName: null,
    });

    const caller = createCaller(publicCtx());
    const result = await caller.customerPortal.acceptInvite({ token: "some-raw-token" });

    expect(result).toEqual({ email: "client@acme.test", customerName: "Jane Doe" });
  });

  it("acceptInvite: unknown token → generic NOT_FOUND", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue(null);
    const caller = createCaller(publicCtx());
    await expect(caller.customerPortal.acceptInvite({ token: "bogus" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("acceptInvite: CONSUMED token → generic NOT_FOUND (single-use)", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const caller = createCaller(publicCtx());
    await expect(caller.customerPortal.acceptInvite({ token: "used-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("acceptInvite: EXPIRED token → generic NOT_FOUND", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });
    const caller = createCaller(publicCtx());
    await expect(caller.customerPortal.acceptInvite({ token: "expired-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("setPassword: sets hash + enables portal + bumps version + consumes the invite", async () => {
    const invite = {
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    mockDb.customerPortalInvite.findUnique.mockResolvedValue(invite);
    mockDb.customer.findUnique.mockResolvedValue({ isActive: true });
    mockDb.customer.update.mockResolvedValue({ id: "ckcust1000000000000000001" });
    mockDb.customerPortalInvite.update.mockResolvedValue({ ...invite, consumedAt: new Date() });

    const caller = createCaller(publicCtx());
    const result = await caller.customerPortal.setPassword({ token: "raw-token", password: "correct-horse-battery" });

    expect(result).toEqual({ success: true });

    const updateCall = mockDb.customer.update.mock.calls[0]![0];
    expect(updateCall.where).toEqual({ id: "ckcust1000000000000000001" });
    expect(updateCall.data.portalEnabled).toBe(true);
    expect(updateCall.data.portalEmail).toBe("client@acme.test");
    expect(updateCall.data.customerSecurityVersion).toEqual({ increment: 1 });
    expect(typeof updateCall.data.portalPasswordHash).toBe("string");
    expect(updateCall.data.portalPasswordHash).not.toBe("correct-horse-battery");

    expect(mockDb.customerPortalInvite.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("setPassword: a CONSUMED token is rejected (single-use enforced)", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const caller = createCaller(publicCtx());
    await expect(
      caller.customerPortal.setPassword({ token: "used-token", password: "correct-horse-battery" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.customer.update).not.toHaveBeenCalled();
  });

  it("setPassword: an EXPIRED token is rejected", async () => {
    mockDb.customerPortalInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });

    const caller = createCaller(publicCtx());
    await expect(
      caller.customerPortal.setPassword({ token: "expired-token", password: "correct-horse-battery" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.customer.update).not.toHaveBeenCalled();
  });

  it("SECURITY REGRESSION — after `disable`, a previously-issued invite's setPassword fails and portalEnabled stays false", async () => {
    // `disable` deletes the unconsumed invite row, so the token no longer
    // resolves at all — the same generic NOT_FOUND path as any bad token.
    mockDb.customerPortalInvite.findUnique.mockResolvedValue(null);

    const caller = createCaller(publicCtx());
    await expect(
      caller.customerPortal.setPassword({ token: "stale-token-from-before-disable", password: "correct-horse-battery" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.customer.update).not.toHaveBeenCalled();
  });

  it("SECURITY REGRESSION — setPassword refuses to (re-)activate the portal for an administratively-deactivated customer (isActive:false), even with a live invite", async () => {
    const invite = {
      id: "invite-1",
      customerId: "ckcust1000000000000000001",
      email: "client@acme.test",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    mockDb.customerPortalInvite.findUnique.mockResolvedValue(invite);
    mockDb.customer.findUnique.mockResolvedValue({ isActive: false });
    mockDb.customerPortalInvite.update.mockResolvedValue({ ...invite, consumedAt: new Date() });

    const caller = createCaller(publicCtx());
    await expect(
      caller.customerPortal.setPassword({ token: "raw-token", password: "correct-horse-battery" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // portalEnabled must NEVER be set true for a deactivated customer.
    expect(mockDb.customer.update).not.toHaveBeenCalled();
    // The invite is still consumed so it can never be replayed.
    expect(mockDb.customerPortalInvite.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: { consumedAt: expect.any(Date) },
    });
  });
});
