-- Voice preset on ME (like talk_style) + jargon-guard log on ai_usage.
-- complete_signup is untouched; the column default covers existing and new rows.

alter table public.me
  add column if not exists voice_preset text not null default 'close_friend';

alter table public.me
  drop constraint if exists me_voice_preset_check;

alter table public.me
  add constraint me_voice_preset_check
  check (voice_preset in (
    'neutral',
    'close_friend',
    'hyperactive_friend',
    'parent',
    'motivational_coach'
  ));

comment on column public.me.voice_preset is
  'Sage voice. close_friend is the default. Does not bypass sage.txt hedge rules.';

alter table public.ai_usage
  add column if not exists jargon_flag text,
  add column if not exists jargon_at timestamptz;

comment on column public.ai_usage.jargon_flag is
  'Last jargon-guard keyword that fired this UTC day. Flag only; never the generated line.';
comment on column public.ai_usage.jargon_at is
  'When the last jargon-guard fire was logged this UTC day.';

create or replace function public.log_jargon_guard(p_flag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  flag text := left(trim(coalesce(p_flag, '')), 80);
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if flag = '' then
    return;
  end if;

  insert into public.ai_usage (user_id, day, calls, jargon_flag, jargon_at)
  values (uid, today, 0, flag, timezone('utc', now()))
  on conflict (user_id, day) do update
    set jargon_flag = excluded.jargon_flag,
        jargon_at = excluded.jargon_at;
end;
$$;

revoke all on function public.log_jargon_guard(text) from public, anon;
grant execute on function public.log_jargon_guard(text) to authenticated;

comment on function public.log_jargon_guard(text) is
  'Record a jargon-guard fire for the signed-in user. Does not increment model-call quota.';
