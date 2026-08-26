/**
 * Auth storage split: full session must not land in SecureStore.
 * Run: npm run check:auth-storage
 */
import assert from 'node:assert/strict';

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  SECURESTORE_VALUE_LIMIT,
  createNativeAuthStorage,
  utf8ByteLength,
} from '../src/lib/auth-storage';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const STORAGE_KEY = 'sb-aijzsmupaaaxjctfgwpl-auth-token';

/** Apple-shaped session matching live emci identity bulk (~2.3KB). Fake tokens. */
function appleSession(accessLen: number, refreshLen: number) {
  const access_token = 'a'.repeat(accessLen);
  const refresh_token = 'r'.repeat(refreshLen);
  const user_metadata = {
    iss: 'https://appleid.apple.com',
    sub: '000919.4f2aa1e599284a719b84c92aec3cbcdd.2059',
    email: 'user@example.com',
    provider_id: '000919.4f2aa1e599284a719b84c92aec3cbcdd.2059',
    custom_claims: { auth_time: 1787703366 },
    email_verified: true,
    phone_verified: false,
    apple_given_name: 'First',
    apple_family_name: 'Last',
  };
  return {
    access_token,
    refresh_token,
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000000',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'user@example.com',
      email_confirmed_at: '2026-08-26T00:15:33.888Z',
      phone: '',
      confirmed_at: '2026-08-26T00:15:33.888Z',
      last_sign_in_at: '2026-08-26T00:16:07.333Z',
      app_metadata: { provider: 'apple', providers: ['apple'] },
      user_metadata,
      identities: [
        {
          identity_id: '583485d0-3fb9-4e0f-9a6a-3fb1e732b635',
          id: '000919.4f2aa1e599284a719b84c92aec3cbcdd.2059',
          user_id: '00000000-0000-0000-0000-000000000000',
          identity_data: user_metadata,
          provider: 'apple',
          last_sign_in_at: '2026-08-26T00:15:33.940Z',
          created_at: '2026-08-26T00:15:33.940Z',
          updated_at: '2026-08-26T00:16:07.328Z',
        },
      ],
      created_at: '2026-08-26T00:15:33.888Z',
      updated_at: '2026-08-26T00:16:07.333Z',
      is_anonymous: false,
    },
  };
}

function memoryStores() {
  const asyncMap = new Map<string, string>();
  const secureMap = new Map<string, string>();
  const secureWrites: { key: string; bytes: number }[] = [];

  const asyncStorage = {
    async getItem(key: string) {
      return asyncMap.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      asyncMap.set(key, value);
    },
    async removeItem(key: string) {
      asyncMap.delete(key);
    },
  };

  const secureStore = {
    async getItemAsync(key: string) {
      return secureMap.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      const bytes = utf8ByteLength(value);
      secureWrites.push({ key, bytes });
      if (bytes > SECURESTORE_VALUE_LIMIT) {
        throw new Error(`SecureStore write of ${bytes} bytes for ${key} would warn`);
      }
      secureMap.set(key, value);
    },
    async deleteItemAsync(key: string) {
      secureMap.delete(key);
    },
  };

  return { asyncMap, secureMap, secureWrites, asyncStorage, secureStore };
}

async function main() {
  const liveApple = appleSession(1199, 12);
  const blob = JSON.stringify(liveApple);
  assert.ok(
    utf8ByteLength(blob) > SECURESTORE_VALUE_LIMIT,
    `Apple session fixture should exceed 2048 (got ${utf8ByteLength(blob)})`,
  );
  assert.ok(utf8ByteLength(liveApple.access_token) <= SECURESTORE_VALUE_LIMIT);
  assert.ok(utf8ByteLength(liveApple.refresh_token) <= SECURESTORE_VALUE_LIMIT);
  ok(
    `Apple-shaped session is ${utf8ByteLength(blob)} bytes (over 2048); tokens ${utf8ByteLength(liveApple.access_token)} + ${utf8ByteLength(liveApple.refresh_token)}`,
  );

  const stores = memoryStores();
  const storage = createNativeAuthStorage(stores.asyncStorage, stores.secureStore);
  await storage.setItem(STORAGE_KEY, blob);

  assert.equal(stores.secureMap.has(STORAGE_KEY), false, 'full session must not sit in SecureStore');
  assert.equal(stores.secureMap.get(ACCESS_TOKEN_KEY), liveApple.access_token);
  assert.equal(stores.secureMap.get(REFRESH_TOKEN_KEY), liveApple.refresh_token);
  const cached = JSON.parse(stores.asyncMap.get(STORAGE_KEY) ?? 'null') as {
    access_token?: unknown;
    refresh_token?: unknown;
    user?: { email?: string };
  };
  assert.equal(cached.access_token, undefined);
  assert.equal(cached.refresh_token, undefined);
  assert.equal(cached.user?.email, 'user@example.com');
  for (const write of stores.secureWrites) {
    assert.ok(write.bytes <= SECURESTORE_VALUE_LIMIT, `${write.key} was ${write.bytes} bytes`);
  }
  ok('setItem puts tokens in SecureStore and the rest in AsyncStorage, nothing over 2048');

  const roundTrip = JSON.parse((await storage.getItem(STORAGE_KEY)) ?? 'null') as typeof liveApple;
  assert.equal(roundTrip.access_token, liveApple.access_token);
  assert.equal(roundTrip.refresh_token, liveApple.refresh_token);
  assert.equal(roundTrip.user.email, 'user@example.com');
  ok('getItem hydrates tokens back onto the session for supabase-js');

  // Legacy: old ExpoSecureStoreAdapter wrote the whole blob under the supabase key.
  const legacy = memoryStores();
  legacy.secureMap.set(STORAGE_KEY, blob);
  const migrated = createNativeAuthStorage(legacy.asyncStorage, legacy.secureStore);
  const recovered = JSON.parse((await migrated.getItem(STORAGE_KEY)) ?? 'null') as typeof liveApple;
  assert.equal(recovered.access_token, liveApple.access_token);
  assert.equal(legacy.secureMap.has(STORAGE_KEY), false);
  assert.equal(legacy.secureMap.get(ACCESS_TOKEN_KEY), liveApple.access_token);
  ok('legacy Keychain session migrates off sb-<ref>-auth-token onto the split keys');

  await storage.removeItem(STORAGE_KEY);
  assert.equal(stores.asyncMap.has(STORAGE_KEY), false);
  assert.equal(stores.secureMap.has(ACCESS_TOKEN_KEY), false);
  assert.equal(stores.secureMap.has(REFRESH_TOKEN_KEY), false);
  ok('removeItem clears AsyncStorage and both SecureStore token keys');

  // Oversized JWT: do not write it to SecureStore (judgment-call path).
  const huge = appleSession(SECURESTORE_VALUE_LIMIT + 40, 12);
  const hugeStores = memoryStores();
  const hugeStorage = createNativeAuthStorage(hugeStores.asyncStorage, hugeStores.secureStore);
  const warns: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warns.push(String(args[0]));
  };
  try {
    await hugeStorage.setItem(STORAGE_KEY, JSON.stringify(huge));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(hugeStores.secureMap.has(ACCESS_TOKEN_KEY), false);
  assert.equal(hugeStores.asyncMap.get(STORAGE_KEY), JSON.stringify(huge));
  assert.ok(warns.some((line) => line.includes('Not writing this secret to Keychain')));
  ok('oversized JWT stays in the session cache and is not forced into SecureStore');

  console.log(`\nAll ${passed} auth-storage checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
