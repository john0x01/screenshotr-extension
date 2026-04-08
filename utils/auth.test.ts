import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStorageLocal, mockIdentity, storageData } from './__mocks__/chrome';

// Mock @supabase/supabase-js
const mockSignInWithOAuth = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCodeForSession,
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  })),
}));

describe('auth module', () => {
  let auth: typeof import('./auth');

  beforeEach(async () => {
    vi.resetModules();
    (globalThis as any).chrome = {
      storage: { local: mockStorageLocal },
      identity: mockIdentity,
      alarms: (globalThis as any).chrome?.alarms,
    };
    mockStorageLocal._reset();
    mockSignInWithOAuth.mockReset();
    mockExchangeCodeForSession.mockReset();
    mockGetSession.mockReset();
    mockSignOut.mockReset();
    mockIdentity.launchWebAuthFlow.mockReset();

    auth = await import('./auth');
  });

  describe('hydrateStorageCache', () => {
    it('loads string values from chrome.storage.local into cache', async () => {
      storageData['sb-auth-token'] = '{"access_token":"test-token"}';
      storageData['some-number'] = 42;

      await auth.hydrateStorageCache();

      const adapter = auth._getStorageAdapter();
      expect(adapter.getItem('sb-auth-token')).toBe('{"access_token":"test-token"}');
      expect(adapter.getItem('some-number')).toBeNull();
    });

    it('is idempotent via ensureHydrated', async () => {
      storageData['key1'] = 'value1';
      mockStorageLocal.get.mockClear();

      await auth.ensureHydrated();
      await auth.ensureHydrated(); // second call should be no-op

      expect(mockStorageLocal.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('chromeStorageAdapter', () => {
    it('setItem writes to both cache and chrome.storage.local', () => {
      const adapter = auth._getStorageAdapter();
      adapter.setItem('test-key', 'test-value');

      expect(adapter.getItem('test-key')).toBe('test-value');
      expect(mockStorageLocal.set).toHaveBeenCalledWith({ 'test-key': 'test-value' });
    });

    it('removeItem deletes from cache and chrome.storage.local', () => {
      const adapter = auth._getStorageAdapter();
      adapter.setItem('test-key', 'test-value');
      adapter.removeItem('test-key');

      expect(adapter.getItem('test-key')).toBeNull();
      expect(mockStorageLocal.remove).toHaveBeenCalledWith('test-key');
    });
  });

  describe('signInWithProvider', () => {
    it('calls supabase OAuth, launches web auth flow, exchanges code for session', async () => {
      const oauthUrl = 'https://supabase.co/auth/v1/authorize?provider=google';
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: oauthUrl, provider: 'google' },
        error: null,
      });
      mockIdentity.launchWebAuthFlow.mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/oauth?code=test-auth-code',
      );
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'at', refresh_token: 'rt' } },
        error: null,
      });

      await auth.signInWithProvider('google');

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          options: expect.objectContaining({
            skipBrowserRedirect: true,
          }),
        }),
      );
      expect(mockIdentity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: oauthUrl,
        interactive: true,
      });
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-auth-code');
    });

    it('throws if auth flow is cancelled (no responseUrl)', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://supabase.co/auth', provider: 'google' },
        error: null,
      });
      mockIdentity.launchWebAuthFlow.mockResolvedValue(undefined);

      await expect(auth.signInWithProvider('google')).rejects.toThrow('Auth flow cancelled');
    });

    it('throws if no authorization code in redirect', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://supabase.co/auth', provider: 'google' },
        error: null,
      });
      mockIdentity.launchWebAuthFlow.mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/oauth',
      );

      await expect(auth.signInWithProvider('google')).rejects.toThrow('No authorization code');
    });
  });

  describe('getAuthToken', () => {
    it('returns access_token from active session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'my-access-token' } },
        error: null,
      });

      const token = await auth.getAuthToken();
      expect(token).toBe('my-access-token');
    });

    it('returns null when no session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const token = await auth.getAuthToken();
      expect(token).toBeNull();
    });
  });

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await auth.signOut();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
