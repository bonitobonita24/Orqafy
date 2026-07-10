/**
 * Data Subject Rights router — V32.9 / RA 10173 (Philippine Data Privacy Act)
 * Covers all 6 rights: access | rectify | erase | port | object | inform
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@orqafy/db";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";

// Admin roles that may manage DSR requests on behalf of the tenant.
// Must match the seeded role names in packages/db/src/seed/roles.ts.
const DSR_ADMIN_ROLES = ["Tenant Super Admin", "Admin", "Platform Owner"] as const;
const adminProcedure = requireRole(...DSR_ADMIN_ROLES);
const adminWriteProcedure = writeProcedure.use(({ ctx, next }) => {
  if (!ctx.roles.some((r) => (DSR_ADMIN_ROLES as readonly string[]).includes(r))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to manage DSR requests." });
  }
  return next({ ctx });
});

// Safe User select — never expose passwordHash
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  phone: true,
  createdAt: true,
  roleId: true,
  departmentId: true,
} as const;

export const dsrRouter = createTRPCRouter({
  /**
   * inform — Static privacy notice metadata (Art. 16 RA 10173 right to be informed)
   * Public-ish but requires session so we know who is asking.
   */
  inform: protectedProcedure.query(() => {
    return {
      controller: "Powerbyte IT Solutions",
      dpoContact: "bonitobonita24@gmail.com",
      lawfulBases: [
        "Fulfillment of a contract to which the data subject is a party",
        "Compliance with a legal obligation",
        "Legitimate interests pursued by the personal information controller",
      ],
      rights: [
        "Right to be informed (Section 16)",
        "Right to access (Section 16)",
        "Right to object (Section 34)",
        "Right to erasure or blocking (Section 16)",
        "Right to rectification (Section 16)",
        "Right to data portability (Section 18)",
        "Right to file a complaint with the NPC",
      ],
      retentionPolicies: {
        payroll: "7 years — BIR compliance",
        auditLogs: "5 years — NPC recommendation",
        general: "3 years after last activity or contract end",
      },
      npcWebsite: "https://www.privacy.gov.ph",
    };
  }),

  /**
   * access — Data subject accesses their own personal data (Section 16 RA 10173)
   */
  access: protectedProcedure.query(async ({ ctx }) => {
    const [user, employee, activityLogs] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: SAFE_USER_SELECT,
      }),
      db.employee.findFirst({
        where: { userId: ctx.userId, tenantId: ctx.tenantId },
      }),
      db.auditLog.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    return { subject: user, employee, activityLogs };
  }),

  /**
   * port — Structured copy for data portability (Section 18 RA 10173)
   */
  port: protectedProcedure.query(async ({ ctx }) => {
    const [user, employee, activityLogs] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: SAFE_USER_SELECT,
      }),
      db.employee.findFirst({
        where: { userId: ctx.userId, tenantId: ctx.tenantId },
      }),
      db.auditLog.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      subject: user,
      employee: employee ?? null,
      activity: activityLogs,
    };
  }),

  /**
   * rectify — Correct inaccurate personal data (Section 16 RA 10173)
   */
  rectify: writeProcedure
    .input(
      z
        .object({
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
          displayName: z.string().min(1).max(150).optional(),
          phone: z.string().max(30).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await db.user.update({
        where: { id: ctx.userId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
        select: SAFE_USER_SELECT,
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "dsr.rectify",
          entity: "User",
          entityId: ctx.userId,
          after: input,
        },
      });

      return updated;
    }),

  /**
   * requestErasure — Submit an erasure request (Section 16 RA 10173)
   * Does NOT delete data — ERP/payroll legal retention applies.
   */
  requestErasure: writeProcedure
    .input(z.object({ reason: z.string().max(1000).optional() }).strict())
    .mutation(async ({ ctx, input }) => {
      const request = await db.dataSubjectRequest.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          type: "erase",
          status: "received",
          details: { reason: input.reason ?? null },
        },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "dsr.requestErasure",
          entity: "DataSubjectRequest",
          entityId: request.id,
          after: { type: "erase", reason: input.reason ?? null },
        },
      });

      return request;
    }),

  /**
   * object — Submit an objection to processing (Section 34 RA 10173)
   */
  object: writeProcedure
    .input(
      z.object({
        reason: z.string().max(1000).optional(),
        scope: z.string().max(200).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const request = await db.dataSubjectRequest.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          type: "object",
          status: "received",
          details: { reason: input.reason ?? null, scope: input.scope ?? null },
        },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "dsr.object",
          entity: "DataSubjectRequest",
          entityId: request.id,
          after: { type: "object", reason: input.reason ?? null, scope: input.scope ?? null },
        },
      });

      return request;
    }),

  /**
   * myRequests — List the caller's own DSR requests
   */
  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return db.dataSubjectRequest.findMany({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ─── Admin procedures ────────────────────────────────────────────────────────

  /**
   * adminList — Paginated list of all DSR requests for the tenant
   */
  adminList: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.status != null && input.status !== "" ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.dataSubjectRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        db.dataSubjectRequest.count({ where }),
      ]);
      return { items, total };
    }),

  /**
   * adminUpdateStatus — Advance a DSR to in_progress | completed | rejected
   */
  adminUpdateStatus: adminWriteProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["in_progress", "completed", "rejected"]),
        resolution: z.string().max(2000).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await db.dataSubjectRequest.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      const isTerminal = input.status === "completed" || input.status === "rejected";

      const updated = await db.dataSubjectRequest.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
          handledById: ctx.userId,
          ...(isTerminal ? { resolvedAt: new Date() } : {}),
        },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "dsr.adminUpdateStatus",
          entity: "DataSubjectRequest",
          entityId: input.id,
          before: { status: existing.status },
          after: { status: input.status, resolution: input.resolution },
        },
      });

      return updated;
    }),
});
