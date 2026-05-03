import { randomUUID } from "node:crypto";
import path from "node:path";

export interface StoragePathParams {
  tenantSlug: string;
  entityType: string;
  entityId: string;
  /** Original filename — used only for extension extraction. Never stored as-is. */
  originalFilename: string;
}

/**
 * Generates a tenant-scoped storage key.
 * Pattern: <tenant_slug>/<entity_type>/<entity_id>/<uuid>.<ext>
 * Original filenames are never preserved — randomised to prevent enumeration and path traversal.
 */
export function buildStoragePath(params: StoragePathParams): string {
  const ext = path.extname(params.originalFilename).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  return `${params.tenantSlug}/${params.entityType}/${params.entityId}/${filename}`;
}

/** Extract tenant slug from a storage key (first path segment). */
export function extractTenantSlug(storageKey: string): string {
  const segment = storageKey.split("/")[0];
  if (!segment) throw new Error(`Invalid storage key: "${storageKey}"`);
  return segment;
}

/**
 * Verify that a storage key belongs to the expected tenant.
 * Returns false (not 403) to avoid confirming existence of cross-tenant objects.
 */
export function isKeyOwnedByTenant(
  storageKey: string,
  tenantSlug: string,
): boolean {
  try {
    return extractTenantSlug(storageKey) === tenantSlug;
  } catch {
    return false;
  }
}
