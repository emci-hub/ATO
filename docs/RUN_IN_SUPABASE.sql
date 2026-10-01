-- ATO — run this ONCE in the Supabase SQL editor (project "ato").
-- It is wave74 + wave75 together. All or nothing: if any line fails, nothing changes.
-- When it finishes you should see ONE row with three "true" values.

begin;

-- ===== wave74: shared question pool lock + AI call refund function =====

alter table public.question_bank_pool
  add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.question_bank_pool.created_by is
  'wave74: the account whose AI call produced this row (null for authored rows and for AI rows from before wave74). AI rows are served only to created_by.';

create index if not exists question_bank_pool_created_by_idx
  on public.question_bank_pool (created_by)
  where created_by is not null;

drop policy if exists question_bank_pool_select_auth on public.question_bank_pool;
create policy question_bank_pool_select_auth on public.question_bank_pool
  for select to authenticated
  using (source = 'authored' or created_by = auth.uid());

drop function if exists public.insert_bank_pool_items(jsonb);

create function public.insert_bank_pool_items(p_items jsonb)
returns table(id uuid, out_prompt text)
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
      insert into public.question_bank_pool (axis, category, prompt, options, source, created_by)
      values (item->>'axis', item->>'category', v_prompt, item->'options', 'ai', uid)
      on conflict (prompt) do update set prompt = excluded.prompt
      returning question_bank_pool.id, question_bank_pool.prompt;
  end loop;
end;
$$;

revoke all on function public.insert_bank_pool_items(jsonb) from public, anon;
grant execute on function public.insert_bank_pool_items(jsonb) to authenticated;

create or replace function public.fetch_bank_candidates(p_axis text, p_limit int)
returns table(id uuid, category text, prompt text, options jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  lim := least(greatest(coalesce(p_limit, 0), 0), 100);
  if lim = 0 then
    return;
  end if;

  return query
    select b.id, b.category, b.prompt, b.options
    from public.question_bank_pool b
    where b.axis = p_axis
      and (b.source = 'authored' or b.created_by = uid)
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    order by b.times_served asc, b.created_at asc
    limit lim;
end;
$$;

revoke all on function public.fetch_bank_candidates(text, int) from public, anon;
grant execute on function public.fetch_bank_candidates(text, int) to authenticated;

create or replace function public.bank_pool_depth()
returns table(axis text, available int)
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

  return query
    select b.axis, count(*)::int as available
    from public.question_bank_pool b
    where (b.source = 'authored' or b.created_by = uid) -- wave74: same visibility rule as the draw
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    group by b.axis;
end;
$$;

revoke all on function public.bank_pool_depth() from public, anon;
grant execute on function public.bank_pool_depth() to authenticated;

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
      and (p.source = 'authored' or p.created_by = uid)
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

alter table public.ai_usage add column if not exists refunds int not null default 0;

create or replace function public.refund_ai_call(p_user_id uuid, p_call_type text default 'sage')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  call_type text := lower(btrim(coalesce(p_call_type, 'sage')));
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '22023';
  end if;
  if call_type not in ('sage', 'explore') then
    raise exception 'invalid call type' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  update public.ai_usage
    set
      refunds = refunds + 1,
      calls = greatest(calls - 1, 0),
      by_type = jsonb_set(
        coalesce(by_type, '{}'::jsonb),
        array[call_type],
        to_jsonb(greatest(coalesce((by_type->>call_type)::int, 0) - 1, 0))
      )
    where user_id = p_user_id and day = today and calls > 0 and refunds < 5;
end;
$$;

revoke all on function public.refund_ai_call(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_call(uuid, text) to service_role;

comment on function public.refund_ai_call(uuid, text) is
  'wave74: gives back one claim_ai_call unit for today when the vendor returned nothing. service_role only (called by the ai-generate Edge Function) — never grantable to authenticated.';

-- ===== wave75: root-only "clear all my questions" =====

create or replace function public.reset_my_test_data()
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
    raise exception 'reset_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'reset_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

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

  delete from public.ato_token_events where user_id = uid;
  delete from public.token_events where user_id = uid;

  perform set_config('ato.allow_ato_token_write', '1', true);
  perform set_config('ato.allow_token_write', '1', true);

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
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null,
      ato_tokens = 0,
      tokens = 0
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reset_my_test_data() from public, anon;
grant execute on function public.reset_my_test_data() to authenticated;

comment on function public.reset_my_test_data() is
  'PRE-LAUNCH TEST TOOL (wave75). Root only, own account only: clears answers, trait scores, rounds, both token ledgers and generated content, keeps the profile. Refuses when app_config.signup_mode is not invite_only. Drop before public launch.';

commit;

-- ===== check: all three should say true =====
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'question_bank_pool' and column_name = 'created_by'
  ) as pool_lock_applied,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'refund_ai_call'
  ) as refund_function_ready,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reset_my_test_data'
  ) as clear_function_ready;
