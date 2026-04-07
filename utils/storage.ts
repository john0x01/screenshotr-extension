import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB } from './constants';
import type { CaptureMetadata } from './metadata';

export type CaptureStatus = 'pending' | 'compressed' | 'uploaded';

export interface CaptureRecord {
  id: string;
  imageBlob: Blob;
  metadata: CaptureMetadata;
  status: CaptureStatus;
  capturedAt: number;
}

interface ScreenshotrDB extends DBSchema {
  captures: {
    key: string;
    value: CaptureRecord;
    indexes: {
      'by-status': CaptureStatus;
      'by-capturedAt': number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ScreenshotrDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ScreenshotrDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScreenshotrDB>(DB.NAME, DB.VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('captures', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-capturedAt', 'capturedAt');
      },
    });
  }
  return dbPromise;
}

export async function storeCapture(
  imageBlob: Blob,
  metadata: CaptureMetadata,
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('captures', {
    id,
    imageBlob,
    metadata,
    status: 'compressed',
    capturedAt: metadata.capturedAt,
  });
  return id;
}

export async function getCapture(id: string): Promise<CaptureRecord | undefined> {
  const db = await getDB();
  return db.get('captures', id);
}

export async function getRecentCaptures(limit: number = 10): Promise<CaptureRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('captures', 'by-capturedAt');
  return all.reverse().slice(0, limit);
}

export async function updateCaptureStatus(id: string, status: CaptureStatus): Promise<void> {
  const db = await getDB();
  const record = await db.get('captures', id);
  if (record) {
    record.status = status;
    await db.put('captures', record);
  }
}
