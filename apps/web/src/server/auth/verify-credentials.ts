// Shared credential-verification core, extracted from NextAuth's
// Credentials `authorize()` (config.ts) so the WEB session flow and the
// MOBILE JWT flow (api/auth/mobile/login) run the exact same tenant lookup +
// bcrypt compare + generic-error posture instead of drifting apart.
//
// Rate limiting is intentionally NOT done here — callers own their own
// `rateLimiters.auth.check(...)` call (web keys by IP via the NextAuth
// request; mobile keys by IP from the Route Handler) so this module stays a
// pure DB+bcrypt verifier.
import bcrypt from "bcryptjs";
import { prisma as db } from "@orqafy/db";
import { isTenantSuspended } from "@/server/auth/tenant-status";

/**
 * ORQ-46 — sentinel thrown by both verifiers when, and ONLY when, a correct
 * email+password pair authenticates against a SUSPENDED tenant. It is never
 * thrown for an unknown tenant/user, a missing hash, or a wrong password —
 * those all still return `null` (the generic, enumeration-resistant failure).
 *
 * Framework-agnostic on purpose (a plain Error, no next-auth import): the web
 * flow maps it to the `tenant_suspended` login-error code (config.ts) and the
 * mobile flow maps it to a 403 (api/auth/mobile/login), each in their own
 * layer. Keeping it here lets both callers share one signal without this
 * module depending on either transport.
 */
export class TenantSuspendedError extends Error {
  constructor() {
    super("TENANT_SUSPENDED");
    this.name = "TenantSuspendedError";
  }
}

export interface VerifiedCredentialsUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  roleId: string;
  tenantSlug: string;
  tenantId: string;
  securityVersion: number;
  isDemoTenant: boolean;
}

/**
 * Tenant-scoped verification — email + password + tenantSlug.
 * This is the WEB login shape (loginSchema in config.ts) and is also
 * available for any future mobile flow that collects a tenant slug
 * (e.g. a tenant picker for a future multi-tenant-per-email model).
 *
 * Returns null on ANY failure that must stay opaque (unknown tenant, unknown
 * user, inactive user, missing hash, wrong password) — never reveals which
 * check failed (enumeration-resistant, matches security.md "Auth error
 * messages MUST NOT reveal whether the account, tenant, or email exists").
 *
 * ORQ-46 EXCEPTION — a SUSPENDED tenant is signalled distinctly, but ONLY
 * after a correct email+password has been proven: the full user lookup +
 * bcrypt compare run first, exactly as they would for an active tenant, so an
 * anonymous or wrong-password attacker cannot tell a suspended workspace apart
 * from any other failed login (no workspace enumeration). Success against a
 * suspended tenant throws `TenantSuspendedError` instead of returning a user.
 */
export async function verifyCredentials(input: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<VerifiedCredentialsUser | null> {
  const { email, password, tenantSlug } = input;

  const isDemoTenant = tenantSlug === "demo";

  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, isActive: true, status: true, slug: true },
  });
  // Unknown tenant → generic null (there is no user to verify; unchanged,
  // enumeration-resistant). A suspended-but-existing tenant is NOT short-
  // circuited here (ORQ-46): the decision is deferred until the password is
  // proven below, so suspension can't leak before authentication.
  if (tenant === null) return null;
  // ORQ-38: check both — rows suspended before ORQ-38b have only `status` set.
  const suspended = isTenantSuspended(tenant);

  const user = await db.user.findFirst({
    where: { email, tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      passwordHash: true,
      securityVersion: true,
      roleId: true,
      role: { select: { name: true } },
    },
  });
  if (user?.passwordHash === undefined || user.passwordHash === "") return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  // ORQ-46: email+password are proven correct. ONLY now may we distinguish a
  // suspended workspace from a successful login — never to a wrong-password or
  // anonymous attacker.
  if (suspended) throw new TenantSuspendedError();

  const roles = [user.role.name];
  const displayName = user.displayName ?? `${user.firstName} ${user.lastName}`;

  return {
    id: user.id,
    email: user.email,
    name: displayName,
    roles,
    roleId: user.roleId,
    tenantSlug: tenant.slug,
    tenantId: tenant.id,
    securityVersion: user.securityVersion,
    isDemoTenant,
  };
}

/**
 * Global-email verification — email + password only, no tenantSlug.
 *
 * MOBILE-SPECIFIC: `apps/mobile`'s `useAuth().login(email, password)` (already
 * built — see src/hooks/use-auth.ts) does not collect or send a tenantSlug.
 * This is safe because `User.email` carries a GLOBAL `@unique` constraint in
 * the schema (packages/db/prisma/schema.prisma) — one email can belong to
 * exactly one tenant, ever. So the tenant is looked up FROM the user row,
 * not the other way around, and the result is otherwise identical in shape
 * and error posture to `verifyCredentials` above.
 */
export async function verifyCredentialsByEmail(input: {
  email: string;
  password: string;
}): Promise<VerifiedCredentialsUser | null> {
  const { email, password } = input;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      passwordHash: true,
      securityVersion: true,
      isActive: true,
      roleId: true,
      role: { select: { name: true } },
      tenant: { select: { id: true, slug: true, isActive: true, status: true } },
    },
  });
  if (user === null || !user.isActive) return null;
  if (user.passwordHash === "") return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  // ORQ-46: reveal suspension ONLY after the password is proven — the lookup +
  // bcrypt compare above run identically for a suspended tenant, so a wrong-
  // password attacker can't distinguish it from any other failed login.
  if (isTenantSuspended(user.tenant)) throw new TenantSuspendedError();

  const roles = [user.role.name];
  const displayName = user.displayName ?? `${user.firstName} ${user.lastName}`;
  const isDemoTenant = user.tenant.slug === "demo";

  return {
    id: user.id,
    email: user.email,
    name: displayName,
    roles,
    roleId: user.roleId,
    tenantSlug: user.tenant.slug,
    tenantId: user.tenant.id,
    securityVersion: user.securityVersion,
    isDemoTenant,
  };
}
