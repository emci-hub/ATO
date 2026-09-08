-- Trait system redesign (§7): reveal_roll_item must refuse to charge for an
-- item whose stored result isn't actually ready. Found in review of wave46
-- (already applied) — every roll item's `result` now carries a top-level
-- `ready: boolean` (src/lib/rolls/compose.ts, a review-driven fix on the
-- TypeScript side, unified across legend/category/story), but the RPC
-- itself never checked it: a user could spend a token to "reveal" a
-- category or story whose generation had failed (or a legend with no
-- match), and get nothing for it. Redefines reveal_roll_item only —
-- everything else about it (lock key, balance check, atomicity) is
-- unchanged from wave46.

create or replace function public.reveal_roll_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_type text;
  v_result jsonb;
  v_revealed_at timestamptz;
  v_price int;
  v_balance int;
  v_new_balance int;
  tz text;
  today date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));

  select type, result, revealed_at into v_type, v_result, v_revealed_at
    from public.trait_rolls
    where id = p_item_id and user_id = uid
    for update;

  if v_type is null then
    raise exception 'roll item not found' using errcode = 'P0002';
  end if;

  if v_revealed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'revealed_at', v_revealed_at, 'type', v_type);
  end if;

  -- Refuse to charge for an item with nothing to reveal. Every roll item's
  -- result carries a top-level `ready` boolean (composeRoll, TypeScript
  -- side) — a row this is false for legitimately exists (it fills its slot
  -- in the fixed 13-item shape store_roll requires) but has no real content
  -- yet. Treat a MISSING `ready` key the same as false (defensive: an older
  -- or malformed row must not accidentally read as chargeable).
  if coalesce((v_result->>'ready')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'type', v_type);
  end if;

  v_price := case v_type when 'legend' then 5 else 1 end;

  select coalesce(nullif(timezone, ''), 'UTC'), tokens into tz, v_balance
    from public.me
    where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  today := (timezone(tz, now()))::date;

  if coalesce(v_balance, 0) < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', coalesce(v_balance, 0), 'price', v_price);
  end if;

  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, -v_price, 'roll_reveal', today);

  update public.me
    set tokens = tokens - v_price
    where id = uid
    returning tokens into v_new_balance;

  update public.trait_rolls
    set revealed_at = now()
    where id = p_item_id
    returning revealed_at into v_revealed_at;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', v_new_balance,
    'price', v_price,
    'revealed_at', v_revealed_at,
    'type', v_type
  );
end;
$$;

comment on function public.reveal_roll_item(uuid) is
  'Atomic spend + reveal for one roll item: refuses to charge unless result->>''ready'' is true, then balance check, deduct, and revealed_at update all inside one advisory-locked transaction, so two simultaneous reveal requests for the same item cannot both succeed.';
