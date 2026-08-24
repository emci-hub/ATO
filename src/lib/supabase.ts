import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// SecureStore has a hard 2KB-per-value ceiling on iOS Keychain. The Supabase
// session blob (tokens + user + identities + metadata) exceeds that, which is
// what produced the "larger than 2048 bytes" warning. Fix: cache the session
// in AsyncStorage (no size ceiling) and keep SecureStore for the actual
// secrets only — the access + refresh tokens, one small value each.
const ACCESS_TOKEN_KEY = 'ato.auth.access_token';
const REFRESH_TOKEN_KEY = 'ato.auth.refresh_token';

/**
 * Native storage for Supabase auth: full session in AsyncStorage, tokens
 * mirrored into SecureStore. supabase reads/writes the whole session via
 * getItem/setItem; this adapter keeps that contract while splitting where the
 * bytes actually land.
 */
const SplitStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
    // Mirror the actual secrets into SecureStore (each well under 2KB).
    try {
      const parsed = JSON.parse(value) as {
        access_token?: unknown;
        refresh_token?: unknown;
      } | null;
      if (parsed && typeof parsed.access_token === 'string' && typeof parsed.refresh_token === 'string') {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, parsed.access_token);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, parsed.refresh_token);
      }
    } catch {
      // Not JSON, or not the session shape — nothing to mirror.
    }
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    // Clear the mirrored tokens too so a sign-out leaves nothing behind.
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
  },
};

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
    storage: Platform.OS === 'web' ? WebStorageAdapter : SplitStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
