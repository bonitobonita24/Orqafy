/**
 * adapter.ts
 *
 * StorageAdapter abstraction — the runtime backend switch that makes Telegram
 * the fleet-default persistent-media backend while keeping MinIO/S3 fully
 * working as the retained fallback (see ~/.claude/rules/media-storage-default.md).
 *
 * Config-driven backend selection via STORAGE_BACKEND ("minio" | "s3" |
 * "telegram", default "minio"). Both "minio" and "s3" resolve to the same
 * S3Adapter (S3Client), since MinIO and AWS S3/R2 share the S3 wire protocol —
 * only the endpoint/credentials differ, at the env level.
 *
 * Faithfully ported from FRMS's `packages/storage/src/adapter.ts`, adapted to
 * Orqafy's richer, server-side upload API:
 *   - Orqafy storage keys are 4-segment `tenantSlug/entityType/entityId/uuid.ext`
 *     (built by buildStoragePath), not FRMS's 3-segment `tenantId/entityType/hex.ext`.
 *   - S3 uploads go through Orqafy's `uploadObject` (which enforces the MIME
 *     allow-list + per-context size limits); this adapter adds a magic-byte
 *     check on top for both backends (defence-in-depth the presigned path can't do).
 *   - Downloads for S3 use presigned GET URLs; downloads for Telegram return
 *     the proxied `/api/media?key=…` URL the app-layer route resolves.
 *
 * This module (and the whole @orqafy/storage package) stays prisma-free: the
 * TelegramAdapter never looks up a tenant's channel or writes a ledger row.
 * The app layer resolves `tenant.telegramChannelId ?? TELEGRAM_DEFAULT_CHANNEL_ID`
 * and passes the resolved chatId into `upload()`, and separately persists the
 * MediaObject ledger row from the enriched result.
 */

import type { S3Client } from "@aws-sdk/client-s3";
import { createStorageClient, storageConfigFromEnv } from "./client";
import { MAX_FILE_SIZE } from "./config";
import { assertMimeTypeAllowed, type UploadContext } from "./mime";
import { assertMagicBytesMatch } from "./magic";
import { buildStoragePath } from "./path";
import {
  uploadObject,
  createPresignedDownloadUrl,
  deleteObject,
} from "./operations";
import { getTelegramBotToken, uploadDocumentToTelegram } from "./telegram";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StorageBackend = "minio" | "s3" | "telegram";

export interface AdapterUploadInput {
  /** Tenant CUID — carried through for the ledger, not the storage key. */
  tenantId: string;
  /** Tenant slug — first path segment of the storage key. */
  tenantSlug: string;
  entityType: string;
  entityId: string;
  originalFilename: string;
  mimeType: string;
  body: Buffer;
  /** Bucket for the S3 backend. Ignored by TelegramAdapter. */
  bucket: string;
  context?: UploadContext;
  /** Override the per-context size limit. */
  maxBytes?: number;
  /**
   * Resolved Telegram chat id (tenant.telegramChannelId ?? TELEGRAM_DEFAULT_CHANNEL_ID).
   * Required only for the telegram backend; the app layer resolves it.
   */
  chatId?: string;
}

export interface AdapterUploadResult {
  storageKey: string;
  bucket: string;
  sizeBytes: number;
  mimeType: string;
  backend: StorageBackend;
  telegramChatId?: string;
  telegramFileId?: string;
  telegramMessageId?: number;
}

