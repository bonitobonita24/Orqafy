import imageCompression from "browser-image-compression";
import { compressImageFile } from "./image-compression";

/** Image MIME types eligible for a generated thumbnail. Matches image-compression's list. */
const THUMBNAILABLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Prepares a File for the `storage.uploadDirect` tRPC mutation:
 *   1. Compresses images client-side (no-op for non-images, or on compression
 *      failure — see `compressImageFile`).
 *   2. Enforces the size limit against the COMPRESSED size (post-compression
 *      gate) so a large photo that compresses under the cap still uploads.
 *   3. Base64-encodes the (possibly compressed) bytes for the JSON tRPC
 *      transport `uploadDirect` expects.
 *
 * Pure/testable — no React state, no network calls beyond the (mockable)
 * `compressImageFile` call.
 */

export interface PreparedUpload {
  ok: true;
  filename: string;
  contentType: string;
  bodyBase64: string;
  originalSize: number;
  compressedSize: number;
}

export interface PreparedUploadError {
  ok: false;
  error: string;
  originalSize: number;
  compressedSize: number;
}

export type PrepareUploadResult = PreparedUpload | PreparedUploadError;

/** Read a File into a base64 string, chunked to avoid call-stack overflow on large files. */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function prepareUploadFile(
  file: File,
  maxFileSizeMb: number,
): Promise<PrepareUploadResult> {
  const maxBytes = maxFileSizeMb * 1024 * 1024;

  const { file: processedFile, originalSize, compressedSize } = await compressImageFile(
    file,
    maxFileSizeMb,
  );

  if (processedFile.size > maxBytes) {
    return {
      ok: false,
      error: `File exceeds ${String(maxFileSizeMb)} MB limit`,
      originalSize,
      compressedSize,
    };
  }

  const bodyBase64 = await fileToBase64(processedFile);

  return {
    ok: true,
    filename: processedFile.name,
    contentType: processedFile.type || "application/octet-stream",
    bodyBase64,
    originalSize,
    compressedSize,
  };
}

/** True for image types a thumbnail is worth generating for. */
export function isThumbnailable(file: File): boolean {
  return THUMBNAILABLE_MIME_TYPES.has(file.type);
}

export interface PreparedThumbnail {
  filename: string;
  contentType: string;
  bodyBase64: string;
}

/**
 * Generates a small (~320px max edge) thumbnail from the ORIGINAL file — never
 * from the already-compressed upload body, so quality doesn't compound.
 * Returns `null` on any failure (non-image file, compression error) — the
 * caller MUST treat that as non-fatal: the main upload already succeeded.
 */
export async function prepareThumbnail(file: File): Promise<PreparedThumbnail | null> {
  if (!isThumbnailable(file)) return null;

  try {
    const thumbnailFile = await imageCompression(file, {
      maxWidthOrHeight: 320,
      initialQuality: 0.7,
      useWebWorker: true,
      // maxSizeMB is required by the library's types; a 320px-edge JPEG is
      // well under 1MB in practice — this is a ceiling, not a target.
      maxSizeMB: 1,
    });

    const bodyBase64 = await fileToBase64(thumbnailFile);

    return {
      filename: thumbnailFile.name,
      contentType: thumbnailFile.type || "application/octet-stream",
      bodyBase64,
    };
  } catch {
    return null;
  }
}
