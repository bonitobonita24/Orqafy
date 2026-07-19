-- Upload thumbnails (feat/upload-thumbnails): a thumbnail is stored as a second
-- MediaObject row (variant="thumbnail", parentId -> the original's id) rather than
-- a duplicate user-facing Attachment. Additive-only, reversible via:
--   ALTER TABLE "public"."attachments" DROP COLUMN "thumbnail_key";
--   ALTER TABLE "public"."media_objects" DROP CONSTRAINT "media_objects_parent_id_fkey";
--   DROP INDEX "public"."media_objects_tenant_id_parent_id_idx";
--   ALTER TABLE "public"."media_objects" DROP COLUMN "parent_id";
--   ALTER TABLE "public"."media_objects" DROP COLUMN "variant";
-- Existing rows default variant='original', parent_id/thumbnail_key NULL — zero backfill needed.

-- AlterTable: media_objects gains variant + parent_id (self-relation to the original)
ALTER TABLE "public"."media_objects" ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'original';
ALTER TABLE "public"."media_objects" ADD COLUMN "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "media_objects_tenant_id_parent_id_idx" ON "public"."media_objects"("tenant_id", "parent_id");

-- AddForeignKey (self-relation; SetNull so deleting an original never blocks on its thumbnail row)
ALTER TABLE "public"."media_objects" ADD CONSTRAINT "media_objects_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."media_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: attachments gains thumbnail_key (storage key of its thumbnail MediaObject, if any)
ALTER TABLE "public"."attachments" ADD COLUMN "thumbnail_key" TEXT;
