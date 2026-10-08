/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * ORQ-51 — Support staff-management authz (owner ruling 2026-10-08)
 *
 * Proves the four support.ts role gates that previously checked the DEAD
 * role names "Administrator"/"Manager" (matching no seeded role — see
 * packages/db/src/seed/roles.ts) now correctly recognize the owner-ruled
 * allow-list: Support Agent, Admin, Tenant Super Admin, Platform Owner.
 *
 *  1. ticket.update — override the creator-only edit restriction
 *  2. ticket.assign — assign a ticket to a user
 *  3. comment.list  — see internal-only comments
 *  4. comment.create — post an internal-only comment
 *
 * Each gate is tested with a NON-bypass staff role (Support Agent, Admin —
 * neither is in hasPermission's MATRIX_BYPASS_ROLE_NAMES) so the assertion
 * exercises the business-logic role check itself, not the matrix bypass.
 * A plain "Customer" role proves the gate still denies non-staff.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type * as OrqafyDb from "@orqafy/db";

const {
  mockTicketFindUnique,
  mockTicketUpdate,
  mockCommentFindMany,
  mockCommentCreate,
  mockUserFindUnique,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
} = vi.hoisted(() => ({
  mockTicketFindUnique: vi.fn(),
  mockTicketUpdate: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      supportTicket: {
        findUnique: mockTicketFindUnique,
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: mockTicketUpdate,
        count: vi.fn().mockResolvedValue(0),
      },
      ticketComment: {
        findMany: mockCommentFindMany,
        create: mockCommentCreate,
      },
      ticketAttachment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: mockUserFindUnique,
      },
      role: {
        findFirst: mockRoleFindFirst,
      },
      rolePermission: {
        findUnique: mockRolePermissionFindUnique,
      },
    },
  };
});

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

function ctxForRole(roleName: string) {
  return {
    req: makeReq(),
    userId: "caller-user",
    roles: [roleName],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId: "tenant-A",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const ticketCreatedBySomeoneElse = {
  id: "ticket-1",
  tenantId: "tenant-A",
  ticketNumber: "TK-2610-0001",
  createdById: "ticket-owner", // NOT the caller — exercises the override path
  assignedToId: null,
  title: "Needs admin eyes",
  description: "Customer is upset",
  status: "open",
  priority: "medium",
  category: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("support.ts authz gates (ORQ-51)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Grant the matrix layer fully so every assertion below isolates the
    // business-logic role check inside the handler, not the matrix gate.
    mockRolePermissionFindUnique.mockResolvedValue({
      view: true,
      create: true,
      update: true,
      delete: true,
    });
  });

  function mockRole(roleName: string) {
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "tenant-A",
      name: roleName,
    });
  }

  // ── ticket.update — creator-only override ──────────────────────────────

  describe("ticket.update override (non-creator)", () => {
    it.each(["Support Agent", "Admin"])(
      "%s may update a ticket they did not create",
      async (roleName) => {
        mockRole(roleName);
        mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
        mockTicketUpdate.mockResolvedValueOnce({ ...ticketCreatedBySomeoneElse, title: "Updated" });

        const caller = createCaller(ctxForRole(roleName));

        await expect(
          caller.support.ticket.update({ id: "ticket-1", title: "Updated" }),
        ).resolves.toMatchObject({ title: "Updated" });
      },
    );

    it("a non-staff role (Customer) may NOT update a ticket they did not create", async () => {
      mockRole("Customer");
      mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);

      const caller = createCaller(ctxForRole("Customer"));

      await expect(
        caller.support.ticket.update({ id: "ticket-1", title: "Hijacked" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(mockTicketUpdate).not.toHaveBeenCalled();
    });
  });

  // ── ticket.assign ───────────────────────────────────────────────────────

  describe("ticket.assign", () => {
    it.each(["Support Agent", "Admin"])(
      "%s may assign a ticket",
      async (roleName) => {
        mockRole(roleName);
        mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
        mockUserFindUnique.mockResolvedValueOnce({ id: "assignee-1", tenantId: "tenant-A" });
        mockTicketUpdate.mockResolvedValueOnce({
          ...ticketCreatedBySomeoneElse,
          assignedToId: "assignee-1",
        });

        const caller = createCaller(ctxForRole(roleName));

        await expect(
          caller.support.ticket.assign({ id: "ticket-1", assignedToId: "assignee-1" }),
        ).resolves.toMatchObject({ assignedToId: "assignee-1" });
      },
    );

    it("a non-staff role (Customer) may NOT assign a ticket", async () => {
      mockRole("Customer");

      const caller = createCaller(ctxForRole("Customer"));

      await expect(
        caller.support.ticket.assign({ id: "ticket-1", assignedToId: "assignee-1" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(mockTicketUpdate).not.toHaveBeenCalled();
    });
  });

  // ── comment.list — internal visibility ─────────────────────────────────

  describe("comment.list internal-comment visibility", () => {
    it.each(["Support Agent", "Admin"])(
      "%s sees internal comments (no isInternal filter applied)",
      async (roleName) => {
        mockRole(roleName);
        mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
        mockCommentFindMany.mockResolvedValueOnce([]);

        const caller = createCaller(ctxForRole(roleName));
        await caller.support.comment.list({ ticketId: "ticket-1" });

        expect(mockCommentFindMany).toHaveBeenCalledOnce();
        const callArg = (mockCommentFindMany.mock.calls[0] as unknown[])[0] as any;
        expect(callArg.where.isInternal).toBeUndefined();
      },
    );

    it("a non-staff role (Customer) is filtered to non-internal comments only", async () => {
      mockRole("Customer");
      mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
      mockCommentFindMany.mockResolvedValueOnce([]);

      const caller = createCaller(ctxForRole("Customer"));
      await caller.support.comment.list({ ticketId: "ticket-1" });

      const callArg = (mockCommentFindMany.mock.calls[0] as unknown[])[0] as any;
      expect(callArg.where.isInternal).toBe(false);
    });
  });

  // ── comment.create — internal flag ─────────────────────────────────────

  describe("comment.create internal flag", () => {
    it.each(["Support Agent", "Admin"])(
      "%s can post an internal-only comment",
      async (roleName) => {
        mockRole(roleName);
        mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
        mockCommentCreate.mockResolvedValueOnce({ id: "c1", isInternal: true });

        const caller = createCaller(ctxForRole(roleName));
        await caller.support.comment.create({
          ticketId: "ticket-1",
          content: "internal note",
          isInternal: true,
        });

        expect(mockCommentCreate).toHaveBeenCalledOnce();
        const callArg = (mockCommentCreate.mock.calls[0] as unknown[])[0] as any;
        expect(callArg.data.isInternal).toBe(true);
      },
    );

    it("a non-staff role (Customer) requesting isInternal:true is forced to false", async () => {
      mockRole("Customer");
      mockTicketFindUnique.mockResolvedValueOnce(ticketCreatedBySomeoneElse);
      mockCommentCreate.mockResolvedValueOnce({ id: "c2", isInternal: false });

      const caller = createCaller(ctxForRole("Customer"));
      await caller.support.comment.create({
        ticketId: "ticket-1",
        content: "trying to sneak an internal note",
        isInternal: true,
      });

      const callArg = (mockCommentCreate.mock.calls[0] as unknown[])[0] as any;
      expect(callArg.data.isInternal).toBe(false);
    });
  });
});
