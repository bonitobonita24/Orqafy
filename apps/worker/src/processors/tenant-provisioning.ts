import type { Job } from 'bullmq';
import {
  prisma,
  toSchemaName,
  provisionTenantRolesAndOwner,
  provisionTenantFinancials,
} from '@orqafy/db';
import type { TenantProvisioningJobData } from '@orqafy/jobs';

export async function processTenantProvisioning(
  job: Job<TenantProvisioningJobData>,
): Promise<void> {
  const {
    tenantSlug,
    tenantName: _tenantName,
    tenantId,
    traceId,
    ownerEmail,
    ownerName,
    ownerPassword,
  } = job.data;
  const schemaName = toSchemaName(tenantSlug);

  console.log(
    `[tenant-provisioning] job=${job.id} trace=${traceId ?? 'n/a'} slug=${tenantSlug} schema=${schemaName}`,
  );

  // ── Step 1: seed standard roles + owner user, then activate tenant ──
  // If anything below throws AFTER the schema exists, we deliberately leave the
  // tenant at status="provisioning" (no rollback / no delete) so it surfaces in
  // the powerbyte-admin tenant view for manual retry. The whole step is idempotent
  // (roles upsert on (tenantId, slug); owner upserts on email), so a BullMQ retry
  // — or a manual re-run — converges safely without duplicating roles/user.
  try {
    const { ownerUserId } = await provisionTenantRolesAndOwner(prisma, {
      tenantId,
      ownerEmail,
      ownerName,
      ownerPassword,
    });
    console.log(
      `[tenant-provisioning] roles + owner user (${ownerEmail}, id=${ownerUserId}) provisioned for tenant=${tenantId}`,
    );

    // ── Step 2: seed finance baseline (D-2 R4) — chart of accounts + fiscal year +
    //   VAT tax rate + 2025 statutory rates, and auto-map the 5 AccountingSettings
    //   default accounts so GR→JE auto-post works out-of-the-box. Idempotent. ──
    const fin = await provisionTenantFinancials(prisma, { tenantId, schemaName });
    console.log(
      `[tenant-provisioning] finance baseline seeded for tenant=${tenantId} ` +
        `(${fin.accountsSeeded} accounts, ${fin.statutorySeeded} statutory rates, defaults auto-mapped)`,
    );

    // ── Step 3: activate the tenant — owner can now log in (no email-verify gate) ──
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });
    console.log(`[tenant-provisioning] tenant=${tenantId} activated (status=active)`);
  } catch (err) {
    console.error(
      `[tenant-provisioning] owner/role provisioning FAILED for tenant=${tenantId} — ` +
        `leaving status="provisioning" for manual retry via powerbyte-admin`,
      err,
    );
    // Re-throw so BullMQ records the failure and retries per DEFAULT_JOB_OPTIONS.
    throw err;
  }
}
