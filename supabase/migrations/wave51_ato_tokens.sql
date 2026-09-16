-- wave51_ato_tokens.sql
--
-- T-04 (core loop redesign, docs/CORE_LOOP_REDESIGN_PLAN.md §5): a brand-new
-- "ATO tokens" currency, fully separate from the existing Sage/Notes economy
-- (me.tokens / token_events, wave19/45/46). Applied to the live DB
-- 2026-09-09. See wave52_ato_tokens_fixes.sql for 4 critical fixes found by
-- review the same day (FK cascade on delete, round-completion farming via
-- skip/tiny-pack, and a missing server-side check on
-- claim_full_profile_complete) — those RPCs are superseded there, not here.
--
-- Why a separate table, not a shared reason string on token_events: the
-- existing token_events_reason_known check constraint is specific to the
-- Sage economy, and mixing two currencies into one ledger would make balance
-- queries ambiguous (a plain `sum(delta)` would blend Notes and ATO tokens).
--
-- Balance column lives on `me` (confirmed the real table name at build time
-- per §7 Q7 of the plan — it is `me`, not `profiles`), mirroring me.tokens
-- exactly, including the same client-write-guard trigger shape used for
-- me.tokens (wave19) and me.is_root (wave34): a BEFORE UPDATE trigger that
-- rejects any change to ato_tokens unless a transaction-local config flag is
-- set, which only the RPCs below ever set. Deliberately a SEPARATE flag
-- (ato.allow_ato_token_write) from me.tokens' own ato.allow_token_write, so
-- the two economies' write-guards can never accidentally piggyback on each
-- other within the same transaction.
--
-- Reasons and amounts, all confirmed against the finalized product plan
-- (item 5) at the 2026-09-09 checkpoint — not new judgment calls:
--   full_profile_complete    +21, once ever
--   ongoing_round_complete   +21, once per finished round
--   legend_reroll            -10, capped 1/day
--   category_reroll           -1, capped 1/day per category
--   question_reroll           -1, capped 1/day per question slot
--
-- ongoing_round_complete is keyed on question_packs.id (pack_id), not a
-- round_number column like wave45's still-unshipped round_complete reason
-- speculated — nothing in this codebase actually numbers rounds; each round
-- IS a question_packs row, so that row's own id is the real unique identity
-- to dedupe against.
--
-- claim_ongoing_round_complete verifies completion from server-side truth
-- (every question_items row in the pack has answered_option set), not a
-- trusted completed_at flag — nothing in the client sets completed_at today,
-- so gating on it would make the RPC permanently unclaimable. The RPC does
-- still populate completed_at as a side effect (first time only), matching
-- wave49's original intent for that column to mean something.
--
-- Depends on wave49 + wave50 (question_packs.kind/completed_at,
-- insert_ongoing_round_pack) being applied first — those are also not yet
-- live as of this migration; apply in order wave49 -> wave50 -> wave51.

-- 1. me.ato_tokens + write guard ----------------------------------------------

alter table public.me
  add column if not exists ato_tokens int not null default 0
  check (ato_tokens >= 0);

comment on column public.me.ato_tokens is
  'Earned-only ATO tokens balance. Separate currency from tokens (Notes/Sage economy) — never mix reasons/ledgers. Direct client updates are rejected; use claim_full_profile_complete / claim_ongoing_round_complete / spend_ato_tokens_*.';

create or replace function public.me_ato_tokens_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.ato_tokens is distinct from old.ato_tokens then
    if current_setting('ato.allow_ato_token_write', true) is distinct from '1' then
      raise exception 'ato_tokens are earned only' using errcode = 'P0040';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.me_ato_tokens_guard() from public, anon, authenticated;

drop trigger if exists me_ato_tokens_guard on public.me;
create trigger me_ato_tokens_guard
  before update of ato_tokens on public.me
  for each row execute function public.me_ato_tokens_guard();

-- 2. ato_token_events ledger ---------------------------------------------------

