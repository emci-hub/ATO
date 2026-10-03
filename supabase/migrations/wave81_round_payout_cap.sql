-- wave81_round_payout_cap.sql
--
-- APPLIED 2026-10-03 to the live project (by the agent, through the Supabase
-- connector; emci: "cap 2").
--
-- The +21 for a finished round is paid at most TWICE per local day. A round's
-- questions are created by the phone (insert_ongoing_round_pack, wave50), so
-- without a cap someone sending their own requests could make and finish fake
-- rounds for unlimited tokens. Real rounds take minutes and the AI quota
-- (20/day) already slows anyone down, so 2 a day rarely touches a real person.
--
-- claim_ongoing_round_complete (wave78) is replaced with one change: after the
-- lock, if this account already has 2 round payouts on its local today, and
-- this pack was not already paid, it raises 'daily round payout cap reached'
-- (errcode P0042) instead of paying. Older app bundles treat any refusal as
-- "not paid" and simply do not name the +21; the new bundle says why. A re-ask
-- for an already-paid pack still answers `already` (idempotent). A capped
-- round is refused, not consumed, so a later claim on another day can pay it
-- (still inside that day's cap).
--
-- No row is altered or deleted.

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
