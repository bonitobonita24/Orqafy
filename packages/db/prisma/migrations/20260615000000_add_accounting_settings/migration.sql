-- Add AccountingSettings table for per-tenant configurable finance settings.
-- poApprovalThreshold (default ₱10,000): POs at or below this amount auto-approve on submit;
-- above requires an Administrator or Purchasing Manager to approve manually.

-- CreateTable
CREATE TABLE "public"."accounting_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "po_approval_threshold" DECIMAL(12,2) NOT NULL DEFAULT 10000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_settings_tenant_id_key" ON "public"."accounting_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "public"."accounting_settings" ADD CONSTRAINT "accounting_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
