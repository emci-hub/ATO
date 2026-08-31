-- Trait history (safety-net timeline) + earned-only token balance.
-- History is append-only for clients. Tokens never purchased; mutations
-- only through earn_tokens / spend_tokens. Both tables cascade with
-- auth.users so self-delete and delete_branch empty them.

-- 1. trait_history -----------------------------------------------------------

create table public.trait_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  axis text not null,
  value numeric not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint trait_history_axis_known check (axis in (
    'openness',
    'conscientiousness',
    'extraversion',
    'agreeableness',
    'steadiness',
    'attachment_anxiety',
    'attachment_avoidance',
    'conflict_assertiveness',
    'conflict_cooperativeness',
    'autonomy',
    'competence',
    'relatedness',
    'growth_mindset',
    'locus_of_control',
    'self_efficacy'
  )),
  constraint trait_history_value_01 check (value >= 0 and value <= 1),
  constraint trait_history_source_known check (source in (
    'self_slider',
    'self_tap',
    'self_confirm',
    'self_settings',
    'self_grid',
    'self_situation',
    'self_game'
  ))
);

create index trait_history_user_axis_created_idx
  on public.trait_history (user_id, axis, created_at desc);

comment on table public.trait_history is
  'Append-only growth timeline of numeric trait writes. RLS matches me_select_own (auth.uid() = user_id). Cascades with auth.users.';

alter table public.trait_history enable row level security;

create policy trait_history_select_own on public.trait_history
  for select using (auth.uid() = user_id);

create policy trait_history_insert_own on public.trait_history
  for insert with check (auth.uid() = user_id);

grant select, insert on public.trait_history to authenticated;
revoke update, delete on public.trait_history from public, anon, authenticated;

-- 2. tokens on ME + ledger ---------------------------------------------------

alter table public.me
  add column if not exists tokens int not null default 0
  check (tokens >= 0);

comment on column public.me.tokens is
  'Earned-only balance. Never purchased. Direct client updates are rejected; use earn_tokens / spend_tokens.';

create table public.token_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null,
  reason text not null,
  local_day date not null,
  created_at timestamptz not null default now(),
  constraint token_events_reason_known check (reason in (
    'check_in',
    'game_round',
    'trickle',
    'sage_insight',
    'profile_depth'
  )),
  constraint token_events_nonzero check (delta <> 0)
);

create unique index token_events_earn_once_per_day
  on public.token_events (user_id, reason, local_day)
  where delta > 0;

create index token_events_user_created_idx
  on public.token_events (user_id, created_at desc);

comment on table public.token_events is
  'Ledger for earned-only tokens. Positive rows are once per local day per reason. Cascades with auth.users.';

alter table public.token_events enable row level security;

create policy token_events_select_own on public.token_events
  for select using (auth.uid() = user_id);

grant select on public.token_events to authenticated;
revoke insert, update, delete on public.token_events from public, anon, authenticated;

create or replace function public.me_tokens_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.tokens is distinct from old.tokens then
    if current_setting('ato.allow_token_write', true) is distinct from '1' then
      raise exception 'tokens are earned only' using errcode = 'P0040';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists me_tokens_guard on public.me;
create trigger me_tokens_guard
  before update on public.me
  for each row execute function public.me_tokens_guard();

revoke execute on function public.me_tokens_guard() from public, anon, authenticated;

create or replace function public.earn_tokens(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reason text := lower(btrim(coalesce(p_reason, '')));
  amount int;
  tz text;
  today date;
  yesterday date;
  had_yesterday boolean;
  new_balance int;
  v_event_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if reason = 'check_in' then
    amount := 3;
  elsif reason = 'game_round' then
    amount := 5;
  else
    raise exception 'invalid earn reason' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;
  yesterday := today - 1;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));
  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, amount, reason, today)
  on conflict (user_id, reason, local_day) where delta > 0 do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', reason
    );
  end if;

  update public.me
    set tokens = tokens + amount
    where id = uid
    returning tokens into new_balance;

  if reason = 'check_in' then
    select exists (
      select 1 from public.checks
      where user_id = uid and logged_on = yesterday
    ) into had_yesterday;

    if had_yesterday and not exists (
      select 1 from public.token_events
      where user_id = uid and reason = 'trickle' and local_day = today and delta > 0
    ) then
      insert into public.token_events (user_id, delta, reason, local_day)
      values (uid, 1, 'trickle', today);
      update public.me
        set tokens = tokens + 1
        where id = uid
        returning tokens into new_balance;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', reason
  );
end;
$$;

create or replace function public.spend_tokens(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reason text := lower(btrim(coalesce(p_reason, '')));
  amount int;
  tz text;
  today date;
  current_balance int;
  new_balance int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if reason = 'sage_insight' then
    amount := 8;
  elsif reason = 'profile_depth' then
    amount := 12;
  else
    raise exception 'invalid spend reason' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC'), tokens
    into tz, current_balance
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));

  if coalesce(current_balance, 0) < amount then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient',
      'balance', coalesce(current_balance, 0),
      'price', amount
    );
  end if;

  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, -amount, reason, today);

  update public.me
    set tokens = tokens - amount
    where id = uid
    returning tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'balance', coalesce(new_balance, 0),
    'delta', -amount,
    'reason', reason,
    'price', amount
  );
end;
$$;

revoke all on function public.earn_tokens(text) from public, anon;
grant execute on function public.earn_tokens(text) to authenticated;
revoke all on function public.spend_tokens(text) from public, anon;
grant execute on function public.spend_tokens(text) to authenticated;
