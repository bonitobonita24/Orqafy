import { describe, it, expect, vi, beforeEach } from 'vitest';

const imageCompressionMock = vi.hoisted(() => vi.fn());

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}));

import { prepareUploadFile, fileToBase64 } from '../upload';

function makeFile(name: string, type: string, content = 'x'.repeat(100)): File {
  return new File([content], name, { type });
}

function decodeBase64ToString(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

describe('fileToBase64', () => {
  it('round-trips file bytes through base64', async () => {
    const file = makeFile('note.txt', 'text/plain', 'hello world');
    const b64 = await fileToBase64(file);
    expect(decodeBase64ToString(b64)).toBe('hello world');
  });

  it('handles content larger than one chunk (32KB) without overflowing the call stack', async () => {
    const big = 'a'.repeat(100_000);
    const file = makeFile('big.txt', 'text/plain', big);
    const b64 = await fileToBase64(file);
    expect(decodeBase64ToString(b64)).toBe(big);
  });
});

describe('prepareUploadFile', () => {
  beforeEach(() => {
    imageCompressionMock.mockReset();
  });

  it('compresses an image BEFORE preparing the upload payload (compression runs first)', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 'x'.repeat(1000));
    const compressed = makeFile('photo.jpg', 'image/jpeg', 'y'.repeat(200));
    imageCompressionMock.mockResolvedValue(compressed);

    const result = await prepareUploadFile(original, 1);

    expect(imageCompressionMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(compressed.size);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.filename).toBe('photo.jpg');
    // bodyBase64 must reflect the COMPRESSED bytes, not the original file's.
    expect(decodeBase64ToString(result.bodyBase64)).toBe('y'.repeat(200));
  });

  it('applies the size gate to the COMPRESSED size — a large original that compresses under the cap succeeds', async () => {
    // Original is 15 MB (over the 10 MB cap); compressed output is 2 MB (under cap).
    const original = makeFile('huge.jpg', 'image/jpeg', 'x'.repeat(15 * 1024 * 1024));
    const compressed = makeFile('huge.jpg', 'image/jpeg', 'y'.repeat(2 * 1024 * 1024));
    imageCompressionMock.mockResolvedValue(compressed);

    const result = await prepareUploadFile(original, 10);

    expect(result.ok).toBe(true);
  });

  it('rejects when the COMPRESSED size still exceeds the cap', async () => {
    const original = makeFile('huge.jpg', 'image/jpeg', 'x'.repeat(15 * 1024 * 1024));
    const compressed = makeFile('huge.jpg', 'image/jpeg', 'y'.repeat(11 * 1024 * 1024));
    imageCompressionMock.mockResolvedValue(compressed);

    const result = await prepareUploadFile(original, 10);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error result');
    expect(result.error).toBe('File exceeds 10 MB limit');
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(compressed.size);
  });

  it('bypasses compression for a non-image file and still prepares the upload', async () => {
    const original = makeFile('invoice.pdf', 'application/pdf', 'x'.repeat(500));

    const result = await prepareUploadFile(original, 10);

    expect(imageCompressionMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.contentType).toBe('application/pdf');
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(original.size);
    expect(decodeBase64ToString(result.bodyBase64)).toBe('x'.repeat(500));
  });

  it('falls back to the original file when compression throws, and still succeeds if the original is under the cap', async () => {
    const original = makeFile('broken.webp', 'image/webp', 'x'.repeat(1000));
    imageCompressionMock.mockRejectedValue(new Error('worker crashed'));

    const result = await prepareUploadFile(original, 10);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(original.size);
    expect(decodeBase64ToString(result.bodyBase64)).toBe('x'.repeat(1000));
  });

  it('falls back to the original file when compression throws, and rejects if the original still exceeds the cap', async () => {
    const original = makeFile('broken.webp', 'image/webp', 'x'.repeat(2 * 1024 * 1024));
    imageCompressionMock.mockRejectedValue(new Error('worker crashed'));

    const result = await prepareUploadFile(original, 1);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error result');
    expect(result.error).toBe('File exceeds 1 MB limit');
  });

  it('defaults contentType to application/octet-stream when the file has no type', async () => {
    const original = new File(['x'.repeat(10)], 'unknown', { type: '' });

    const result = await prepareUploadFile(original, 10);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.contentType).toBe('application/octet-stream');
  });
});
