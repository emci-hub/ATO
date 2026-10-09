/**
 * ai-library — writes shared library cards on the SERVER (wave93, emci
 * 2026-10-09: "library first, AI tops up"; safe for a public app).
 *
 * The phone sends only { kind, bucket, mode } — never card text. This function:
 *   1. verifies the JWT and AI consent (same rules as ai-generate);
 *   2. claims first, as the person (`claim_library_write`): paid = the
 *      existing 5-token claim + the shared AI cap; free_legend = the free daily
 *      Legends reveal; seed = root only, its own cap. No claim = no call;
 *   3. paid Legends reveals take an unseen library card when one exists
 *      (the reveal is already paid for) — no model call;
 *   4. builds the prompt FROM THE BUCKET KEY with the app's own code
 *      (`_shared/ai-library.bundle.js`, generated from src/lib/ai-library),
 *      calls the model (Gemini, then DeepSeek), and checks the answer with the
 *      app's own rules (one retry);
 *   5. stores only passing cards with the service role (`library_add_cards`,
 *      which re-checks them) and returns the person's card;
 *   6. a failed paid call gives the tokens back (`refund_ai_tokens`).
 *
 * Keys: GEMINI_API_KEY / DEEPSEEK_API_KEY (+ optional *_MODEL), same secrets as
 * ai-generate. SUPABASE_SERVICE_ROLE_KEY is provided by the platform.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { LIBRARY_VERSION, checkLibraryAnswer, isLibraryKind, planLibraryCall } from '../_shared/ai-library.bundle.js';
import { complete } from '../_shared/ai-vendors.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Mode = 'paid' | 'free_legend' | 'seed';
type Kind = 'deep_dive' | 'story' | 'legend';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

const REFUND_KIND: Record<Kind, string> = { deep_dive: 'deep_dive', story: 'story', legend: 'legend' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let payload: { kind?: unknown; bucket?: unknown; mode?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const kind = payload.kind;
  const bucket = payload.bucket;
  const mode = payload.mode;
  if (!isLibraryKind(kind) || typeof bucket !== 'string' || (mode !== 'paid' && mode !== 'free_legend' && mode !== 'seed')) {
    return json({ error: 'invalid_request' }, 400);
  }
  const version = LIBRARY_VERSION[kind as Kind];

  // The key must be one this code can rebuild a prompt from, BEFORE anything is charged.
  const counts = await admin.rpc('library_angle_counts', { p_kind: kind, p_bucket: bucket, p_version: version });
  const angleCounts = (counts.data as Record<string, number> | null) ?? {};
  const plan = planLibraryCall(kind, bucket, angleCounts);
  if (!plan.ok) return json({ ok: false, reason: 'bucket' }, 400);

  // Consent: only an explicit true passes (same as ai-generate).
  const { data: consentRow, error: consentError } = await caller.from('me').select('ai_consent').eq('id', user.id).maybeSingle();
  if (consentError) return json({ error: 'consent_check_failed' }, 500);
  if ((consentRow as { ai_consent?: unknown } | null)?.ai_consent !== true) return json({ ok: false, reason: 'consent' }, 403);

  // Claim first, as the person. No claim = no call.
  const { data: claim, error: claimError } = await caller.rpc('claim_library_write', {
    p_kind: kind,
    p_mode: mode,
    p_bucket: bucket,
    p_version: version,
  });
  if (claimError) {
    return json({ ok: false, reason: /P0043|ai quota/.test(`${claimError.code} ${claimError.message}`) ? 'quota' : 'failed' });
  }
  const claimRow = claim as { ok?: boolean; reason?: string; served?: { ok?: boolean } } | null;
  if (!claimRow?.ok) return json({ ok: false, reason: claimRow?.reason ?? 'failed' });
  // A Legends reveal (claimed above) got an unseen library card: no model call.
  if (claimRow.served?.ok) return json({ ok: true, served: claimRow.served, written: 0 });

  const refund = async () => {
    // The shared AI cap unit (not for seeds: they use the root cap), then the tokens.
    if (mode !== 'seed') await admin.rpc('refund_ai_call', { p_user_id: user.id, p_call_type: 'explore' });
    if (mode === 'paid') await caller.rpc('refund_ai_tokens', { p_kind: REFUND_KIND[kind as Kind] });
  };

  let angles = plan.angles;
  let prompt = plan.prompt;
  let maxOutputTokens = plan.maxOutputTokens;
  for (let pass = 1; pass <= 2; pass += 1) {
    const raw = await complete(prompt, maxOutputTokens);
    if (!raw) break;
    const checked = checkLibraryAnswer(kind, bucket, angles, raw);
    if (checked.cards.length > 0) {
      const added = await admin.rpc('library_add_cards', {
        p_user: mode === 'seed' ? null : user.id,
        p_kind: kind,
        p_bucket: bucket,
        p_version: version,
        p_items: checked.cards,
        p_source: mode === 'seed' ? 'seed' : 'ai',
      });
      const row = added.data as { ok?: boolean; served?: unknown; ids?: unknown[] } | null;
      if (added.error || !row?.ok) break;
      return json({ ok: true, served: row.served ?? null, written: row.ids?.length ?? 0 });
    }
    // Reason only, never the text.
    console.log(`[ai-library] ${kind} rejected (pass ${pass}): ${checked.reason ?? 'unknown'}`);
    // The retry asks for one card only: a cut-off two-card answer is not paid for twice in the same shape.
    const one = planLibraryCall(kind, bucket, angleCounts, 1);
    if (one.ok) {
      angles = one.angles;
      prompt = one.prompt;
      maxOutputTokens = one.maxOutputTokens;
    }
  }
  await refund();
  return json({ ok: false, reason: 'failed' });
});
