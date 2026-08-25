/**
 * delete-account — irreversible in-app account deletion.
 *
 * Order matters and is deliberate:
 *   1. Authenticate the caller and require an explicit confirmation token.
 *   2. Read the stored Apple credentials FIRST. Deleting the user cascades
 *      `apple_credentials` away, so reading after the delete would leave
 *      nothing to revoke and revocation would silently become impossible.
 *   3. Revoke at Apple and keep Apple's literal status/body.
 *   4. Delete the auth user, which cascades every owned row in the schema.
 *   5. Count remaining referencing rows as in-band proof the cascade worked.
 *   6. Write the audit row (which has no FK, so it survives the deletion).
 *
 * Revocation failure does NOT block deletion. Apple's own guidance is that the
 * deletion request must still be fulfilled even when no token is available —
 * but the failure is recorded rather than swallowed.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { appleConfigFromEnv, confirmRevoked, isRevoked, revokeToken } from '../_shared/apple.ts';
import type { AppleHttpResult } from '../_shared/apple.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** The client must send this exact value. A server-side guard so the endpoint
 *  cannot delete an account from a stray or replayed POST with an empty body. */
const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let payload: { confirm?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (payload.confirm !== CONFIRMATION_PHRASE) {
    return json({ error: 'confirmation_required' }, 400);
  }

  const userId = user.id;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- Step 2: read Apple credentials BEFORE the delete cascades them away ---
  const { data: credentials } = await adminClient
    .from('apple_credentials')
    .select('refresh_token, access_token, client_id')
    .eq('user_id', userId)
    .maybeSingle();

  const hasAppleIdentity =
    !!credentials || !!user.identities?.some((identity) => identity.provider === 'apple');

  // --- Step 3: revoke at Apple, keeping the literal response ---
  let revokeResult: AppleHttpResult | null = null;
  let revokeError: string | null = null;
  // null = could not be determined. See confirmRevoked: Apple's /auth/revoke
  // answers 200 to almost anything, so the 200 alone proves nothing. The real
  // proof is that the refresh token stops working afterwards.
  let revocationConfirmed: boolean | null = null;

  if (credentials?.refresh_token || credentials?.access_token) {
    try {
      const config = appleConfigFromEnv();

      if (credentials.refresh_token) {
        revokeResult = await revokeToken(config, credentials.refresh_token, 'refresh_token');
      }

      // Fall back to the access token only if the refresh token did not produce
      // Apple's documented success shape (200 + empty body).
      if ((!revokeResult || !isRevoked(revokeResult)) && credentials.access_token) {
        const fallback = await revokeToken(config, credentials.access_token, 'access_token');
        if (isRevoked(fallback) || !revokeResult) revokeResult = fallback;
      }

      if (revokeResult && !isRevoked(revokeResult)) {
        revokeError = revokeResult.body || `unexpected_status_${revokeResult.status}`;
      }

      // Independent proof: try to USE the refresh token now. Apple's token
      // endpoint validates properly, so a rejection here is real evidence the
      // authorization is gone — and a success means revocation silently failed
      // even though /auth/revoke said 200.
      if (credentials.refresh_token) {
        const proof = await confirmRevoked(config, credentials.refresh_token);
        revocationConfirmed = proof.confirmed;
        if (proof.confirmed === false) {
          revokeError = 'apple_returned_200_but_refresh_token_still_valid';
        } else if (proof.confirmed === null && !revokeError) {
          revokeError = `revocation_unconfirmed: ${proof.detail}`;
        }
      }
    } catch (error) {
      // Missing/invalid Apple config. Recorded, not silently treated as revoked.
      revokeError = String(error);
    }
  } else if (hasAppleIdentity) {
    revokeError = 'no_stored_apple_token';
  }

  // --- Step 4: delete the auth user; every FK in the schema is ON DELETE CASCADE ---
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    // Surface the real Postgres/GoTrue error. A blocking FK would appear here
    // rather than being reported to the user as a successful deletion.
    return json(
      {
        error: 'delete_failed',
        detail: deleteError.message,
        apple_revoke_status: revokeResult?.status ?? null,
        apple_revoke_error: revokeError,
      },
      500,
    );
  }

  // --- Step 5: in-band proof the cascade emptied the account ---
  const { data: rowsRemaining } = await adminClient.rpc('count_user_rows', {
    p_user_id: userId,
  });

  // --- Step 6: audit row (no FK, so it survives) ---
  await adminClient.from('account_deletions').insert({
    user_id: userId,
    had_apple_identity: hasAppleIdentity,
    apple_revoke_status: revokeResult?.status ?? null,
    apple_revocation_confirmed: revocationConfirmed,
    apple_revoke_error: revokeError,
    rows_remaining: rowsRemaining ?? null,
  });

  return json({
    deleted: true,
    user_id: userId,
    had_apple_identity: hasAppleIdentity,
    // Apple's actual HTTP status, not a claim that we "called sign out".
    apple_revoke_status: revokeResult?.status ?? null,
    // Apple accepted the revoke request (200 + empty body). Necessary, but on
    // its own NOT proof — see apple_revocation_confirmed.
    apple_revoke_accepted: revokeResult ? isRevoked(revokeResult) : false,
    // The real signal: true = the refresh token no longer works at Apple.
    apple_revocation_confirmed: revocationConfirmed,
    apple_revoke_error: revokeError,
    // 0 means nothing anywhere still references this user.
    rows_remaining: rowsRemaining ?? null,
  });
});
