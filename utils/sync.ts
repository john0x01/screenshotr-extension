import { getAuthToken } from './auth';
import { getPendingCaptures } from './storage';
import { uploadCapture } from './upload';

let _syncing = false;

export async function syncPendingCaptures(): Promise<void> {
  if (_syncing) return;
  _syncing = true;

  try {
    const token = await getAuthToken();
    if (!token) return;

    const pending = await getPendingCaptures();
    for (const capture of pending) {
      try {
        await uploadCapture(capture, token);
        console.log(`[screenshotr] Synced capture: ${capture.id}`);
      } catch (err) {
        console.warn(`[screenshotr] Sync failed for ${capture.id}:`, err);
        break;
      }
    }
  } finally {
    _syncing = false;
  }
}
