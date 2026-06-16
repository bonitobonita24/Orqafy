-- Migration: add email_digest_sent_at to notifications
-- Tracks which notification rows have already been included in an emailed
-- digest so the BullMQ digest processor can SELECT unsent rows efficiently.
-- D8: email digest delivery (in-app realtime + email digest milestone).

ALTER TABLE "public"."notifications"
  ADD COLUMN "email_digest_sent_at" TIMESTAMP(3);

CREATE INDEX "notifications_tenant_id_email_digest_sent_at_idx"
  ON "public"."notifications" ("tenant_id", "email_digest_sent_at");
