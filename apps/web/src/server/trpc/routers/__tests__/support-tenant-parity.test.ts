/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Support/Ticket tenant parity
 *
 * Proves:
 *  1. support.ticket.create injects tenantId from ctx (never from input)
 *  2. support.ticket.update throws NOT_FOUND when ticket belongs to tenant-B but ctx is tenant-A
 *  3. support.ticket.changeStatus throws NOT_FOUND for cross-tenant access
 *  4. support.comment.create throws NOT_FOUND for cross-tenant ticket
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock ───────────────────────────────────────────────────────────────────
const {
  mockTicketFindUnique,
  mockTicketFindFirst,
  mockTicketCreate,
  mockTicketUpdate,
  mockCommentCreate,
} = vi.hoisted(() => ({
  mockTicketFindUnique: vi.fn(),
  mockTicketFindFirst: vi.fn(),
  mockTicketCreate: vi.fn(),
  mockTicketUpdate: vi.fn(),
  mockCommentCreate: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    supportTicket: {
      findUnique: mockTicketFindUnique,
      findFirst: mockTicketFindFirst,
      findMany: vi.fn().mockResolvedValue([]),
      create: mockTicketCreate,
      update: mockTicketUpdate,
      count: vi.fn().mockResolvedValue(0),
    },
    ticketComment: {
      findMany: vi.fn().mockResolvedValue([]),
      create: mockCommentCreate,
    },
    ticketAttachment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { supportRouter } from "@/server/trpc/routers/support";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ support: supportRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, roles: string[] = ["Administrator"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ticketOnTenantB = {
  id: "ticket-b1",
  tenantId: "tenant-B",
  ticketNumber: "TK-2606-0001",
  createdById: "user-1",
  assignedToId: null,
  title: "Cross-tenant ticket",
  description: "Should not be visible to tenant-A",
  status: "open",
  priority: "medium",
  category: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Support tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("support.ticket.create injects tenantId from ctx, not from input", async () => {
    mockTicketFindFirst.mockResolvedValueOnce(null); // no prior ticket this month
    mockTicketCreate.mockResolvedValueOnce({
      ...ticketOnTenantB,
      tenantId: "tenant-A",
      id: "ticket-a1",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.support.ticket.create({
      title: "Test issue",
      description: "Details here",
    });

    expect(mockTicketCreate).toHaveBeenCalledOnce();
    const callArg = mockTicketCreate.mock.calls[0]![0] as any;
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("support.ticket.update throws NOT_FOUND when ticket belongs to tenant-B but ctx is tenant-A", async () => {
    mockTicketFindUnique.mockResolvedValueOnce(ticketOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.support.ticket.update({ id: "ticket-b1", title: "Hack" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("support.ticket.changeStatus throws NOT_FOUND for cross-tenant access", async () => {
    mockTicketFindUnique.mockResolvedValueOnce(ticketOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.support.ticket.changeStatus({ id: "ticket-b1", status: "in_progress" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("support.comment.create throws NOT_FOUND when ticket belongs to different tenant", async () => {
    // loadTicketForTenant guard uses findUnique
    mockTicketFindUnique.mockResolvedValueOnce(ticketOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.support.comment.create({
        ticketId: "ticket-b1",
        content: "Injected comment",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("support.ticket.close throws NOT_FOUND when ticket belongs to different tenant", async () => {
    mockTicketFindUnique.mockResolvedValueOnce(ticketOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.support.ticket.close({ id: "ticket-b1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
