-- Batch 22 Direction C: webhook replay protection / audit trail.
-- Records the timestamp of the most recent successful Xendit webhook processing
-- for an order. Combined with the existing TERMINAL_PAYMENT_STATUSES idempotency
-- check, gives belt-and-suspenders replay protection plus a queryable audit
-- field for "when was this order's payment marked paid?".
-- Additive nullable column — no backfill needed.
ALTER TABLE "ecommerce_orders" ADD COLUMN "webhook_processed_at" TIMESTAMP(3);
