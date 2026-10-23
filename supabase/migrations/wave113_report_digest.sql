-- wave113: daily report alert (roadmap v2 S1, decision D24; emci OK 2026-10-22: "Count + report IDs").
--
-- Apple 1.2 asks for a timely response to reports; the Privacy/Terms promise one within 24 hours.
-- Once a day the `report-digest` Edge Function emails support@emgens.com IF reports arrived in the
-- last 24 hours: how many, their ids and kind (chat message / person / shared card). Never the reason,
-- the message text, a handle or who reported: emci reads details with the daily query in
-- docs/circle-safety.md. No email on a day with no new report.
--
-- Copies the tested wave94 path (ai-library-fill): a random token kept only in Vault, a
-- service-role-only check function, a pg_cron job calling the function with net.http_post.
-- Additive: no table, row or existing function changes. Pinned by check:circle-safety (S1 block).
-- Apply by hand:
--   supabase db query --linked -f supabase/migrations/wave113_report_digest.sql

-- 1. The token the cron job sends, checked against Vault (same shape as library_fill_token_ok).
create or replace function public.report_digest_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'report_digest_token' and decrypted_secret = p_token
  );
$$;
revoke all on function public.report_digest_token_ok(text) from public, anon, authenticated;
grant execute on function public.report_digest_token_ok(text) to service_role;

-- 2. What the email says: counts and ids only.
create or replace function public.report_digest(p_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'hours', p_hours,
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'kind', case when r.message_id is not null or r.context ->> 'kind' = 'chat' then 'message' else 'person' end
             ) order by r.at)
      from public.reports r
      where r.at >= now() - make_interval(hours => p_hours)
    ), '[]'::jsonb),
    'card_reports', coalesce((
      select jsonb_agg(jsonb_build_object('card_id', c.card_id) order by c.created_at)
      from public.ai_library_reports c
      where c.created_at >= now() - make_interval(hours => p_hours)
    ), '[]'::jsonb),
    'open_total', (select count(*) from public.reports where status = 'open')
  );
$$;
revoke all on function public.report_digest(integer) from public, anon, authenticated;
grant execute on function public.report_digest(integer) to service_role;

-- 3. The token (created once) and the daily timer: 15:05 UTC = 09:05 in Alberta (summer time).
do $tok$
begin
  if not exists (select 1 from vault.secrets where name = 'report_digest_token') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'report_digest_token',
      'Bearer token the report-digest cron job sends (wave113).'
    );
  end if;
end
$tok$;

do $cron$
begin
  begin
    perform cron.unschedule('report-digest-daily');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'report-digest-daily',
    '5 15 * * *',
    $job$
      select net.http_post(
        url := 'https://aijzsmupaaaxjctfgwpl.supabase.co/functions/v1/report-digest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'report_digest_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron not available; schedule report-digest-daily by hand: %', sqlerrm;
end
$cron$;

-- AFTER APPLYING, CHECK (read-only):
--   select jobname, schedule, active from cron.job where jobname = 'report-digest-daily';   -- 1 row, active
--   select count(*) from vault.secrets where name = 'report_digest_token';                   -- 1
--   select public.report_digest(24);   -- as postgres: counts + ids only
