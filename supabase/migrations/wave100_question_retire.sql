-- wave100_question_retire.sql
--
-- NOT APPLIED. Apply order: (1) the OTA with the wave100 client bank must be
-- live first, (2) this file, (3) wave100b_question_retire_rows.sql right after,
-- in the same session. See docs/copy-review-agent/applied-set2-questions.md.
--
-- Retiring a bank question (emci 2026-10-20, approved): a question whose
-- SCENE changes keeps its id and its ORIGINAL text forever (answers point at
-- it and keep showing it), is marked retired and is never served again. The
-- new scene is a NEW id (<trait>_26, _27 …), same trait, direction and value
-- scheme. Ids are never deleted, renumbered or reused. Wording-only edits
-- (wave99) stay in-place updates.
--
-- Pattern: the retired_at column copies ai_library_cards.retired_at (wave93):
-- nullable, null = live, a timestamp = retired, rows are never deleted.
-- Every function below is copied word for word from its CURRENT definition,
-- with only the retired filter added (check:question-bank pins each copy
-- against its source):
--
--   function                  copied from                        change
--   _bank_trait_progress()    NEW (internal helper)              per trait: active count, and answered
--                                                                (retired answers included) capped at it
--   _bank_all_done()          wave85_fixed_question_bank.sql     counts per trait through the helper
--   serve_bank_set()          wave85_fixed_question_bank.sql     sets done through the helper; serves only
--                                                                active rows, only on traits not yet full,
--                                                                never more than a trait still needs
--   dev_fill_bank()           wave85_fixed_question_bank.sql     fills only active rows, only up to each
--                                                                trait's active count
--   change_bank_answer()      wave86_change_answers_history.sql  refuses a retired question
--   serve_bank_retest()       wave85_fixed_question_bank.sql     active rows only (no client grant since
--                                                                wave86; kept revoked)
--
-- Read and left unchanged on purpose (they must see retired rows):
--   _bank_answered_ids()  wave85  an answer to a retired question still counts as answered
--   bank_answered()       wave85  the phone gets those ids too and counts them the same way
--   answer_bank_item()    wave85  an item served before retirement can still be answered and
--                                 is scored from the retired row's own options
--   answer_round_item()   wave85  hands bank items to answer_bank_item
--   set_trait_flag()      wave85  only checks the trait name exists
--   start_fresh(boolean)  wave86  asks _bank_all_done (picks up the new definition)
--   undo_change_session   wave86  puts back answer rows by question id; no bank read
--
-- Progress rule (server and phone, src/lib/questions/bank-sets.ts):
--   answered on a trait = min(active rows on the trait, every row answered on it)
-- so a person's sets-done, "bank complete" and Change answers unlock never move
-- because of a retirement. A person who answered a retired question needs one
-- fewer active question on that trait; its replacement may simply never be
-- served to them.
--
-- With no row retired, every function here behaves exactly as before (all
-- rows active, 25 per trait). The rows are retired in wave100b.

-- 1. The column ----------------------------------------------------------------

alter table public.question_bank add column if not exists retired_at timestamptz;

comment on column public.question_bank.retired_at is
  'wave100: null = live. Set = retired: never served or changed again; the row keeps its original text forever because answers point at its id. Never delete, renumber or reuse a bank id.';

-- 2. Per-trait progress (new helper) ---------------------------------------------

create or replace function public._bank_trait_progress(p_uid uuid)
returns table (axis text, active_n int, answered_n int)
language sql
stable
security definer
set search_path = public
as $$
  select b.axis,
         (count(*) filter (where b.retired_at is null))::int,
         least(count(*) filter (where b.retired_at is null), count(a.question_id))::int
    from public.question_bank b
    left join public._bank_answered_ids(p_uid) a on a.question_id = b.id
   group by b.axis;
$$;
revoke all on function public._bank_trait_progress(uuid) from public, anon, authenticated;

-- 3. All done (copied from wave85) -------------------------------------------------

create or replace function public._bank_all_done(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public._bank_trait_progress(p_uid) p where p.answered_n < p.active_n
  );
$$;
revoke all on function public._bank_all_done(uuid) from public, anon, authenticated;

