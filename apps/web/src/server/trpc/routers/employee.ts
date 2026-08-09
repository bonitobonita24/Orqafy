import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, writeProcedure } from "../trpc";
import { matrixProcedure, matrixMiddleware } from "../middleware/matrix";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// Migrated to the data-driven `role_permissions` matrix (feature key
// "employees"). Reads use `matrixProcedure` (protectedProcedure +
// matrixMiddleware); mutations compose `writeProcedure.use(matrixMiddleware(...))`
// so the demo-tenant mutation guard survives alongside the matrix grant check.
// `terminate` maps to "update" (it mutates an existing employee's
// dateTerminated field, not create or delete it) — mirrors expense.ts's
// approve/reject → "update" convention.
const employeesViewProcedure = matrixProcedure("employees", "view");
const employeesCreateProcedure = writeProcedure.use(matrixMiddleware("employees", "create"));
const employeesUpdateProcedure = writeProcedure.use(matrixMiddleware("employees", "update"));

async function loadEmployeeForTenant(id: string, ctx: { tenantId: string }) {
  const e = await db.employee.findUnique({ where: { id } });
  if (!e || e.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
  }
  return e;
}

// Roles with authority to terminate an employee. Inline gate (vs. shared
// middleware) keeps the role list visible at the call site — matches the
// approver-gate convention used in dtr.ts. The roster mirrors dtr.ts
// APPROVER_ROLES so the delegated Admin tier can terminate as well as
// approve DTR/leave.
const TERMINATE_ROLES = ["HR Manager", "Admin"] as const;

function requireTerminateAuthority(roles: ReadonlyArray<string>): void {
  if (!roles.some((r) => (TERMINATE_ROLES as ReadonlyArray<string>).includes(r))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only an HR Manager or Admin can terminate an employee.",
    });
  }
}

const employeeInput = z.object({
  userId: z.string().cuid(),
  departmentId: z.string().cuid().optional(),
  position: z.string().max(200).optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "probationary"]).default("full_time"),
  dateHired: z.date(),
  baseSalary: z.number().positive().optional(),
  dailyRate: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  sssNumber: z.string().max(50).optional(),
  philhealthNumber: z.string().max(50).optional(),
  pagibigNumber: z.string().max(50).optional(),
  tinNumber: z.string().max(50).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
}).strict();

