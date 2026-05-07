import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.userId === null || ctx.tenantSlug === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      tenantSlug: ctx.tenantSlug,
      tenantId: ctx.tenantId!,
    },
  });
});

export const middleware = t.middleware;

// Platform Owner procedure — requires "Platform Owner" role; no tenant scoping
export const platformProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.roles.includes("Platform Owner")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

// Demo-safe write procedure — blocks mutations on demo tenant
export const writeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.isDemoTenant === true) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mutations are disabled in demo mode.",
    });
  }
  return next({ ctx });
});
