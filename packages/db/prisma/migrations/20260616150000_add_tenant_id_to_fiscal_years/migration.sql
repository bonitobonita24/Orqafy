-- Migration: add_tenant_id_to_fiscal_years
-- fiscal_years was created in the init migration without tenant_id (schema drift).
-- This migration adds tenant_id + FK + index to match the current Prisma schema.

ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
-- No rows to backfill — fresh DB only.
ALTER TABLE fiscal_years ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE fiscal_years DROP CONSTRAINT IF EXISTS "fiscal_years_tenant_id_fkey";
ALTER TABLE fiscal_years ADD CONSTRAINT "fiscal_years_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "fiscal_years_tenant_id_idx" ON fiscal_years(tenant_id);
