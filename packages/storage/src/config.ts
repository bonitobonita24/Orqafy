/** MIME types that are unconditionally blocked — XSS vectors. */
export const BLOCKED_MIME_TYPES = new Set([
  "image/svg+xml",
  "text/html",
]);

/** Allowed MIME types for standard uploads. */
export const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Extended MIME types for project notes / document uploads. */
export const PROJECT_NOTES_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

/** Maximum file size limits per upload context (bytes). */
export const MAX_FILE_SIZE = {
  DEFAULT: 10 * 1024 * 1024,        // 10 MB
  PROJECT_NOTES: 50 * 1024 * 1024,  // 50 MB
  SIGNATURE: 1 * 1024 * 1024,       // 1 MB
} as const;

/** Pre-signed URL expiry — 15 minutes is sufficient for direct browser uploads. */
export const PRESIGNED_URL_EXPIRES_SECONDS = 15 * 60;

/** Pre-signed download URL expiry — 1 hour. */
export const PRESIGNED_DOWNLOAD_EXPIRES_SECONDS = 60 * 60;
