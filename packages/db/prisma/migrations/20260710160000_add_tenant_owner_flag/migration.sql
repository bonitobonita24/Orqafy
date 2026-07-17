-- Add is_tenant_owner flag: exactly one designated owner per tenant.
-- The owner is distinct from the tenant_super_admin role (several users may hold that role;
-- only one is the owner). Enforced by a partial unique index below.
ALTER TABLE "public"."users" ADD COLUMN "is_tenant_owner" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: designate exactly ONE owner per tenant — the earliest-created user holding the
-- tenant_super_admin role. DISTINCT ON guarantees at most one per tenant.
UPDATE "public"."users" u SET "is_tenant_owner" = true
WHERE u.id IN (
  SELECT DISTINCT ON (x."tenant_id") x.id
  FROM "public"."users" x
  JOIN "public"."roles" r ON x."role_id" = r.id
  WHERE r.slug = 'tenant_super_admin'
  ORDER BY x."tenant_id", x."created_at" ASC, x.id ASC
);

-- Enforce one owner per tenant at the DB layer (partial unique index).
CREATE UNIQUE INDEX "one_tenant_owner_per_tenant"
  ON "public"."users" ("tenant_id")
  WHERE "is_tenant_owner";
