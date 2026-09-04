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
 * Drop every locally cached auth artifact. Used after account deletion and when
 * a restored session points at a user that no longer exists on the server.
 * `scope: 'local'` is required when the remote user/session is already gone —
 * a global sign-out would 403 and leave the cache in place if we relied on it.
 */
export async function clearLocalSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && Platform.OS !== 'web') {
    await clearNativeAuthSecrets(SecureStore);
  }
}
