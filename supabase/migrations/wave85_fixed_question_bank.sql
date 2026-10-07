-- wave85_fixed_question_bank.sql
--
-- NOT APPLIED. Written 2026-10-06 on branch feat/fixed-question-bank; apply
-- only after emci approves the PR. Apply this file FIRST, then
-- wave85b_question_bank_seed.sql (the 400 rows, generated).
--
-- The fixed question bank (emci 2026-10-06): 25 questions per trait, 400 in
-- all, written once and stored here. No question is generated at runtime any
-- more, and nothing a person typed can reach a question.
--
-- What this adds (every piece copies a path already live here):
--   question_bank            the 400 questions. Own table, keyed by a stable
--                            id; answers point at the id, so rewording a
--                            question never touches anyone's answers. Same read
--                            model as intake_questions (wave79): RLS on, no
--                            client access, read only inside the RPCs below.
--   question_packs.set_no    which of the 25 sets a pack is. Kinds gain
--                            'bank_set' (sets 1-3, and every set after a Start
--                            Fresh) and 'bank_retest'. Sets 4-25 stay
--                            kind 'ongoing_round', so the EXISTING
--                            claim_ongoing_round_complete pays them exactly as
--                            it paid AI rounds (+21, 2 a day). No token
--                            function is changed by this file.
--   question_items.bank_question_id   which bank question an item is.
--   trait_answers kind 'bank'          one row per answered bank question
--                            (question_key = the bank id), unique per person.
--   serve_bank_set()         the server picks the next set: one random
--                            unanswered question per trait, random order,
--                            options copied from question_bank. Replaces the
--                            phone-built insert_ongoing_round_pack.
--   answer_bank_item()       sibling of answer_round_item (wave79): scores
--                            with the option value from question_bank, never
--                            from the phone. In a retest pack the new answer
--                            REPLACES the old one and the trait is recomputed.
--   _trait_replay()          recomputes one trait from its answer log with the
--                            same EWMA step (trait_ewma_step, wave79).
--   serve_bank_retest()      a pack of 5-25 questions this person already
--                            answered on one trait. After all 25 sets.
--   trait_flags + set_trait_flag()     "This isn't me". A flag only: it adds
--                            no questions and writes nothing to traits.
--   trait_profile_snapshots + start_fresh()   saves the old profile, then
--                            HARD DELETES the answers, trait scores and trait
--                            history (emci: hard delete) so all 16 start over.
--   bank_answered()          the ids this person has answered, for the phone.
--   dev_fill_bank()          pre-launch test tool: answers every remaining
--                            question on the caller's own account.
--   _bank_premium_price()    THE premium gate. Returns null = free. Retest and
--                            Start Fresh both ask it; turning on pricing later
--                            means changing this one function (and
--                            src/lib/questions/premium-gate.ts).
--
-- Stopped: insert_bank_pool_items, bump_bank_times_served and
-- insert_ongoing_round_pack lose their client grant (no more shared AI pool
-- writes, no more phone-built rounds). The pool table and its rows stay.
--
-- Kept: intake_questions and answer_intake_question (older app bundles still
-- send them), every token function.
--
-- Changed: answer_round_item hands a bank item to answer_bank_item (an older
-- bundle answering a bank set cannot double-score it); old round packs work
-- exactly as before. start_over_my_test_data (root-only test tool) also
-- clears the three new per-person tables — NEEDS EMCI'S OK, section 14.
--
-- Old answers: an intake answer already given counts as an answer to the bank
-- question with the same wording (question_bank.legacy_prompts). Accounts
-- whose answers predate the wave79 log are covered by their answer counts.

-- 1. The bank ----------------------------------------------------------------

create table if not exists public.question_bank (
  id text primary key check (id ~ '^[a-z_]+_[0-9]{2}$'),
  axis text not null check (axis in (
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance', 'conflict_assertiveness',
    'conflict_cooperativeness', 'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'
  )),
  setting text not null check (setting in ('work', 'friends', 'dating', 'family', 'solo', 'online', 'money', 'stress')),
  unflattering text not null check (unflattering in ('high', 'low', 'neither')),
  intake_slot int check (intake_slot between 1 and 3),
  prompt text not null check (char_length(prompt) between 1 and 400),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 3),
  legacy_prompts text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.question_bank is
  'wave85: the fixed 400-question bank (25 per trait). Generated from src/lib/questions/bank/*.ts by scripts/gen-wave85-bank.ts. Answers reference id; rewording a row never touches answers.';

