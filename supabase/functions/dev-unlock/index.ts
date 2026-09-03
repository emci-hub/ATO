/**
 * dev-unlock — checks a password typed behind the hidden "tap the version
 * number 7 times" gesture (`src/components/dev-unlock-gate.tsx`) against the
 * `DEV_UNLOCK_PASSWORD` Supabase secret.
 *
 * This answers only "did the typed password match" — it never grants a
 * session, writes anything, or touches the `me` row. A correct answer just
 * flips an in-memory, session-only flag on the client
 * (`src/lib/dev-access-unlock.ts`) that `canSeeDevLab` also accepts, next to
 * `PRE_LAUNCH_DEV`, root, and per-account grants. Nothing here replaces those
 * checks for actual dev-tools actions.
 *
 * JWT required so an anonymous caller cannot hammer the password blind.
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

/** Equal-length constant-time compare — a length mismatch just returns false. */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let payload: { password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const password = typeof payload.password === 'string' ? payload.password : '';
  const secret = Deno.env.get('DEV_UNLOCK_PASSWORD') ?? '';

  // An unset secret or an empty typed password must never unlock anything.
  const ok = secret.length > 0 && password.length > 0 && timingSafeEqual(password, secret);
  return json({ ok });
});
