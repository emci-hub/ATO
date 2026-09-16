-- wave54_reroll_rpcs_fixes.sql
--
-- Review fix for wave53_reroll_rpcs.sql: neither reroll_question_item nor
-- reroll_category_batch_item took `for update` on the target row before
-- checking answered_option/answered_at, so two concurrent calls for the same
-- item (a double-tap, or an answer landing mid-reroll) raced the
-- already-answered check against the update. Low-probability for a
-- single-user row, but free to close — same pattern as every other
-- ownership-checked mutation RPC in this codebase would use if it read a
-- row it was about to conditionally update.

create or replace function public.reroll_question_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pack_id uuid;
  v_axis text;
  v_old_bank_id uuid;
  v_answered int;
  v_new_id uuid;
  v_new_prompt text;
  v_new_options jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select pack_id, axis, question_bank_item_id, answered_option
    into v_pack_id, v_axis, v_old_bank_id, v_answered
    from public.question_items
    where id = p_item_id and user_id = uid
    for update;

  if v_pack_id is null then
    raise exception 'question item not found' using errcode = '22023';
  end if;
  if v_answered is not null then
    raise exception 'already answered' using errcode = '22023';
  end if;
  if v_old_bank_id is null then
    raise exception 'not eligible for reroll' using errcode = '22023';
  end if;

  insert into public.question_bank_reroll_exclusions (user_id, question_bank_item_id)
  values (uid, v_old_bank_id)
  on conflict (user_id, question_bank_item_id) do nothing;

  select p.id, p.prompt, p.options
    into v_new_id, v_new_prompt, v_new_options
    from public.question_bank_pool p
    where p.axis = v_axis
      and p.id not in (
        select question_bank_item_id from public.question_bank_reroll_exclusions where user_id = uid
      )
      and p.id not in (
        select question_bank_item_id from public.question_items
        where pack_id = v_pack_id and question_bank_item_id is not null
      )
    order by p.times_served asc, p.id asc
    limit 1;

  if v_new_id is null then
    raise exception 'no reroll candidates available for this axis' using errcode = 'P0042';
  end if;

  update public.question_items
    set prompt = v_new_prompt, options = v_new_options, question_bank_item_id = v_new_id
    where id = p_item_id;

  update public.question_bank_pool set times_served = times_served + 1 where id = v_new_id;

  return jsonb_build_object(
    'id', p_item_id,
    'axis', v_axis,
    'prompt', v_new_prompt,
    'options', v_new_options
  );
end;
$$;

create or replace function public.reroll_category_batch_item(
  p_item_id uuid,
  p_prompt text,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_axis text;
  v_answered timestamptz;
  v_prompt text := left(trim(coalesce(p_prompt, '')), 400);
  opt_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_prompt = '' then
    raise exception 'prompt required' using errcode = '22023';
  end if;

  select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb));
  if opt_count < 2 or opt_count > 3 then
    raise exception 'question needs 2-3 options' using errcode = '22023';
  end if;

  select axis, answered_at into v_axis, v_answered
    from public.category_question_items
    where id = p_item_id and user_id = uid
    for update;

  if v_axis is null then
    raise exception 'category question item not found' using errcode = '22023';
  end if;
  if v_answered is not null then
    raise exception 'already answered' using errcode = '22023';
  end if;

  update public.category_question_items
    set prompt = v_prompt, options = p_options
    where id = p_item_id;

  return jsonb_build_object(
    'id', p_item_id,
    'axis', v_axis,
    'prompt', v_prompt,
    'options', p_options
  );
end;
$$;

-- Grants/revokes are unchanged from wave53 (create or replace on the same
-- signature preserves them) — restated here only as a comment, not reapplied,
-- matching wave47's precedent for a fix migration that doesn't touch grants.
