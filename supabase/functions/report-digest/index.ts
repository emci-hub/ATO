/**
 * report-digest — the daily report alert (wave113, roadmap v2 S1 / D24, emci OK 2026-10-22).
 *
 * Called once a day by pg_cron (job `report-digest-daily`) with a random token kept in Vault;
 * deploy with --no-verify-jwt (the token is the auth, checked by `report_digest_token_ok`), the
 * same way as ai-library-fill. If reports arrived in the last 24 hours it emails
 * support@emgens.com through Resend (same key and from-address as review-access):
 * how many, their ids and kind (`digest.ts`). Never a reason, message text, handle or reporter.
 * No new report = no email. Logs counts only.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { DIGEST_TO, digestText, type Digest } from './digest.ts';

const FROM = 'ATO <noreply@asstrollogs.com>';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const auth = await admin.rpc('report_digest_token_ok', { p_token: token });
  if (auth.error || auth.data !== true) return json({ error: 'not_allowed' }, 401);

  const { data, error } = await admin.rpc('report_digest', { p_hours: 24 });
  if (error || !data) return json({ error: 'digest_failed' }, 500);
  const digest = data as Digest;
  const mail = digestText(digest);
  if (!mail) return json({ ok: true, sent: false, reports: 0 });

  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey) return json({ ok: false, error: 'resend_key_missing' }, 500);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [DIGEST_TO], subject: mail.subject, text: mail.text }),
  });
  const count = digest.reports.length + digest.card_reports.length;
  console.log(`[report-digest] ${count} report(s), email ${res.ok ? 'sent' : `failed ${res.status}`}`);
  if (!res.ok) return json({ ok: false, error: `resend_${res.status}` }, 502);
  return json({ ok: true, sent: true, reports: count });
});
