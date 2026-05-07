import type { Job } from 'bullmq';
import { prisma, createTenantSchema, tenantSchemaExists, toSchemaName } from '@orqafy/db';
import type { TenantProvisioningJobData } from '@orqafy/jobs';

export async function processTenantProvisioning(
  job: Job<TenantProvisioningJobData>,
): Promise<void> {
  const { tenantSlug, tenantName, tenantId, traceId } = job.data;
  const schemaName = toSchemaName(tenantSlug);

  console.log(
    `[tenant-provisioning] job=${job.id} trace=${traceId ?? 'n/a'} slug=${tenantSlug} schema=${schemaName}`,
  );

  const already = await tenantSchemaExists(prisma, schemaName);
  if (already) {
    console.log(
      `[tenant-provisioning] schema ${schemaName} already exists — skipping (idempotent)`,
    );
    return;
  }

  await createTenantSchema(prisma, schemaName);

  console.log(
    `[tenant-provisioning] schema ${schemaName} created for tenant=${tenantId} name="${tenantName}"`,
  );
}
