/**
 * ai-library-fill — the shared AI library fills itself (wave94, emci
 * 2026-10-09: "make our library big enough that it won't need AI yet").
 *
 * Called every 10 minutes by pg_cron (job `ai-library-fill`) with a random
 * token kept in Vault; deploy with --no-verify-jwt (the token is the auth,
 * checked by `library_fill_token_ok`). No person is involved and no one is
 * charged. Each run, up to `library_fill_per_run` AI calls:
 *   1. groups readers said they will need (their next Stories, today's
 *      Legends frames, a deep-dive group they ran out of) where someone has
 *      fewer than 2 unseen cards, most people waiting first;
 *   2. then every deep-dive group (207) with fewer than 3 cards.
 * Prompts and checks are the app's own code (the bundle), cards are stored as
 * approved seed cards (`library_add_cards`, which re-checks them), a group that
 * fails 3 times today is skipped, and `library_fill_begin` stops at the daily
 * cap. Logs reasons and counts only, never text.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  DEEP_DIVE_FILL_TARGET,
  LIBRARY_VERSION,
  checkLibraryAnswer,
  deepDiveBaseline,
  isLibraryKind,
  planLibraryCall,
} from '../_shared/ai-library.bundle.js';
import { complete } from '../_shared/ai-vendors.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Item = { kind: string; bucket: string; version: string };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const auth = await admin.rpc('library_fill_token_ok', { p_token: token });
  if (auth.error || auth.data !== true) return json({ error: 'not_allowed' }, 401);

  // 1. What readers are waiting for.
  const items: Item[] = [];
  const seen = new Set<string>();
  const add = (kind: string, bucket: string, version: string) => {
    const key = `${kind}|${version}|${bucket}`;
    if (seen.has(key) || !isLibraryKind(kind) || version !== LIBRARY_VERSION[kind]) return;
    seen.add(key);
    items.push({ kind, bucket, version });
  };
  const queue = await admin.rpc('library_fill_queue', { p_limit: 20 });
  for (const row of (queue.data as { kind: string; bucket_key: string; version: string }[] | null) ?? []) {
    add(row.kind, row.bucket_key, row.version);
  }

  // 2. The deep-dive baseline: every group up to 3 cards, thinnest first.
  const state = await admin.rpc('library_fill_state', { p_kind: 'deep_dive', p_version: LIBRARY_VERSION.deep_dive });
  const st = (state.data as { counts?: Record<string, number>; blocked?: string[]; per_run?: number } | null) ?? {};
  const counts = st.counts ?? {};
  const blocked = new Set(st.blocked ?? []);
  const perRun = Math.max(0, Math.min(20, st.per_run ?? 5));
  (deepDiveBaseline() as string[])
    .map((bucket) => ({ bucket, n: counts[bucket] ?? 0 }))
    .filter((row) => row.n < DEEP_DIVE_FILL_TARGET && !blocked.has(row.bucket))
    .sort((a, b) => a.n - b.n)
    .forEach((row) => add('deep_dive', row.bucket, LIBRARY_VERSION.deep_dive));

  let calls = 0;
  let written = 0;
  for (const item of items) {
    if (calls >= perRun) break;
    const angles = await admin.rpc('library_angle_counts', { p_kind: item.kind, p_bucket: item.bucket, p_version: item.version });
    const plan = planLibraryCall(item.kind, item.bucket, (angles.data as Record<string, number> | null) ?? {});
    if (!plan.ok) {
      // A key this code can't build (bad or stale): count it as a failure so it is skipped.
      await admin.rpc('library_fill_done', { p_kind: item.kind, p_bucket: item.bucket, p_version: item.version, p_cards: 0 });
      continue;
    }
    const go = await admin.rpc('library_fill_begin');
    if (go.data !== true) break; // today's cap
    calls += 1;
    let cards = 0;
    const raw = await complete(plan.prompt, plan.maxOutputTokens);
    if (raw) {
      const checked = checkLibraryAnswer(item.kind, item.bucket, plan.angles, raw);
      if (checked.cards.length > 0) {
        const added = await admin.rpc('library_add_cards', {
          p_user: null,
          p_kind: item.kind,
          p_bucket: item.bucket,
          p_version: item.version,
          p_items: checked.cards,
          p_source: 'seed',
        });
        const ids = (added.data as { ids?: unknown[] } | null)?.ids;
        cards = Array.isArray(ids) ? ids.length : 0;
      } else {
        console.log(`[ai-library-fill] ${item.kind} rejected: ${checked.reason ?? 'unknown'}`);
      }
    }
    written += cards;
    await admin.rpc('library_fill_done', { p_kind: item.kind, p_bucket: item.bucket, p_version: item.version, p_cards: cards });
  }

  return json({ ok: true, waiting: items.length, calls, written });
});
