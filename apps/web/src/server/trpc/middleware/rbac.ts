import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const requireRole = (...allowedRoles: string[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    const hasRole = ctx.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });

export const requireAnyRole = requireRole;

export const requireAllRoles = (...requiredRoles: string[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    const hasAll = requiredRoles.every((r) => ctx.roles.includes(r));
    if (!hasAll) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
