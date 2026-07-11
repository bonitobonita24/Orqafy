/**
 * Compliance router — V32.9 / RA 10173 (Philippine Data Privacy Act)
 * Breach Record management: NPC 72-hr initial notice + 5-business-day full report gate.
 * All procedures are admin-only (Tenant Super Admin | Admin | Platform Owner).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@orqafy/db";
import { createTRPCRouter, writeProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { matrixMiddleware } from "../middleware/matrix";

// Admin roles — must match seeded role names in packages/db/src/seed/roles.ts
//
// Task 5.1 — `list`/`byId` are DELIBERATELY LEFT on this inline `requireRole`
// gate, NOT migrated to the matrix. The `compliance` feature's `view` action
// is seeded broad (true for every internal role, per the Task 3.3
// "view tracks nav-visibility" rule) — routing these RA 10173 breach-record
// reads through `matrixProcedure("compliance","view")` would WIDEN access
// from admin-only to every internal role. See the Task 5.1 handoff report.
const COMPLIANCE_ADMIN_ROLES = ["Tenant Super Admin", "Admin", "Platform Owner"] as const;
const adminProcedure = requireRole(...COMPLIANCE_ADMIN_ROLES);
// Writes — migrated to the data-driven `role_permissions` matrix (feature key
// "compliance"). `writeProcedure` still enforces the demo-tenant mutation
// guard; `matrixMiddleware` resolves the (feature, action) grant on top of
// it. `create` maps to `create`; every lifecycle state-change (update,
// markNpcNotified, markSubjectsNotified, fileReport, close) maps to
// `update` — the Task 3.3 backfill grants Admin both on "compliance".
const complianceCreateProcedure = writeProcedure.use(matrixMiddleware("compliance", "create"));
const complianceUpdateProcedure = writeProcedure.use(matrixMiddleware("compliance", "update"));

/**
 * Add N business days (Mon-Fri) to a date, skipping Sat/Sun.
 * Used for NPC 5-business-day full report deadline (RA 10173 Sec. 20).
 */
function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

const createBreachInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  discoveredAt: z.string().datetime(), // ISO 8601
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedSubjects: z.number().int().min(0).optional(),
}).strict();

const updateBreachInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  affectedSubjects: z.number().int().min(0).nullable().optional(),
}).strict();

const breachRouter = createTRPCRouter({
  list: adminProcedure
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
        db.breachRecord.findMany({
          where,
          orderBy: { discoveredAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        db.breachRecord.count({ where }),
      ]);
      return { items, total };
    }),

  byId: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const record = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!record || record.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }
      return record;
    }),

  create: complianceCreateProcedure
    .input(createBreachInput)
    .mutation(async ({ ctx, input }) => {
      const discoveredAt = new Date(input.discoveredAt);
      const fullReportDueAt = addBusinessDays(discoveredAt, 5);

      const record = await db.breachRecord.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          description: input.description,
          discoveredAt,
          severity: input.severity,
          ...(input.affectedSubjects !== undefined ? { affectedSubjects: input.affectedSubjects } : {}),
          fullReportDueAt,
          reportedById: ctx.userId,
          status: "open",
        },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.create",
          entity: "BreachRecord",
          entityId: record.id,
          after: {
            title: record.title,
            severity: record.severity,
            discoveredAt: record.discoveredAt,
            fullReportDueAt: record.fullReportDueAt,
          },
        },
      });

      return record;
    }),

  update: complianceUpdateProcedure
    .input(updateBreachInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }

      const { id, ...rest } = input;
      const updated = await db.breachRecord.update({
        where: { id },
        data: {
          ...(rest.title !== undefined ? { title: rest.title } : {}),
          ...(rest.description !== undefined ? { description: rest.description } : {}),
          ...(rest.severity !== undefined ? { severity: rest.severity } : {}),
          ...(rest.affectedSubjects !== undefined ? { affectedSubjects: rest.affectedSubjects } : {}),
        },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.update",
          entity: "BreachRecord",
          entityId: id,
          before: {
            title: existing.title,
            severity: existing.severity,
            affectedSubjects: existing.affectedSubjects,
          },
          after: rest,
        },
      });

      return updated;
    }),

  markNpcNotified: complianceUpdateProcedure
    .input(z.object({ id: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }

      const now = new Date();
      const updated = await db.breachRecord.update({
        where: { id: input.id },
        data: { npcNotifiedAt: now, status: "notified" },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.markNpcNotified",
          entity: "BreachRecord",
          entityId: input.id,
          after: { npcNotifiedAt: now, status: "notified" },
        },
      });

      return updated;
    }),

  markSubjectsNotified: complianceUpdateProcedure
    .input(z.object({ id: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }

      const now = new Date();
      const updated = await db.breachRecord.update({
        where: { id: input.id },
        data: { subjectsNotifiedAt: now },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.markSubjectsNotified",
          entity: "BreachRecord",
          entityId: input.id,
          after: { subjectsNotifiedAt: now },
        },
      });

      return updated;
    }),

  fileReport: complianceUpdateProcedure
    .input(z.object({ id: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }

      const now = new Date();
      const updated = await db.breachRecord.update({
        where: { id: input.id },
        data: { fullReportFiledAt: now, status: "reported" },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.fileReport",
          entity: "BreachRecord",
          entityId: input.id,
          after: { fullReportFiledAt: now, status: "reported" },
        },
      });

      return updated;
    }),

  close: complianceUpdateProcedure
    .input(z.object({ id: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.breachRecord.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Breach record not found" });
      }

      const updated = await db.breachRecord.update({
        where: { id: input.id },
        data: { status: "closed" },
      });

      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "compliance.breach.close",
          entity: "BreachRecord",
          entityId: input.id,
          after: { status: "closed" },
        },
      });

      return updated;
    }),
});

export const complianceRouter = createTRPCRouter({
  breach: breachRouter,
});
