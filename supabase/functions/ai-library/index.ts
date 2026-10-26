/**
 * ai-library — closed.
 *
 * Legends cards and category deep dives are assembled on the phone from the
 * story library. This function does not claim a write and does not call a
 * model. Insights were already template-only and never came through here.
 *
 * The fill cron is unscheduled by supabase/migrations/wave114_unschedule_ai_library.sql.
 * That migration is in the repo and is not applied until the owner runs it.
 */
type Kind = 'deep_dive' | 'legend';
const CLOSED: Record<Kind, true> = { deep_dive: true, legend: true };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let kind: unknown;
  try {
    const payload = await request.json();
    kind = payload?.kind;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (kind === 'deep_dive' || kind === 'legend' || kind === 'story' || (typeof kind === 'string' && kind in CLOSED)) {
    return json({ ok: false, reason: 'library' }, 410);
  }
  return json({ ok: false, reason: 'library' }, 410);
});
