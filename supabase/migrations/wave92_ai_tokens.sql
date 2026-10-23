-- wave92_ai_tokens.sql
-- AI views paid in ATO tokens + a daily check-in (emci approved 2026-10-09).
--
--   Earn: daily check-in +5 (every 7th check-in +10 instead), the first 48
--         questions +15 (was +21), each set of 16 +5 (was +21; still 2 a day).
--   Spend: every AI view costs 5 — a Legends AI card, a deep dive (2 cards),
--          a new Story. Charged on the server inside each claim, refunded once
--          a day per feature when the call then fails.
--   Caps: tokens decide now; the per-feature daily caps become a safety
--         ceiling of 5 (Story, Legends, deep dive).
--   Dev: dev_reset_ai_limits — root only; clears today's AI counters for the
--        root account or a named handle (emci: "me or any account").
--
-- Copies tested paths: the ledger + me_ato_tokens_guard flag (wave51
-- spend_ato_tokens_*), the claim functions (wave22 / wave89 / wave90), and
-- require_root (wave88). Changes existing rows only in app_config (the caps).

-- 1. Ledger: new reasons, the AI kind, once-a-day rules -------------------------

alter table public.ato_token_events drop constraint if exists ato_token_events_reason_check;
alter table public.ato_token_events add constraint ato_token_events_reason_check check (reason in (
  'full_profile_complete',
  'ongoing_round_complete',
  'legend_reroll',
  'category_reroll',
  'question_reroll',
  'daily_checkin',
  'ai_spend',
  'ai_refund'
));

alter table public.ato_token_events
  add column if not exists ai_kind text check (ai_kind in ('story', 'legend', 'deep_dive'));
alter table public.ato_token_events drop constraint if exists ato_token_events_ai_kind_matches_reason;
alter table public.ato_token_events add constraint ato_token_events_ai_kind_matches_reason check (
  (reason in ('ai_spend', 'ai_refund')) = (ai_kind is not null)
);

create unique index if not exists ato_token_events_checkin_daily
  on public.ato_token_events (user_id, local_day) where reason = 'daily_checkin';
create unique index if not exists ato_token_events_ai_refund_daily
  on public.ato_token_events (user_id, ai_kind, local_day) where reason = 'ai_refund';

-- 2. Prices and caps ---------------------------------------------------------------

alter table public.app_config
  add column if not exists ai_token_price int not null default 5 check (ai_token_price >= 0),
  add column if not exists checkin_tokens int not null default 5 check (checkin_tokens >= 0),
  add column if not exists checkin_week_bonus int not null default 10 check (checkin_week_bonus >= 0);

comment on column public.app_config.ai_token_price is
  'ATO tokens one AI view costs (Story, Legends AI card, deep dive). Charged inside the claim.';

-- Tokens decide how often; these are now only a safety ceiling.
update public.app_config
  set story_daily_cap = 5, legend_figure_daily_cap = 5, category_deep_dive_daily_cap = 5
  where id = 1;

-- 3. The charge (internal) --------------------------------------------------------

-- Charges one AI view. Returns the new balance, or null when the balance is
-- too low (nothing is charged then). Caller holds the per-account token lock.
create or replace function public._charge_ai_tokens(p_uid uuid, p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  price int;
  tz text;
  new_balance int;
begin
  select ai_token_price into strict price from public.app_config where id = 1;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = p_uid;
  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - price
    where id = p_uid and ato_tokens >= price
    returning ato_tokens into new_balance;
  perform set_config('ato.allow_ato_token_write', '0', true);
  if new_balance is null then
    return null;
  end if;
  insert into public.ato_token_events (user_id, delta, reason, ai_kind, local_day)
  values (p_uid, -price, 'ai_spend', p_kind, (timezone(coalesce(tz, 'UTC'), now()))::date);
  return new_balance;
end;
$$;

revoke all on function public._charge_ai_tokens(uuid, text) from public, anon, authenticated;

-- 4. The three AI claims, now paid --------------------------------------------------

create or replace function public.claim_story_generate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select story_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':story'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'story')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'story');
  end if;

  balance := public._charge_ai_tokens(uid, 'story');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'story');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{story}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'story', 'balance', balance);
end;
$$;

revoke all on function public.claim_story_generate() from public, anon;
grant execute on function public.claim_story_generate() to authenticated;

