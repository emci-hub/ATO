import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { clearNativeAuthSecrets, createNativeAuthStorage } from '@/lib/auth-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

const NativeStorageAdapter = createNativeAuthStorage(AsyncStorage, SecureStore);

// On web, AsyncStorage wraps localStorage, which is not available during
// server-side static rendering. Guard so auth init resolves to null on the server.
const WebStorageAdapter = {
  getItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? WebStorageAdapter : NativeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// RN throttles JS timers while backgrounded, so the client's internal refresh
// tick can miss its window; by foreground the access token has often fully
// expired, which GoTrue treats as a dead session and signs out instead of
// refreshing. Ticking auto-refresh on app-state change keeps it proactive.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh().catch(() => {});
    } else {
      supabase.auth.stopAutoRefresh().catch(() => {});
    }
  });
}

/**
 * Drop every locally cached artifact for the signed-in account — the auth
 * tokens AND everything else this account wrote to the device. Used after
 * account deletion, when a user abandons onboarding, and when a restored
 * session points at a user that no longer exists on the server.
 *
 * `scope: 'local'` is required when the remote user/session is already gone —
 * a global sign-out would 403 and leave the cache in place if we relied on it.
 *
 * The `clearLocalAccountData` call is the fix for the 2026-09-15 bug where a
 * deleted-then-recreated account inherited the previous account's content: this
 * used to clear the session only, so every other `ato.*` key survived the
 * deletion and the next signup on that device read them straight back. It runs
 * unconditionally, including when sign-out errored — a failure to drop the
 * token is exactly when leftover account content matters most.
 *
 * Imported lazily to keep this module's import graph free of the question,
 * insight and widget modules that `local-account-data` pulls in; `supabase.ts`
 * is imported by nearly everything and is loaded at app start.
 */
export async function clearLocalSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && Platform.OS !== 'web') {
    await clearNativeAuthSecrets(SecureStore);
  }
  const { clearLocalAccountData } = await import('@/lib/local-account-data');
  await clearLocalAccountData();
}
