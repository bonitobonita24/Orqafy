import {
  BLOCKED_MIME_TYPES,
  DEFAULT_ALLOWED_MIME_TYPES,
  PROJECT_NOTES_ALLOWED_MIME_TYPES,
} from "./config.js";

export type UploadContext = "default" | "project-notes" | "signature";

const ALLOWED_BY_CONTEXT: Record<UploadContext, ReadonlySet<string>> = {
  default: DEFAULT_ALLOWED_MIME_TYPES,
  "project-notes": PROJECT_NOTES_ALLOWED_MIME_TYPES,
  signature: new Set(["image/jpeg", "image/png", "image/webp"]),
};

export function isMimeTypeAllowed(
  mimeType: string,
  context: UploadContext = "default",
): boolean {
  if (BLOCKED_MIME_TYPES.has(mimeType)) return false;
  return ALLOWED_BY_CONTEXT[context].has(mimeType);
}

export function assertMimeTypeAllowed(
  mimeType: string,
  context: UploadContext = "default",
): void {
  if (!isMimeTypeAllowed(mimeType, context)) {
    throw new Error(
      `File type "${mimeType}" is not permitted in context "${context}".`,
    );
  }
}

export function getAllowedMimeTypes(context: UploadContext = "default"): string[] {
  return [...ALLOWED_BY_CONTEXT[context]];
}
