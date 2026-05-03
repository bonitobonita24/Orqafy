import { Prisma } from '@prisma/client';

const GLOBAL_MODELS = new Set([
  'Tenant',
  'Plan',
  'TenantSubscription',
  'TenantInvoice',
  'TenantPayment',
  'TenantSmtpConfig',
  'TenantXenditConfig',
  'TenantAuditLog',
]);

export function tenantGuardExtension(schemaName: string) {
  return Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          if (model !== undefined && GLOBAL_MODELS.has(model)) {
            return query(args);
          }

          const client = Prisma.getExtensionContext(this) as unknown as {
            $executeRawUnsafe: (sql: string) => Promise<number>;
          };

          await client.$executeRawUnsafe(
            `SET search_path TO "${schemaName}", public`
          );

          try {
            return await query(args);
          } finally {
            await client.$executeRawUnsafe(`SET search_path TO public`);
          }
        },
      },
    },
  });
}
