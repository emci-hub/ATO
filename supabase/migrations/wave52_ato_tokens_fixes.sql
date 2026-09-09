-- wave52_ato_tokens_fixes.sql
--
-- Fixes 4 critical issues found in the `reviewer` subagent's pass on wave51
-- (ATO tokens, core loop redesign §5/T-04), applied and pushed the same
-- session. wave51 is already live, so these are corrections via
-- create-or-replace / alter, not edits to the original file — same
-- convention as wave47 patching wave46.
--
-- 1. `ato_token_events.pack_id`/`question_item_id` were `on delete set
--    null`, but the CHECK constraints tying them to their reason
--    (`(reason = 'ongoing_round_complete') = (pack_id is not null)` etc.)
--    make that combination fatal: deleting a user cascades auth.users ->
--    question_packs, whose FK action then tries to null pack_id on this
--    table's row -> the CHECK fires -> the whole delete-account transaction
--    aborts. supabase/functions/delete-account/index.ts explicitly relies
--    on every FK in this schema being ON DELETE CASCADE. Fixed by making
--    both FKs cascade instead: the row (and its historical ledger value)
--    disappears with the account, same as every other user-owned row.
--
-- 2. `claim_ongoing_round_complete` treated a SKIPPED item as "resolved"
--    (`answered_option is null and skipped_at is null`), but
--    `skip_rest_question_pack` (wave18) is generic — it has no kind filter
--    and will happily mark every item in an ongoing-round pack skipped. A
--    user could skip an entire round and still claim +21 for zero real
--    answers. Fixed to require every item genuinely ANSWERED
--    (answered_option is not null), full stop — skipped_at is no longer
--    consulted by this RPC at all.
--
-- 3. Same RPC had no floor on pack size: `insert_ongoing_round_pack`
--    (wave50) accepts 1-25 items with no daily cap, so a 1-item pack with
--    1 real answer would satisfy "every item answered" and mint +21,
--    repeatable without limit (every other reason in this ledger is either
--    once-ever or daily-capped). A real round is always 25 items
--    (composeOngoingRound's only caller), so the RPC now also requires
--    exactly 25 question_items rows in the pack before it will pay out.
--
-- 4. `claim_full_profile_complete` did zero server-side verification — any
--    authenticated caller got +21 once, no matter how many questions
--    they'd actually answered. Its sibling RPC verifies from server truth;
--    this one now does too, checking trait_history for at least 50 rows
--    with source = 'self_situation' (the write source every bank-question
--    answer path uses — intake, Infinite Questions, and the ongoing round
--    all call updateTraits(..., 'self_situation', ...)). This is a floor,
--    not a byte-identical reimplementation of the client's
--    bankTotalProgress tiered-per-axis counting — sufficient to close "zero
--    answers, free tokens" without duplicating that logic server-side.

-- 1. FK cascade fix -------------------------------------------------------------

alter table public.ato_token_events
  drop constraint ato_token_events_pack_id_fkey,
  add constraint ato_token_events_pack_id_fkey
    foreign key (pack_id) references public.question_packs(id) on delete cascade;

alter table public.ato_token_events
  drop constraint ato_token_events_question_item_id_fkey,
  add constraint ato_token_events_question_item_id_fkey
    foreign key (question_item_id) references public.question_items(id) on delete cascade;

-- 2 & 3. claim_ongoing_round_complete: require every item genuinely
-- answered AND exactly 25 items in the pack ------------------------------------

create or replace function public.claim_ongoing_round_complete(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 21;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_pack_owner uuid;
  v_total_items int;
  v_unanswered int;
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

  select count(*) into v_total_items
  from public.question_items
  where pack_id = p_pack_id;
  if v_total_items <> 25 then
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

-- 4. claim_full_profile_complete: real server-side floor check -----------------

create or replace function public.claim_full_profile_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 21;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
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

  select count(*) into v_answer_count
  from public.trait_history
  where user_id = uid and source = 'self_situation';
  if v_answer_count < 50 then
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
