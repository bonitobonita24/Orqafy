-- DECISIONS_LOG §B/§C: JE auto-post default-account mapping + PH payroll statutory computation.
-- Create-only migration (Phase-7 convention; dev synced via `prisma db push` against direct postgres).

-- AccountingSettings: default GL account mapping for JE auto-post (goods receipt + payroll)
ALTER TABLE "public"."accounting_settings"
  ADD COLUMN "default_inventory_account_id" TEXT,
  ADD COLUMN "default_ap_account_id" TEXT,
  ADD COLUMN "default_expense_account_id" TEXT,
  ADD COLUMN "default_fiscal_year_id" TEXT;

-- Payslip: employer statutory shares (employer cost, NOT deducted from employee net)
ALTER TABLE "public"."payslips"
  ADD COLUMN "sss_employer_share" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "philhealth_employer_share" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "pagibig_employer_share" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- StatutoryRate: configurable, tenant-scoped, effective-dated, cited PH statutory rate tables
CREATE TABLE "public"."statutory_rates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "effective_from" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "statutory_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "statutory_rates_tenant_id_idx" ON "public"."statutory_rates"("tenant_id");
CREATE INDEX "statutory_rates_tenant_id_type_is_active_idx" ON "public"."statutory_rates"("tenant_id", "type", "is_active");

ALTER TABLE "public"."statutory_rates"
  ADD CONSTRAINT "statutory_rates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
