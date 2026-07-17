/**
 * media-bytes.ts
 *
 * resolveMediaBytes — the shared Telegram-first, MinIO-fallback byte
 * resolution core used by the /api/media proxy route. Ported from FRMS's
 * media-bytes.ts (itself from Marine-Guardian's proven asset-bytes pattern),
 * adapted for Orqafy's presigned S3/MinIO download API.
 *
 * Flow:
 *   1. If a telegramFileId is present, try Telegram first (the fleet-default
 *      source of truth going forward). Any failure falls through to MinIO.
 *   2. If there is no telegramFileId, or the Telegram fetch failed, fall back
 *      to MinIO via a presigned GET URL + fetch (dual-read: media rows written
 *      by the presigned S3 upload path still resolve correctly).
 *   3. If BOTH fail, throw — the caller (route) maps this to a 502.
 *
 * This module is intentionally storage-key/prisma-free at the caller boundary:
 * the caller resolves telegramFileId / storageKey / tenantSlug from the DB
 * (MediaObject ledger + session) and passes them in.
 */

import {
  createStorageClient,
  storageConfigFromEnv,
  createPresignedDownloadUrl,
  fetchTelegramFileBytes,
  getTelegramBotToken,
} from "@orqafy/storage";

type StorageS3Client = ReturnType<typeof createStorageClient>;

export interface ResolvedMedia {
  bytes: Buffer;
  source: "telegram" | "minio";
}

export interface ResolveMediaBytesInput {
  /** Tenant slug — the first segment of the storage key (S3 ownership check). */
  tenantSlug: string;
  storageKey: string;
  telegramFileId: string | null;
  mimeType?: string | null;
}

let s3Client: StorageS3Client | undefined;
function getS3Client(): StorageS3Client {
  if (s3Client === undefined) {
    s3Client = createStorageClient(storageConfigFromEnv());
  }
  return s3Client;
}

function getStorageBucket(): string {
  const bucket = process.env["STORAGE_BUCKET"];
  if (bucket === undefined || bucket === "") {
    throw new Error("STORAGE_BUCKET environment variable is required");
  }
  return bucket;
}

async function resolveFromMinio(
  storageKey: string,
  tenantSlug: string,
): Promise<Buffer> {
  const url = await createPresignedDownloadUrl(getS3Client(), {
    bucket: getStorageBucket(),
    storageKey,
    tenantSlug,
  });
  if (url === null) {
    // Cross-tenant key — treated as a fetch failure, never confirms existence.
    throw new Error("MinIO download denied: key not owned by tenant");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `MinIO download failed: HTTP ${String(res.status)} ${res.statusText}`,
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function resolveMediaBytes(
  input: ResolveMediaBytesInput,
): Promise<ResolvedMedia> {
  const { tenantSlug, storageKey, telegramFileId } = input;

  // 1. Telegram-first, when a file_id is on record.
  if (telegramFileId !== null && telegramFileId !== "") {
    try {
      const { bytes } = await fetchTelegramFileBytes({
        botToken: getTelegramBotToken(),
        fileId: telegramFileId,
      });
      return { bytes: Buffer.from(bytes), source: "telegram" };
    } catch {
      // Swallow — degrade to the MinIO fallback below.
    }
  }

  // 2. MinIO fallback (also the direct path when there is no telegramFileId).
  try {
    const bytes = await resolveFromMinio(storageKey, tenantSlug);
    return { bytes, source: "minio" };
  } catch (minioError) {
    throw new Error(
      `Failed to resolve media bytes for key "${storageKey}": both Telegram and MinIO fetch failed. ${
        minioError instanceof Error ? minioError.message : String(minioError)
      }`,
    );
  }
}
