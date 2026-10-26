-- wave115: drop the AI provider layer and the model-writer plumbing.
--
-- *** NOT APPLIED. RUN ONLY AFTER emci APPROVES. ***
-- ATO calls no outside AI service (Gemini, DeepSeek, any). The phone-side
-- provider switcher (/ai-lab) and the shared ai-vendors module are removed in
-- code; ai-library and ai-library-fill already return 410. This drops what only
-- those paths used. The story library itself (ai_library_cards / _seen /
-- _reports, library_serve, library_team_size, ...) and ai_usage stay: the app
-- still reads them and none of them call a model.
--
-- Verify before running: no deployed function calls claim_library_write or
-- library_fill_*:  select proname from pg_proc where proname like 'library_fill%';

begin;

-- 1. Cron: the fill job (wave94). wave114 already unscheduled it; this is a no-op if so.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ai-library-fill';
  end if;
end $$;

-- 2. Provider usage log + its counter RPC (ai_provider_layer.sql). Only /ai-lab read it.
drop function if exists public.ai_provider_counts();
drop table if exists public.ai_provider_log;

-- 3. Model-writer RPCs (wave93 claim_library_write, wave94 library_fill_*), every overload.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_library_write', 'library_fill_token_ok', 'library_fill_queue',
                        'library_fill_state', 'library_fill_begin', 'library_fill_done')
  loop
    execute format('drop function if exists %s', f);
  end loop;
end $$;

-- 4. Fill bookkeeping tables (wave94). ai_library_wanted stays (library_want still records demand).
drop table if exists public.ai_library_fill_fails;
drop table if exists public.ai_library_fill_days;

commit;

-- Verify after:
--   select count(*) from cron.job where jobname = 'ai-library-fill';            -- 0
--   select to_regclass('public.ai_provider_log'), to_regclass('public.ai_library_fill_days');  -- null, null
