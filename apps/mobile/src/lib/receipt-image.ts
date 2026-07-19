import * as ImageManipulator from "expo-image-manipulator";

/**
 * Receipt photo compression — matches the web app's client-side compression
 * params (apps/web/src/lib/image-compression.ts): max edge ~2048px, quality 0.8,
 * always re-encoded as JPEG. Keeping these in sync means a receipt captured on
 * mobile and one uploaded from web produce comparable file sizes/quality.
 */
export const RECEIPT_MAX_EDGE_PX = 2048;
export const RECEIPT_COMPRESS_QUALITY = 0.8;

/**
 * Picks the resize action for `ImageManipulator.manipulateAsync`.
 *
 * `expo-image-manipulator`'s `resize` action only accepts `width` XOR `height`
 * to preserve aspect ratio — passing both would stretch a non-matching-ratio
 * image. So: resize by whichever dimension is the image's long edge, and only
 * when that long edge actually exceeds the target (never upscale a smaller photo).
 *
 * Pure function — no I/O — so it's unit-testable without a device/simulator.
 */
export function getReceiptResizeAction(
  width: number,
  height: number,
  maxEdge: number = RECEIPT_MAX_EDGE_PX,
): ImageManipulator.Action[] {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return [];
  }
  return width >= height ? [{ resize: { width: maxEdge } }] : [{ resize: { height: maxEdge } }];
}

/**
 * Compresses a captured receipt photo: resizes so its long edge is at most
 * RECEIPT_MAX_EDGE_PX (never upscales), re-encodes as JPEG at
 * RECEIPT_COMPRESS_QUALITY. Returns the manipulator result (new local file URI +
 * final dimensions) — the caller is responsible for persisting/using that URI.
 */
export async function compressReceiptImage(
  uri: string,
  width: number,
  height: number,
): Promise<ImageManipulator.ImageResult> {
  const actions = getReceiptResizeAction(width, height);
  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: RECEIPT_COMPRESS_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}