create index if not exists question_bank_axis_idx on public.question_bank (axis);

alter table public.question_bank enable row level security;
revoke all on table public.question_bank from public, anon, authenticated;

-- 2. Packs, items, answers ---------------------------------------------------

alter table public.question_packs add column if not exists set_no int check (set_no between 1 and 25);
alter table public.question_packs drop constraint if exists question_packs_kind_check;
alter table public.question_packs add constraint question_packs_kind_check
  check (kind in ('infinite_questions', 'ongoing_round', 'bank_set', 'bank_retest'));

alter table public.question_items
  add column if not exists bank_question_id text references public.question_bank (id);

alter table public.trait_answers drop constraint if exists trait_answers_kind_check;
alter table public.trait_answers add constraint trait_answers_kind_check
  check (kind in ('intake', 'round', 'bank'));
create unique index if not exists trait_answers_bank_once
  on public.trait_answers (user_id, question_key) where kind = 'bank';
create index if not exists trait_answers_user_axis_idx on public.trait_answers (user_id, axis, created_at);

-- 3. Flags and snapshots -----------------------------------------------------

create table if not exists public.trait_flags (
  user_id uuid not null references auth.users (id) on delete cascade,
  axis text not null,
  flagged_at timestamptz not null default now(),
  primary key (user_id, axis)
);
comment on table public.trait_flags is
  'wave85: "This isn''t me" on a trait card. A flag only — it changes no question and no trait value; it puts the trait first on the retest list.';
alter table public.trait_flags enable row level security;
drop policy if exists trait_flags_select_own on public.trait_flags;
create policy trait_flags_select_own on public.trait_flags
  for select to authenticated using (auth.uid() = user_id);
revoke all on table public.trait_flags from public, anon, authenticated;
grant select on table public.trait_flags to authenticated;

create table if not exists public.trait_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text not null check (reason in ('start_fresh')),
  profile jsonb not null
);
comment on table public.trait_profile_snapshots is
  'wave85: the profile as it was right before a Start Fresh (16 values, sources, report tracks, flags, answer count). Read-only for the owner.';
create index if not exists trait_profile_snapshots_user_idx on public.trait_profile_snapshots (user_id, created_at desc);
alter table public.trait_profile_snapshots enable row level security;
drop policy if exists trait_profile_snapshots_select_own on public.trait_profile_snapshots;
create policy trait_profile_snapshots_select_own on public.trait_profile_snapshots
  for select to authenticated using (auth.uid() = user_id);
revoke all on table public.trait_profile_snapshots from public, anon, authenticated;
grant select on table public.trait_profile_snapshots to authenticated;

-- 4. The premium gate (OFF) --------------------------------------------------

-- The one place Retest and Start Fresh ask "what does this cost?". null means
-- free. To turn on premium-token pricing later: return the price here, and
-- spend it where the callers below say PREMIUM GATE. Mirrors
-- src/lib/questions/premium-gate.ts.
create or replace function public._bank_premium_price(p_action text)
returns int
language sql
immutable
as $$
  select null::int where p_action in ('retest', 'start_fresh');
$$;
revoke all on function public._bank_premium_price(text) from public, anon, authenticated;

-- 5. What a person has answered ---------------------------------------------

-- A bank question counts as answered when:
--   * there is a 'bank' answer for its id, or
--   * it is intake slot N and an intake answer exists for one of its legacy
--     prompts, or
--   * it is intake slot N and the trait's answer count, minus its bank
--     answers, is at least N (answers from before the wave79 log).
create or replace function public._bank_answered_ids(p_uid uuid)
returns table (axis text, question_id text)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select t.axis,
           greatest(0, t.answer_count - coalesce((
             select count(*) from public.trait_answers a
              where a.user_id = p_uid and a.kind = 'bank' and a.axis = t.axis), 0)) as legacy_n
      from public.trait_tracks t
     where t.user_id = p_uid and t.track = 'report'
  )
  select b.axis, b.id
    from public.question_bank b
   where exists (select 1 from public.trait_answers a
                  where a.user_id = p_uid and a.kind = 'bank' and a.question_key = b.id)
      or (b.intake_slot is not null and (
            exists (select 1 from public.trait_answers a
                     where a.user_id = p_uid and a.kind = 'intake' and a.question_key = any (b.legacy_prompts))
            or b.intake_slot <= coalesce((select c.legacy_n from counts c where c.axis = b.axis), 0)));
