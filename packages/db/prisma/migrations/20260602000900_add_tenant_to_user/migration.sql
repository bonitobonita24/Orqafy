-- AlterTable: Add tenantId to users
ALTER TABLE "public"."users" ADD COLUMN "tenant_id" TEXT;

-- Backfill: assign all existing users to the first tenant
UPDATE "public"."users" SET "tenant_id" = (SELECT id FROM "public"."tenants" LIMIT 1) WHERE "tenant_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "public"."users" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Add index and FK
CREATE INDEX "users_tenant_id_idx" ON "public"."users"("tenant_id");
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
