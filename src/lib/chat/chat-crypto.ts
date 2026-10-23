/**
 * Circle chat encryption (Step 14). libsodium crypto_box: X25519 keys + XSalsa20-Poly1305.
 *
 * - One key pair per account per phone, kept in the Keychain (expo-secure-store). Only the public
 *   key is sent to the server (`chat_set_key`). A new phone (or a wiped Keychain) makes a new pair:
 *   older messages can't be opened there, and the screen says so.
 * - crypto_box uses one shared key per pair of people, so the sender can open their own sent copy
 *   with the recipient's public key and their own secret key.
 * - The native module only exists in the 1.1 store build. `chatCryptoReady()` is false anywhere it
 *   can't load, and the chat screen then shows "Update the app" instead of crashing.
 */
import * as SecureStore from 'expo-secure-store';

type Sodium = typeof import('react-native-libsodium');

const KEY_PREFIX = 'ato.chat.keypair.v1.';

let sodiumPromise: Promise<Sodium | null> | null = null;

/** Loads libsodium once; null when the native module isn't in this build. */
export function loadSodium(): Promise<Sodium | null> {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      try {
        const s: Sodium = await import('react-native-libsodium');
        await s.ready;
        // A 1.0 binary has the JS but not the native half: the first real call throws.
        s.crypto_box_keypair();
        return s;
      } catch {
        return null;
      }
    })();
  }
  return sodiumPromise;
}

export async function chatCryptoReady(): Promise<boolean> {
  return (await loadSodium()) != null;
}

export type ChatKeyPair = { publicKey: string; secretKey: string };

const keyPairInFlight = new Map<string, Promise<ChatKeyPair | null>>();

/** This account's key pair on this phone, made on first use. Two opens at once share one result. */
export function getOrCreateKeyPair(userId: string): Promise<ChatKeyPair | null> {
  let p = keyPairInFlight.get(userId);
  if (!p) {
    p = readOrMakeKeyPair(userId).then((kp) => {
      if (!kp) keyPairInFlight.delete(userId);
      return kp;
    });
    keyPairInFlight.set(userId, p);
  }
  return p;
}

async function readOrMakeKeyPair(userId: string): Promise<ChatKeyPair | null> {
  const s = await loadSodium();
  if (!s) return null;
  const slot = `${KEY_PREFIX}${userId}`;
  try {
    const saved = await SecureStore.getItemAsync(slot);
    if (saved) {
      const kp = JSON.parse(saved) as Partial<ChatKeyPair>;
      if (typeof kp.publicKey === 'string' && typeof kp.secretKey === 'string') {
        return { publicKey: kp.publicKey, secretKey: kp.secretKey };
      }
    }
    const fresh = s.crypto_box_keypair();
    const kp = { publicKey: s.to_base64(fresh.publicKey), secretKey: s.to_base64(fresh.privateKey) };
    await SecureStore.setItemAsync(slot, JSON.stringify(kp), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return kp;
  } catch {
    return null;
  }
}

export type Sealed = { ciphertext: string; nonce: string };

export async function sealFor(text: string, peerPublicKey: string, mine: ChatKeyPair): Promise<Sealed | null> {
  const s = await loadSodium();
  if (!s) return null;
  try {
    const nonce = s.randombytes_buf(s.crypto_box_NONCEBYTES);
    const box = s.crypto_box_easy(text, nonce, s.from_base64(peerPublicKey), s.from_base64(mine.secretKey));
    return { ciphertext: s.to_base64(box), nonce: s.to_base64(nonce) };
  } catch {
    return null;
  }
}

export type SealedRow = Sealed & { mine: boolean; senderKey: string; recipientKey: string };

/**
 * Opens one stored message. Null when this phone's key wasn't the one used (an older phone) or the
 * box doesn't verify.
 */
export async function openRow(row: SealedRow, mine: ChatKeyPair): Promise<string | null> {
  const s = await loadSodium();
  if (!s) return null;
  const myKeyOnRow = row.mine ? row.senderKey : row.recipientKey;
  if (myKeyOnRow !== mine.publicKey) return null;
  const otherKey = row.mine ? row.recipientKey : row.senderKey;
  try {
    return s.crypto_box_open_easy(
      s.from_base64(row.ciphertext),
      s.from_base64(row.nonce),
      s.from_base64(otherKey),
      s.from_base64(mine.secretKey),
      'text',
    );
  } catch {
    return null;
  }
}