$$;
revoke all on function public._bank_answered_ids(uuid) from public, anon, authenticated;

create or replace function public.bank_answered()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'ids', coalesce((select jsonb_agg(question_id order by question_id) from public._bank_answered_ids(uid)), '[]'::jsonb),
    'fresh_starts', (select count(*) from public.trait_profile_snapshots where user_id = uid and reason = 'start_fresh')
  );
end;
$$;
revoke all on function public.bank_answered() from public, anon;
grant execute on function public.bank_answered() to authenticated;

-- 6. Serving a set -----------------------------------------------------------

create or replace function public.serve_bank_set()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pack uuid;
  v_done int;
  v_set int;
  v_kind text;
  v_fresh boolean;
  r record;
  idx int := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;

  -- One open set at a time: an unfinished one comes back as is.
  select p.id into v_pack
    from public.question_packs p
   where p.user_id = uid and p.set_no is not null and p.kind in ('bank_set', 'ongoing_round')
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null)
   order by p.created_at desc
   limit 1;
  if v_pack is not null then
    return v_pack;
  end if;

  -- Sets finished = the fewest questions answered on any trait.
  select coalesce(min(n), 0) into v_done
    from (select b.axis, count(a.question_id) as n
            from (select distinct axis from public.question_bank) b
            left join public._bank_answered_ids(uid) a on a.axis = b.axis
           group by b.axis) x;
  if v_done >= 25 then
    raise exception 'bank complete' using errcode = 'P0001';
  end if;
  v_set := v_done + 1;

  v_fresh := exists (select 1 from public.trait_profile_snapshots where user_id = uid and reason = 'start_fresh');
  -- Sets 1-3 are the intake (its +21 is the once-ever full-profile claim).
  -- Sets 4-25 pay like the old rounds — unless the person has started fresh,
  -- so a free Start Fresh can never be a way to re-earn tokens.
  v_kind := case when v_set <= 3 or v_fresh then 'bank_set' else 'ongoing_round' end;

  insert into public.question_packs (user_id, generated_on, kind, set_no)
    values (uid, (timezone('utc', now()))::date, v_kind, v_set)
    returning id into v_pack;

  for r in
    with ans as (select question_id from public._bank_answered_ids(uid))
    select pick.* from (
      select distinct on (b.axis) b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
       order by b.axis, random()
    ) pick
    order by random()
  loop
    insert into public.question_items (pack_id, user_id, sort_index, axis, prompt, options, bank_question_id)
      values (v_pack, uid, idx, r.axis, r.prompt, r.options, r.id);
    idx := idx + 1;
  end loop;

  -- Uneven accounts (old tiered-50, a dev jump): once some traits run out, a
  -- set still gets 16 by taking a second unanswered question from traits
  -- that have them. Only when fewer than 16 questions remain in the whole
  -- bank is a set short, and a short set never claims to be a paying round
  -- (claim_ongoing_round_complete needs 16).
  if idx < 16 then
    for r in
      with ans as (select question_id from public._bank_answered_ids(uid))
      select b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
         and b.id not in (select i.bank_question_id from public.question_items i
                           where i.pack_id = v_pack and i.bank_question_id is not null)
       order by random()
       limit 16 - idx
    loop
      insert into public.question_items (pack_id, user_id, sort_index, axis, prompt, options, bank_question_id)
        values (v_pack, uid, idx, r.axis, r.prompt, r.options, r.id);
      idx := idx + 1;
    end loop;
  end if;
  if idx = 0 then
    raise exception 'question bank is empty' using errcode = 'P0001';
  end if;
  if idx < 16 then
    update public.question_packs set kind = 'bank_set' where id = v_pack;
  end if;

  return v_pack;
end;
$$;
revoke all on function public.serve_bank_set() from public, anon;
grant execute on function public.serve_bank_set() to authenticated;

-- 7. Recomputing one trait from its answers (retest) -------------------------

