-- Customer Portal (W1-T1.1): security-stamp version column on customers +
-- customer_portal_invites table (invite-token flow for portal login setup).
-- Additive-only, public-schema global entities.

-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN "customer_security_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."customer_portal_invites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_portal_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_invites_token_hash_key" ON "public"."customer_portal_invites"("token_hash");

-- CreateIndex
CREATE INDEX "customer_portal_invites_tenant_id_idx" ON "public"."customer_portal_invites"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_portal_invites_customer_id_idx" ON "public"."customer_portal_invites"("customer_id");

-- AddForeignKey
ALTER TABLE "public"."customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: one enabled portal login per tenant+email
CREATE UNIQUE INDEX "customers_tenant_portal_email_unique" ON "public"."customers"("tenant_id", "portal_email") WHERE "portal_enabled" = true;
