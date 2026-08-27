// Portal credential verifier — the Customer-portal counterpart to
// verify-credentials.ts. Mirrors its exact posture (tenant-scoped lookup,
// generic-error/enumeration-resistant failure, bcrypt compare) so the
// portal login path never leaks which check failed, matching
// security.md "Auth error messages MUST NOT reveal whether the account,
// tenant, or email exists".
import bcrypt from "bcryptjs";
import { prisma as db } from "@orqafy/db";

export interface VerifiedPortalCustomer {
  customerId: string;
  tenantId: string;
  tenantSlug: string;
  customerSecurityVersion: number;
  email: string;
}

/**
 * Tenant-scoped portal verification — portalEmail + password + tenantSlug.
 *
 * Succeeds ONLY when the tenant is active, the Customer row is active,
 * portalEnabled is true, and a portalPasswordHash is set. Returns null on
 * ANY failure (unknown tenant, inactive tenant, unknown portalEmail,
 * inactive customer, portal not enabled, missing hash, wrong password) —
 * never reveals which check failed.
 */
export async function verifyPortalCredentials(input: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<VerifiedPortalCustomer | null> {
  const { email, password, tenantSlug } = input;

  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, isActive: true, slug: true },
  });
  if (tenant?.isActive !== true) return null;

  const customer = await db.customer.findFirst({
    where: { portalEmail: email, tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      portalEmail: true,
      portalPasswordHash: true,
      portalEnabled: true,
      customerSecurityVersion: true,
    },
  });
  if (
    customer?.portalPasswordHash === undefined ||
    customer.portalPasswordHash === null ||
    customer.portalEnabled !== true
  ) {
    return null;
  }

  const valid = await bcrypt.compare(password, customer.portalPasswordHash);
  if (!valid) return null;

  return {
    customerId: customer.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    customerSecurityVersion: customer.customerSecurityVersion,
    email: customer.portalEmail ?? email,
  };
}
