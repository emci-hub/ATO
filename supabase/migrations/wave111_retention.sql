-- wave111: retention periods promised in the privacy policy (roadmap v2 step A2, emci OK 2026-10-22).
--
-- Same pattern as wave108's chat cleanup (purge_old_chat_messages + a daily pg_cron job):
--   * reports           : deleted 2 years after they were filed (reports.at)
--   * account_deletions : deleted 2 years after the deletion (account_deletions.deleted_at)
--   * access_requests   : the landing-page invite form is gone (A2); stored emails are deleted now,
--                         and anything that still arrives is deleted after 30 days.
-- Pinned by check:floor (retention block). Applied by hand:
--   supabase db query --linked -f supabase/migrations/wave111_retention.sql

create or replace function public.purge_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_reports int;
  n_deletions int;
  n_requests int;
begin
  delete from public.reports where at < now() - interval '2 years';
  get diagnostics n_reports = row_count;
  delete from public.account_deletions where deleted_at < now() - interval '2 years';
  get diagnostics n_deletions = row_count;
  delete from public.access_requests where requested_at < now() - interval '30 days';
  get diagnostics n_requests = row_count;
  return jsonb_build_object('reports', n_reports, 'account_deletions', n_deletions, 'access_requests', n_requests);
end;
$$;
revoke all on function public.purge_retention() from public, anon, authenticated;

-- One-time: the invite form is removed, so the emails it collected are no longer needed.
delete from public.access_requests;

do $cron$
begin
  begin
    perform cron.unschedule('retention-daily');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'retention-daily',
    '41 4 * * *',
    $job$select public.purge_retention();$job$
  );
exception when others then
  raise notice 'retention cron not scheduled: %', sqlerrm;
end;
$cron$;
