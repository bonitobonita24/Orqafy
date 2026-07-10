-- Migration: drop_stale_single_col_code_uniques
--
-- The 20260616120000_tenant_scoped_code_unique migration intended to convert the
-- single-column `code` @unique on warehouses / accounts / tax_rates /
-- expense_categories to a composite @@unique([tenant_id, code]). It created the
-- composite indexes correctly, but removed the old ones with
-- `ALTER TABLE ... DROP CONSTRAINT IF EXISTS "<table>_code_key"` — a silent no-op,
-- because Prisma materialises a single-column @unique as a UNIQUE INDEX, not a
-- table CONSTRAINT. The stale single-column unique indexes therefore survived in
-- every environment (dev / staging / prod), silently preventing two tenants from
-- ever sharing a `code` (e.g. two tenants each provisioning a 'vat-12' tax rate,
-- or the same chart-of-accounts codes). This was masked while tenant data lived in
-- physical per-tenant `t_<slug>` schemas; consolidating all tenant data into the
-- single canonical `public` schema exposed it. Drop the stale indexes with the
-- correct DROP INDEX statement. The composite (tenant_id, code) uniques remain and
-- are the intended isolation-safe constraint. Idempotent.
DROP INDEX IF EXISTS "warehouses_code_key";
DROP INDEX IF EXISTS "accounts_code_key";
DROP INDEX IF EXISTS "tax_rates_code_key";
DROP INDEX IF EXISTS "expense_categories_code_key";
