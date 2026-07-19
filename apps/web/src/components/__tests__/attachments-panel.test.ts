import { describe, it, expect } from 'vitest';
import { resolveImageSrcKey } from '../attachments-panel';

describe('resolveImageSrcKey', () => {
  it('prefers the thumbnail key when present', () => {
    const key = resolveImageSrcKey({ thumbnailKey: 'tenant/entity/thumb.jpg', storageKey: 'tenant/entity/original.jpg' });
    expect(key).toBe('tenant/entity/thumb.jpg');
  });

  it('falls back to the full storage key when thumbnailKey is null (pre-migration row or failed thumbnail)', () => {
    const key = resolveImageSrcKey({ thumbnailKey: null, storageKey: 'tenant/entity/original.jpg' });
    expect(key).toBe('tenant/entity/original.jpg');
  });
});
