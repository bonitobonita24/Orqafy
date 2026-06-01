/**
 * Phase 8 Batch 5 Item 1 — Module 13 Support/Tickets Phase 1
 *
 * ticketRouter:     list / byId / create / update / assign / changeStatus / close
 * commentRouter:    list (with isInternal privacy) / create
 * attachmentRouter: list
 *
 * Schema-adapted from spec:
 *  - SupportTicket / TicketComment / TicketAttachment have NO tenantId column
 *    (per-schema isolation via SET search_path — see demo.ts:26 comment)
 *  - status + priority are String (NOT Prisma enums); allowed values in comments:
 *      status:   open | in_progress | waiting | resolved | closed
 *      priority: low | medium | high | critical
 *  - Router uses local z.enum schemas matching the schema's allowed values
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { supportRouter } from "@/server/trpc/routers/support";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => ({
  prisma: {
    supportTicket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    ticketComment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    ticketAttachment: {
      findMany: vi.fn(),
    },
  },
}));

const testRouter = createTRPCRouter({ support: supportRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  supportTicket: {
    findFirst: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    create: MockFn;
    update: MockFn;
    count: MockFn;
  };
  ticketComment: { findMany: MockFn; create: MockFn };
  ticketAttachment: { findMany: MockFn };
};

// ── Context factories ─────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function adminCtx() {
  return {
    req: makeReq(),
    userId: "user-admin",
    roles: ["Administrator"] as string[],
    tenantSlug: "acme",
    tenantId: "tenant-acme",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}
function staffCtx() {
  return { ...adminCtx(), userId: "user-staff", roles: ["Staff"] as string[] };
}
function managerCtx() {
  return { ...adminCtx(), userId: "user-mgr", roles: ["Manager"] as string[] };
}

// ── Fake fixtures (mirror schema fields exactly — no tenantId) ───────────────

const fakeUser = {
  id: "user-staff",
  firstName: "Jane",
  lastName: "Staff",
  displayName: "Jane Staff",
};
const fakeAdmin = {
  id: "user-admin",
  firstName: "Ada",
  lastName: "Admin",
  displayName: "Ada Admin",
};

const fakeTicket = {
  id: "ticket-1",
  tenantId: "tenant-acme",
  ticketNumber: "TK-2605-0001",
  createdById: "user-staff",
  assignedToId: null as string | null,
  title: "Printer offline",
  description: "The office printer will not respond.",
  category: "hardware",
  priority: "medium",
  status: "open",
  resolvedAt: null as Date | null,
  closedAt: null as Date | null,
  createdAt: new Date("2026-05-15T10:00:00Z"),
  updatedAt: new Date("2026-05-15T10:00:00Z"),
};

const fakeComment = {
  id: "comment-1",
  ticketId: "ticket-1",
  userId: "user-staff",
  content: "Tried restart, still offline.",
  isInternal: false,
  createdAt: new Date("2026-05-15T10:05:00Z"),
  updatedAt: new Date("2026-05-15T10:05:00Z"),
};

const fakeInternalComment = {
  ...fakeComment,
  id: "comment-2",
  content: "Customer is a VIP — escalate fast.",
  isInternal: true,
};

const fakeAttachment = {
  id: "att-1",
  ticketId: "ticket-1",
  fileName: "screenshot.png",
  fileUrl: "/storage/ticket-1/screenshot.png",
  fileSizeBytes: 12345,
  mimeType: "image/png",
  createdAt: new Date("2026-05-15T10:06:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// ticketRouter
// ─────────────────────────────────────────────────────────────────────────────

describe("support.ticket.list", () => {
  it("returns items + total with default pagination", async () => {
    mockDb.supportTicket.findMany.mockResolvedValueOnce([fakeTicket]);
    mockDb.supportTicket.count.mockResolvedValueOnce(1);

    const caller = createCaller(staffCtx());
    const result = await caller.support.ticket.list({});

    expect(result).toEqual({ items: [fakeTicket], total: 1 });
    expect(mockDb.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("applies status + priority + assignedToId filters", async () => {
    mockDb.supportTicket.findMany.mockResolvedValueOnce([]);
    mockDb.supportTicket.count.mockResolvedValueOnce(0);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.list({
      status: "in_progress",
      priority: "high",
      assignedToId: "user-mgr",
    });

    expect(mockDb.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "in_progress",
          priority: "high",
          assignedToId: "user-mgr",
        }),
      })
    );
  });

  it("paginates with page + limit", async () => {
    mockDb.supportTicket.findMany.mockResolvedValueOnce([]);
    mockDb.supportTicket.count.mockResolvedValueOnce(0);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.list({ page: 3, limit: 10 });

    expect(mockDb.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

describe("support.ticket.byId", () => {
  it("returns ticket with comments + attachments", async () => {
    const ticketWithRelations = {
      ...fakeTicket,
      createdBy: fakeUser,
      assignedTo: null,
      comments: [{ ...fakeComment, user: fakeUser }],
      attachments: [fakeAttachment],
    };
    // loadTicketForTenant guard call, then the full include call
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(fakeTicket);
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(ticketWithRelations);

    const caller = createCaller(staffCtx());
    const result = await caller.support.ticket.byId({ id: "ticket-1" });

    expect(result).toEqual(ticketWithRelations);
  });

  it("throws NOT_FOUND when ticket is missing", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(staffCtx());
    await expect(caller.support.ticket.byId({ id: "missing" })).rejects.toThrow(
      /Ticket not found/i
    );
  });
});

describe("support.ticket.create", () => {
  it("generates a TK-YYMM-0001 number when none exist this month", async () => {
    mockDb.supportTicket.findFirst.mockResolvedValueOnce(null);
    mockDb.supportTicket.create.mockResolvedValueOnce({
      ...fakeTicket,
      ticketNumber: expect.any(String),
    });

    const caller = createCaller(staffCtx());
    await caller.support.ticket.create({
      title: "Printer offline",
      description: "Not responding",
    });

    const createCall = mockDb.supportTicket.create.mock.calls[0]?.[0];
    expect(createCall.data.ticketNumber).toMatch(/^TK-\d{4}-0001$/);
    expect(createCall.data.createdById).toBe("user-staff");
    expect(createCall.data.title).toBe("Printer offline");
  });

  it("increments sequence when prior ticket exists this month", async () => {
    mockDb.supportTicket.findFirst.mockResolvedValueOnce({
      ticketNumber: "TK-2605-0042",
    });
    mockDb.supportTicket.create.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.create({
      title: "Issue",
      description: "Details",
    });

    const createCall = mockDb.supportTicket.create.mock.calls[0]?.[0];
    expect(createCall.data.ticketNumber).toMatch(/-0043$/);
  });

  it("only writes optional fields when provided (exactOptionalPropertyTypes)", async () => {
    mockDb.supportTicket.findFirst.mockResolvedValueOnce(null);
    mockDb.supportTicket.create.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.create({
      title: "Minimal",
      description: "No category/priority",
    });

    const data = mockDb.supportTicket.create.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty("category");
    expect(data).not.toHaveProperty("priority");
  });

  it("passes category + priority when provided", async () => {
    mockDb.supportTicket.findFirst.mockResolvedValueOnce(null);
    mockDb.supportTicket.create.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.create({
      title: "Urgent",
      description: "Server down",
      category: "infrastructure",
      priority: "critical",
    });

    const data = mockDb.supportTicket.create.mock.calls[0]?.[0].data;
    expect(data.category).toBe("infrastructure");
    expect(data.priority).toBe("critical");
  });
});

describe("support.ticket.update", () => {
  it("allows the creator to update their own ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      createdById: "user-staff",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.update({
      id: "ticket-1",
      title: "Updated title",
    });

    expect(mockDb.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ticket-1" },
        data: { title: "Updated title" },
      })
    );
  });

  it("allows an Administrator to update another user's ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      createdById: "user-other",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.update({ id: "ticket-1", priority: "high" })
    ).resolves.toBeTruthy();
  });

  it("blocks non-creator non-admin staff with FORBIDDEN", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      createdById: "user-other",
    });

    const caller = createCaller(staffCtx());
    await expect(
      caller.support.ticket.update({ id: "ticket-1", title: "Hijack" })
    ).rejects.toThrow(/creator or an admin/i);
  });

  it("throws NOT_FOUND for missing ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.update({ id: "missing", title: "x" })
    ).rejects.toThrow(/Ticket not found/i);
  });

  it("allows clearing category by passing null", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      createdById: "user-staff",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(staffCtx());
    await caller.support.ticket.update({ id: "ticket-1", category: null });

    const data = mockDb.supportTicket.update.mock.calls[0]?.[0].data;
    expect(data.category).toBeNull();
  });
});

describe("support.ticket.assign", () => {
  it("blocks Staff with FORBIDDEN", async () => {
    const caller = createCaller(staffCtx());
    await expect(
      caller.support.ticket.assign({
        id: "ticket-1",
        assignedToId: "user-mgr",
      })
    ).rejects.toThrow(/administrators or managers/i);
  });

  it("allows Manager to assign and auto-progresses open → in_progress", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "open",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce({
      ...fakeTicket,
      status: "in_progress",
      assignedToId: "user-mgr",
    });

    const caller = createCaller(managerCtx());
    await caller.support.ticket.assign({
      id: "ticket-1",
      assignedToId: "user-mgr",
    });

    expect(mockDb.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedToId: "user-mgr", status: "in_progress" },
      })
    );
  });

  it("preserves status when assigning a non-open ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "waiting",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.assign({
      id: "ticket-1",
      assignedToId: "user-mgr",
    });

    expect(mockDb.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedToId: "user-mgr", status: "waiting" },
      })
    );
  });

  it("allows unassignment (assignedToId = null) without forcing status", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "open",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.assign({
      id: "ticket-1",
      assignedToId: null,
    });

    expect(mockDb.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedToId: null, status: "open" },
      })
    );
  });

  it("throws NOT_FOUND for missing ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.assign({
        id: "missing",
        assignedToId: "user-mgr",
      })
    ).rejects.toThrow(/Ticket not found/i);
  });
});

describe("support.ticket.changeStatus (state machine)", () => {
  it("allows open → in_progress", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "open",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.changeStatus({
        id: "ticket-1",
        status: "in_progress",
      })
    ).resolves.toBeTruthy();
  });

  it("rejects open → resolved (skipping in_progress)", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "open",
    });

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.changeStatus({
        id: "ticket-1",
        status: "resolved",
      })
    ).rejects.toThrow(/Invalid status transition from open to resolved/i);
  });

  it("rejects any transition out of closed (terminal)", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "closed",
    });

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.changeStatus({
        id: "ticket-1",
        status: "in_progress",
      })
    ).rejects.toThrow(/Invalid status transition/i);
  });

  it("sets resolvedAt when transitioning in_progress → resolved", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "in_progress",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.changeStatus({
      id: "ticket-1",
      status: "resolved",
    });

    const data = mockDb.supportTicket.update.mock.calls[0]?.[0].data;
    expect(data.status).toBe("resolved");
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("sets closedAt when transitioning resolved → closed", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "resolved",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.changeStatus({
      id: "ticket-1",
      status: "closed",
    });

    const data = mockDb.supportTicket.update.mock.calls[0]?.[0].data;
    expect(data.status).toBe("closed");
    expect(data.closedAt).toBeInstanceOf(Date);
  });

  it("clears resolvedAt when transitioning resolved → in_progress (reopen)", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "resolved",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.changeStatus({
      id: "ticket-1",
      status: "in_progress",
    });

    const data = mockDb.supportTicket.update.mock.calls[0]?.[0].data;
    expect(data.status).toBe("in_progress");
    expect(data.resolvedAt).toBeNull();
  });

  it("throws NOT_FOUND for missing ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.changeStatus({
        id: "missing",
        status: "in_progress",
      })
    ).rejects.toThrow(/Ticket not found/i);
  });
});

describe("support.ticket.close", () => {
  it("closes a resolved ticket and stamps closedAt", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "resolved",
    });
    mockDb.supportTicket.update.mockResolvedValueOnce(fakeTicket);

    const caller = createCaller(adminCtx());
    await caller.support.ticket.close({ id: "ticket-1" });

    const data = mockDb.supportTicket.update.mock.calls[0]?.[0].data;
    expect(data.status).toBe("closed");
    expect(data.closedAt).toBeInstanceOf(Date);
  });

  it("rejects closing an open ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({
      id: "ticket-1",
      tenantId: "tenant-acme",
      status: "open",
    });

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.ticket.close({ id: "ticket-1" })
    ).rejects.toThrow(/Only resolved tickets can be closed/i);
  });

  it("throws NOT_FOUND for missing ticket", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(adminCtx());
    await expect(caller.support.ticket.close({ id: "missing" })).rejects.toThrow(
      /Ticket not found/i
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// commentRouter
// ─────────────────────────────────────────────────────────────────────────────

describe("support.comment.list", () => {
  it("filters out internal comments for non-privileged staff", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.findMany.mockResolvedValueOnce([
      { ...fakeComment, user: fakeUser },
    ]);

    const caller = createCaller(staffCtx());
    await caller.support.comment.list({ ticketId: "ticket-1" });

    expect(mockDb.ticketComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: "ticket-1", isInternal: false },
      })
    );
  });

  it("includes internal comments for Administrator", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.findMany.mockResolvedValueOnce([
      { ...fakeComment, user: fakeUser },
      { ...fakeInternalComment, user: fakeAdmin },
    ]);

    const caller = createCaller(adminCtx());
    const result = await caller.support.comment.list({ ticketId: "ticket-1" });

    expect(result.length).toBe(2);
    expect(mockDb.ticketComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: "ticket-1" },
      })
    );
  });

  it("includes internal comments for Manager", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.findMany.mockResolvedValueOnce([]);

    const caller = createCaller(managerCtx());
    await caller.support.comment.list({ ticketId: "ticket-1" });

    const where = mockDb.ticketComment.findMany.mock.calls[0]?.[0].where;
    expect(where).not.toHaveProperty("isInternal");
  });

  it("throws NOT_FOUND when ticket missing", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(staffCtx());
    await expect(
      caller.support.comment.list({ ticketId: "missing" })
    ).rejects.toThrow(/Ticket not found/i);
  });
});

describe("support.comment.create", () => {
  it("creates a public comment from any authenticated user", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.create.mockResolvedValueOnce(fakeComment);

    const caller = createCaller(staffCtx());
    await caller.support.comment.create({
      ticketId: "ticket-1",
      content: "Update: still down.",
    });

    expect(mockDb.ticketComment.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        tenantId: "tenant-acme",
        userId: "user-staff",
        content: "Update: still down.",
        isInternal: false,
      },
    });
  });

  it("downgrades isInternal=true to false for non-privileged Staff", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.create.mockResolvedValueOnce(fakeComment);

    const caller = createCaller(staffCtx());
    await caller.support.comment.create({
      ticketId: "ticket-1",
      content: "Attempt to leak internal info",
      isInternal: true,
    });

    const data = mockDb.ticketComment.create.mock.calls[0]?.[0].data;
    expect(data.isInternal).toBe(false);
  });

  it("honors isInternal=true for Administrator", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketComment.create.mockResolvedValueOnce(fakeInternalComment);

    const caller = createCaller(adminCtx());
    await caller.support.comment.create({
      ticketId: "ticket-1",
      content: "Escalate to VIP queue",
      isInternal: true,
    });

    const data = mockDb.ticketComment.create.mock.calls[0]?.[0].data;
    expect(data.isInternal).toBe(true);
  });

  it("throws NOT_FOUND when ticket missing", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(adminCtx());
    await expect(
      caller.support.comment.create({
        ticketId: "missing",
        content: "hi",
      })
    ).rejects.toThrow(/Ticket not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// attachmentRouter
// ─────────────────────────────────────────────────────────────────────────────

describe("support.attachment.list", () => {
  it("returns attachments ordered by createdAt desc", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce({ id: "ticket-1", tenantId: "tenant-acme" });
    mockDb.ticketAttachment.findMany.mockResolvedValueOnce([fakeAttachment]);

    const caller = createCaller(staffCtx());
    const result = await caller.support.attachment.list({
      ticketId: "ticket-1",
    });

    expect(result).toEqual([fakeAttachment]);
    expect(mockDb.ticketAttachment.findMany).toHaveBeenCalledWith({
      where: { ticketId: "ticket-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("throws NOT_FOUND when ticket missing", async () => {
    mockDb.supportTicket.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(staffCtx());
    await expect(
      caller.support.attachment.list({ ticketId: "missing" })
    ).rejects.toThrow(/Ticket not found/i);
  });
});
