-- wave53_reroll_rpcs.sql
--
-- Effect RPCs for the ATO tokens reroll surfaces (wave51's
-- spend_ato_tokens_legend_reroll / _category_reroll / _question_reroll only
-- move the currency — they don't change what's shown). Legend reroll needs
-- no new RPC: Legends matching is already live/stateless
-- (buildLegendView) — "reroll" there is just logShownVariants marking the
-- current variant seen so the next render's best-unseen-per-figure pick
-- moves on. This migration adds the two RPCs that DO need a server-side
-- write: one per question_items (ongoing-round rows only — Infinite
-- Questions rows carry no question_bank_item_id and are not reroll-eligible)
-- and one per category_question_items.
--
-- reroll_question_item draws from the wave49 shared question_bank_pool,
-- same bank-first mechanism composeOngoingRound already uses to fill a
-- round, and permanently excludes the old pick via
-- question_bank_reroll_exclusions (wave49's own stated purpose for that
-- table). reroll_category_batch_item has no bank pool to draw from —
-- category batches are always AI-generated (category-batch.ts,
-- composeCategoryBatch) — so it takes the already-generated replacement
-- prompt/options from the client (reroll.ts generates via the same
-- generateQuestionBatch path the batch itself was built with) and only
-- handles the ownership-checked persist.
--
-- Both require the target row to be this user's own and unanswered — a
-- reroll on an already-answered slot would silently discard a real trait
-- signal, which nothing in this feature should ever do.

-- 1. reroll_question_item -------------------------------------------------

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
    where id = p_item_id and user_id = uid;

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

revoke all on function public.reroll_question_item(uuid) from public, anon;
grant execute on function public.reroll_question_item(uuid) to authenticated;

comment on function public.reroll_question_item(uuid) is
  'Swaps an unanswered ongoing-round question_items row for a fresh least-served question_bank_pool candidate on the same axis, permanently excluding the old bank item for this user (question_bank_reroll_exclusions) and never repeating a bank item already used elsewhere in the same pack. Caller must already hold a successful spend_ato_tokens_question_reroll for today — this RPC does not itself check the ATO token balance/cap.';

-- 2. reroll_category_batch_item --------------------------------------------

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
    where id = p_item_id and user_id = uid;

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

revoke all on function public.reroll_category_batch_item(uuid, text, jsonb) from public, anon;
grant execute on function public.reroll_category_batch_item(uuid, text, jsonb) to authenticated;

comment on function public.reroll_category_batch_item(uuid, text, jsonb) is
  'Persists an already-generated replacement prompt/options onto an unanswered category_question_items row the caller owns. No bank-pool concept here (category batches are always AI-generated, see category-batch.ts) — the replacement content is generated client-side (reroll.ts, same generateQuestionBatch path composeCategoryBatch uses) before this RPC is called. Caller must already hold a successful spend_ato_tokens_category_reroll for today/this category — this RPC does not itself check the ATO token balance/cap.';
