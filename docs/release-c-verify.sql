-- Release C read-only check for wave108 + wave109. Changes nothing. Every row should say ok = true.
select 'tables chat_keys/chat_messages/chat_restrictions' as check_name,
       (select count(*) from information_schema.tables where table_schema='public'
          and table_name in ('chat_keys','chat_messages','chat_restrictions')) = 3 as ok
union all select 'RLS on for all three',
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('chat_keys','chat_messages','chat_restrictions') and c.relrowsecurity) = 3
union all select 'reports.context column',
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='context')
union all select 'reports_insert_no_context is restrictive',
       exists (select 1 from pg_policies where schemaname='public' and tablename='reports'
          and policyname='reports_insert_no_context' and permissive='RESTRICTIVE')
union all select 'chat RPCs (8)',
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname in ('chat_set_key','chat_peer_key','chat_send','chat_thread',
          'chat_report','chat_my_status','chat_ack_warning','admin_chat_restrict')) = 8
union all select 'no client write grants on chat_messages',
       not exists (select 1 from information_schema.role_table_grants where table_schema='public'
          and table_name='chat_messages' and grantee in ('anon','authenticated')
          and privilege_type in ('INSERT','UPDATE','DELETE'))
union all select 'cron chat-retention-30d scheduled',
       exists (select 1 from cron.job where jobname='chat-retention-30d')
union all select 'wave109: blocks select policy is blocker-only',
       exists (select 1 from pg_policies where schemaname='public' and tablename='blocks'
          and policyname='blocks_select_blocker')
       and not exists (select 1 from pg_policies where schemaname='public' and tablename='blocks'
          and policyname='blocks_select_parties');
