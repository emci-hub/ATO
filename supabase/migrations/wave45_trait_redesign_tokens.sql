-- Trait system redesign (§7): a new, dedicated token earn event —
-- intake_complete (once ever per user). Deliberately NOT folded into the
-- existing generic earn_tokens(reason) RPC: that function's idempotency is
-- hardwired around a once-per-local-day unique index
-- (token_events_earn_once_per_day), which is the wrong shape for "once
-- ever" — a new dedicated RPC instead, same pattern earn_tokens/spend_tokens
-- already use.
--
-- round_complete (+13/round, once per round number) is SCHEMA-ONLY here —
-- the round_number column, reason value, and its own unique index are laid
-- down as forward-compatible groundwork, but its earn RPC is deliberately
-- NOT included in this migration. Found in review: nothing server-side
-- tracks "which round a user is actually on" yet (that state lands with the
-- ongoing post-intake round persistence, a later part of §7) — an RPC that
-- trusts a client-supplied p_round_number with no real state to validate it
-- against is an unbounded token mint (call it with an ever-incrementing
-- number, forever). This differs from every other trust-the-caller RPC in
-- this codebase (earn_tokens is trust-the-caller too, but hard-bounded to
-- once per real calendar day): round_complete has no such real-world bound
-- until round state actually exists. Ship the RPC alongside that state, not
-- before it.

-- 1. Schema: round_number column, widened reason check, reworked indexes --

alter table public.token_events
  add column if not exists round_number int;

comment on column public.token_events.round_number is
  'Set only for reason = round_complete. Which post-intake tiered round (§3) this payout is for — each round number pays out once, ever. Column exists ahead of the round_complete RPC, which ships once real round-tracking state exists to validate it against (see migration header).';

alter table public.token_events
  drop constraint if exists token_events_reason_known,
  add constraint token_events_reason_known check (reason in (
    'check_in',
    'game_round',
    'trickle',
    'sage_insight',
    'profile_depth',
    'intake_complete',
    'round_complete'
  )),
  -- round_number must be set whenever (and only whenever) reason is
  -- round_complete — without this, a NULL round_number would silently
  -- bypass token_events_round_once's dedupe (NULLs are distinct in a
  -- unique index). Inert today (no RPC writes round_complete rows yet),
  -- closed proactively rather than left for whoever builds that RPC to
  -- remember.
  drop constraint if exists token_events_round_number_matches_reason,
  add constraint token_events_round_number_matches_reason check (
    (reason = 'round_complete') = (round_number is not null)
  );

-- The existing once-per-day index is a blanket rule across every reason —
-- left unscoped, it would silently cap intake_complete/round_complete at
-- "once per day" too, defeating the point of the two indexes below. Scope
-- it to exclude the two new reasons instead of widening their semantics.
--
-- IMPORTANT: earn_tokens (wave19) infers this index as its ON CONFLICT
-- arbiter via `on conflict (user_id, reason, local_day) where delta > 0`.
-- Postgres requires the ON CONFLICT predicate to IMPLY the index's actual
-- predicate — `delta > 0` alone does NOT imply `delta > 0 and reason not in
-- (...)`, so rescoping this index without also updating earn_tokens's own
-- ON CONFLICT clause breaks arbiter inference and makes EVERY check_in/
-- game_round earn error at runtime. Found in review before this shipped.
-- earn_tokens is redefined below (§1b) with the matching predicate — it
-- only ever inserts rows whose reason is in the untouched set, so this is a
-- text-only change to keep the arbiter valid, not a behavior change.
drop index if exists public.token_events_earn_once_per_day;
create unique index if not exists token_events_earn_once_per_day
  on public.token_events (user_id, reason, local_day)
  where delta > 0 and reason not in ('intake_complete', 'round_complete');

create unique index if not exists token_events_intake_once
  on public.token_events (user_id)
  where reason = 'intake_complete';

create unique index if not exists token_events_round_once
  on public.token_events (user_id, round_number)
  where reason = 'round_complete';

-- 1b. Redefine earn_tokens with the matching ON CONFLICT predicate --------
-- Byte-identical to wave19's version except the ON CONFLICT clause below,
-- which must match token_events_earn_once_per_day's new predicate exactly
-- for Postgres to infer it as the arbiter (see comment above). No other
-- line changed.

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
  on conflict (user_id, reason, local_day)
    where delta > 0 and reason not in ('intake_complete', 'round_complete')
    do nothing
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

-- 2. claim_intake_complete: +20 tokens, once ever ---------------------------

create or replace function public.claim_intake_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 20;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));
  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'intake_complete', today)
  on conflict (user_id) where reason = 'intake_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'intake_complete'
    );
  end if;

  update public.me
    set tokens = tokens + amount
    where id = uid
    returning tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'intake_complete'
  );
end;
$$;

revoke all on function public.claim_intake_complete() from public, anon;
grant execute on function public.claim_intake_complete() to authenticated;
