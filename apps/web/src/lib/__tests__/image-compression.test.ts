import { describe, it, expect, vi, beforeEach } from 'vitest';

const imageCompressionMock = vi.hoisted(() => vi.fn());

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}));

import { compressImageFile } from '../image-compression';

function makeFile(name: string, type: string, content = 'x'.repeat(100)): File {
  return new File([content], name, { type });
}

describe('compressImageFile', () => {
  beforeEach(() => {
    imageCompressionMock.mockReset();
  });

  it('compresses a jpeg with the expected options and reports wasCompressed=true', async () => {
    const original = makeFile('photo.jpg', 'image/jpeg', 'x'.repeat(1000));
    const compressed = makeFile('photo.jpg', 'image/jpeg', 'x'.repeat(200));
    imageCompressionMock.mockResolvedValue(compressed);

    const result = await compressImageFile(original, 1);

    expect(imageCompressionMock).toHaveBeenCalledTimes(1);
    expect(imageCompressionMock).toHaveBeenCalledWith(original, {
      maxSizeMB: 1,
      maxWidthOrHeight: 2048,
      initialQuality: 0.8,
      useWebWorker: true,
    });
    const callArgs = imageCompressionMock.mock.calls[0];
    expect(callArgs?.[1]).not.toHaveProperty('fileType');

    expect(result.wasCompressed).toBe(true);
    expect(result.file).toBe(compressed);
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(compressed.size);
  });

  it('preserves the image/png mime type on the compressed output', async () => {
    const original = makeFile('graphic.png', 'image/png', 'x'.repeat(1000));
    const compressed = makeFile('graphic.png', 'image/png', 'x'.repeat(300));
    imageCompressionMock.mockResolvedValue(compressed);

    const result = await compressImageFile(original, 2);

    expect(result.file.type).toBe('image/png');
    expect(result.wasCompressed).toBe(true);
  });

  it('never calls imageCompression for a non-image file (pdf) and returns the original untouched', async () => {
    const original = makeFile('invoice.pdf', 'application/pdf', 'x'.repeat(500));

    const result = await compressImageFile(original, 1);

    expect(imageCompressionMock).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(original);
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(original.size);
  });

  it('never calls imageCompression for a non-image file (csv) and returns the original untouched', async () => {
    const original = makeFile('data.csv', 'text/csv', 'a,b,c\n1,2,3');

    const result = await compressImageFile(original, 1);

    expect(imageCompressionMock).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(original);
  });

  it('returns the original file with wasCompressed=false when imageCompression throws', async () => {
    const original = makeFile('broken.webp', 'image/webp', 'x'.repeat(1000));
    imageCompressionMock.mockRejectedValue(new Error('worker crashed'));

    const result = await compressImageFile(original, 1);

    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(original);
    expect(result.originalSize).toBe(original.size);
    expect(result.compressedSize).toBe(original.size);
  });
});
