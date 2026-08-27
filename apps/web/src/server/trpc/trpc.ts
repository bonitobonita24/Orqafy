import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TRPCContext } from "./context";
import { rateLimiters } from "@/server/lib/rate-limit";

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

export const protectedProcedure = t.procedure.use(({ ctx, type, next }) => {
  if (ctx.userId === null || ctx.tenantSlug === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // Rate limiting is a runtime concern — unit tests assert business logic, not
  // throttling. The shared module-singleton limiter cache would otherwise pollute
  // the vitest suite, which fires many mutations per userId within 60s.
  if (type === "mutation" && process.env.NODE_ENV !== "test") {
    rateLimiters.api.check(ctx.userId);
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

// Customer-portal procedure (T1.2/T1.3) — the portal counterpart to
// protectedProcedure. Requires ctx.principalType === "customer" (a staff
// session/context is deny-by-default here, mirroring how a customer ctx is
// deny-by-default on protectedProcedure/matrixProcedure — neither procedure
// family trusts the other's principal). Also denies an unauthenticated
// request and an invalidated customer session (ctx.customerId is null in
// both cases — createTRPCContext collapses "invalidated" to the same
// unauthenticated shape as "never signed in").
export const portalProcedure = t.procedure.use(({ ctx, next }) => {
  if (
    ctx.principalType !== "customer" ||
    ctx.customerId === null ||
    ctx.customerId === undefined ||
    ctx.tenantSlug === null
  ) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      customerId: ctx.customerId,
      tenantSlug: ctx.tenantSlug,
      tenantId: ctx.tenantId!,
    },
  });
});

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

// Tenant/platform role-management procedure — requires "Tenant Super Admin" or
// "Platform Owner" (tenant-rbac-standard.md §4: "Only Tenant Super Admin (+
// platform Platform Owner) may create/edit/assign custom roles"). Tenant-scoped
// (unlike platformProcedure) — a Tenant Super Admin manages ONLY their own tenant.
export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ctx.roles.includes("Tenant Super Admin") || ctx.roles.includes("Platform Owner");
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
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
