-- Mobile-sync idempotency ledger (mobile-sync-foundation).
-- One row per successfully-applied client mutation from apps/mobile's push
-- sync queue, keyed on the mobile client's stable local WatermelonDB record
-- id so a network-retry POST replays safely instead of double-applying.

-- CreateTable
CREATE TABLE "public"."mobile_sync_ops" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_sync_ops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_sync_ops_tenant_id_entity_type_client_id_idx" ON "public"."mobile_sync_ops"("tenant_id", "entity_type", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_sync_ops_tenant_id_user_id_entity_type_client_id_ac_key" ON "public"."mobile_sync_ops"("tenant_id", "user_id", "entity_type", "client_id", "action");
