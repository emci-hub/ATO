-- Trait system redesign (§7): the roll/reveal mechanic. One "roll" computes
-- a legend match + 11 category reads + a story together (13 rows, grouped
-- by roll_id); the user spends tokens to reveal individual items from an
-- already-computed set — revealing never triggers new generation.

-- 1. Roll AI quota — own call_type, own daily cap, NOT shared with
--    Sage/Explore's claim_ai_call pool (§7, pre-approved: a single roll is
--    ~12 AI generations — 11 category reads + 1 story; legend matching is
--    deterministic, no AI call — reusing the shared Sage/Explore cap as-is
--    would let one roll exhaust it by itself). Mirrors claim_questions_batch
--    exactly: its own ai_usage.by_type key, its own app_config cap column,
--    its own advisory-lock suffix. One roll = one quota unit regardless of
--    its ~12 sub-generations.

alter table public.app_config
  add column if not exists rolls_daily_cap int not null default 1
    check (rolls_daily_cap >= 0);

comment on column public.app_config.rolls_daily_cap is
  'Per-user daily cap on trait-roll generations. One roll = one quota unit regardless of its ~12 sub-generations (legend match is free/deterministic; 11 category reads + 1 story are the AI calls). This is the blunt backstop from §7 — the real gate is RCI eligibility, decided in the calling Edge Function before this is ever claimed.';

create or replace function public.claim_roll()
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
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select rolls_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'roll')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'roll'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{roll}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'roll')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'roll'
  );
end;
$$;

revoke all on function public.claim_roll() from public, anon;
grant execute on function public.claim_roll() to authenticated;

comment on function public.claim_roll() is
  'Claim one roll generation (rolls_daily_cap/day, default 1). Does not increment Sage/Explore/Questions calls. Called AFTER the caller has already decided (via RCI, client-untrusted — see the composing Edge Function) that a new roll is warranted; this is the blunt backstop, not the eligibility check itself.';

-- 2. trait_rolls — one row per item (legend/category/story), grouped by
--    roll_id. Writes only through store_roll below — no direct client
--    insert, same pattern token_events/trait_history already use.

create table public.trait_rolls (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('legend', 'category', 'story')),
  category_id text,
  result jsonb not null,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trait_rolls_category_id_matches_type check (
    (type = 'category') = (category_id is not null)
  )
);

create index trait_rolls_user_roll_idx on public.trait_rolls (user_id, roll_id);
create index trait_rolls_user_revealed_idx on public.trait_rolls (user_id, revealed_at desc);

-- Defense in depth alongside store_roll's own validation below: no two rows
-- in the same roll can claim the same category, and at most one legend row
-- / one story row per roll. Two separate indexes because category_id is
-- NULL for legend/story rows, and NULLs are distinct from each other in a
-- plain unique constraint — `unique (roll_id, type, category_id)` alone
-- would NOT stop two legend rows in the same roll.
create unique index trait_rolls_unique_category
  on public.trait_rolls (roll_id, category_id)
  where category_id is not null;
create unique index trait_rolls_unique_singleton_type
  on public.trait_rolls (roll_id, type)
  where category_id is null;

comment on table public.trait_rolls is
  'One row per item from a roll (13 per roll: 1 legend + 11 categories + 1 story), grouped by roll_id. revealed_at null = generated but hidden. Cascades with auth.users.';

alter table public.trait_rolls enable row level security;

create policy trait_rolls_select_own on public.trait_rolls
  for select using (auth.uid() = user_id);

grant select on public.trait_rolls to authenticated;
revoke insert, update, delete on public.trait_rolls from public, anon, authenticated;

-- 3. trait_roll_snapshots — one row PER ROLL (not per axis): value +
--    stability for every answered axis at the moment of that roll, for
--    RCI (§5) to compare the next candidate roll against.

