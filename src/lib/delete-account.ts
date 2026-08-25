import { supabase } from '@/lib/supabase';

/**
 * In-app account deletion. Irreversible.
 *
 * The confirmation phrase is checked server-side as well as in the UI, so the
 * endpoint cannot delete an account from a stray or replayed request with an
 * empty body. The UI never sends it until the user has explicitly confirmed.
 */
export const DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

export interface DeleteAccountResult {
  deleted: boolean;
  hadAppleIdentity: boolean;
  /** Apple's literal HTTP status from POST /auth/revoke. 200 = revoked. null =
   *  not attempted (no Apple identity or no stored token). */
  appleRevokeStatus: number | null;
  /** True only for Apple's documented success shape: 200 with an empty body. */
  appleRevoked: boolean;
  appleRevokeError: string | null;
  /** Rows anywhere in the schema still referencing this user, counted after the
   *  delete. 0 means the cascade emptied the account. */
  rowsRemaining: number | null;
}

export class DeleteAccountError extends Error {}

/**
 * Calls the `delete-account` edge function, then clears the local session.
 *
 * Sign-out happens only AFTER the server confirms the deletion — signing out
 * first would drop the JWT the function needs to authenticate the caller.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: DELETE_CONFIRMATION },
  });

  if (error) {
    throw new DeleteAccountError(
      'We could not delete your account. Nothing was changed. Try again.',
    );
  }

  if (!data?.deleted) {
    throw new DeleteAccountError(
      typeof data?.detail === 'string'
        ? data.detail
        : 'We could not delete your account. Nothing was changed. Try again.',
    );
  }

  // The server-side user is gone; drop the local session so the root guard
  // routes back to /auth. scope 'local' because the remote session no longer
  // exists to revoke.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

  return {
    deleted: true,
    hadAppleIdentity: !!data.had_apple_identity,
    appleRevokeStatus: data.apple_revoke_status ?? null,
    appleRevoked: !!data.apple_revoked,
    appleRevokeError: data.apple_revoke_error ?? null,
    rowsRemaining: data.rows_remaining ?? null,
  };
}
