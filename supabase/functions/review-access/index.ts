/**
 * review-access — root-only list / approve / deny for landing-page requests.
 *
 * Approve generates a single-use invite code owned by root (emci) and emails
 * it via Resend, same from-address as Auth OTP (`noreply@asstrollogs.com`).
 * Deny only flips the row — no email.
 *
 * JWT required. Caller's me row must have is_root = true (wave34 — root is a
 * column, never a handle string). The RPCs re-check via require_root().
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FROM = 'ATO <noreply@asstrollogs.com>';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

async function sendInviteEmail(to: string, code: string): Promise<{ emailed: boolean; error: string | null }> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey) return { emailed: false, error: 'resend_key_missing' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'Your ATO invite',
      text: `You're in. Your invite code is:\n\n${code}\n\nEnter it when you create an account. It works once.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { emailed: false, error: detail.slice(0, 300) || `resend_${res.status}` };
  }
  return { emailed: true, error: null };
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

  const { data: me } = await caller.from('me').select('is_root').eq('id', user.id).maybeSingle();
  if (me?.is_root !== true) return json({ error: 'not_allowed' }, 403);

  let payload: { action?: unknown; id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const action = payload.action;
  if (action !== 'list' && action !== 'approve' && action !== 'deny') {
    return json({ error: 'unknown_action' }, 400);
  }

  if (action === 'list') {
    const { data, error } = await caller.rpc('list_pending_access_requests');
    if (error) return json({ error: error.message }, 400);
    return json({ requests: data ?? [] });
  }

  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) return json({ error: 'missing_id' }, 400);

  if (action === 'deny') {
    const { data, error } = await caller.rpc('deny_access_request', { p_id: id }).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    return json({
      result: {
        id: data?.id,
        email: data?.email,
        status: 'denied',
        invite_code: null,
        emailed: false,
      },
    });
  }

  const { data, error } = await caller.rpc('approve_access_request', { p_id: id }).maybeSingle();
  if (error) return json({ error: error.message }, 400);
  const email = String(data?.email ?? '');
  const code = String(data?.invite_code ?? '');
  const sent = email && code ? await sendInviteEmail(email, code) : { emailed: false, error: 'missing_code' };
  return json({
    result: {
      id: data?.id,
      email,
      status: 'approved',
      invite_code: code,
      emailed: sent.emailed,
      email_error: sent.error,
    },
  });
});
