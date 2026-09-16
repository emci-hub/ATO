-- wave50_ongoing_round_prep.sql
--
-- T-02 (core loop redesign, docs/CORE_LOOP_REDESIGN_PLAN.md §2). Applied to
-- the live DB 2026-09-09.
--
-- CORRECTION (caught in this session's own review, before push): an earlier
-- draft of this migration re-added a 16-axis `question_items_axis_check`
-- constraint, believing wave17's original 15-axis check (missing
-- 'playfulness') was still live. It is not. wave21_playfulness_categories.sql
-- already replaced it with `question_items_axis_known` (all 16 axes,
-- including playfulness), and wave27_drop_stale_question_items_axis_check.sql
-- exists solely to drop the old `question_items_axis_check` name so the two
-- constraints can't coexist. wave49's migration comment ("re-verified —
-- confirmed stale, no fix needed") was correct; this migration's plan-time
-- claim to the contrary was wrong. No axis-check change is needed or made
-- here — question_items.axis already has full 16-axis coverage via
-- `question_items_axis_known`.
--
-- What this migration actually does:
-- 1. question_items.sort_index was capped at 0..4 (insert_question_pack's
--    own 1-5 item cap for Infinite Questions). A 25-item ongoing round needs
--    headroom past that — widened to 0..29, independent of any RPC's own
--    item-count validation.
-- 2. insert_ongoing_round_pack: a NEW sibling RPC for 25-item ongoing-round
--    packs (kind='ongoing_round'), not a widening of insert_question_pack
--    itself — that RPC's own 1-5/2-3 checks are inline in its function body
--    (not just the column constraints), and Infinite Questions must keep
--    behaving exactly as it does today. insert_question_pack is untouched.
--    Every item requires question_bank_item_id (never null for an
--    ongoing-round row, per the core loop redesign's Q9 resolution — every
--    ongoing-round question, bank-drawn or freshly AI-generated, has a bank
--    row by the time it's shown to a user). Not yet called by any client
--    code — T-02 only wires round *composition*; T-03 wires the save path
--    that will call this.
-- 3 & 4. bump_bank_times_served / insert_bank_pool_items: question_bank_pool
--    (wave49) revokes insert/update/delete from authenticated by design (a
--    shared, catalog-style table) — these two security-definer RPCs are the
--    only write path onto it, needed by T-02's bank-pool.ts
--    (recordBankUsage / addToBankPool), which IS called by this session's
--    code (unlike insert_ongoing_round_pack above). Both cap their input
--    array length (25) — question_bank_pool is shared across every user, so
--    an unbounded array from one caller must not be able to skew it or
--    balloon it in one call.

-- 1. question_items.sort_index widening ---------------------------------------

alter table public.question_items
  drop constraint if exists question_items_sort_index_check;
alter table public.question_items
  add constraint question_items_sort_index_check check (sort_index >= 0 and sort_index < 30);

comment on constraint question_items_sort_index_check on public.question_items is
  'Widened from < 5 (wave17, Infinite Questions'' own 1-5 item cap) to < 30 for wave50''s 25-item ongoing rounds. insert_question_pack (Infinite Questions) still enforces its own 1-5 item cap inline in its function body, unaffected by this widening.';

-- 2. insert_ongoing_round_pack ------------------------------------------------

create function public.insert_ongoing_round_pack(
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pack_id uuid;
  item jsonb;
  idx int := 0;
  entry_count int;
  opt_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 or entry_count > 25 then
    raise exception 'ongoing round pack must have 1-25 items' using errcode = '22023';
  end if;

  insert into public.question_packs (user_id, generated_on, kind)
  values (uid, (timezone('utc', now()))::date, 'ongoing_round')
  returning id into pack_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2-3 options' using errcode = '22023';
    end if;
    if item->>'question_bank_item_id' is null then
      raise exception 'question_bank_item_id required for ongoing round items' using errcode = '22023';
    end if;

    insert into public.question_items (
      pack_id, user_id, sort_index, axis, prompt, options, question_bank_item_id
    ) values (
      pack_id,
      uid,
      idx,
      item->>'axis',
      left(trim(coalesce(item->>'prompt', '')), 400),
      item->'options',
      (item->>'question_bank_item_id')::uuid
    );
    idx := idx + 1;
  end loop;

  return pack_id;
end;
$$;

revoke all on function public.insert_ongoing_round_pack(jsonb) from public, anon;
grant execute on function public.insert_ongoing_round_pack(jsonb) to authenticated;

comment on function public.insert_ongoing_round_pack(jsonb) is
  'Saves one 25-item ongoing-round pack (question_packs.kind=ongoing_round) + its question_items rows, each requiring a non-null question_bank_item_id. Sibling of insert_question_pack (Infinite Questions), not a replacement — that RPC is untouched. Not yet called by any client code as of wave50/T-02; T-03 wires the save path that calls this.';

-- 3. bump_bank_times_served ----------------------------------------------------

create function public.bump_bank_times_served(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  id_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  id_count := coalesce(array_length(p_ids, 1), 0);
  if id_count > 25 then
    raise exception 'too many ids (max 25)' using errcode = '22023';
  end if;

  update public.question_bank_pool
    set times_served = times_served + 1
    where id = any(coalesce(p_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.bump_bank_times_served(uuid[]) from public, anon;
grant execute on function public.bump_bank_times_served(uuid[]) to authenticated;

comment on function public.bump_bank_times_served(uuid[]) is
  'Bumps times_served for drawn question_bank_pool rows (T-02 bank-pool.ts recordBankUsage) — informational only, question_bank_pool has no other client write path (wave49 revokes insert/update/delete from authenticated).';

-- 4. insert_bank_pool_items -----------------------------------------------------

create function public.insert_bank_pool_items(p_items jsonb)
returns table(id uuid, prompt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  v_prompt text;
  opt_count int;
  entry_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count > 25 then
    raise exception 'too many items (max 25)' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_prompt := left(trim(coalesce(item->>'prompt', '')), 400);
    if v_prompt = '' then
      raise exception 'prompt required' using errcode = '22023';
    end if;

    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2-3 options' using errcode = '22023';
    end if;

    return query
      insert into public.question_bank_pool (axis, category, prompt, options, source)
      values (item->>'axis', item->>'category', v_prompt, item->'options', 'ai')
      on conflict (prompt) do update set prompt = excluded.prompt
      returning question_bank_pool.id, question_bank_pool.prompt;
  end loop;
end;
$$;

revoke all on function public.insert_bank_pool_items(jsonb) from public, anon;
grant execute on function public.insert_bank_pool_items(jsonb) to authenticated;

comment on function public.insert_bank_pool_items(jsonb) is
  'Writes freshly AI-generated drafts into question_bank_pool (source=ai) before they are shown to a user (T-02 bank-pool.ts addToBankPool), so every ongoing-round question always has a bank row to reference. on conflict (prompt) do update ... returning guarantees a row (new or pre-existing) always comes back, unlike do nothing.';
