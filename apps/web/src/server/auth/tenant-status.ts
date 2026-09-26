/**
 * ORQ-38 — single source of truth for "may this tenant's principals use the
 * app right now?".
 *
 * Two fields can take a tenant offline and they are written by different
 * paths: `platform.suspendTenant` sets `status = "suspended"` (and leaves
 * `isActive` untouched), while `isActive = false` is the older hard-off flag.
 * Every auth gate (login, the Auth.js session/jwt callbacks, mobile bearer +
 * refresh, sync bearer) must treat EITHER as suspended — checking only one
 * of them is how suspension silently failed to block anything.
 *
 * `status = "demo"` and `status = "provisioning"` are NOT suspensions. A
 * missing tenant row fails closed.
 *
 * Callers select `{ isActive: true, status: true }` on the tenant relation in
 * the lookup they already make, so this adds no extra query.
 */
export interface TenantAccessFields {
  isActive: boolean;
  status?: string | null;
}

export const TENANT_ACCESS_SELECT = { isActive: true, status: true } as const;

export function isTenantSuspended(tenant: TenantAccessFields | null | undefined): boolean {
  if (tenant === null || tenant === undefined) return true;
  if (tenant.isActive !== true) return true;
  return tenant.status === "suspended";
}
