import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import {
  RbacGuardrailError,
  assertNoForbiddenFeatures,
  assertWithinAdminCeiling,
  assertCanManageRoles,
  assertSystemRoleImmutable,
  type PermissionMatrix,
} from "@orqafy/db";
import { FEATURE_KEYS, featureKeySchema, type FeatureKey } from "@orqafy/shared/rbac";
import { createTRPCRouter, protectedProcedure, superAdminProcedure } from "../trpc";

/**
 * Custom-role permission-matrix router (tenant-rbac-standard.md §4 role-builder
 * backend). Only Tenant Super Admin / Platform Owner may create, edit, or assign
 * custom roles (§4 guardrails) — enforced by `superAdminProcedure` plus the
 * defense-in-depth `assertCanManageRoles` guardrail call below.
 */

const ADMIN_ROLE_SLUG = "admin";

const permissionRowInput = z
  .object({
    featureKey: featureKeySchema,
    view: z.boolean(),
    create: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  })
  .strict();

const createInput = z
  .object({
    name: z.string().min(1).max(100),
    permissions: z.array(permissionRowInput),
  })
  .strict();

const updateInput = z
  .object({
    roleId: z.string().cuid(),
    permissions: z.array(permissionRowInput),
  })
  .strict();

const assignInput = z
  .object({
    userId: z.string().cuid(),
    roleId: z.string().cuid(),
  })
  .strict();

/** Resolves the caller's "acting role name" for the guardrail's `actorRoleName`
 * argument. superAdminProcedure already restricts callers to these two names —
 * this is defense-in-depth, not the primary gate. */
function actorRoleName(roles: string[]): string {
  if (roles.includes("Platform Owner")) return "Platform Owner";
  if (roles.includes("Tenant Super Admin")) return "Tenant Super Admin";
  return roles[0] ?? "";
}

/** Re-throws an RbacGuardrailError as a tRPC FORBIDDEN; anything else rethrows as-is. */
function rethrowGuardrailError(e: unknown): never {
  if (e instanceof RbacGuardrailError) {
    throw new TRPCError({ code: "FORBIDDEN", message: e.message });
  }
  throw e;
}

/** Fetches the tenant's "Admin" role's matrix rows — the ceiling every custom
 * role must stay within (tenant-rbac-standard.md §4 guardrails). */
async function loadAdminCeiling(tenantId: string): Promise<PermissionMatrix> {
  const adminRole = await db.role.findFirst({ where: { tenantId, slug: ADMIN_ROLE_SLUG } });
  if (!adminRole) {
    // Should never happen post-seed, but fail closed (empty ceiling = nothing passes).
    return [];
  }
  const rows = await db.rolePermission.findMany({ where: { tenantId, roleId: adminRole.id } });
  return rows.map((row) => ({
    featureKey: row.featureKey as FeatureKey,
    view: row.view,
    create: row.create,
    update: row.update,
    delete: row.delete,
  }));
}

