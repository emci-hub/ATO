-- wave114: unschedule the AI library writer.
--
-- NOT APPLIED in this pull request. The owner runs it after merge:
--   supabase db query --linked -f supabase/migrations/wave114_unschedule_ai_library.sql
--
-- Removes the wave94 cron job `ai-library-fill`. It does not delete cards,
-- tables, or functions. The Edge Function in this repo already refuses
-- deep_dive and legend with 410 and does not call a model. Deploy that
-- function in the same change as this unschedule, or the old deployed
-- writer can still run until the job is gone.

do $cron$
begin
  perform cron.unschedule('ai-library-fill');
exception when others then
  raise notice 'ai-library-fill was not scheduled: %', sqlerrm;
end
$cron$;

-- AFTER APPLYING, CHECK:
--   select jobname, schedule from cron.job where jobname = 'ai-library-fill';
--   -- zero rows
