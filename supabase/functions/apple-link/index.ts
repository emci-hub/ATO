/**
 * apple-link — exchanges the one-time Apple authorization code for a refresh
 * token and stores it server-side, so the account can actually be revoked at
 * delete time.
 *
 * Why this exists: Supabase's native `signInWithIdToken` only verifies the
 * identity token. It never redeems Apple's authorization code and never exposes
 * an Apple refresh token on the session. Without this step there is nothing to
 * send to Apple's /auth/revoke endpoint later, and "delete account" could only
 * ever be a local sign-out.
 *
 * The caller must present a valid Supabase JWT. The Apple `sub` returned by
 * Apple's token endpoint must match the Apple identity already attached to that
 * Supabase user, so a stolen authorization code cannot be used to bind someone
 * else's Apple identity to an attacker's account.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  appleConfigFromEnv,
  exchangeAuthorizationCode,
  unverifiedSubFromIdToken,
} from '../_shared/apple.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  // Caller-scoped client: resolves who is actually asking.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let payload: { authorizationCode?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const authorizationCode = payload.authorizationCode;
  if (typeof authorizationCode !== 'string' || authorizationCode.length === 0) {
    return json({ error: 'missing_authorization_code' }, 400);
  }

  // The Apple identity Supabase already verified for this user. This is the
  // value the exchange must agree with.
  const appleIdentity = user.identities?.find((identity) => identity.provider === 'apple');
  if (!appleIdentity) return json({ error: 'no_apple_identity' }, 400);

  let config;
  try {
    config = appleConfigFromEnv();
  } catch (error) {
    // Surface configuration problems distinctly — never let a missing secret
    // look like a successful link.
    return json({ error: 'apple_not_configured', detail: String(error) }, 500);
  }

  const tokens = await exchangeAuthorizationCode(config, authorizationCode);

  if (tokens.error || !tokens.refresh_token) {
    return json(
      {
        error: 'apple_exchange_failed',
        apple_error: tokens.error ?? null,
        apple_error_description: tokens.error_description ?? null,
      },
      502,
    );
  }

  // Defence in depth: the code we just redeemed must belong to the same Apple
  // user Supabase authenticated.
  const exchangedSub = tokens.id_token ? unverifiedSubFromIdToken(tokens.id_token) : null;
  if (exchangedSub && exchangedSub !== appleIdentity.id) {
    return json({ error: 'apple_sub_mismatch' }, 403);
  }

  const appleSub = exchangedSub ?? appleIdentity.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error: upsertError } = await adminClient.from('apple_credentials').upsert(
    {
      user_id: user.id,
      apple_sub: appleSub,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      client_id: config.clientId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) {
    // A unique violation on apple_sub means this Apple identity is already
    // bound to a different Supabase user — the exact duplicate-account case
    // Hide My Email could otherwise create. Report it rather than forking.
    const duplicate = upsertError.code === '23505';
    return json(
      {
        error: duplicate ? 'apple_sub_already_linked' : 'store_failed',
        detail: upsertError.message,
      },
      duplicate ? 409 : 500,
    );
  }

  return json({ linked: true, apple_sub: appleSub });
});
