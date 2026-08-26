-- Stage 8, piece 4 — per-user AI quota (floor requirement: router rate-limited).
-- Caps are config-driven on app_config. Claims are atomic in claim_ai_call,
-- keyed on auth.uid(). Clients can read their own usage; they cannot write it.

alter table public.app_config
  add column ai_daily_cap int not null default 20
    check (ai_daily_cap >= 0),
  add column ai_monthly_cap int not null default 200
    check (ai_monthly_cap >= 0);

comment on column public.app_config.ai_daily_cap is
  'Per-user daily cap on model calls (Talk). Flip without a rebuild.';
comment on column public.app_config.ai_monthly_cap is
  'Per-user monthly cap on model calls (Talk). Flip without a rebuild.';

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls int not null default 0 check (calls >= 0),
  primary key (user_id, day)
);

create index ai_usage_user_month_idx on public.ai_usage (user_id, day);

alter table public.ai_usage enable row level security;

create policy ai_usage_select_own on public.ai_usage
  for select using (auth.uid() = user_id);

comment on table public.ai_usage is
  'Per-user per-UTC-day model-call counts. Writes only via claim_ai_call.';

create function public.claim_ai_call()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  daily_cap int;
  monthly_cap int;
  today date := (timezone('utc', now()))::date;
  month_start date := date_trunc('month', timezone('utc', now()))::date;
  daily_count int;
  monthly_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select ai_daily_cap, ai_monthly_cap
    into strict daily_cap, monthly_cap
    from public.app_config
    where id = 1;

  -- Serialize claims per user so two in-flight requests cannot both pass a cap of 1.
  perform pg_advisory_xact_lock(hashtext(uid::text));

  insert into public.ai_usage (user_id, day, calls)
  values (uid, today, 0)
  on conflict (user_id, day) do nothing;

  select calls into strict daily_count
    from public.ai_usage
    where user_id = uid and day = today;

  select coalesce(sum(calls), 0) into monthly_count
    from public.ai_usage
    where user_id = uid and day >= month_start and day <= today;

  if daily_count >= daily_cap or monthly_count >= monthly_cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', daily_count,
      'daily_cap', daily_cap,
      'monthly', monthly_count,
      'monthly_cap', monthly_cap
    );
  end if;

  update public.ai_usage
    set calls = calls + 1
    where user_id = uid and day = today
    returning calls into daily_count;

  return jsonb_build_object(
    'ok', true,
    'daily', daily_count,
    'daily_cap', daily_cap,
    'monthly', monthly_count + 1,
    'monthly_cap', monthly_cap
  );
end;
$$;

revoke all on function public.claim_ai_call() from public, anon;
grant execute on function public.claim_ai_call() to authenticated;

comment on function public.claim_ai_call() is
  'Atomically claim one model call against the signed-in user daily/monthly cap.';