create table public.ato_token_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in (
    'full_profile_complete',
    'ongoing_round_complete',
    'legend_reroll',
    'category_reroll',
    'question_reroll'
  )),
  pack_id uuid references public.question_packs(id) on delete set null,
  category_id text,
  question_item_id uuid references public.question_items(id) on delete set null,
  local_day date not null,
  created_at timestamptz not null default now(),
  constraint ato_token_events_pack_matches_reason check (
    (reason = 'ongoing_round_complete') = (pack_id is not null)
  ),
  constraint ato_token_events_category_matches_reason check (
    (reason = 'category_reroll') = (category_id is not null)
  ),
  constraint ato_token_events_question_matches_reason check (
    (reason = 'question_reroll') = (question_item_id is not null)
  )
);

comment on table public.ato_token_events is
  'Ledger for the ATO tokens currency (core loop redesign §5) — separate from token_events (Notes/Sage economy). All writes go through claim_full_profile_complete / claim_ongoing_round_complete / spend_ato_tokens_* only.';

create index ato_token_events_user_idx on public.ato_token_events (user_id);

alter table public.ato_token_events enable row level security;

create policy ato_token_events_select_own on public.ato_token_events
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy — writes happen only via the security
-- definer RPCs below, same convention as token_events.

create unique index ato_token_events_full_profile_once
  on public.ato_token_events (user_id) where reason = 'full_profile_complete';

create unique index ato_token_events_round_once
  on public.ato_token_events (user_id, pack_id) where reason = 'ongoing_round_complete';

create unique index ato_token_events_legend_reroll_daily
  on public.ato_token_events (user_id, local_day) where reason = 'legend_reroll';

create unique index ato_token_events_category_reroll_daily
  on public.ato_token_events (user_id, category_id, local_day) where reason = 'category_reroll';

create unique index ato_token_events_question_reroll_daily
  on public.ato_token_events (user_id, question_item_id, local_day) where reason = 'question_reroll';

-- 3. claim_full_profile_complete: +21, once ever -------------------------------

create function public.claim_full_profile_complete()
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

revoke all on function public.claim_full_profile_complete() from public, anon;
grant execute on function public.claim_full_profile_complete() to authenticated;

-- 4. claim_ongoing_round_complete: +21, once per pack ---------------------------

create function public.claim_ongoing_round_complete(p_pack_id uuid)
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

  select count(*) into v_unanswered
  from public.question_items
  where pack_id = p_pack_id and answered_option is null and skipped_at is null;
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

revoke all on function public.claim_ongoing_round_complete(uuid) from public, anon;
grant execute on function public.claim_ongoing_round_complete(uuid) to authenticated;

-- 5. spend_ato_tokens_legend_reroll: -10, capped 1/day --------------------------

create function public.spend_ato_tokens_legend_reroll()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 10;
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

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, -amount, 'legend_reroll', today)
  on conflict (user_id, local_day) where reason = 'legend_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'legend_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'legend_reroll',
    'price', amount
  );
end;
$$;

revoke all on function public.spend_ato_tokens_legend_reroll() from public, anon;
grant execute on function public.spend_ato_tokens_legend_reroll() to authenticated;

-- 6. spend_ato_tokens_category_reroll: -1, capped 1/day per category -----------

create function public.spend_ato_tokens_category_reroll(p_category_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 1;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  category text := btrim(coalesce(p_category_id, ''));
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if category = '' then
    raise exception 'category_id required' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, category_id, local_day)
  values (uid, -amount, 'category_reroll', category, today)
  on conflict (user_id, category_id, local_day) where reason = 'category_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'category_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'category_reroll',
    'price', amount
  );
end;
$$;

revoke all on function public.spend_ato_tokens_category_reroll(text) from public, anon;
grant execute on function public.spend_ato_tokens_category_reroll(text) to authenticated;

-- 7. spend_ato_tokens_question_reroll: -1, capped 1/day per question slot ------

create function public.spend_ato_tokens_question_reroll(p_question_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 1;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_item_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_item_owner
  from public.question_items
  where id = p_question_item_id;
  if v_item_owner is null or v_item_owner is distinct from uid then
    raise exception 'question item not found' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, question_item_id, local_day)
  values (uid, -amount, 'question_reroll', p_question_item_id, today)
  on conflict (user_id, question_item_id, local_day) where reason = 'question_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'question_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'question_reroll',
    'price', amount
  );
end;
$$;

revoke all on function public.spend_ato_tokens_question_reroll(uuid) from public, anon;
grant execute on function public.spend_ato_tokens_question_reroll(uuid) to authenticated;
