-- Telegram-default media storage (media-storage-default.md).
-- Adds the per-tenant Telegram channel column + the media_objects storage
-- ledger that the /api/media proxy resolves bytes through (Telegram-first,
-- MinIO-fallback). MinIO/S3 is retained as the fallback backend.

-- AlterTable: per-tenant private Telegram channel (null => TELEGRAM_DEFAULT_CHANNEL_ID)
ALTER TABLE "public"."tenants" ADD COLUMN "telegram_channel_id" TEXT;

-- CreateTable: storage ledger
CREATE TABLE "public"."media_objects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "backend" TEXT NOT NULL DEFAULT 'telegram',
    "telegram_chat_id" TEXT,
    "telegram_file_id" TEXT,
    "telegram_message_id" BIGINT,
    "size_bytes" INTEGER,
    "mime_type" TEXT,
    "migrated_at" TIMESTAMP(3),
    "minio_reclaimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_objects_tenant_id_idx" ON "public"."media_objects"("tenant_id");

-- CreateIndex
CREATE INDEX "media_objects_tenant_id_backend_idx" ON "public"."media_objects"("tenant_id", "backend");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_tenant_id_storage_key_key" ON "public"."media_objects"("tenant_id", "storage_key");

-- AddForeignKey
ALTER TABLE "public"."media_objects" ADD CONSTRAINT "media_objects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