export const roleRouter = createTRPCRouter({
  /**
   * List all roles for the current tenant with their permission matrix rows.
   * Read-only — used by the role-builder UI (view list) and the sidebar nav
   * filter's underlying data.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const roles = await db.role.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { rolePermissions: true },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      sortOrder: role.sortOrder,
      permissions: role.rolePermissions.map((row) => ({
        featureKey: row.featureKey as FeatureKey,
        view: row.view,
        create: row.create,
        update: row.update,
        delete: row.delete,
      })),
    }));
  }),

  /**
   * The CALLER's own resolved permission set — the list of feature keys where
   * the caller has `view=true`. Consumed by the sidebar nav filter. Platform
   * Owner / Tenant Super Admin bypass the matrix entirely (full view set) per
   * has-permission.ts `MATRIX_BYPASS_ROLE_NAMES`.
   */
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.roles.includes("Platform Owner") || ctx.roles.includes("Tenant Super Admin")) {
      return { view: [...FEATURE_KEYS] as FeatureKey[] };
    }
    if (ctx.roleId === null || ctx.roleId === undefined) {
      return { view: [] as FeatureKey[] };
    }
    const rows = await db.rolePermission.findMany({
      where: { tenantId: ctx.tenantId, roleId: ctx.roleId, view: true },
      select: { featureKey: true },
    });
    return { view: rows.map((r) => r.featureKey as FeatureKey) };
  }),

  /**
   * Create a new custom role + its permission-matrix rows for the current
   * tenant. Guardrails (in order): only Tenant Super Admin/Platform Owner may
   * manage roles, no Billing/Users grant, and the matrix must stay within the
   * tenant's Admin-role ceiling.
   */
  create: superAdminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    try {
      assertCanManageRoles(actorRoleName(ctx.roles));
      assertNoForbiddenFeatures(input.permissions);
      const ceiling = await loadAdminCeiling(ctx.tenantId);
      assertWithinAdminCeiling(input.permissions, ceiling);
    } catch (e) {
      rethrowGuardrailError(e);
    }

    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const created = await db.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          slug: slug.length > 0 ? slug : `role_${Date.now()}`,
          isSystem: false,
        },
      });

      if (input.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: input.permissions.map((row) => ({
            tenantId: ctx.tenantId,
            roleId: role.id,
            featureKey: row.featureKey,
            view: row.view,
            create: row.create,
            update: row.update,
            delete: row.delete,
          })),
        });
      }

      await writeAuditLog(tx, {
        userId: ctx.userId,
        action: "CREATE",
        entity: "Role",
        entityId: role.id,
        before: null,
        after: { name: role.name, slug: role.slug, permissions: input.permissions },
      });

      return role;
    });

    return { id: created.id, name: created.name, slug: created.slug };
  }),

  /**
   * Edit an existing custom role's permission matrix. The 3 fixed system-tier
   * roles (Platform Owner / Tenant Super Admin / Admin) can never be
   * matrix-edited — enforced by `assertSystemRoleImmutable`.
   */
  update: superAdminProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const role = await db.role.findUnique({ where: { id: input.roleId } });
    if (!role || role.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    try {
      assertCanManageRoles(actorRoleName(ctx.roles));
      assertSystemRoleImmutable(role);
      assertNoForbiddenFeatures(input.permissions);
      const ceiling = await loadAdminCeiling(ctx.tenantId);
      assertWithinAdminCeiling(input.permissions, ceiling);
    } catch (e) {
      rethrowGuardrailError(e);
    }

    await db.$transaction(async (tx) => {
      for (const row of input.permissions) {
        await tx.rolePermission.upsert({
          where: {
            tenantId_roleId_featureKey: {
              tenantId: ctx.tenantId,
              roleId: role.id,
              featureKey: row.featureKey,
            },
          },
          update: { view: row.view, create: row.create, update: row.update, delete: row.delete },
          create: {
            tenantId: ctx.tenantId,
            roleId: role.id,
            featureKey: row.featureKey,
            view: row.view,
            create: row.create,
            update: row.update,
            delete: row.delete,
          },
        });
      }

      await writeAuditLog(tx, {
        userId: ctx.userId,
        action: "UPDATE",
        entity: "Role",
        entityId: role.id,
        before: null,
        after: { permissions: input.permissions },
      });
    });

    return { id: role.id, success: true };
  }),

  /**
   * Assign a role to a user within the current tenant. Never changes
   * `isTenantOwner` and never demotes the sole tenant owner directly (Q-U1
   * ruling) — an owner-role reassignment must go through `transferOwnership`
   * (user router) or the platform break-glass `reassignTenantOwner`, never
   * duplicated here. Bumps the target's `securityVersion` so the role change
   * is picked up on next session check (role/tenant-change invalidation).
   */
  assign: superAdminProcedure.input(assignInput).mutation(async ({ ctx, input }) => {
    assertCanManageRoles(actorRoleName(ctx.roles));

    const target = await db.user.findUnique({ where: { id: input.userId } });
    if (!target || target.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (target.isTenantOwner) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Cannot reassign the tenant owner's role directly. Use transferOwnership (or the platform reassignTenantOwner break-glass) to change ownership first.",
      });
    }

    const role = await db.role.findUnique({ where: { id: input.roleId } });
    if (!role || role.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const before = { roleId: target.roleId };
    const updated = await db.user.update({
      where: { id: input.userId },
      data: { roleId: input.roleId, securityVersion: { increment: 1 } },
      select: { id: true, roleId: true },
    });

    await writeAuditLog(db, {
      userId: ctx.userId,
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      before,
      after: { roleId: updated.roleId },
    });

    return { success: true };
  }),
});
