import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth', () => ({
  getAuthToken: vi.fn(),
}));

vi.mock('./storage', () => ({
  getPendingCaptures: vi.fn(),
}));

vi.mock('./upload', () => ({
  uploadCapture: vi.fn(),
}));

import { syncPendingCaptures } from './sync';
import { getAuthToken } from './auth';
import { getPendingCaptures } from './storage';
import { uploadCapture } from './upload';

const mockGetAuthToken = vi.mocked(getAuthToken);
const mockGetPendingCaptures = vi.mocked(getPendingCaptures);
const mockUploadCapture = vi.mocked(uploadCapture);

function makeCaptureRecord(id: string) {
  return {
    id,
    imageBlob: new Blob(['test'], { type: 'image/webp' }),
    metadata: {
      title: 'Test',
      url: `https://example.com/${id}`,
      domain: 'example.com',
      path: `/${id}`,
      capturedAt: Date.now(),
      devicePixelRatio: 2,
      viewportWidth: 1920,
      viewportHeight: 1080,
    },
    status: 'compressed' as const,
    capturedAt: Date.now(),
  };
}

describe('syncPendingCaptures (UPLD-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads all pending captures sequentially', async () => {
    const captures = [makeCaptureRecord('a'), makeCaptureRecord('b'), makeCaptureRecord('c')];
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockGetPendingCaptures.mockResolvedValue(captures);
    mockUploadCapture.mockResolvedValue(undefined);

    await syncPendingCaptures();

    expect(mockUploadCapture).toHaveBeenCalledTimes(3);
    expect(mockUploadCapture).toHaveBeenNthCalledWith(1, captures[0], 'valid-token');
    expect(mockUploadCapture).toHaveBeenNthCalledWith(2, captures[1], 'valid-token');
    expect(mockUploadCapture).toHaveBeenNthCalledWith(3, captures[2], 'valid-token');
  });

  it('skips sync when no auth token available', async () => {
    mockGetAuthToken.mockResolvedValue(null);

    await syncPendingCaptures();

    expect(mockGetPendingCaptures).not.toHaveBeenCalled();
    expect(mockUploadCapture).not.toHaveBeenCalled();
  });

  it('stops on first upload failure', async () => {
    const captures = [makeCaptureRecord('a'), makeCaptureRecord('b'), makeCaptureRecord('c')];
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockGetPendingCaptures.mockResolvedValue(captures);
    mockUploadCapture
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    await syncPendingCaptures();

    expect(mockUploadCapture).toHaveBeenCalledTimes(2);
    expect(mockUploadCapture).toHaveBeenNthCalledWith(1, captures[0], 'valid-token');
    expect(mockUploadCapture).toHaveBeenNthCalledWith(2, captures[1], 'valid-token');
  });

  it('prevents concurrent runs via reentrance guard', async () => {
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockGetPendingCaptures.mockResolvedValue([makeCaptureRecord('a')]);
    mockUploadCapture.mockResolvedValue(undefined);

    // Call twice concurrently without awaiting first
    const [first, second] = await Promise.all([
      syncPendingCaptures(),
      syncPendingCaptures(),
    ]);

    // Only one call should have actually fetched pending captures
    expect(mockGetPendingCaptures).toHaveBeenCalledTimes(1);
  });
});
