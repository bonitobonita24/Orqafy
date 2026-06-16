-- Migration: tenant_scoped_code_unique
-- Convert global code @unique → composite @@unique([tenant_id, code])
-- for: warehouses, accounts, tax_rates, expense_categories
-- Department already has composite unique — not modified.
--
-- NOTE: This migration also adds tenant_id to tables that were created by the
-- init migration without it (staging schema drift). The columns are added as
-- nullable first (to avoid constraint issues on empty tables), then made NOT NULL,
-- then the FK constraint and index are added.

-- ─── warehouses ───────────────────────────────────────────────────────────────
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
-- Backfill: no rows in staging; prod will seed via db:seed. FK enforced after column exists.
ALTER TABLE warehouses ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS "warehouses_tenant_id_fkey";
ALTER TABLE warehouses ADD CONSTRAINT "warehouses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS "warehouses_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_tenant_id_code_key" ON warehouses(tenant_id, code);
CREATE INDEX IF NOT EXISTS "warehouses_tenant_id_idx" ON warehouses(tenant_id);

-- ─── accounts ─────────────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
ALTER TABLE accounts ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS "accounts_tenant_id_fkey";
ALTER TABLE accounts ADD CONSTRAINT "accounts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS "accounts_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_tenant_id_code_key" ON accounts(tenant_id, code);
CREATE INDEX IF NOT EXISTS "accounts_tenant_id_idx" ON accounts(tenant_id);

-- ─── tax_rates ────────────────────────────────────────────────────────────────
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
ALTER TABLE tax_rates ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS "tax_rates_tenant_id_fkey";
ALTER TABLE tax_rates ADD CONSTRAINT "tax_rates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS "tax_rates_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_tenant_id_code_key" ON tax_rates(tenant_id, code);
CREATE INDEX IF NOT EXISTS "tax_rates_tenant_id_idx" ON tax_rates(tenant_id);

-- ─── expense_categories ───────────────────────────────────────────────────────
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
ALTER TABLE expense_categories ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS "expense_categories_tenant_id_fkey";
ALTER TABLE expense_categories ADD CONSTRAINT "expense_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS "expense_categories_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_tenant_id_code_key" ON expense_categories(tenant_id, code);
CREATE INDEX IF NOT EXISTS "expense_categories_tenant_id_idx" ON expense_categories(tenant_id);