-- Folds every logged answer on the trait, oldest first, through the same EWMA
-- step _trait_write uses (trait_ewma_step), then writes the result once. A
-- trait the person set by hand (a direct source) keeps its value, as in
-- _trait_write; only the count changes. One trait_history row when the
-- value moved. p_unlogged = answers the trait has that the log never saw
-- (answers from before wave79, dev jumps, counted Today's Picks): they stay in
-- the count, so a retest never reopens questions or the bank. Their values are
-- not in the log, so the recomputed value rests on the logged answers. TS mirror: replayTraitAnswers in src/lib/trait-stability.ts.
create or replace function public._trait_replay(p_uid uuid, p_axis text, p_unlogged int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me jsonb;
  v_cur double precision;
  v_src text;
  v_direct boolean;
  v_first double precision;
  v_n int := 0;
  s record;
  a record;
  v_depth timestamptz;
  v_now timestamptz := now();
  v_now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select to_jsonb(m) into v_me from public.me m where m.id = p_uid for update;
  if v_me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_cur := nullif(v_me ->> p_axis, '')::double precision;
  v_src := v_me -> 'trait_sources' ->> p_axis;
  v_direct := v_cur is not null and public.trait_is_direct_source(v_src);

  select last_depth_at into v_depth from public.trait_tracks
    where user_id = p_uid and axis = p_axis and track = 'report';

  for a in
    select value from public.trait_answers
     where user_id = p_uid and axis = p_axis
     order by created_at, id
  loop
    if v_n = 0 then
      v_first := a.value;
      s := public.trait_ewma_step(null, null, 0, a.value, 'answer');
    else
      s := public.trait_ewma_step(s.value::float8, s.stability::float8, s.answer_count, a.value, 'answer');
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    delete from public.trait_tracks where user_id = p_uid and axis = p_axis and track = 'report';
    return;
  end if;
  v_n := v_n + greatest(0, coalesce(p_unlogged, 0));

  if v_direct then
    insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
      values (p_uid, p_axis, 'report', least(1::float8, greatest(0::float8, coalesce(v_cur, v_first))), 0, v_n, v_now, v_depth)
      on conflict (user_id, axis, track) do update
        set value = excluded.value, stability = 0, answer_count = excluded.answer_count, last_touched = excluded.last_touched;
    return;
  end if;

  insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
    values (p_uid, p_axis, 'report', s.value, s.stability, v_n, v_now, v_depth)
    on conflict (user_id, axis, track) do update
      set value = excluded.value, stability = excluded.stability, answer_count = excluded.answer_count,
          last_touched = excluded.last_touched;

  execute format(
    'update public.me set %I = $1, trait_sources = coalesce(trait_sources, ''{}''::jsonb) || jsonb_build_object($2, ''self_situation''::text), trait_touched_at = coalesce(trait_touched_at, ''{}''::jsonb) || jsonb_build_object($2, $3::text) where id = $4',
    p_axis
  ) using s.value, p_axis, v_now_iso, p_uid;
  if v_cur is null or round(v_cur * 100) <> round(s.value * 100) then
    insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, s.value, 'self_situation');
  end if;
end;
$$;
revoke all on function public._trait_replay(uuid, text, int) from public, anon, authenticated;

-- 8. Answering a bank item ----------------------------------------------------

create or replace function public.answer_bank_item(p_item_id uuid, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it record;
  q record;
  v_kind text;
  v_opt jsonb;
  v_value double precision;
  v_unlogged int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  -- me first, then the item: the same lock order as serve_bank_set,
  -- start_fresh and dev_fill_bank, so they can never deadlock.
  perform 1 from public.me where id = uid for update;
  select * into it from public.question_items
    where id = p_item_id and user_id = uid
    for update;
  if not found or it.bank_question_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if it.answered_at is not null then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if it.skipped_at is not null then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  select * into q from public.question_bank where id = it.bank_question_id;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  -- The value comes from the bank row, never from the phone or the item copy.
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;
  select kind into v_kind from public.question_packs where id = it.pack_id;

  update public.question_items
    set answered_option = p_option_index, answered_at = timezone('utc', now())
    where id = p_item_id;

  if v_kind = 'bank_retest' then
    -- REPLACE: the old answer to this question goes (and, for an intake
    -- question, the intake-era answer to its old wording), the new one is
    -- logged, and the trait is recomputed from what is left.
    select greatest(0, coalesce((select answer_count from public.trait_tracks
                                  where user_id = uid and axis = q.axis and track = 'report'), 0)
                       - (select count(*) from public.trait_answers where user_id = uid and axis = q.axis))
      into v_unlogged;
    delete from public.trait_answers
      where user_id = uid and axis = q.axis
        and ((kind = 'bank' and question_key = q.id)
             or (kind = 'intake' and question_key = any (q.legacy_prompts)));
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
    perform public._trait_replay(uid, q.axis, v_unlogged);
  elsif exists (select 1 from public._bank_answered_ids(uid) a where a.question_id = q.id) then
    -- Already answered elsewhere (an old bundle, a double tap): the item is
    -- closed, nothing is scored twice.
    null;
  else
    perform public._trait_write(uid, q.axis, 'self_situation', v_value, 'answer');
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
  end if;

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.answer_bank_item(uuid, int) from public, anon;
grant execute on function public.answer_bank_item(uuid, int) to authenticated;

-- 9. Retest ------------------------------------------------------------------

create or replace function public._bank_all_done(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with ans as (select question_id from public._bank_answered_ids(p_uid))
  select not exists (
    select 1 from public.question_bank b where b.id not in (select question_id from ans)
  );
$$;
revoke all on function public._bank_all_done(uuid) from public, anon, authenticated;

create or replace function public.serve_bank_retest(p_axis text, p_count int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pack uuid;
  v_price int;
  r record;
  idx int := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_axis is null or not exists (select 1 from public.question_bank where axis = p_axis) then
    raise exception 'unknown trait' using errcode = '22023';
  end if;
  if p_count is null or p_count < 5 or p_count > 25 then
    raise exception 'retest needs 5-25 questions' using errcode = '22023';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._bank_all_done(uid) then
    raise exception 'retest opens after all 25 sets' using errcode = 'P0001';
  end if;

  -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
  v_price := public._bank_premium_price('retest');
  if v_price is not null then
    raise exception 'premium tokens required' using errcode = 'P0042';
  end if;

  -- An unfinished retest comes back as is.
  select p.id into v_pack
    from public.question_packs p
   where p.user_id = uid and p.kind = 'bank_retest'
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null)
   order by p.created_at desc
   limit 1;
  if v_pack is not null then
    return v_pack;
  end if;

  insert into public.question_packs (user_id, generated_on, kind)
    values (uid, (timezone('utc', now()))::date, 'bank_retest')
    returning id into v_pack;

  for r in
    select b.id, b.axis, b.prompt, b.options
      from public.question_bank b
      join public._bank_answered_ids(uid) a on a.question_id = b.id
     where b.axis = p_axis
     order by random()
     limit p_count
  loop
    insert into public.question_items (pack_id, user_id, sort_index, axis, prompt, options, bank_question_id)
      values (v_pack, uid, idx, r.axis, r.prompt, r.options, r.id);
    idx := idx + 1;
  end loop;

  return v_pack;
end;
$$;
revoke all on function public.serve_bank_retest(text, int) from public, anon;
grant execute on function public.serve_bank_retest(text, int) to authenticated;

-- 10. "This isn't me" ---------------------------------------------------------

create or replace function public.set_trait_flag(p_axis text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_axis is null or not exists (select 1 from public.question_bank where axis = p_axis) then
    raise exception 'unknown trait' using errcode = '22023';
  end if;
  if coalesce(p_on, false) then
    insert into public.trait_flags (user_id, axis) values (uid, p_axis)
      on conflict (user_id, axis) do nothing;
  else
    delete from public.trait_flags where user_id = uid and axis = p_axis;
  end if;
end;
$$;
revoke all on function public.set_trait_flag(text, boolean) from public, anon;
grant execute on function public.set_trait_flag(text, boolean) to authenticated;

-- 11. Start Fresh -------------------------------------------------------------

create or replace function public.start_fresh()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_price int;
  v_snapshot uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._bank_all_done(uid) then
    raise exception 'start fresh opens after all 25 sets' using errcode = 'P0001';
  end if;

  -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
  v_price := public._bank_premium_price('start_fresh');
  if v_price is not null then
    raise exception 'premium tokens required' using errcode = 'P0042';
  end if;

  insert into public.trait_profile_snapshots (user_id, reason, profile)
  select uid, 'start_fresh', jsonb_build_object(
      'values', jsonb_build_object(
        'openness', m.openness, 'conscientiousness', m.conscientiousness, 'extraversion', m.extraversion,
        'agreeableness', m.agreeableness, 'steadiness', m.steadiness,
        'attachment_anxiety', m.attachment_anxiety, 'attachment_avoidance', m.attachment_avoidance,
        'conflict_assertiveness', m.conflict_assertiveness, 'conflict_cooperativeness', m.conflict_cooperativeness,
        'autonomy', m.autonomy, 'competence', m.competence, 'relatedness', m.relatedness,
        'growth_mindset', m.growth_mindset, 'locus_of_control', m.locus_of_control,
        'self_efficacy', m.self_efficacy, 'playfulness', m.playfulness),
      'sources', coalesce(m.trait_sources, '{}'::jsonb),
      'tracks', coalesce((select jsonb_agg(jsonb_build_object(
          'axis', t.axis, 'value', t.value, 'stability', t.stability, 'answer_count', t.answer_count))
        from public.trait_tracks t where t.user_id = uid and t.track = 'report'), '[]'::jsonb),
      'flags', coalesce((select jsonb_agg(f.axis) from public.trait_flags f where f.user_id = uid), '[]'::jsonb),
      'answers', (select count(*) from public.trait_answers a where a.user_id = uid))
    from public.me m where m.id = uid
  returning id into v_snapshot;

  -- HARD DELETE (emci 2026-10-06): answers, report scores, trait history,
  -- flags, and any set or retest still open. Finished packs stay (their token
  -- records hang off them). The gut-call game track, tokens and the account
  -- itself are untouched.
  delete from public.trait_answers where user_id = uid;
  delete from public.trait_tracks where user_id = uid and track = 'report';
  delete from public.trait_history where user_id = uid;
  delete from public.trait_flags where user_id = uid;
  delete from public.question_packs p
   where p.user_id = uid and (p.set_no is not null or p.kind = 'bank_retest')
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null);

  update public.me
    set
      openness = null, conscientiousness = null, extraversion = null, agreeableness = null,
      steadiness = null, attachment_anxiety = null, attachment_avoidance = null,
      conflict_assertiveness = null, conflict_cooperativeness = null,
      autonomy = null, competence = null, relatedness = null,
      growth_mindset = null, locus_of_control = null, self_efficacy = null, playfulness = null,
      trait_sources = '{}'::jsonb,
      trait_touched_at = '{}'::jsonb
    where id = uid;

  return jsonb_build_object('ok', true, 'snapshot_id', v_snapshot);
end;
$$;
revoke all on function public.start_fresh() from public, anon;
grant execute on function public.start_fresh() to authenticated;

-- 12. Pre-launch test tool ----------------------------------------------------

-- Answers every remaining bank question on the caller's OWN account with a
-- random option, through the same scoring as a real answer. Root only and
-- pre-launch only (signup_mode = invite_only), like start_over_my_test_data. Lets a tester
-- reach "all 25 sets done" without 400 taps.
create or replace function public.dev_fill_bank()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
  r record;
  v_idx int;
  v_value double precision;
  v_n int := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'root only' using errcode = '42501';
  end if;
  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'dev_fill_bank is disabled once sign-up is public' using errcode = '42501';
  end if;
  perform 1 from public.me where id = uid for update;
  for r in
    with ans as (select question_id from public._bank_answered_ids(uid))
    select b.id, b.axis, b.options from public.question_bank b
     where b.id not in (select question_id from ans)
     order by b.id
  loop
    v_idx := floor(random() * jsonb_array_length(r.options))::int;
    v_value := (r.options -> v_idx ->> 'value')::double precision;
    perform public._trait_write(uid, r.axis, 'self_situation', v_value, 'answer');
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', r.id, r.axis, v_idx, v_value);
    v_n := v_n + 1;
  end loop;
  -- Close any open set, so the screen does not offer half a set of nothing.
  update public.question_items i set skipped_at = timezone('utc', now())
    from public.question_packs p
   where i.pack_id = p.id and p.user_id = uid and p.set_no is not null
     and i.answered_option is null and i.skipped_at is null;
  return v_n;
end;
$$;
revoke all on function public.dev_fill_bank() from public, anon;
grant execute on function public.dev_fill_bank() to authenticated;

-- 13. Old bundles answering a bank item -----------------------------------------

-- Sets 4-25 are kind 'ongoing_round', so an older app bundle can load one and
-- answer it with answer_round_item. Without this, that path would score from
-- the item's copy, log a 'round' row and leave the bank question open, so it
-- would be served and paid again. Same function as wave79, plus one hand-off:
-- a bank item always goes through answer_bank_item.
create or replace function public.answer_round_item(p_item_id uuid, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it record;
  v_opt jsonb;
  v_value double precision;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  if exists (select 1 from public.question_items
              where id = p_item_id and user_id = uid and bank_question_id is not null) then
    return public.answer_bank_item(p_item_id, p_option_index);
  end if;
  select * into it from public.question_items
    where id = p_item_id and user_id = uid
    for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if it.answered_at is not null then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if it.skipped_at is not null then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  v_opt := it.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  update public.question_items
    set answered_option = p_option_index, answered_at = timezone('utc', now())
    where id = p_item_id;
  perform public._trait_write(uid, it.axis, 'self_situation', v_value, 'answer');
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'round', p_item_id::text, it.axis, p_option_index, v_value);

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

-- 14. Start over (wave76) learns the new tables ------------------------------

-- NEEDS EMCI'S OK (changes an existing function that deletes data): the
-- root-only pre-launch Start over must also clear the bank's answer log,
-- flags and snapshots, or a "clean" account keeps its bank progress and its
-- started-fresh mark. Everything else is wave76 word for word.
create or replace function public.start_over_my_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'start_over_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'start_over_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- What the account answered, and everything generated from it. Same list as
  -- wave75. Deleting question_items and question_packs removes their own token
  -- records with them (wave52 foreign keys, on delete cascade).
  delete from public.question_items where user_id = uid;
  delete from public.question_packs where user_id = uid;
  delete from public.question_bank_reroll_exclusions where user_id = uid;
  delete from public.trait_history where user_id = uid;
  delete from public.trait_tracks where user_id = uid;
  delete from public.daily_insights where user_id = uid;
  delete from public.category_statements where user_id = uid;
  delete from public.legend_generations where user_id = uid;
  delete from public.trait_rolls where user_id = uid;
  delete from public.trait_roll_snapshots where user_id = uid;
  delete from public.sage_title_flags where user_id = uid;
  delete from public.explore_reactions where user_id = uid;
  delete from public.explore_entries where user_id = uid;
  delete from public.explore_packs where user_id = uid;
  -- wave85
  delete from public.trait_answers where user_id = uid;
  delete from public.trait_flags where user_id = uid;
  delete from public.trait_profile_snapshots where user_id = uid;

  -- Only the once-ever "finished the 50" record, so it can be earned again.
  -- The balance itself is deliberately not changed anywhere below.
  delete from public.ato_token_events
    where user_id = uid and reason = 'full_profile_complete';

  update public.me
    set
      openness = null, conscientiousness = null, extraversion = null, agreeableness = null,
      steadiness = null, attachment_anxiety = null, attachment_avoidance = null,
      conflict_assertiveness = null, conflict_cooperativeness = null,
      autonomy = null, competence = null, relatedness = null,
      growth_mindset = null, locus_of_control = null, self_efficacy = null, playfulness = null,
      trait_sources = '{}'::jsonb,
      trait_touched_at = '{}'::jsonb,
      celebrated_milestone_ids = '{}',
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      -- the eight preference taps, as wave75 clears them
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

-- 15. No more runtime AI questions --------------------------------------------

revoke execute on function public.insert_bank_pool_items(jsonb) from authenticated;
revoke execute on function public.bump_bank_times_served(uuid[]) from authenticated;
revoke execute on function public.insert_ongoing_round_pack(jsonb) from authenticated;

-- BEFORE APPLYING, CHECK:
--   1. insert_bank_pool_items' live signature is (jsonb) — if the revoke
--      errors, read it with \df and fix the argument list.
--   2. Apply wave85b_question_bank_seed.sql right after this file, in the same
--      session. serve_bank_set with an empty question_bank serves nothing.
--   3. Section 14 replaces start_over_my_test_data: compare its body with the
--      live one before applying, in case it changed after wave76.
--   4. Release note: older bundles can no longer START a round
--      (insert_ongoing_round_pack is revoked); they need this OTA.
