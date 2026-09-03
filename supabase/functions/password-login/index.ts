/**
 * password-login — resolves an @handle or email + password to a session
 * without ever exposing the account's email address to the caller.
 *
 * login_email_for_identifier() used to be called directly from the client
 * with the anon key, which let anyone signed out enumerate handle -> email
 * pairs merely by calling it (see docs/GOTCHAS.md, wave36 migration). Its
 * anon/authenticated EXECUTE grants are revoked; only this function's
 * service-role client may call it now. The resolved email never leaves this
 * function — signInWithPassword runs here and only the resulting session
 * (or a generic failure) goes back to the client.
 *
 * No JWT is required or possible — this IS the pre-login path. The failure
 * response is identical whether the identifier didn't resolve or the
 * password was wrong, so a caller cannot use this to probe which handles
 * exist.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

const GENERIC_FAILURE = { error: 'invalid_credentials' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: { identifier?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!identifier || !password) return json(GENERIC_FAILURE, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let email: string;
  if (identifier.includes('@')) {
    email = identifier.toLowerCase();
  } else {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await serviceClient.rpc('login_email_for_identifier', {
      p_identifier: identifier,
    });
    if (error || typeof data !== 'string' || !data.trim()) {
      return json(GENERIC_FAILURE, 401);
    }
    email = data.trim();
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session) {
    return json(GENERIC_FAILURE, 401);
  }

  return json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });
});
