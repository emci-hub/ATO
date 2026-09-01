-- Unified AI provider usage log. One row per model call (not the response).
-- Self-tracked because vendor dashboards need cloud-admin credentials, not API keys.

create table public.ai_provider_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null
    check (provider in ('gemini', 'nvidia', 'perplexity', 'claude', 'grok')),
  created_at timestamptz not null default now()
);

create index ai_provider_log_user_created_idx
  on public.ai_provider_log (user_id, created_at desc);

alter table public.ai_provider_log enable row level security;

create policy ai_provider_log_select_own on public.ai_provider_log
  for select using (auth.uid() = user_id);

create policy ai_provider_log_insert_own on public.ai_provider_log
  for insert with check (auth.uid() = user_id);

comment on table public.ai_provider_log is
  'Per-call vendor log (provider + timestamp only). Writes from the signed-in client after a model attempt.';

grant select, insert on table public.ai_provider_log to authenticated;
revoke all on table public.ai_provider_log from anon, public;

create function public.ai_provider_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'minute', coalesce((
      select jsonb_object_agg(provider, n)
      from (
        select provider, count(*)::int as n
        from public.ai_provider_log
        where user_id = auth.uid()
          and created_at > timezone('utc', now()) - interval '1 minute'
        group by provider
      ) minute_rows
    ), '{}'::jsonb),
    'day', coalesce((
      select jsonb_object_agg(provider, n)
      from (
        select provider, count(*)::int as n
        from public.ai_provider_log
        where user_id = auth.uid()
          and created_at > timezone('utc', now()) - interval '24 hours'
        group by provider
      ) day_rows
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.ai_provider_counts() from public, anon;
grant execute on function public.ai_provider_counts() to authenticated;

comment on function public.ai_provider_counts() is
  'Rolling 1-minute and 24-hour self-tracked call counts per provider for the signed-in user.';
