import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MAX_FILE_SIZE,
  PRESIGNED_DOWNLOAD_EXPIRES_SECONDS,
  PRESIGNED_URL_EXPIRES_SECONDS,
} from "./config.js";
import { assertMimeTypeAllowed, type UploadContext } from "./mime.js";
import { buildStoragePath, isKeyOwnedByTenant, type StoragePathParams } from "./path.js";

export interface UploadParams extends StoragePathParams {
  bucket: string;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  mimeType: string;
  context?: UploadContext;
  /** Override default size limit for this context. */
  maxBytes?: number;
}

export interface UploadResult {
  storageKey: string;
  bucket: string;
  sizeBytes: number;
}

export async function uploadObject(
  client: S3Client,
  params: UploadParams,
): Promise<UploadResult> {
  const context = params.context ?? "default";
  assertMimeTypeAllowed(params.mimeType, context);

  const maxBytes =
    params.maxBytes ??
    (context === "project-notes"
      ? MAX_FILE_SIZE.PROJECT_NOTES
      : context === "signature"
        ? MAX_FILE_SIZE.SIGNATURE
        : MAX_FILE_SIZE.DEFAULT);

  const body = params.body instanceof ReadableStream
    ? await streamToBuffer(params.body)
    : params.body;

  if (body.byteLength > maxBytes) {
    throw new Error(
      `File size ${body.byteLength} bytes exceeds the ${maxBytes}-byte limit for context "${context}".`,
    );
  }

  const storageKey = buildStoragePath(params);

  await client.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: storageKey,
      Body: body,
      ContentType: params.mimeType,
      // Prevent browsers from rendering uploaded files inline (defence-in-depth against XSS).
      ContentDisposition: "attachment",
    }),
  );

  return { storageKey, bucket: params.bucket, sizeBytes: body.byteLength };
}

export interface PresignedUploadParams {
  bucket: string;
  storageKey: string;
  mimeType: string;
  context?: UploadContext;
  expiresIn?: number;
}

/** Generate a presigned PUT URL for direct browser uploads. */
export async function createPresignedUploadUrl(
  client: S3Client,
  params: PresignedUploadParams,
): Promise<string> {
  assertMimeTypeAllowed(params.mimeType, params.context ?? "default");

  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.storageKey,
    ContentType: params.mimeType,
    ContentDisposition: "attachment",
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresIn ?? PRESIGNED_URL_EXPIRES_SECONDS,
  });
}

export interface PresignedDownloadParams {
  bucket: string;
  storageKey: string;
  tenantSlug: string;
  expiresIn?: number;
}

/**
 * Generate a presigned GET URL for authenticated downloads.
 * Enforces tenant ownership — returns null instead of 403 to avoid confirming existence.
 */
export async function createPresignedDownloadUrl(
  client: S3Client,
  params: PresignedDownloadParams,
): Promise<string | null> {
  if (!isKeyOwnedByTenant(params.storageKey, params.tenantSlug)) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.storageKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresIn ?? PRESIGNED_DOWNLOAD_EXPIRES_SECONDS,
  });
}

export interface DeleteParams {
  bucket: string;
  storageKey: string;
  tenantSlug: string;
}

/**
 * Delete an object after verifying tenant ownership.
 * Returns false (silently) when the key belongs to another tenant.
 */
export async function deleteObject(
  client: S3Client,
  params: DeleteParams,
): Promise<boolean> {
  if (!isKeyOwnedByTenant(params.storageKey, params.tenantSlug)) {
    return false;
  }

  await client.send(
    new DeleteObjectCommand({ Bucket: params.bucket, Key: params.storageKey }),
  );
  return true;
}

export interface ObjectMetadata {
  contentType: string | undefined;
  sizeBytes: number | undefined;
  lastModified: Date | undefined;
}

/**
 * Fetch object metadata without downloading the body.
 * Returns null when the object does not exist or tenant check fails.
 */
export async function getObjectMetadata(
  client: S3Client,
  bucket: string,
  storageKey: string,
  tenantSlug: string,
): Promise<ObjectMetadata | null> {
  if (!isKeyOwnedByTenant(storageKey, tenantSlug)) return null;

  try {
    const response = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
    return {
      contentType: response.ContentType,
      sizeBytes: response.ContentLength,
      lastModified: response.LastModified,
    };
  } catch {
    return null;
  }
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
