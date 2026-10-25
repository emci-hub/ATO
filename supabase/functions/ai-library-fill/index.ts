/**
 * ai-library-fill — closed.
 *
 * The phone no longer asks for model-written deep dives or Legends cards.
 * This function does not call a model. wave114 unschedules the cron job
 * `ai-library-fill`. That migration is not applied in this change.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve((request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  return json({ ok: false, reason: 'library' }, 410);
});