export interface StorageAdapter {
  upload(input: AdapterUploadInput): Promise<AdapterUploadResult>;
  /**
   * S3: a presigned GET URL (null when the key is cross-tenant).
   * Telegram: the proxied `/api/media?key=…` URL (tenant enforced at the proxy).
   */
  getDownloadUrl(
    storageKey: string,
    tenantSlug: string,
    ttl?: number,
  ): Promise<string | null>;
  delete(storageKey: string, tenantSlug: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveMaxBytes(context: UploadContext, override?: number): number {
  if (override !== undefined) return override;
  if (context === "project-notes") return MAX_FILE_SIZE.PROJECT_NOTES;
  if (context === "signature") return MAX_FILE_SIZE.SIGNATURE;
  return MAX_FILE_SIZE.DEFAULT;
}

function getStorageBucketEnv(): string {
  const bucket = process.env["STORAGE_BUCKET"];
  if (bucket === undefined || bucket === "") {
    throw new Error("STORAGE_BUCKET environment variable is required");
  }
  return bucket;
}

/** Lazy singleton S3 client — created only when the S3 backend is used. */
let s3Client: S3Client | undefined;
function getS3Client(): S3Client {
  if (s3Client === undefined) {
    s3Client = createStorageClient(storageConfigFromEnv());
  }
  return s3Client;
}

// ---------------------------------------------------------------------------
// S3Adapter — serves MinIO (dev/staging/prod today) + AWS S3 / R2 (future)
// ---------------------------------------------------------------------------

export class S3Adapter implements StorageAdapter {
  async upload(input: AdapterUploadInput): Promise<AdapterUploadResult> {
    const context = input.context ?? "default";
    // Defence-in-depth: signature check on top of uploadObject's MIME+size gate.
    assertMagicBytesMatch(input.body, input.mimeType);

    const result = await uploadObject(getS3Client(), {
      bucket: input.bucket,
      body: input.body,
      mimeType: input.mimeType,
      context,
      ...(input.maxBytes !== undefined ? { maxBytes: input.maxBytes } : {}),
      tenantSlug: input.tenantSlug,
      entityType: input.entityType,
      entityId: input.entityId,
      originalFilename: input.originalFilename,
    });

    return {
      storageKey: result.storageKey,
      bucket: result.bucket,
      sizeBytes: result.sizeBytes,
      mimeType: input.mimeType,
      backend: "s3",
    };
  }

  async getDownloadUrl(
    storageKey: string,
    tenantSlug: string,
    ttl?: number,
  ): Promise<string | null> {
    return createPresignedDownloadUrl(getS3Client(), {
      bucket: getStorageBucketEnv(),
      storageKey,
      tenantSlug,
      ...(ttl !== undefined ? { expiresIn: ttl } : {}),
    });
  }

  async delete(storageKey: string, tenantSlug: string): Promise<void> {
    await deleteObject(getS3Client(), {
      bucket: getStorageBucketEnv(),
      storageKey,
      tenantSlug,
    });
  }
}

// ---------------------------------------------------------------------------
// TelegramAdapter
// ---------------------------------------------------------------------------

/**
 * TelegramAdapter uploads bytes to a Telegram channel via sendDocument and
 * formats proxied download URLs. It never touches the DB:
 *  - upload() does NOT write the MediaObject ledger row (app layer does).
 *  - getDownloadUrl() does NOT look up the ledger; it purely formats the
 *    "/api/media?key=..." URL the app-layer route resolves.
 *  - delete() is a best-effort no-op: Telegram's Bot API cannot reliably
 *    delete channel messages older than 48h, so the real soft-delete
 *    semantics live in the app-layer MediaObject ledger.
 */
export class TelegramAdapter implements StorageAdapter {
  async upload(input: AdapterUploadInput): Promise<AdapterUploadResult> {
    if (input.chatId === undefined || input.chatId === "") {
      throw new Error(
        "TelegramAdapter.upload requires a resolved chatId (tenant.telegramChannelId ?? TELEGRAM_DEFAULT_CHANNEL_ID)",
      );
    }

    const context = input.context ?? "default";
    const maxBytes = resolveMaxBytes(context, input.maxBytes);
    if (input.body.byteLength <= 0 || input.body.byteLength > maxBytes) {
      throw new Error(
        `File size ${String(input.body.byteLength)} bytes is outside the allowed range for context "${context}" (max ${String(maxBytes)}).`,
      );
    }
    assertMimeTypeAllowed(input.mimeType, context);
    assertMagicBytesMatch(input.body, input.mimeType);

    const storageKey = buildStoragePath({
      tenantSlug: input.tenantSlug,
      entityType: input.entityType,
      entityId: input.entityId,
      originalFilename: input.originalFilename,
    });
    const botToken = getTelegramBotToken();
    const caption = `${input.tenantSlug} · ${input.entityType} · ${storageKey}`;

    const { messageId, fileId } = await uploadDocumentToTelegram({
      botToken,
      chatId: input.chatId,
      bytes: new Uint8Array(
        input.body.buffer,
        input.body.byteOffset,
        input.body.byteLength,
      ) as Uint8Array<ArrayBuffer>,
      filename: input.originalFilename,
      mimeType: input.mimeType,
      caption,
    });

    return {
      storageKey,
      bucket: "",
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
      backend: "telegram",
      telegramChatId: input.chatId,
      telegramFileId: fileId,
      telegramMessageId: messageId,
    };
  }

  getDownloadUrl(
    storageKey: string,
    _tenantSlug: string,
    _ttl?: number,
  ): Promise<string | null> {
    return Promise.resolve(`/api/media?key=${encodeURIComponent(storageKey)}`);
  }

  delete(_storageKey: string, _tenantSlug: string): Promise<void> {
    // Best-effort no-op — see class doc. The app-layer MediaObject ledger row
    // is the real soft-delete record.
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// resolveBackend() — config-driven factory
// ---------------------------------------------------------------------------

export function getStorageBackend(): StorageBackend {
  const value = process.env["STORAGE_BACKEND"];
  if (value === "telegram") return "telegram";
  if (value === "s3") return "s3";
  return "minio";
}

/**
 * Return the StorageAdapter instance for the configured STORAGE_BACKEND.
 * "minio" and "s3" both resolve to S3Adapter (same S3Client, different env).
 */
export function resolveBackend(): StorageAdapter {
  if (getStorageBackend() === "telegram") {
    return new TelegramAdapter();
  }
  return new S3Adapter();
}
