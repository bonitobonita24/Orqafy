-- Migration: tenant_scoped_code_unique
-- Convert global code @unique → composite @@unique([tenant_id, code])
-- for: warehouses, accounts, tax_rates, expense_categories
-- Department already has composite unique — not modified.

-- warehouses
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS "warehouses_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_tenant_id_code_key" ON warehouses(tenant_id, code);

-- accounts
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS "accounts_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_tenant_id_code_key" ON accounts(tenant_id, code);

-- tax_rates
ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS "tax_rates_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_tenant_id_code_key" ON tax_rates(tenant_id, code);

-- expense_categories
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS "expense_categories_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_tenant_id_code_key" ON expense_categories(tenant_id, code);
