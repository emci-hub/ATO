import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Sign in with Apple, wired alongside the existing email/OTP auth.
 *
 * Identity model — why this cannot fork an account:
 *  * Apple's `sub` (exposed as `credential.user`) is stable per Apple ID per
 *    developer team, and is the SAME value whether or not the user chose "Hide
 *    My Email". Supabase keys the auth identity on that `sub`, so every repeat
 *    sign-in resolves to the same `user_id`.
 *  * The ME row is keyed by that `user_id` (`me.id` is a PK with an FK to
 *    auth.users) and `createMe` upserts on conflict, so one Apple identity can
 *    only ever produce one ME row.
 *  * `apple_credentials.apple_sub` is UNIQUE at the database level, so a second
 *    account can never bind the same Apple identity even if something upstream
 *    misbehaved.
 *
 * The relay address (`@privaterelay.appleid.com`) is therefore never the
 * identity key — it is incidental data. Hiding the email changes nothing about
 * which row the user lands on.
 */

export type AppleSignInOutcome =
  | { status: 'signed-in'; userId: string; linkedForRevocation: boolean }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/** iOS only, and only where the OS actually supports it. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Registers the Apple authorization code with the backend so the account can be
 * revoked at delete time.
 *
 * This is not optional bookkeeping: Supabase's `signInWithIdToken` only
 * consumes the identity token and never exposes an Apple refresh token, so if
 * the authorization code is not exchanged and stored here, there is nothing to
 * send to Apple's revoke endpoint later.
 *
 * Returns false rather than throwing — a failure here must not strand a user
 * who has otherwise signed in successfully.
 */
async function linkForRevocation(authorizationCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('apple-link', {
      body: { authorizationCode },
    });
    if (error) {
      console.log('[auth-apple] apple-link failed:', error.message);
      return false;
    }
    return data?.linked === true;
  } catch (error) {
    console.log('[auth-apple] apple-link threw:', String(error));
    return false;
  }
}

export async function signInWithApple(): Promise<AppleSignInOutcome> {
  if (!(await isAppleSignInAvailable())) return { status: 'unavailable' };

  // Replay protection: Apple embeds the nonce we hand it into the identity
  // token, and Supabase verifies that claim against the SHA-256 of the raw
  // value. So Apple gets the hash, Supabase gets the raw string.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: 'Apple sign-in did not complete. Try again.' };
  }

  if (!credential.identityToken) {
    return { status: 'error', message: 'Apple did not return an identity token.' };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error || !data.user) {
    return { status: 'error', message: error?.message ?? 'Could not sign in with Apple.' };
  }

  // Apple returns the full name ONLY on the very first authorization for this
  // app. If it is dropped here it cannot be retrieved again (short of the user
  // revoking and re-authorizing), so persist it immediately.
  const givenName = credential.fullName?.givenName;
  const familyName = credential.fullName?.familyName;
  if (givenName || familyName) {
    await supabase.auth
      .updateUser({
        data: {
          apple_given_name: givenName ?? null,
          apple_family_name: familyName ?? null,
        },
      })
      .catch(() => {});
  }

  const linkedForRevocation = credential.authorizationCode
    ? await linkForRevocation(credential.authorizationCode)
    : false;

  return { status: 'signed-in', userId: data.user.id, linkedForRevocation };
}