-- 4. Serving a set (copied from wave85) ---------------------------------------------

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
  select coalesce(min(p.answered_n), 0) into v_done
    from public._bank_trait_progress(uid) p
   where p.active_n > 0;
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
    with ans as (select question_id from public._bank_answered_ids(uid)),
         open_axes as (select p.axis from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select pick.* from (
      select distinct on (b.axis) b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
         and b.retired_at is null
         and b.axis in (select o.axis from open_axes o)
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
  -- wave100: a trait never gets more than it still needs (room = what it
  -- needs minus the one the first pass already took), so a retired answer
  -- can never push a trait past its active count.
  if idx < 16 then
    for r in
      with ans as (select question_id from public._bank_answered_ids(uid)),
           room as (select p.axis, p.active_n - p.answered_n - 1 as n
                      from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
      select x.id, x.axis, x.prompt, x.options from (
        select b.id, b.axis, b.prompt, b.options, rm.n,
               row_number() over (partition by b.axis order by random()) as rn
          from public.question_bank b
          join room rm on rm.axis = b.axis
         where b.id not in (select question_id from ans)
           and b.retired_at is null
           and b.id not in (select i.bank_question_id from public.question_items i
                             where i.pack_id = v_pack and i.bank_question_id is not null)
      ) x
       where x.rn <= x.n
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

-- 5. Pre-launch test tool (copied from wave85) ----------------------------------------

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
    with ans as (select question_id from public._bank_answered_ids(uid)),
         room as (select p.axis, p.active_n - p.answered_n as n
                    from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select x.id, x.axis, x.options from (
      select b.id, b.axis, b.options, rm.n,
             row_number() over (partition by b.axis order by b.id) as rn
        from public.question_bank b
        join room rm on rm.axis = b.axis
       where b.id not in (select question_id from ans)
         and b.retired_at is null
    ) x
     where x.rn <= x.n
     order by x.id
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

-- 6. Change answers (copied from wave86) ------------------------------------------------

create or replace function public.change_bank_answer(p_session uuid, p_question_id text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  v_opt jsonb;
  v_value double precision;
  v_unlogged int;
  v_old jsonb;
  v_session uuid := p_session;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  perform 1 from public.me where id = uid for update;
  if v_session is null then
    if not public._bank_all_done(uid) then
      raise exception 'change answers opens after all 25 sets' using errcode = 'P0001';
    end if;
    -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
    if public._bank_premium_price('change_answers') is not null then
      raise exception 'premium tokens required' using errcode = 'P0042';
    end if;
  elsif not public._change_session_ok(uid, v_session) then
    raise exception 'change session is closed' using errcode = 'P0001';
  end if;
  select * into q from public.question_bank where id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  -- wave100: a retired question keeps the answer it was given; it is never re-asked.
  if q.retired_at is not null then
    raise exception 'retired question' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public._bank_answered_ids(uid) a where a.question_id = q.id) then
    raise exception 'only an answered question can be changed' using errcode = 'P0001';
  end if;
  -- The value comes from the bank row, never from the phone.
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  if v_session is null then
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'change_answers', public._profile_payload(uid))
      returning id into v_session;
  end if;

  -- Same REPLACE as wave85's retest branch, keeping what it removes.
  select greatest(0, coalesce((select answer_count from public.trait_tracks
                                where user_id = uid and axis = q.axis and track = 'report'), 0)
                     - (select count(*) from public.trait_answers where user_id = uid and axis = q.axis))
    into v_unlogged;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_old
    from public.trait_answers a
   where a.user_id = uid and a.axis = q.axis
     and ((a.kind = 'bank' and a.question_key = q.id)
          or (a.kind = 'intake' and a.question_key = any (q.legacy_prompts)));
  delete from public.trait_answers
    where user_id = uid and axis = q.axis
      and ((kind = 'bank' and question_key = q.id)
           or (kind = 'intake' and question_key = any (q.legacy_prompts)));
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
  perform public._trait_replay(uid, q.axis, v_unlogged);
  insert into public.trait_answer_changes (user_id, snapshot_id, axis, question_id, old_rows)
    values (uid, v_session, q.axis, q.id, v_old);

  return jsonb_build_object('session', v_session);
end;
$$;
revoke all on function public.change_bank_answer(uuid, text, int) from public, anon;
grant execute on function public.change_bank_answer(uuid, text, int) to authenticated;

-- 7. Retest (copied from wave85; retired from clients by wave86) ------------------------

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
       and b.retired_at is null
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
-- Same end state as live: wave85 granted it, wave86 revoked it from clients.
revoke all on function public.serve_bank_retest(text, int) from public, anon;
revoke execute on function public.serve_bank_retest(text, int) from authenticated;

-- BEFORE APPLYING, CHECK:
--   1. The OTA carrying the wave100 client bank (src/lib/questions/bank/*.ts with
--      retired rows and the _26+ ids) is published and adopted. An older bundle
--      counts progress only over the ids it knows, so a person served a _26+
--      question on an old bundle would see that trait stall below 25.
--   2. The live bodies of serve_bank_set, _bank_all_done, dev_fill_bank,
--      change_bank_answer and serve_bank_retest still match their source
--      migrations listed above (pg_get_functiondef), in case one was changed
--      by hand after wave86. Nothing in the repo redefines them after wave86.
--   3. Apply wave100b_question_retire_rows.sql right after this file. This
--      file alone changes nothing visible (no row is retired yet).
