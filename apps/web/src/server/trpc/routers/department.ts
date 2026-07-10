import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@orqafy/db";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { logger } from "@/lib/logger";

// Roles permitted to manage (create/update/delete) departments.
// These are the seeded role NAMES (see packages/db/src/seed/roles.ts) — the tenant
// owner ("Tenant Super Admin"), the tenant operational "Admin", and the cross-tenant
// "Platform Owner". Owner decision (2026-06-19, DECISIONS_LOG): the tenant owner /
// super-admin SHALL be permitted to manage departments in their own tenant. The prior
// list checked a role NAME ("Administrator") that no seeded role carries, which 403'd
// the owner — that stale gate is now resolved.
const DEPARTMENT_MANAGE_ROLES = ["Tenant Super Admin", "Admin", "Platform Owner"];
const _adminReadProcedure = requireRole(...DEPARTMENT_MANAGE_ROLES);
const adminWriteProcedure = writeProcedure.use(({ ctx, next }) => {
  if (!ctx.roles.some((r) => DEPARTMENT_MANAGE_ROLES.includes(r))) {
    // UX: surface a human-readable message so the client toast isn't the bare
    // literal "FORBIDDEN".
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to manage departments.",
    });
  }
  return next({ ctx });
});

const createInput = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  parentId: z.string().cuid().optional(),
}).strict();

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  parentId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const departmentRouter = createTRPCRouter({
  /**
   * List all departments for the current tenant (flat list, clients can nest if needed).
   * Accessible to any authenticated user — used by employee/payroll forms for selects.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.department.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        parentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, employees: true } },
      },
    });
  }),

  /**
   * Create a new department for the current tenant.
   * Enforces tenantId from ctx — never trusts client-supplied tenant.
   */
  create: adminWriteProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    // Guard: if code supplied, ensure uniqueness within tenant
    if (input.code != null && input.code !== "") {
      const existing = await db.department.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Department code "${input.code}" is already in use.`,
        });
      }
    }

    // Guard: parentId must belong to same tenant
    if (input.parentId != null && input.parentId !== "") {
      const parent = await db.department.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Parent department not found." });
      }
    }

    const dept = await db.department.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      },
    });

    logger.info(
      { tenantId: ctx.tenantId, departmentId: dept.id, surface: "settings.departments", action: "create" },
      "department created",
    );
    return dept;
  }),

  /**
   * Update an existing department. Only fields supplied are changed.
   */
  update: adminWriteProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    const existing = await db.department.findUnique({ where: { id: input.id } });
    if (!existing || existing.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
    }

    // Guard: code uniqueness if changing code
    if (input.code != null && input.code !== "" && input.code !== existing.code) {
      const conflict = await db.department.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Department code "${input.code}" is already in use.`,
        });
      }
    }

    const dept = await db.department.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    logger.info(
      { tenantId: ctx.tenantId, departmentId: dept.id, surface: "settings.departments", action: "update" },
      "department updated",
    );
    return dept;
  }),

  /**
   * Delete a department. Blocked if any users or employees still reference it.
   */
  delete: adminWriteProcedure
    .input(z.object({ id: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const existing = await db.department.findUnique({
        where: { id: input.id },
        include: { _count: { select: { users: true, employees: true } } },
      });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
      }

      const refCount = existing._count.users + existing._count.employees;
      if (refCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete department — ${String(refCount)} user(s)/employee(s) still assigned to it.`,
        });
      }

      const deleted = await db.department.delete({ where: { id: input.id } });
      logger.warn(
        { tenantId: ctx.tenantId, departmentId: input.id, surface: "settings.departments", action: "delete" },
        "department deleted",
      );
      return deleted;
    }),
});
