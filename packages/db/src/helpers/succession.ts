import type { PrismaClient } from '@prisma/client';
import { TENANT_SUPER_ADMIN_SLUG } from '../seed/roles';

const TENANT_ADMIN_SLUG = 'admin';

export interface TransferTenantOwnershipInput {
  tenantId: string;
  fromUserId: string; // current owner
  toUserId: string; // becomes the new owner
}

/**
 * Owner transfer (in-tenant, §2 succession): promote toUser to owner + demote fromUser to Admin.
 * Mediated in a single transaction, index-safe: the outgoing owner's is_tenant_owner is cleared
 * FIRST (frees the partial-unique slot) before the incoming owner is set. Both users' security
 * version is bumped to force re-authentication (role/ownership change).
 * Throws Error('...') if either user is missing, not in the tenant, or fromUser is not the owner.
 */
export async function transferTenantOwnership(
  prisma: PrismaClient,
  input: TransferTenantOwnershipInput,
): Promise<void> {
  const { tenantId, fromUserId, toUserId } = input;
  if (fromUserId === toUserId) throw new Error('Cannot transfer ownership to the same user');
  await prisma.$transaction(async (tx) => {
    const [fromUser, toUser] = await Promise.all([
      tx.user.findUnique({ where: { id: fromUserId } }),
      tx.user.findUnique({ where: { id: toUserId } }),
    ]);
    if (!fromUser || fromUser.tenantId !== tenantId) throw new Error('Current owner not found in tenant');
    if (!toUser || toUser.tenantId !== tenantId) throw new Error('Target user not found in tenant');
    if (!fromUser.isTenantOwner) throw new Error('fromUser is not the current tenant owner');

    const [superAdminRole, adminRole] = await Promise.all([
      tx.role.findUnique({ where: { tenantId_slug: { tenantId, slug: TENANT_SUPER_ADMIN_SLUG } } }),
      tx.role.findUnique({ where: { tenantId_slug: { tenantId, slug: TENANT_ADMIN_SLUG } } }),
    ]);
    if (!superAdminRole) throw new Error(`${TENANT_SUPER_ADMIN_SLUG} role not found for tenant`);
    if (!adminRole) throw new Error(`${TENANT_ADMIN_SLUG} role not found for tenant`);

    // Clear the outgoing owner FIRST (frees the partial-unique slot), demote to Admin.
    await tx.user.update({
      where: { id: fromUserId },
      data: { isTenantOwner: false, roleId: adminRole.id, securityVersion: { increment: 1 } },
    });
    // Promote the incoming owner.
    await tx.user.update({
      where: { id: toUserId },
      data: { isTenantOwner: true, roleId: superAdminRole.id, securityVersion: { increment: 1 } },
    });
  });
}

export interface ReassignTenantOwnerInput {
  tenantId: string;
  newOwnerUserId: string;
}

/**
 * Platform break-glass reassign (§2 succession): a platform manager forcibly sets a tenant's owner.
 * Clears any existing owner for the tenant FIRST (index-safe), then promotes newOwner to owner +
 * tenant_super_admin role, bumping security version. Throws Error('NOT_FOUND') if the tenant does
 * not exist, or a descriptive Error if the new owner is missing / not in the tenant.
 */
export async function reassignTenantOwner(
  prisma: PrismaClient,
  input: ReassignTenantOwnerInput,
): Promise<void> {
  const { tenantId, newOwnerUserId } = input;
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('NOT_FOUND');
    const newOwner = await tx.user.findUnique({ where: { id: newOwnerUserId } });
    if (!newOwner || newOwner.tenantId !== tenantId) throw new Error('New owner not found in tenant');
    const superAdminRole = await tx.role.findUnique({
      where: { tenantId_slug: { tenantId, slug: TENANT_SUPER_ADMIN_SLUG } },
    });
    if (!superAdminRole) throw new Error(`${TENANT_SUPER_ADMIN_SLUG} role not found for tenant`);

    // Clear any existing owner FIRST (frees the partial-unique slot).
    await tx.user.updateMany({
      where: { tenantId, isTenantOwner: true },
      data: { isTenantOwner: false },
    });
    await tx.user.update({
      where: { id: newOwnerUserId },
      data: { isTenantOwner: true, roleId: superAdminRole.id, securityVersion: { increment: 1 } },
    });
  });
}
