import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from './constants';

// --- In-memory cache + chrome.storage.local adapter ---

let _cache: Record<string, string> = {};
let _hydrated = false;

const chromeStorageAdapter = {
  getItem: (key: string): string | null => _cache[key] ?? null,
  setItem: (key: string, value: string): void => {
    _cache[key] = value;
    chrome.storage.local.set({ [key]: value });
  },
  removeItem: (key: string): void => {
    delete _cache[key];
    chrome.storage.local.remove(key);
  },
};

// --- Hydration ---

export async function hydrateStorageCache(): Promise<void> {
  if (_hydrated) return;
  const items = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(items)) {
    if (typeof value === 'string') _cache[key] = value;
  }
  _hydrated = true;
}

export async function ensureHydrated(): Promise<void> {
  if (!_hydrated) await hydrateStorageCache();
}

// --- Supabase client (PKCE flow) ---

export const supabase: SupabaseClient = createClient(SUPABASE.URL, SUPABASE.ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// --- Auth functions ---

export async function signInWithProvider(provider: 'google' | 'github') {
  const redirectUrl = chrome.identity.getRedirectURL('oauth');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) throw error ?? new Error('No OAuth URL');

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });
  if (!responseUrl) throw new Error('Auth flow cancelled');

  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) throw new Error('No authorization code in redirect');

  const { data: session, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (sessionError) throw sessionError;
  return session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAuthToken(): Promise<string | null> {
  await ensureHydrated();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// --- Test helpers ---

export function _resetForTesting(): void {
  _cache = {};
  _hydrated = false;
}

export function _getStorageAdapter() {
  return chromeStorageAdapter;
}