create or replace function public.claim_legend_figure_story()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select legend_figure_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_figure'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'legend_figure')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'legend_figure');
  end if;

  balance := public._charge_ai_tokens(uid, 'legend');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'legend_figure');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{legend_figure}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'legend_figure', 'balance', balance);
end;
$$;

revoke all on function public.claim_legend_figure_story() from public, anon;
grant execute on function public.claim_legend_figure_story() to authenticated;

create or replace function public.claim_category_deep_dive()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select category_deep_dive_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':category_deep_dive'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'category_deep_dive')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'category_deep_dive');
  end if;

  balance := public._charge_ai_tokens(uid, 'deep_dive');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'category_deep_dive');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{category_deep_dive}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'category_deep_dive', 'balance', balance);
end;
$$;

revoke all on function public.claim_category_deep_dive() from public, anon;
grant execute on function public.claim_category_deep_dive() to authenticated;

-- 5. Refund when the AI then fails --------------------------------------------------

-- Gives back the price of the latest charge for this feature, if it was made in
-- the last 15 minutes and nothing was refunded for this feature today. The
-- server can't see whether the call worked, so a client could claim one refund
-- a day per feature after a good call: at most 3 extra views a day, still
-- inside the 5/day safety caps (accepted, emci 2026-10-09). Frees the slot too.
create or replace function public.refund_ai_tokens(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
  charge record;
  new_balance int;
  v_id uuid;
  usage_key text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('story', 'legend', 'deep_dive') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  local_today := (timezone(coalesce(tz, 'UTC'), now()))::date;
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  select id, delta, created_at into charge
    from public.ato_token_events
    where user_id = uid and reason = 'ai_spend' and ai_kind = p_kind
      and created_at > now() - interval '15 minutes'
    order by created_at desc
    limit 1;
  if charge.id is null then
    return jsonb_build_object('ok', false, 'reason', 'nothing to refund');
  end if;

  insert into public.ato_token_events (user_id, delta, reason, ai_kind, local_day)
  values (uid, -charge.delta, 'ai_refund', p_kind, local_today)
  on conflict (user_id, ai_kind, local_day) where reason = 'ai_refund' do nothing
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'already refunded today');
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me set ato_tokens = ato_tokens - charge.delta where id = uid returning ato_tokens into new_balance;
  perform set_config('ato.allow_ato_token_write', '0', true);

  usage_key := case p_kind when 'story' then 'story' when 'legend' then 'legend_figure' else 'category_deep_dive' end;
  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      array[usage_key],
      to_jsonb(greatest(coalesce((by_type->>usage_key)::int, 0) - 1, 0))
    )
    where user_id = uid and day = (timezone('utc', now()))::date;

  return jsonb_build_object('ok', true, 'balance', new_balance, 'delta', -charge.delta);
end;
$$;

revoke all on function public.refund_ai_tokens(text) from public, anon;
grant execute on function public.refund_ai_tokens(text) to authenticated;

-- 6. Daily check-in -------------------------------------------------------------------

create or replace function public.claim_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
  base int;
  bonus int;
  before_count int;
  amount int;
  v_id uuid;
  new_balance int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  local_today := (timezone(tz, now()))::date;
  select checkin_tokens, checkin_week_bonus into strict base, bonus from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  select count(*) into before_count from public.ato_token_events where user_id = uid and reason = 'daily_checkin';
  -- Every 7th check-in pays the bonus instead. A missed day never resets the count.
  amount := case when (before_count + 1) % 7 = 0 then bonus else base end;

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'daily_checkin', local_today)
  on conflict (user_id, local_day) where reason = 'daily_checkin' do nothing
  returning id into v_id;
  if v_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object('ok', false, 'already', true, 'balance', coalesce(new_balance, 0),
      'week_count', ((before_count - 1) % 7) + 1);
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me set ato_tokens = ato_tokens + amount where id = uid returning ato_tokens into new_balance;
  perform set_config('ato.allow_ato_token_write', '0', true);

  return jsonb_build_object('ok', true, 'already', false, 'balance', new_balance, 'delta', amount,
    'week_count', (before_count % 7) + 1);
end;
$$;

revoke all on function public.claim_daily_checkin() from public, anon;
grant execute on function public.claim_daily_checkin() to authenticated;

-- 7. Dev: reset today's AI limits (root only) -------------------------------------

