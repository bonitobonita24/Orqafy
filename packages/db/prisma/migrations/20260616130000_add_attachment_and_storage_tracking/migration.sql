-- Migration: add_attachment_and_storage_tracking
-- Adds storageBytesUsed to tenants and creates attachments table

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_bytes_used BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS attachments (
  id                  TEXT        NOT NULL PRIMARY KEY,
  tenant_id           TEXT        NOT NULL REFERENCES tenants(id),
  entity_type         TEXT        NOT NULL,
  entity_id           TEXT        NOT NULL,
  storage_key         TEXT        NOT NULL,
  filename            TEXT        NOT NULL,
  mime_type           TEXT        NOT NULL,
  size_bytes          BIGINT      NOT NULL,
  uploaded_by_user_id TEXT        NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "attachments_tenant_id_idx" ON attachments(tenant_id);
CREATE INDEX IF NOT EXISTS "attachments_entity_type_entity_id_idx" ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS "attachments_tenant_id_entity_type_entity_id_idx" ON attachments(tenant_id, entity_type, entity_id);
