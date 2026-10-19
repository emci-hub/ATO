/**
 * ai-generate — CLOSED (wave98, ato-finish-roadmap step 1, M1).
 *
 * This used to be a generic prompt proxy: any signed-in caller with AI consent could
 * send any prompt (≤24k chars) to six vendors. No live feature needs that any more —
 * deep dives, Story and Legends cards are written by `ai-library`, which rebuilds the
 * prompt on the server from `{kind, bucket, mode}` and never takes caller text.
 *
 * It now answers 410 to everything and holds no vendor key, so there is nothing to
 * proxy. Old app bundles that still fall back to it (only when ai-library says
 * "missing") show their normal "couldn't write this one" state. The function itself is
 * deleted in step 9 (`supabase functions delete ai-generate`) once those bundles are gone.
 *
 * Do not add a vendor call, a secret or a prompt field back here. Pinned by
 * `check:ai-provider`.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  return new Response(JSON.stringify({ error: 'gone' }), {
    status: 410,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
});
