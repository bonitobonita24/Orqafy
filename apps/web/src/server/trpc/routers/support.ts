/**
 * Phase 8 Batch 5 Item 1 — Support/Tickets Phase 1 Backend
 *
 * ticket:     list / byId / create / update / assign / changeStatus / close
 * comment:    list / create
 * attachment: list
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

// Schema stores status + priority as String (not Prisma enums) — comments in
// schema.prisma define the allowed values.
const TICKET_STATUS = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
const TICKET_PRIORITY = ["low", "medium", "high", "critical"] as const;
type TicketStatus = (typeof TICKET_STATUS)[number];
const ticketStatusSchema = z.enum(TICKET_STATUS);
const ticketPrioritySchema = z.enum(TICKET_PRIORITY);

// ── Tenant helper ─────────────────────────────────────────────────────────────

async function loadTicketForTenant(id: string, ctx: { tenantId: string }) {
  const t = await db.supportTicket.findUnique({ where: { id } });
  if (!t || t.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
  }
  return t;
}

// ── Sequence helper ───────────────────────────────────────────────────────────

async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `TK-${yy}${mm}-`;

  const last = await db.supportTicket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  const seq = last ? Number(last.ticketNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── State machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting"],
  in_progress: ["waiting", "resolved"],
  waiting: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

// ── Sub-routers ───────────────────────────────────────────────────────────────

const ticketRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: ticketStatusSchema.optional(),
        priority: ticketPrioritySchema.optional(),
        assignedToId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, priority, assignedToId, page, limit } = input;
      const where = {
        tenantId: ctx.tenantId,
        ...(status !== undefined ? { status } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(assignedToId !== undefined ? { assignedToId } : {}),
      };
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        db.supportTicket.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        }),
        db.supportTicket.count({ where }),
      ]);

      return { items, total };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await loadTicketForTenant(input.id, ctx);

      const ticket = await db.supportTicket.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          attachments: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      return ticket;
    }),

  create: writeProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        category: z.string().optional(),
        priority: ticketPrioritySchema.optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const ticketNumber = await generateTicketNumber();

      return db.supportTicket.create({
        data: {
          ticketNumber,
          tenantId: ctx.tenantId,
          createdById: ctx.userId,
          title: input.title,
          description: input.description,
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
        },
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).optional(),
        category: z.string().nullable().optional(),
        priority: ticketPrioritySchema.optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadTicketForTenant(input.id, ctx);

      const isAdmin =
        ctx.roles?.includes("Administrator") === true ||
        ctx.roles?.includes("Manager") === true;

      if (!isAdmin && existing.createdById !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the creator or an admin can update this ticket",
        });
      }

      const { id, ...rest } = input;

      return db.supportTicket.update({
        where: { id },
        data: {
          ...(rest.title !== undefined ? { title: rest.title } : {}),
          ...(rest.description !== undefined ? { description: rest.description } : {}),
          ...(rest.category !== undefined ? { category: rest.category } : {}),
          ...(rest.priority !== undefined ? { priority: rest.priority } : {}),
        },
      });
    }),

  assign: writeProcedure
    .input(
      z.object({
        id: z.string(),
        assignedToId: z.string().nullable(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const isAdmin =
        ctx.roles?.includes("Administrator") === true ||
        ctx.roles?.includes("Manager") === true;

      if (!isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators or managers can assign tickets",
        });
      }

      const existing = await loadTicketForTenant(input.id, ctx);

      // Tenant-isolation: the assignee (when not unassigning) must belong to
      // the caller's tenant — otherwise a ticket could be handed to a
      // cross-tenant user, leaking that user's identity/reference.
      if (input.assignedToId !== null) {
        const assignee = await db.user.findUnique({ where: { id: input.assignedToId } });
        if (!assignee || assignee.tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found." });
        }
      }

      const newStatus =
        input.assignedToId !== null && existing.status === "open"
          ? "in_progress"
          : existing.status;

      return db.supportTicket.update({
        where: { id: input.id },
        data: {
          assignedToId: input.assignedToId,
          status: newStatus,
        },
      });
    }),

  changeStatus: writeProcedure
    .input(
      z.object({
        id: z.string(),
        status: ticketStatusSchema,
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadTicketForTenant(input.id, ctx);

      const allowed = VALID_TRANSITIONS[existing.status as TicketStatus] ?? [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid status transition from ${existing.status} to ${input.status}`,
        });
      }

      const now = new Date();

      return db.supportTicket.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === "resolved" ? { resolvedAt: now } : {}),
          ...(input.status === "closed" ? { closedAt: now } : {}),
          ...(existing.status === "resolved" && input.status === "in_progress"
            ? { resolvedAt: null }
            : {}),
        },
      });
    }),

  close: writeProcedure
    .input(z.object({ id: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadTicketForTenant(input.id, ctx);

      if (existing.status !== "resolved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only resolved tickets can be closed",
        });
      }

      return db.supportTicket.update({
        where: { id: input.id },
        data: {
          status: "closed",
          closedAt: new Date(),
        },
      });
    }),
});

const commentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      await loadTicketForTenant(input.ticketId, ctx);

      const isPrivileged =
        ctx.roles?.includes("Administrator") === true ||
        ctx.roles?.includes("Manager") === true;

      return db.ticketComment.findMany({
        where: {
          ticketId: input.ticketId,
          ...(!isPrivileged ? { isInternal: false } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      });
    }),

  create: writeProcedure
    .input(
      z.object({
        ticketId: z.string(),
        content: z.string().min(1),
        isInternal: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await loadTicketForTenant(input.ticketId, ctx);

      const isPrivileged =
        ctx.roles?.includes("Administrator") === true ||
        ctx.roles?.includes("Manager") === true;

      const isInternal =
        input.isInternal === true && isPrivileged ? true : false;

      return db.ticketComment.create({
        data: {
          ticketId: input.ticketId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          content: input.content,
          isInternal,
        },
      });
    }),
});

const attachmentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      await loadTicketForTenant(input.ticketId, ctx);

      return db.ticketAttachment.findMany({
        where: { ticketId: input.ticketId },
        orderBy: { createdAt: "desc" },
      });
    }),
});

// ── Root export ───────────────────────────────────────────────────────────────

export const supportRouter = createTRPCRouter({
  ticket: ticketRouter,
  comment: commentRouter,
  attachment: attachmentRouter,
});
