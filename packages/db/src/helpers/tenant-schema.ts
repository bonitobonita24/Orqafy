import type { PrismaClient } from '@prisma/client';

export function toSchemaName(slug: string): string {
  return `t_${slug.replace(/-/g, '_')}`;
}

export async function tenantSchemaExists(
  prisma: PrismaClient,
  schemaName: string
): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = ${schemaName}
    ) AS "exists"
  `;
  return result[0]?.exists === true;
}

export async function createTenantSchema(
  prisma: PrismaClient,
  schemaName: string
): Promise<void> {
  if (!/^t_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(
      `Invalid schema name: ${schemaName}. Must match t_[a-z0-9_]+`
    );
  }

  const exists = await tenantSchemaExists(prisma, schemaName);
  if (exists) {
    throw new Error(`Schema "${schemaName}" already exists`);
  }

  await prisma.$executeRawUnsafe(
    `CREATE SCHEMA "${schemaName}"`
  );

  // Clone all tenant-scoped tables from public schema into the new schema.
  // Uses pg_dump-like approach: copy table DDL from public, create in tenant schema.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        'tenants', 'plans', 'tenant_subscriptions', 'tenant_invoices',
        'tenant_payments', 'tenant_smtp_configs', 'tenant_xendit_configs',
        'tenant_audit_logs', '_prisma_migrations'
      )
  `;

  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${schemaName}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`
    );
  }
}

export async function dropTenantSchema(
  prisma: PrismaClient,
  schemaName: string
): Promise<void> {
  if (!/^t_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(
      `Invalid schema name: ${schemaName}. Must match t_[a-z0-9_]+`
    );
  }

  const exists = await tenantSchemaExists(prisma, schemaName);
  if (!exists) {
    throw new Error(`Schema "${schemaName}" does not exist`);
  }

  await prisma.$executeRawUnsafe(
    `DROP SCHEMA "${schemaName}" CASCADE`
  );
}
