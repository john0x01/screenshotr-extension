import type { CaptureRecord } from './storage';
import { updateCaptureStatus } from './storage';
import { getAuthToken } from './auth';
export { getAuthToken };

// TODO: Make configurable via extension settings (Phase 10)
const API_BASE_URL = 'http://localhost:3000';

export async function computeContentHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function uploadCapture(record: CaptureRecord, token: string): Promise<void> {
  const contentHash = await computeContentHash(record.imageBlob);

  const formData = new FormData();
  formData.append('image', record.imageBlob, 'capture.webp');
  formData.append(
    'metadata',
    JSON.stringify({
      id: record.id,
      title: record.metadata.title,
      url: record.metadata.url,
      domain: record.metadata.domain,
      path: record.metadata.path,
      capturedAt: record.metadata.capturedAt,
      contentHash,
      fileSize: record.imageBlob.size,
    }),
  );

  const response = await fetch(`${API_BASE_URL}/api/captures`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  await updateCaptureStatus(record.id, 'uploaded');
}

// getAuthToken is now imported from ./auth and re-exported above
