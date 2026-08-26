/**
 * Native auth storage for supabase-js.
 *
 * SecureStore (iOS Keychain) warns above 2048 bytes per value. The full
 * Supabase session JSON — tokens plus user, identities, metadata — is ~2.3KB
 * for an Apple-signed-in account, which is what produced the warning when it
 * was written as one Keychain item under `sb-<ref>-auth-token`.
 *
 * Split: access + refresh tokens in SecureStore (each well under 2KB), the
 * rest of the session cache in AsyncStorage. supabase-js still sees one
 * getItem/setItem blob; this adapter is what actually places the bytes.
 */
export const ACCESS_TOKEN_KEY = 'ato.auth.access_token';
export const REFRESH_TOKEN_KEY = 'ato.auth.refresh_token';
export const SECURESTORE_VALUE_LIMIT = 2048;

export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

type SessionBag = {
  access_token?: unknown;
  refresh_token?: unknown;
  [key: string]: unknown;
};

function isSessionWithTokens(
  value: unknown,
): value is SessionBag & { access_token: string; refresh_token: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const bag = value as SessionBag;
  return typeof bag.access_token === 'string' && typeof bag.refresh_token === 'string';
}

export async function clearNativeAuthSecrets(secureStore: SecureStoreLike): Promise<void> {
  await Promise.all([
    secureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    secureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

export function createNativeAuthStorage(
  asyncStorage: AsyncStorageLike,
  secureStore: SecureStoreLike,
) {
  const adapter = {
    async getItem(key: string): Promise<string | null> {
      let value = await asyncStorage.getItem(key);
      if (!value) {
        // Pre-split builds stored the whole session under this key in Keychain.
        const leftover = await secureStore.getItemAsync(key).catch(() => null);
        if (leftover) {
          await adapter.setItem(key, leftover);
          value = await asyncStorage.getItem(key);
        }
      }
      if (!value) return null;

      try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return value;
        const bag = parsed as SessionBag;
        const access = await secureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null);
        const refresh = await secureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
        if (typeof access === 'string') bag.access_token = access;
        if (typeof refresh === 'string') bag.refresh_token = refresh;
        return JSON.stringify(bag);
      } catch {
        return value;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      // Drop any leftover full-session Keychain item from the old adapter.
      await secureStore.deleteItemAsync(key).catch(() => {});

      try {
        const parsed: unknown = JSON.parse(value);
        if (isSessionWithTokens(parsed)) {
          const accessSize = utf8ByteLength(parsed.access_token);
          const refreshSize = utf8ByteLength(parsed.refresh_token);
          if (accessSize > SECURESTORE_VALUE_LIMIT || refreshSize > SECURESTORE_VALUE_LIMIT) {
            console.warn(
              `[auth-storage] token is ${Math.max(accessSize, refreshSize)} bytes; SecureStore limit is ${SECURESTORE_VALUE_LIMIT}. Not writing this secret to Keychain.`,
            );
          } else {
            await secureStore.setItemAsync(ACCESS_TOKEN_KEY, parsed.access_token);
            await secureStore.setItemAsync(REFRESH_TOKEN_KEY, parsed.refresh_token);
            const rest: SessionBag = { ...parsed };
            delete rest.access_token;
            delete rest.refresh_token;
            await asyncStorage.setItem(key, JSON.stringify(rest));
            return;
          }
        }
      } catch {
        // Not JSON, or not the session shape.
      }

      await asyncStorage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
      await asyncStorage.removeItem(key);
      await secureStore.deleteItemAsync(key).catch(() => {});
      await clearNativeAuthSecrets(secureStore);
    },
  };

  return adapter;
}
