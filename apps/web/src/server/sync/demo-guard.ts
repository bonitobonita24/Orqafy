/**
 * Thrown when a write is attempted against a demo tenant. Callers on a
 * non-tRPC surface (e.g. the mobile-sync Route Handler) catch this and map
 * it to a generic client error — mirrors the tRPC `FORBIDDEN` the
 * `writeProcedure` demo guard throws (apps/web/src/server/trpc/trpc.ts).
 */
export class DemoTenantWriteError extends Error {
  constructor() {
    super("Mutations are disabled in demo mode.");
    this.name = "DemoTenantWriteError";
  }
}

/**
 * Reusable demo-tenant mutation guard for non-tRPC surfaces. Mirrors
 * `writeProcedure`'s `ctx.isDemoTenant === true` check
 * (apps/web/src/server/trpc/trpc.ts) so the mobile-sync REST surface
 * blocks demo-tenant writes identically to every tRPC mutation.
 */
export function assertNotDemoTenant(isDemoTenant: boolean): void {
  if (isDemoTenant) {
    throw new DemoTenantWriteError();
  }
}
