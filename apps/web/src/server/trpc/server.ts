import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/server/auth";
import { createCallerFactory } from "./trpc";
import { appRouter } from "./routers/_app";
import type { TRPCContext } from "./context";

/**
 * F1 (Phase 7) — RSC → tRPC server-caller.
 *
 * Lets React Server Components and Server Actions invoke tRPC procedures
 * directly (server-to-server, no HTTP round-trip) instead of reading Prisma
 * ad hoc. Routing reads/mutations through the router gives every call the same
 * Auth.js v5 session + tenant resolution, L3 RBAC middleware, and L5 AuditLog
 * guarantees that the HTTP API path already enforces.
 *
 * Mirrors `createTRPCContext` (context.ts) but resolves the request context
 * from `next/headers` + `auth()` rather than a `NextRequest`, since RSC has no
 * incoming `NextRequest` object. The synthesized `req` exposes a `headers`
 * getter so procedures that read `ctx.req.headers` (e.g. IP for rate-limiting)
 * keep working unchanged.
 *
 * Usage (in an RSC page or Server Action):
 *   const api = await createServerCaller();
 *   const invoices = await api.invoice.list({ page: 1 });
 */
export async function createServerCaller() {
  const ctx = await createServerContext();
  const createCaller = createCallerFactory(appRouter);
  return createCaller(ctx);
}

/**
 * Builds a TRPCContext for the current server request from the Auth.js session
 * and the incoming request headers. Memoized per-request via React `cache` so
 * repeated `createServerCaller()` calls within one render share one resolution.
 */
const createServerContext = cache(async (): Promise<TRPCContext> => {
  const session = await auth();
  const requestHeaders = await headers();

  // Synthesize the minimal `req` shape procedures rely on (only `.headers`).
  const req = { headers: requestHeaders } as unknown as TRPCContext["req"];

  if (!session?.user || session.user.error === "SESSION_INVALIDATED") {
    return {
      req,
      userId: null,
      roles: [],
      tenantSlug: null,
      tenantId: null,
      securityVersion: 0,
      isDemoTenant: false,
      session: null,
    };
  }

  return {
    req,
    userId: session.user.id,
    roles: session.user.roles,
    tenantSlug: session.user.tenantSlug,
    tenantId: session.user.tenantId,
    securityVersion: session.user.securityVersion,
    isDemoTenant: session.user.isDemoTenant,
    session,
  };
});
