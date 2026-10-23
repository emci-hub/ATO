-- DO NOT APPLY.
-- Prepared only. Not a migration. Not deployed with the Story Library branch.
-- Apply this only after STORY_LIBRARY_RUNTIME is true in a build that is
-- already on phones, so the fill cron is not the only writer of deep dives
-- and Legends.
--
-- Pauses the wave94 job. The function itself stays deployed until
-- ai-library-writer-off.md is applied in the same change.

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