export const employeeRouter = createTRPCRouter({
  list: employeesViewProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        departmentId: z.string().cuid().optional(),
        employmentType: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const searchWhere = input.search !== undefined && input.search !== ""
        ? {
            user: {
              OR: [
                { firstName: { contains: input.search, mode: "insensitive" as const } },
                { lastName: { contains: input.search, mode: "insensitive" as const } },
                { email: { contains: input.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {};
      const where = {
        tenantId: ctx.tenantId,
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
        ...(input.employmentType !== undefined && input.employmentType !== "" ? { employmentType: input.employmentType } : {}),
        ...searchWhere,
      };
      const [items, total] = await Promise.all([
        db.employee.findMany({
          where,
          include: {
            user: { select: { firstName: true, lastName: true, displayName: true, email: true } },
            department: { select: { name: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.employee.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: employeesViewProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      await loadEmployeeForTenant(input.id, ctx);
      const item = await db.employee.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { firstName: true, lastName: true, displayName: true, email: true, isActive: true } },
          department: true,
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: employeesCreateProcedure
    .input(employeeInput)
    .mutation(async ({ input, ctx }) => {
      const user = await db.user.findUnique({ where: { id: input.userId } });
      if (!user || user.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User not found." });
      }
      if (input.departmentId !== undefined) {
        const department = await db.department.findUnique({ where: { id: input.departmentId } });
        if (!department || department.tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Department not found." });
        }
      }
      const employeeNumber = `EMP-${Date.now()}`;
      return db.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            tenantId: ctx.tenantId,
            userId: input.userId,
            departmentId: input.departmentId ?? null,
            position: input.position ?? null,
            employmentType: input.employmentType,
            dateHired: input.dateHired,
            baseSalary: input.baseSalary ?? null,
            dailyRate: input.dailyRate ?? null,
            hourlyRate: input.hourlyRate ?? null,
            sssNumber: input.sssNumber ?? null,
            philhealthNumber: input.philhealthNumber ?? null,
            pagibigNumber: input.pagibigNumber ?? null,
            tinNumber: input.tinNumber ?? null,
            bankName: input.bankName ?? null,
            bankAccountNumber: input.bankAccountNumber ?? null,
            emergencyContactName: input.emergencyContactName ?? null,
            emergencyContactPhone: input.emergencyContactPhone ?? null,
            employeeNumber,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Employee",
          entityId: created.id,
          before: null,
          after: {
            id: created.id,
            userId: created.userId,
            employeeNumber: created.employeeNumber,
            position: created.position,
            employmentType: created.employmentType,
            dateHired: created.dateHired.toISOString(),
          },
        });
        return created;
      });
    }),

  update: employeesUpdateProcedure
    .input(employeeInput.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const { id, userId: _userId, ...rest } = input;
      await loadEmployeeForTenant(id, ctx);
      const existing = await db.employee.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (rest.departmentId !== undefined && rest.departmentId !== null) {
        const department = await db.department.findUnique({ where: { id: rest.departmentId } });
        if (!department || department.tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Department not found." });
        }
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: {
            ...(rest.departmentId !== undefined ? { departmentId: rest.departmentId ?? null } : {}),
            ...(rest.position !== undefined ? { position: rest.position ?? null } : {}),
            ...(rest.employmentType !== undefined ? { employmentType: rest.employmentType } : {}),
            ...(rest.dateHired !== undefined ? { dateHired: rest.dateHired } : {}),
            ...(rest.baseSalary !== undefined ? { baseSalary: rest.baseSalary ?? null } : {}),
            ...(rest.dailyRate !== undefined ? { dailyRate: rest.dailyRate ?? null } : {}),
            ...(rest.hourlyRate !== undefined ? { hourlyRate: rest.hourlyRate ?? null } : {}),
            ...(rest.sssNumber !== undefined ? { sssNumber: rest.sssNumber ?? null } : {}),
            ...(rest.philhealthNumber !== undefined ? { philhealthNumber: rest.philhealthNumber ?? null } : {}),
            ...(rest.pagibigNumber !== undefined ? { pagibigNumber: rest.pagibigNumber ?? null } : {}),
            ...(rest.tinNumber !== undefined ? { tinNumber: rest.tinNumber ?? null } : {}),
            ...(rest.bankName !== undefined ? { bankName: rest.bankName ?? null } : {}),
            ...(rest.bankAccountNumber !== undefined ? { bankAccountNumber: rest.bankAccountNumber ?? null } : {}),
            ...(rest.emergencyContactName !== undefined ? { emergencyContactName: rest.emergencyContactName ?? null } : {}),
            ...(rest.emergencyContactPhone !== undefined ? { emergencyContactPhone: rest.emergencyContactPhone ?? null } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Employee",
          entityId: id,
          before: {
            position: existing.position,
            employmentType: existing.employmentType,
            departmentId: existing.departmentId,
            dateHired: existing.dateHired.toISOString(),
          },
          after: {
            position: updated.position,
            employmentType: updated.employmentType,
            departmentId: updated.departmentId,
            dateHired: updated.dateHired.toISOString(),
          },
        });
        return updated;
      });
    }),

  terminate: employeesUpdateProcedure
    .input(z.object({ id: z.string().cuid(), dateTerminated: z.date() }).strict())
    .mutation(async ({ input, ctx }) => {
      requireTerminateAuthority(ctx.roles);
      const existing = await loadEmployeeForTenant(input.id, ctx);
      if (existing.dateTerminated != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This employee has already been terminated.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id: input.id },
          data: { dateTerminated: input.dateTerminated },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Employee",
          entityId: input.id,
          before: { dateTerminated: existing.dateTerminated ? existing.dateTerminated.toISOString() : null },
          after: { dateTerminated: updated.dateTerminated ? updated.dateTerminated.toISOString() : null },
        });
        return updated;
      });
    }),

  departments: employeesViewProcedure.query(async ({ ctx }) => {
    return db.department.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }),
});
