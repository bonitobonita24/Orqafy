import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  STANDARD_ROLES,
  TENANT_SUPER_ADMIN_SLUG,
  PASSWORD_BCRYPT_COST,
} from '../seed/roles';
import { backfillRolePermissions } from '../seed/role-permissions';

/**
 * Roles and User are @@schema("public") models scoped by tenantId — they are NOT
 * stored in the tenant's PostgreSQL schema. So seeding roles + the owner user is a
 * set of plain public-table upserts keyed on tenantId, exactly as the seed does it
 * for the demo tenant.
 */

export interface ProvisionTenantOwnerInput {
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
  /** Plaintext password from the provisioning job — bcrypt-hashed here (cost 12). */
  ownerPassword: string;
}

/**
 * Seed the full standard 13-role set into a tenant and create its owner user
 * (Tenant Super Admin, ready-to-login, bcrypt-hashed password).
 *
 * Idempotent: roles upsert on (tenantId, slug); the owner user upserts on email.
 * Safe to re-run after a partial/failed provisioning attempt — no duplicates.
 *
 * Mirrors the demo-tenant logic in packages/db/src/seed/index.ts exactly
 * (same role defs, same bcrypt cost, same role→user link, same User flags).
 */
export async function provisionTenantRolesAndOwner(
  prisma: PrismaClient,
  input: ProvisionTenantOwnerInput,
): Promise<{ ownerUserId: string; superAdminRoleId: string }> {
  const { tenantId, ownerEmail, ownerName, ownerPassword } = input;

  // ── Seed the full standard role set for this tenant (idempotent) ──
  const roleIdBySlug: Record<string, string> = {};
  for (const r of STANDARD_ROLES) {
    const role = await prisma.role.upsert({
      where: { tenantId_slug: { tenantId, slug: r.slug } },
      update: {},
      create: {
        name: r.name,
        slug: r.slug,
        tenantId,
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
        permissions: JSON.stringify(r.permissions),
      },
    });
    roleIdBySlug[r.slug] = role.id;
  }

  const superAdminRoleId = roleIdBySlug[TENANT_SUPER_ADMIN_SLUG];
  if (superAdminRoleId === undefined) {
    throw new Error(`${TENANT_SUPER_ADMIN_SLUG} role not found after seeding`);
  }

  // ── role_permissions matrix backfill (Task 3.3 — day-one no-op) so a
  //    newly self-registered tenant gets the same matrix rows as the demo
  //    tenant (mirrors the demo-tenant logic in packages/db/src/seed/index.ts). ──
  await backfillRolePermissions(prisma, { tenantId, roleIdBySlug });

  // ── Owner user (bcrypt-hashed password, Tenant Super Admin, ready to login) ──
  const passwordHash = await bcrypt.hash(ownerPassword, PASSWORD_BCRYPT_COST);

  // Derive first/last name from the supplied owner name.
  const nameParts = ownerName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? ownerName;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    // On re-run, keep the role/tenant link and ensure the account is active;
    // do NOT overwrite the password hash (avoids re-hashing churn on retries).
    update: {
      roleId: superAdminRoleId,
      tenantId,
      isActive: true,
      isTenantOwner: true,
    },
    create: {
      email: ownerEmail,
      passwordHash,
      firstName,
      lastName,
      displayName: ownerName,
      roleId: superAdminRoleId,
      tenantId,
      isActive: true,
      securityVersion: 1,
      isTenantOwner: true,
    },
  });

  return { ownerUserId: owner.id, superAdminRoleId };
}
