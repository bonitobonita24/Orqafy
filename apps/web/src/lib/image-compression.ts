import imageCompression from 'browser-image-compression';

/**
 * Client-side image compression helper.
 *
 * Only compresses images (jpeg/png/webp). Any other file type (pdf, csv, etc.)
 * is returned untouched. Compression failure never blocks the upload — on any
 * error the original file is returned with `wasCompressed: false`.
 */

const COMPRESSIBLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface CompressImageResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

export async function compressImageFile(
  file: File,
  maxSizeMB: number
): Promise<CompressImageResult> {
  const originalSize = file.size;

  if (!COMPRESSIBLE_MIME_TYPES.has(file.type)) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    };
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight: 2048,
      initialQuality: 0.8,
      useWebWorker: true,
    });

    return {
      file: compressed,
      originalSize,
      compressedSize: compressed.size,
      wasCompressed: true,
    };
  } catch {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    };
  }
}
