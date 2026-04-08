import { vi } from 'vitest';

// Mock chrome.storage.local
const storageData: Record<string, unknown> = {};
const mockStorageLocal = {
  get: vi.fn((keys: string | string[] | null) => {
    if (keys === null) return Promise.resolve({ ...storageData });
    if (typeof keys === 'string') return Promise.resolve({ [keys]: storageData[keys] });
    const result: Record<string, unknown> = {};
    for (const k of keys) { result[k] = storageData[k]; }
    return Promise.resolve(result);
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(storageData, items);
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]) => {
    const arr = typeof keys === 'string' ? [keys] : keys;
    for (const k of arr) delete storageData[k];
    return Promise.resolve();
  }),
  // Helper for tests to reset state
  _reset: () => { Object.keys(storageData).forEach(k => delete storageData[k]); },
};

// Mock chrome.identity
const mockIdentity = {
  getRedirectURL: vi.fn((path?: string) => `https://test-extension-id.chromiumapp.org/${path ?? ''}`),
  launchWebAuthFlow: vi.fn(),
};

// Mock chrome.alarms
const alarmListeners: Array<(alarm: { name: string }) => void> = [];
const mockAlarms = {
  create: vi.fn(),
  onAlarm: {
    addListener: vi.fn((fn: (alarm: { name: string }) => void) => { alarmListeners.push(fn); }),
  },
  // Helper for tests to fire an alarm
  _fire: (name: string) => { alarmListeners.forEach(fn => fn({ name })); },
};

// Attach to globalThis
(globalThis as any).chrome = {
  storage: { local: mockStorageLocal },
  identity: mockIdentity,
  alarms: mockAlarms,
};

export { mockStorageLocal, mockIdentity, mockAlarms, storageData };