create or replace function public.dev_reset_ai_limits(p_handle text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  root_id uuid;
  target uuid;
  target_handle text;
  n int;
begin
  root_id := public.require_root();
  if p_handle is null or btrim(p_handle) = '' then
    target := root_id;
  else
    select id into target from public.me
      where lower(handle) in (lower(btrim(p_handle)), lower(ltrim(btrim(p_handle), '@')))
      limit 1;
    if target is null then
      raise exception 'no account with that handle' using errcode = 'P0002';
    end if;
  end if;
  select handle into target_handle from public.me where id = target;

  update public.ai_usage
    set calls = 0, by_type = '{}'::jsonb
    where user_id = target and day >= (timezone('utc', now()))::date - 1;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'handle', target_handle, 'days_cleared', n);
end;
$$;

revoke all on function public.dev_reset_ai_limits(text) from public, anon;
grant execute on function public.dev_reset_ai_limits(text) to authenticated;

-- 8. Earn amounts (restated from wave78 / wave81 with only the amount changed) ------

create or replace function public.claim_full_profile_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 15;  -- wave92: enough for one AI view of each kind
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_full_axes int;
  v_legacy_answered int;
  v_answer_count int;
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

  -- a. every trait has its 3 (staged intake)
  select count(*) into v_full_axes
  from public.trait_tracks
  where user_id = uid and track = 'report' and answer_count >= 3;

  -- b. the old tiered 50, each trait capped at its old size
  select coalesce(sum(least(t.answer_count, l.old_count)), 0) into v_legacy_answered
  from (values
    ('openness', 6), ('conscientiousness', 6), ('extraversion', 6),
    ('agreeableness', 4), ('steadiness', 2), ('attachment_anxiety', 2),
    ('attachment_avoidance', 2), ('conflict_assertiveness', 4),
    ('conflict_cooperativeness', 2), ('autonomy', 2), ('competence', 2),
    ('relatedness', 4), ('growth_mindset', 2), ('locus_of_control', 2),
    ('self_efficacy', 2), ('playfulness', 2)
  ) as l(axis, old_count)
  join public.trait_tracks t
    on t.user_id = uid and t.track = 'report' and t.axis = l.axis;

  -- c. the wave52 rule, kept
  select count(*) into v_answer_count
  from public.trait_history
  where user_id = uid and source = 'self_situation';

  if v_full_axes < 16 and v_legacy_answered < 50 and v_answer_count < 50 then
    raise exception 'full profile not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'full_profile_complete', today)
  on conflict (user_id) where reason = 'full_profile_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'full_profile_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'full_profile_complete'
  );
end;
$$;

create or replace function public.claim_ongoing_round_complete(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 5;  -- wave92: one AI view per set of 16
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_pack_owner uuid;
  v_total_items int;
  v_unanswered int;
  v_paid_today int;
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

  select user_id into v_pack_owner
  from public.question_packs
  where id = p_pack_id and kind = 'ongoing_round';
  if v_pack_owner is null or v_pack_owner is distinct from uid then
    raise exception 'pack not found' using errcode = '22023';
  end if;

  -- A round is 16 (staged intake, wave78). A round of 25 from before still pays.
  select count(*) into v_total_items
  from public.question_items
  where pack_id = p_pack_id;
  if v_total_items < 16 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  select count(*) into v_unanswered
  from public.question_items
  where pack_id = p_pack_id and answered_option is null;
  if v_unanswered > 0 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  -- Daily cap (emci, 2026-10-03): at most 2 paid rounds per local day. Checked
  -- under the same lock as the insert, so two claims at once cannot both pass.
  -- A capped round is not consumed: it is refused, not recorded.
  select count(*) into v_paid_today
  from public.ato_token_events
  where user_id = uid and reason = 'ongoing_round_complete' and local_day = today;
  if v_paid_today >= 2 and not exists (
    select 1 from public.ato_token_events
    where user_id = uid and reason = 'ongoing_round_complete' and pack_id = p_pack_id
  ) then
    raise exception 'daily round payout cap reached' using errcode = 'P0042';
  end if;

  insert into public.ato_token_events (user_id, delta, reason, pack_id, local_day)
  values (uid, amount, 'ongoing_round_complete', p_pack_id, today)
  on conflict (user_id, pack_id) where reason = 'ongoing_round_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'ongoing_round_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  update public.question_packs
    set completed_at = now()
    where id = p_pack_id and completed_at is null;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'ongoing_round_complete'
  );
end;
$$;
