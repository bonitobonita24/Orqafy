import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";
import { hasPermission } from "@orqafy/db";
import type { FeatureKey, PermissionAction } from "@orqafy/shared/rbac";
import { protectedProcedure, middleware } from "../trpc";

/**
 * Data-driven RBAC matrix middleware (tenant-rbac-standard.md §4, surface 1
 * of 3 — tRPC). Resolves the caller's effective permission for
 * (feature, action) from the `role_permissions` matrix via `hasPermission`.
 * Deny-by-default: a missing roleId, a role in another tenant, or a missing
 * matrix row all resolve to FORBIDDEN.
 *
 * Never trust a client-sent role — roleId is always read from ctx (derived
 * server-side from the session), never from router input.
 *
 * Exported as a standalone middleware (not just a full procedure) so callers
 * that need to compose it with another base procedure — e.g. `writeProcedure`
 * for its demo-tenant mutation guard — can do
 * `writeProcedure.use(matrixMiddleware(feature, action))` instead of losing
 * that guard by starting over from `protectedProcedure`.
 */
export const matrixMiddleware = (feature: FeatureKey, action: PermissionAction) =>
  middleware(async ({ ctx, next }) => {
    // Deny-by-default: a missing roleId OR a missing tenant context (matrix
    // features are strictly tenant-scoped) resolves to FORBIDDEN. The
    // tenantId null-check also narrows ctx.tenantId to `string` for the
    // hasPermission call below.
    if (ctx.roleId === null || ctx.roleId === undefined || ctx.tenantId === null) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const allowed = await hasPermission(prisma, {
      tenantId: ctx.tenantId,
      roleId: ctx.roleId,
      feature,
      action,
    });

    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Re-narrow the downstream context. This standalone middleware is built on
    // the root `middleware`, so it sees the un-narrowed root ctx (tenantId:
    // string | null) and — when composed via writeProcedure.use(...) — would
    // otherwise erase the base procedure's tenantId narrowing. tRPC MERGES the
    // ctx passed to next() (other fields such as session/userId survive), so
    // this restores non-null `tenantId`/`roleId` for every matrix-composed
    // handler. See tRPC authorization docs (isAuthed narrowing pattern).
    return next({ ctx: { tenantId: ctx.tenantId, roleId: ctx.roleId } });
  });

/**
 * Convenience procedure — `protectedProcedure` + `matrixMiddleware`. Use this
 * for read (`view`) procedures that need no additional base guard. Mutation
 * procedures that must also block demo-tenant writes should instead compose
 * `writeProcedure.use(matrixMiddleware(feature, action))` directly.
 */
export const matrixProcedure = (feature: FeatureKey, action: PermissionAction) =>
  protectedProcedure.use(matrixMiddleware(feature, action));
