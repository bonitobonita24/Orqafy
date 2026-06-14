/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { jobOrderRouter } from "@/server/trpc/routers/job-order";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

// D7 — assignTechnician emits a notification as a side effect; stub it (the
// createNotification helper is unit-tested separately).
vi.mock("@/server/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-test" }),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    jobOrder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    jobOrderPart: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    jobOrderServiceLine: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public_invoice: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string): string => s.trim(),
}));

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}
function authenticatedCtx(roles: string[] = ["Administrator"], isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}
function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [] as string[],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const testRouter = createTRPCRouter({ jobOrder: jobOrderRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  jobOrder: { findMany: any; findUnique: any; count: any; create: any; update: any };
  jobOrderPart: { create: any; findUnique: any; delete: any };
  jobOrderServiceLine: { create: any; findUnique: any; delete: any };
  customer: { findUnique: any };
  user: { findUnique: any };
  product: { findUnique: any };
};

const JO_CUID = "ck1234567890123456789012a";
const CUST_CUID = "ck1234567890123456789012b";
const TECH_CUID = "ck1234567890123456789012c";

describe("jobOrder router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns paginated job orders ordered by createdAt desc", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([
        { id: JO_CUID, jobOrderNumber: "JO-1", status: "received", priority: "medium" },
      ]);
      mockDb.jobOrder.count.mockResolvedValue(1);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.list({});
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockDb.jobOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } })
      );
    });

    it("filters by status", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([]);
      mockDb.jobOrder.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.list({ status: "in_progress" });
      expect(mockDb.jobOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: "in_progress" }) })
      );
    });

    it("filters by priority", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([]);
      mockDb.jobOrder.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.list({ priority: "urgent" });
      expect(mockDb.jobOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ priority: "urgent" }) })
      );
    });

    it("filters by technicianId", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([]);
      mockDb.jobOrder.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.list({ technicianId: TECH_CUID });
      expect(mockDb.jobOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ technicianId: TECH_CUID }) })
      );
    });

    it("searches across title and jobOrderNumber", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([]);
      mockDb.jobOrder.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.list({ search: "laptop" });
      const callArgs = mockDb.jobOrder.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { title: { contains: "laptop", mode: "insensitive" } },
        { jobOrderNumber: { contains: "laptop", mode: "insensitive" } },
      ]);
    });

    it("respects pagination", async () => {
      mockDb.jobOrder.findMany.mockResolvedValue([]);
      mockDb.jobOrder.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.list({ page: 4, limit: 20 });
      expect(mockDb.jobOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 60, take: 20 })
      );
    });

    it("rejects unauthenticated callers", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(caller.jobOrder.list({})).rejects.toThrow(TRPCError);
    });
  });

  describe("byId", () => {
    it("returns job order with relations", async () => {
      const guardJo = { id: JO_CUID, tenantId: "acme-tenant-id" };
      const jo = {
        id: JO_CUID,
        jobOrderNumber: "JO-1",
        customer: { id: CUST_CUID, firstName: "Alice", lastName: "Cruz" },
        createdBy: { firstName: "Bob", lastName: "Reyes" },
        technician: null,
        parts: [],
      };
      // loadJobOrderForTenant calls findUnique first, then byId calls it again with include
      mockDb.jobOrder.findUnique.mockResolvedValueOnce(guardJo).mockResolvedValueOnce(jo);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.byId({ id: JO_CUID });
      expect(result).toEqual(jo);
    });

    it("throws NOT_FOUND when job order is missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.byId({ id: JO_CUID })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("publicView", () => {
    it("returns a minimal projection for token-gated public access", async () => {
      const guardJo = { id: JO_CUID, tenantId: "acme-tenant-id" };
      const publicProjection = {
        id: JO_CUID,
        jobOrderNumber: "JO-1",
        title: "Battery replacement",
        status: "completed",
        priority: "medium",
        reportedIssue: "Battery dies in 1h",
        diagnosis: "Battery cell failure",
        estimatedCost: 1500,
        actualCost: 1450,
        warranty: "30 days",
        completedAt: new Date(),
        createdAt: new Date(),
        customer: { firstName: "Alice", lastName: "Cruz", companyName: null },
        technician: { firstName: "Bob", lastName: "Reyes", displayName: null },
      };
      // loadJobOrderForTenant calls findUnique first, then publicView calls it again with select
      mockDb.jobOrder.findUnique.mockResolvedValueOnce(guardJo).mockResolvedValueOnce(publicProjection);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.publicView({ id: JO_CUID, token: "abc123" });
      expect(result).toEqual(publicProjection);
      // The second findUnique call is the one with select — index [1]
      const findArgs = mockDb.jobOrder.findUnique.mock.calls[1][0];
      // publicView MUST NOT leak internal fields such as createdById or createdBy details
      expect(findArgs.select).not.toHaveProperty("createdById");
      expect(findArgs.select).not.toHaveProperty("createdBy");
      expect(findArgs.select).not.toHaveProperty("parts");
    });

    it("requires a non-empty token", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.publicView({ id: JO_CUID, token: "" })).rejects.toThrow();
    });

    it("throws NOT_FOUND when job order is missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.publicView({ id: JO_CUID, token: "abc123" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("create", () => {
    it("creates a new job order with status=received and auto jobOrderNumber", async () => {
      mockDb.customer.findUnique.mockResolvedValue({ id: CUST_CUID });
      mockDb.jobOrder.create.mockResolvedValue({ id: JO_CUID, status: "received" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.create({
        customerId: CUST_CUID,
        title: "Battery replacement",
        description: "Laptop needs new battery",
        reportedIssue: "Battery drains in 1 hour",
        priority: "medium",
      });
      const callArgs = mockDb.jobOrder.create.mock.calls[0][0];
      expect(callArgs.data.status).toBe("received");
      expect(callArgs.data.customerId).toBe(CUST_CUID);
      expect(callArgs.data.createdById).toBe("user-1");
      expect(callArgs.data.jobOrderNumber).toMatch(/^JO-\d+$/);
    });

    it("throws BAD_REQUEST when customer does not exist", async () => {
      mockDb.customer.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.create({
          customerId: CUST_CUID,
          title: "T",
          description: "D",
          reportedIssue: "I",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects empty title via Zod", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.create({
          customerId: CUST_CUID,
          title: "",
          description: "D",
          reportedIssue: "I",
        })
      ).rejects.toThrow();
    });

    it("rejects invalid priority enum", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.create({
          customerId: CUST_CUID,
          title: "T",
          description: "D",
          reportedIssue: "I",
          // @ts-expect-error — testing runtime rejection
          priority: "INVALID",
        })
      ).rejects.toThrow();
    });

    it("rejects negative estimatedCost via Zod", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.create({
          customerId: CUST_CUID,
          title: "T",
          description: "D",
          reportedIssue: "I",
          estimatedCost: -50,
        })
      ).rejects.toThrow();
    });

    it("blocks creation in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.jobOrder.create({
          customerId: CUST_CUID,
          title: "T",
          description: "D",
          reportedIssue: "I",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("updateStatus state machine", () => {
    it("updates status from received → diagnosing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "received", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "diagnosing" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({ id: JO_CUID, status: "diagnosing" });
      const callArgs = mockDb.jobOrder.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe("diagnosing");
    });

    it("attaches diagnosis when moving to diagnosed/quoted", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "diagnosing", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "quoted" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({
        id: JO_CUID,
        status: "quoted",
        diagnosis: "Battery cell failure",
      });
      const callArgs = mockDb.jobOrder.update.mock.calls[0][0];
      expect(callArgs.data.diagnosis).toBe("Battery cell failure");
    });

    it("sets completedAt when status=completed", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "testing",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: "data:image/png;base64,AAA",
        technicianSignatureUrl: "data:image/png;base64,BBB",
      });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "completed" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({
        id: JO_CUID,
        status: "completed",
        actualCost: 1500,
        laborCost: 500,
      });
      const callArgs = mockDb.jobOrder.update.mock.calls[0][0];
      expect(callArgs.data.completedAt).toBeInstanceOf(Date);
      expect(callArgs.data.actualCost).toBe(1500);
      expect(callArgs.data.laborCost).toBe(500);
    });

    it("sets releasedAt when status=released", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "completed", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "released" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({ id: JO_CUID, status: "released" });
      expect(mockDb.jobOrder.update.mock.calls[0][0].data.releasedAt).toBeInstanceOf(Date);
    });

    it("does NOT set completedAt for non-terminal status", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "diagnosing", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({ id: JO_CUID, status: "in_progress" });
      const callArgs = mockDb.jobOrder.update.mock.calls[0][0];
      expect(callArgs.data.completedAt).toBeUndefined();
      expect(callArgs.data.releasedAt).toBeUndefined();
    });

    it("supports cancellation from any state", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "approved", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "cancelled" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({ id: JO_CUID, status: "cancelled" });
      expect(mockDb.jobOrder.update.mock.calls[0][0].data.status).toBe("cancelled");
    });

    it("rejects invalid status values", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({
          id: JO_CUID,
          // @ts-expect-error — testing runtime rejection
          status: "invented_status",
        })
      ).rejects.toThrow();
    });

    it("throws NOT_FOUND when job order missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "in_progress" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("blocks status update in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "in_progress" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects invalid transition (received → released directly)", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "received", tenantId: "acme-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "released" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("Invalid status transition"),
      });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });

    it("rejects invalid transition (approved → testing skipping in_progress)", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "approved", tenantId: "acme-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "testing" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });

    it("blocks testing → completed when customer signature missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "testing",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: null,
        technicianSignatureUrl: "data:image/png;base64,XXX",
      });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "completed" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("signatures"),
      });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });

    it("blocks testing → completed when technician signature missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "testing",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: "data:image/png;base64,YYY",
        technicianSignatureUrl: null,
      });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.updateStatus({ id: JO_CUID, status: "completed" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });

    it("allows cancellation from quoted state", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "quoted", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "cancelled" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({ id: JO_CUID, status: "cancelled" });
      expect(mockDb.jobOrder.update.mock.calls[0][0].data.status).toBe("cancelled");
    });

    it("allows no-op transition (same status) for diagnosis-only update", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "diagnosing", tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, status: "diagnosing" });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.updateStatus({
        id: JO_CUID,
        status: "diagnosing",
        diagnosis: "Updated diagnosis text",
      });
      const callArgs = mockDb.jobOrder.update.mock.calls[0][0];
      expect(callArgs.data.diagnosis).toBe("Updated diagnosis text");
      expect(callArgs.data.completedAt).toBeUndefined();
    });
  });

  describe("assignTechnician", () => {
    it("assigns a technician when both job order and user exist", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, tenantId: "acme-tenant-id", jobOrderNumber: "JO-1" });
      // D7 — technician must belong to the caller's tenant (isolation guard).
      mockDb.user.findUnique.mockResolvedValue({ id: TECH_CUID, tenantId: "acme-tenant-id" });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID, technicianId: TECH_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID });
      expect(mockDb.jobOrder.update).toHaveBeenCalledWith({
        where: { id: JO_CUID },
        data: { technicianId: TECH_CUID },
      });
    });

    it("throws NOT_FOUND when job order missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST when technician user missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, tenantId: "acme-tenant-id" });
      mockDb.user.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("blocks assignment in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("addPart", () => {
    const PART_INPUT = {
      jobOrderId: JO_CUID,
      description: "  HDD replacement  ",
      quantity: 2,
      unitPrice: 1500,
      isFromInventory: false,
    };

    it("creates a part with server-computed totalPrice", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "diagnosing", tenantId: "acme-tenant-id" });
      mockDb.jobOrderPart.create.mockResolvedValue({ id: "part-1" });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.addPart(PART_INPUT);
      expect(result).toEqual({ id: "part-1" });
      expect(mockDb.jobOrderPart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobOrderId: JO_CUID,
          description: "HDD replacement",
          quantity: 2,
          unitPrice: 1500,
          totalPrice: 3000,
          isFromInventory: false,
        }),
      });
    });

    it("throws BAD_REQUEST when job order status disallows line-item edits", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "released", tenantId: "acme-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.addPart(PART_INPUT)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mockDb.jobOrderPart.create).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when job order missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.addPart(PART_INPUT)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("blocks part creation in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(caller.jobOrder.addPart(PART_INPUT)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("removePart", () => {
    const PART_ID = "ck1234567890123456789012d";

    it("deletes a part when parent job order status allows", async () => {
      mockDb.jobOrderPart.findUnique.mockResolvedValue({
        id: PART_ID,
        jobOrder: { status: "in_progress", tenantId: "acme-tenant-id" },
      });
      mockDb.jobOrderPart.delete.mockResolvedValue({ id: PART_ID });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.removePart({ id: PART_ID });
      expect(result).toEqual({ id: PART_ID });
      expect(mockDb.jobOrderPart.delete).toHaveBeenCalledWith({ where: { id: PART_ID } });
    });

    it("throws BAD_REQUEST when parent status disallows line-item edits", async () => {
      mockDb.jobOrderPart.findUnique.mockResolvedValue({
        id: PART_ID,
        jobOrder: { status: "completed", tenantId: "acme-tenant-id" },
      });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.removePart({ id: PART_ID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mockDb.jobOrderPart.delete).not.toHaveBeenCalled();
    });
  });

  describe("addServiceLine", () => {
    const SERVICE_INPUT = {
      jobOrderId: JO_CUID,
      description: "  Diagnostic labor  ",
      hours: 1.5,
      rate: 400,
      amount: 600,
      sortOrder: 0,
    };

    it("creates a service line with hours and rate", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "diagnosing", tenantId: "acme-tenant-id" });
      mockDb.jobOrderServiceLine.create.mockResolvedValue({ id: "svc-1" });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.addServiceLine(SERVICE_INPUT);
      expect(result).toEqual({ id: "svc-1" });
      expect(mockDb.jobOrderServiceLine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobOrderId: JO_CUID,
          description: "Diagnostic labor",
          hours: 1.5,
          rate: 400,
          amount: 600,
          sortOrder: 0,
        }),
      });
    });

    it("throws BAD_REQUEST when status disallows line-item edits", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({ id: JO_CUID, status: "cancelled", tenantId: "acme-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.jobOrder.addServiceLine(SERVICE_INPUT)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mockDb.jobOrderServiceLine.create).not.toHaveBeenCalled();
    });
  });

  describe("removeServiceLine", () => {
    const SVC_ID = "ck1234567890123456789012e";

    it("deletes a service line when parent status allows and returns the id", async () => {
      mockDb.jobOrderServiceLine.findUnique.mockResolvedValue({
        id: SVC_ID,
        jobOrder: { status: "testing", tenantId: "acme-tenant-id" },
      });
      mockDb.jobOrderServiceLine.delete.mockResolvedValue({ id: SVC_ID });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.jobOrder.removeServiceLine({ id: SVC_ID });
      expect(result).toEqual({ id: SVC_ID });
      expect(mockDb.jobOrderServiceLine.delete).toHaveBeenCalledWith({
        where: { id: SVC_ID },
      });
    });
  });

  describe("recordSignature", () => {
    const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

    it("records a customer signature and leaves signedAt unset when technician signature missing", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "testing",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: null,
        technicianSignatureUrl: null,
        signedAt: null,
      });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.recordSignature({
        id: JO_CUID,
        role: "customer",
        dataUrl: PNG_DATA_URL,
      });
      const updateCall = mockDb.jobOrder.update.mock.calls[0][0];
      expect(updateCall.data.customerSignatureUrl).toBe(PNG_DATA_URL);
      expect(updateCall.data.signedAt).toBeUndefined();
    });

    it("sets signedAt to a Date when the other signature is already present", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "completed",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: PNG_DATA_URL,
        technicianSignatureUrl: null,
        signedAt: null,
      });
      mockDb.jobOrder.update.mockResolvedValue({ id: JO_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.jobOrder.recordSignature({
        id: JO_CUID,
        role: "technician",
        dataUrl: PNG_DATA_URL,
      });
      const updateCall = mockDb.jobOrder.update.mock.calls[0][0];
      expect(updateCall.data.technicianSignatureUrl).toBe(PNG_DATA_URL);
      expect(updateCall.data.signedAt).toBeInstanceOf(Date);
    });

    it("throws BAD_REQUEST when dataUrl is not a PNG data URL", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.recordSignature({
          id: JO_CUID,
          role: "customer",
          dataUrl: "data:image/jpeg;base64,xxx",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST when status is not testing or completed", async () => {
      mockDb.jobOrder.findUnique.mockResolvedValue({
        id: JO_CUID,
        status: "diagnosing",
        tenantId: "acme-tenant-id",
        customerSignatureUrl: null,
        technicianSignatureUrl: null,
        signedAt: null,
      });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.jobOrder.recordSignature({
          id: JO_CUID,
          role: "technician",
          dataUrl: PNG_DATA_URL,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.jobOrder.update).not.toHaveBeenCalled();
    });
  });
});