create table public.trait_roll_snapshots (
  roll_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  axis_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index trait_roll_snapshots_user_created_idx
  on public.trait_roll_snapshots (user_id, created_at desc);

comment on table public.trait_roll_snapshots is
  'One row per roll: { [axis]: { value, stability } } for every answered axis at roll time (src/lib/rci.ts snapshotFromTracks). Consumed by RCI to decide whether a later roll attempt is a reliable change or noise. Cascades with auth.users.';

alter table public.trait_roll_snapshots enable row level security;

create policy trait_roll_snapshots_select_own on public.trait_roll_snapshots
  for select using (auth.uid() = user_id);

grant select on public.trait_roll_snapshots to authenticated;
revoke insert, update, delete on public.trait_roll_snapshots from public, anon, authenticated;

-- 4. store_roll — atomically writes one roll's exactly-13 items + its
--    snapshot ------------------------------------------------------------
--    p_items shape: [{ "type": "legend"|"category"|"story", "category_id":
--    string|null, "result": <jsonb> }, ...]. Idempotent on roll_id: a
--    retried call with the same roll_id (already stored) is a no-op, not
--    an error — the caller (Edge Function) may retry after a network blip
--    without risking a duplicate or a partial-then-conflicting write.
--
--    Hard-validated (found necessary in review — an earlier version trusted
--    the caller's p_items completely, an unbounded-write risk in the same
--    class as an earlier unbounded-mint bug this session's reviews already
--    caught elsewhere): exactly 13 items, exactly 1 legend, exactly 1
--    story, exactly 11 distinct non-null category_ids, and each item's
--    result capped at 8KB (matching this repo's existing convention of
--    capping caller-supplied content size, e.g. bank.ts prompts <= 400
--    chars) — a single roll should never need more than that per item.

create or replace function public.store_roll(p_roll_id uuid, p_items jsonb, p_axis_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  -- Deliberately NOT named `item` — every jsonb_array_elements() call below
  -- selects its output column as plain `value` (no AS alias), matching this
  -- repo's own existing convention (explore.sql, wave17, wave44) and
  -- avoiding a real bug found in review: a local variable named `item`
  -- collides with an `AS item` alias under plpgsql's default
  -- variable_conflict = error, raising "column reference is ambiguous" on
  -- every real call — `create or replace function` does not catch this at
  -- migration-apply time (check_function_bodies is syntax-only), so it
  -- would have silently applied clean and failed on first actual use.
  v_item jsonb;
  v_count int := 0;
  v_legend_count int;
  v_story_count int;
  v_category_count int;
  v_snapshot_stored boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_roll_id is null or p_items is null or p_axis_snapshot is null then
    raise exception 'missing roll data' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 13 then
    raise exception 'p_items must contain exactly 13 items (1 legend + 11 categories + 1 story)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_axis_snapshot) <> 'object' then
    raise exception 'p_axis_snapshot must be a JSON object' using errcode = '22023';
  end if;

  select
    count(*) filter (where value->>'type' = 'legend'),
    count(*) filter (where value->>'type' = 'story'),
    count(distinct value->>'category_id') filter (where value->>'type' = 'category')
  into v_legend_count, v_story_count, v_category_count
  from jsonb_array_elements(p_items);

  if v_legend_count <> 1 or v_story_count <> 1 or v_category_count <> 11 then
    raise exception 'p_items must contain exactly 1 legend, 1 story, and 11 distinct categories (got legend=%, story=%, distinct categories=%)',
      v_legend_count, v_story_count, v_category_count using errcode = '22023';
  end if;

  -- `value->'result' is null` alone would only catch a MISSING result key
  -- (SQL NULL) — a caller-supplied JSON `null` literal (`value->'result'`
  -- returns the jsonb scalar 'null', not SQL NULL) would pass that check
  -- and still satisfy trait_rolls.result's `not null` column constraint.
  -- Reject both explicitly.
  if exists (
    select 1 from jsonb_array_elements(p_items)
    where value->>'type' not in ('legend', 'category', 'story')
       or (value->>'type' = 'category') <> (value->>'category_id' is not null)
       or value->'result' is null
       or value->'result' = 'null'::jsonb
       or octet_length((value->'result')::text) > 8192
  ) then
    raise exception 'one or more items has an invalid type, mismatched category_id, a missing/null result, or an oversized result (>8KB)' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll_store'));

  if exists (select 1 from public.trait_rolls where roll_id = p_roll_id and user_id = uid) then
    return jsonb_build_object('ok', true, 'already', true, 'roll_id', p_roll_id);
  end if;

  insert into public.trait_roll_snapshots (roll_id, user_id, axis_snapshot)
  values (p_roll_id, uid, p_axis_snapshot)
  on conflict (roll_id) do nothing
  returning true into v_snapshot_stored;

  -- roll_id is a client/caller-generated uuid, not itself unique-checked
  -- against OTHER users before this point — the per-user advisory lock
  -- above only serializes this user's own concurrent calls. If a different
  -- user already holds this exact roll_id (an astronomically unlikely
  -- gen_random_uuid() collision, but silent-if-unhandled), the snapshot
  -- insert above no-ops and this user would otherwise get `ok:true` with
  -- no snapshot ever stored for them — fail loudly instead of continuing
  -- with a missing RCI baseline.
  if v_snapshot_stored is not true then
    raise exception 'roll_id % is already in use by a different roll — retry with a new roll_id', p_roll_id using errcode = '23505';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.trait_rolls (roll_id, user_id, type, category_id, result)
    values (
      p_roll_id,
      uid,
      v_item->>'type',
      v_item->>'category_id',
      v_item->'result'
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'already', false, 'roll_id', p_roll_id, 'count', v_count);
end;
$$;

revoke all on function public.store_roll(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.store_roll(uuid, jsonb, jsonb) to authenticated;

comment on function public.store_roll(uuid, jsonb, jsonb) is
  'Atomically stores one roll''s items + snapshot. Idempotent on roll_id (a retried call is a no-op). Called by the Edge Function that generated the roll, using the requesting user''s own auth context.';

-- 5. reveal_roll_item — atomic spend + reveal, one item at a time ---------
--    Costs (testing-phase, deliberately generous per §7 — tighten later):
--    5 tokens for a legend, 1 token for a category or story. The plan's
--    §7 prices only legend (5) and category (1) explicitly; story reveal
--    is priced the same as category (1) as the most conservative
--    testing-phase default consistent with the doc's own stated tone —
--    not explicitly specified, flagged for emci's read.

alter table public.token_events
  drop constraint if exists token_events_reason_known,
  add constraint token_events_reason_known check (reason in (
    'check_in',
    'game_round',
    'trickle',
    'sage_insight',
    'profile_depth',
    'intake_complete',
    'round_complete',
    'roll_reveal'
  ));

create or replace function public.reveal_roll_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_type text;
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

  -- Same lock key every other token-mutating RPC uses (earn_tokens,
  -- spend_tokens, claim_intake_complete) — not a differently-suffixed key.
  -- Found in review: a differently-suffixed lock here would let
  -- reveal_roll_item run concurrently with spend_tokens/earn_tokens on the
  -- same user instead of mutually excluding them, which could let two
  -- concurrent spends both read the same starting balance and pass their
  -- own balance checks before either commits — no double-spend in the
  -- ledger itself (the me.tokens update still serializes and the >= 0
  -- check still holds), but the second call would surface a raw constraint
  -- violation instead of the intended {ok:false, reason:'insufficient'}.
  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));

  select type, revealed_at into v_type, v_revealed_at
    from public.trait_rolls
    where id = p_item_id and user_id = uid
    for update;

  if v_type is null then
    raise exception 'roll item not found' using errcode = 'P0002';
  end if;

  if v_revealed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'revealed_at', v_revealed_at, 'type', v_type);
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

revoke all on function public.reveal_roll_item(uuid) from public, anon;
grant execute on function public.reveal_roll_item(uuid) to authenticated;

comment on function public.reveal_roll_item(uuid) is
  'Atomic spend + reveal for one roll item: balance check, deduct, and revealed_at update all inside one advisory-locked transaction, so two simultaneous reveal requests for the same item cannot both succeed.';
