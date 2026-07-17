/**
 * magic.ts
 *
 * Magic-byte (file-signature) validation. Ported from FRMS's
 * `packages/storage/src/validation.ts`. Defence-in-depth on top of the
 * declared-MIME allow-list in `mime.ts`: a client can lie about the
 * Content-Type, so for the binary types we know the leading bytes for, we
 * verify the actual file signature matches the declared MIME.
 *
 * Adaptation vs FRMS: FRMS rejected any buffer whose leading bytes matched no
 * known signature. Orqafy additionally permits text/* uploads (text/plain,
 * text/csv, text/markdown) in the `project-notes` context — those types have
 * no reliable magic signature. So this module is LENIENT: it only enforces a
 * signature when the declared MIME is one we have a signature for; declared
 * MIMEs without a signature entry pass here and rely on the `mime.ts`
 * allow-list. This adds a real guard for image/pdf uploads without regressing
 * text uploads.
 */

interface MagicSignature {
  mime: string;
  bytes: ReadonlyArray<number>;
  offset: number;
}

const MAGIC_BYTES: ReadonlyArray<MagicSignature> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },
];

/** MIME types this module can verify by leading bytes. */
export const SIGNED_MIME_TYPES: ReadonlySet<string> = new Set(
  MAGIC_BYTES.map((m) => m.mime),
);

function bytesMatch(buffer: Uint8Array, sig: MagicSignature): boolean {
  return sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte);
}

/**
 * Validate that a buffer's leading bytes are consistent with the declared MIME.
 *
 * Returns:
 *  - valid=true  when the declared MIME has no known signature (nothing to
 *    check — the mime.ts allow-list is the gate), OR the leading bytes match
 *    the declared MIME's signature.
 *  - valid=false when the declared MIME HAS a known signature but the leading
 *    bytes do not match it (spoofed content-type / mismatched file).
 *
 * `detectedMime` is the MIME whose signature the buffer actually matched, or
 * null when the buffer matched no known signature.
 */
export function validateMagicBytes(
  buffer: Buffer | Uint8Array,
  declaredMime: string,
): { valid: boolean; detectedMime: string | null } {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let detectedMime: string | null = null;
  for (const sig of MAGIC_BYTES) {
    if (bytesMatch(view, sig)) {
      detectedMime = sig.mime;
      break;
    }
  }

  // Declared MIME has no signature we can check — leave the decision to the
  // allow-list (mime.ts). This is the text/* path (project-notes context).
  if (!SIGNED_MIME_TYPES.has(declaredMime)) {
    return { valid: true, detectedMime };
  }

  // Declared MIME is a signed type — the real bytes must match it exactly.
  return { valid: detectedMime === declaredMime, detectedMime };
}

/**
 * Throwing variant used by the storage adapters before an upload. No-op for
 * unsignatured (text) MIME types; throws for a signed MIME whose bytes don't
 * match (spoofed content-type).
 */
export function assertMagicBytesMatch(
  buffer: Buffer | Uint8Array,
  declaredMime: string,
): void {
  const { valid, detectedMime } = validateMagicBytes(buffer, declaredMime);
  if (!valid) {
    throw new Error(
      `File signature does not match declared type. Declared: ${declaredMime}, detected: ${detectedMime ?? "unknown"}.`,
    );
  }
}
