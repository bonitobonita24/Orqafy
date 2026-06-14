-- D7 (Phase 7): in-app Notification store.
-- ACCEPTED option (b): durable Prisma model + Valkey real-time fan-out.
-- Tenant-scoped (carries tenant_id, filtered on ctx.tenantId in the router —
-- the same L6 application-level guard used by customers / expenses / invoices).
-- `category` is a plain TEXT column (matches the repo's String-status
-- convention); the canonical category set is enforced in application code.
--
-- NOTE: This migration is scoped STRICTLY to the new notifications table and its
-- FKs/indexes. The migration history in this repo predates a number of tenant_id
-- schema columns (pre-existing drift unrelated to Phase 7); this file deliberately
-- does NOT capture that drift. Hand-authored from the Notification model to match
-- the repo's scoped-migration convention.

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenant_id_recipient_user_id_read_at_idx" ON "public"."notifications"("tenant_id", "recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_recipient_user_id_created_at_idx" ON "public"."notifications"("tenant_id", "recipient_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
