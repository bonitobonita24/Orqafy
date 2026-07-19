// Shared server-side direct-upload core — the Telegram-capable path (a
// browser/mobile client cannot PUT directly to Telegram, so the bytes are
// sent through the server). Extracted from `storage.ts`'s `uploadDirect`
// tRPC mutation (feat/telegram-storage) so a SECOND non-tRPC caller — the
// mobile-sync expense-receipt Route Handler
// (app/api/sync/expenses/[serverId]/receipt/route.ts) — can reuse the exact
// same quota + backend-resolution + Attachment/MediaObject/audit write
// path without re-implementing it. `storage.ts`'s `uploadDirect` procedure
// is now a thin wrapper around `performDirectUpload` — its input validation
// (Zod) and tRPC context resolution stay in the router; this module owns
// everything after that.
//
// `getStorageBucket` and `getStorageQuota` moved here (from `storage.ts`)
// since `performDirectUpload` needs both and several OTHER storage.ts
// procedures (getUploadUrl, uploadThumbnail, getDownloadUrl, delete) also
// need them — storage.ts now imports them from here instead of duplicating.
import { TRPCError } from "@trpc/server";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { resolveBackend, getStorageBackend, type StorageBackend } from "@orqafy/storage";

export function getStorageBucket(): string {
  const bucket = process.env["STORAGE_BUCKET"];
  if (bucket == null || bucket === "") throw new Error("STORAGE_BUCKET is not set");
  return bucket;
}

export interface StorageQuota {
  usedBytes: bigint;
  maxBytes: bigint;
  planName: string;
}

export async function getStorageQuota(tenantId: string): Promise<StorageQuota> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      storageBytesUsed: true,
      plan: { select: { maxStorageMb: true, name: true } },
    },
  });
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
  const maxStorageMb = tenant.plan?.maxStorageMb ?? 500;
  const planName = tenant.plan?.name ?? "Free";
  return {
    usedBytes: tenant.storageBytesUsed,
    maxBytes: BigInt(maxStorageMb) * BigInt(1024 * 1024),
    planName,
  };
}

export interface PerformDirectUploadArgs {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  /** Attachment.entityType — plain string at the DB layer (see
   * packages/db/prisma/schema.prisma `Attachment.entityType`). Callers pass
   * a value from their own entity-type allow-list (storage.ts's
   * ENTITY_TYPES enum for tRPC callers; a fixed literal for REST callers
   * like the expense-receipt route). */
  entityType: string;
  entityId: string;
  filename: string;
  contentType: string;
  /** File bytes, base64-encoded. Caller is responsible for its own size cap
   * at the input-validation layer (storage.ts's Zod schema caps this at
   * 72_000_000 chars; REST callers should apply the same cap). */
  bodyBase64: string;
}

export interface PerformDirectUploadResult {
  id: string;
  storageKey: string;
  backend: StorageBackend;
}

/**
 * Uploads a file through the configured STORAGE_BACKEND (Telegram default,
 * S3/MinIO fallback — see ~/.claude/rules/media-storage-default.md),
 * enforcing the tenant's storage quota, then records the Attachment +
 * MediaObject ledger + CREATE audit log entry in one transaction. Mirrors
 * `uploadDirect`'s exact original behavior byte-for-byte (this function IS
 * that behavior, extracted).
 *
 * Throws TRPCError:
 *  - BAD_REQUEST  — empty decoded body, or the backend upload itself failed
 *                   (bad MIME/magic-byte mismatch, Telegram/S3 error, etc.)
 *  - FORBIDDEN    — the upload would exceed the tenant's storage quota
 *  - NOT_FOUND    — the tenant row itself is missing (getStorageQuota)
 */
export async function performDirectUpload(
  args: PerformDirectUploadArgs,
): Promise<PerformDirectUploadResult> {
  const body = Buffer.from(args.bodyBase64, "base64");
  if (body.byteLength <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Empty file body." });
  }

  // Quota check (same as getUploadUrl / uploadThumbnail).
  const quota = await getStorageQuota(args.tenantId);
  if (quota.usedBytes + BigInt(body.byteLength) > quota.maxBytes) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Storage quota exceeded. Used ${(Number(quota.usedBytes) / (1024 * 1024)).toFixed(1)} MB of ${(Number(quota.maxBytes) / (1024 * 1024)).toFixed(0)} MB (${quota.planName} plan).`,
    });
  }

  // Resolve the Telegram channel for this tenant (null => default channel).
  let chatId: string | undefined;
  if (getStorageBackend() === "telegram") {
    const tenant = await db.tenant.findUnique({
      where: { id: args.tenantId },
      select: { telegramChannelId: true },
    });
    chatId =
      tenant?.telegramChannelId ??
      process.env["TELEGRAM_DEFAULT_CHANNEL_ID"] ??
      "";
  }

  // Upload OUTSIDE the DB transaction (external network I/O: Telegram/S3).
  let result;
  try {
    result = await resolveBackend().upload({
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      entityType: args.entityType,
      entityId: args.entityId,
      originalFilename: args.filename,
      mimeType: args.contentType,
      body,
      bucket: getStorageBucket(),
      ...(chatId !== undefined ? { chatId } : {}),
    });
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err instanceof Error ? err.message : "Upload failed.",
    });
  }

  const attachment = await db.$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: {
        tenantId: args.tenantId,
        entityType: args.entityType,
        entityId: args.entityId,
        storageKey: result.storageKey,
        filename: args.filename,
        mimeType: args.contentType,
        sizeBytes: BigInt(result.sizeBytes),
        uploadedByUserId: args.userId,
      },
    });
    await tx.tenant.update({
      where: { id: args.tenantId },
      data: { storageBytesUsed: { increment: BigInt(result.sizeBytes) } },
    });
    await tx.mediaObject.upsert({
      where: {
        tenantId_storageKey: { tenantId: args.tenantId, storageKey: result.storageKey },
      },
      create: {
        tenantId: args.tenantId,
        storageKey: result.storageKey,
        entityType: args.entityType,
        backend: result.backend,
        telegramChatId: result.telegramChatId ?? null,
        telegramFileId: result.telegramFileId ?? null,
        telegramMessageId:
          result.telegramMessageId !== undefined ? BigInt(result.telegramMessageId) : null,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
      },
      update: {
        backend: result.backend,
        telegramChatId: result.telegramChatId ?? null,
        telegramFileId: result.telegramFileId ?? null,
        telegramMessageId:
          result.telegramMessageId !== undefined ? BigInt(result.telegramMessageId) : null,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
      },
    });
    await writeAuditLog(tx, {
      userId: args.userId,
      action: "CREATE",
      entity: "Attachment",
      entityId: a.id,
      after: {
        filename: args.filename,
        entityType: args.entityType,
        entityId: args.entityId,
        sizeBytes: result.sizeBytes,
        backend: result.backend,
      },
    });
    return a;
  });

  return {
    id: attachment.id,
    storageKey: attachment.storageKey,
    backend: result.backend,
  };
}
