-- AlterTable: Add tenantId to roles
ALTER TABLE "public"."roles" ADD COLUMN "tenant_id" TEXT;

-- Backfill: assign all existing roles to the first tenant
UPDATE "public"."roles" SET "tenant_id" = (SELECT id FROM "public"."tenants" LIMIT 1) WHERE "tenant_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "public"."roles" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Drop old unique constraints
ALTER TABLE "public"."roles" DROP CONSTRAINT IF EXISTS "roles_name_key";
ALTER TABLE "public"."roles" DROP CONSTRAINT IF EXISTS "roles_slug_key";

-- Add tenant-scoped unique constraints
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_tenant_id_name_key" UNIQUE ("tenant_id", "name");
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");

-- Add index and FK
CREATE INDEX "roles_tenant_id_idx" ON "public"."roles"("tenant_id");
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add tenantId to departments
ALTER TABLE "public"."departments" ADD COLUMN "tenant_id" TEXT;

-- Backfill: assign all existing departments to the first tenant
UPDATE "public"."departments" SET "tenant_id" = (SELECT id FROM "public"."tenants" LIMIT 1) WHERE "tenant_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "public"."departments" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Drop old unique constraint on code
ALTER TABLE "public"."departments" DROP CONSTRAINT IF EXISTS "departments_code_key";

-- Add tenant-scoped unique constraint
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_tenant_id_code_key" UNIQUE ("tenant_id", "code");

-- Add index and FK
CREATE INDEX "departments_tenant_id_idx" ON "public"."departments"("tenant_id");
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
