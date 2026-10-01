-- ============================================================================
-- DRAFT — NOT APPLIED. NOT A MIGRATION YET.
-- Lives in docs/proposals/ on purpose so nothing applies it by accident.
-- To use it: emci reviews, then it is copied to
--   supabase/migrations/wave74_bank_pool_owner_and_ai_refund.sql
-- and applied. Written 2026-10-01.
-- ============================================================================
--
-- PART 1 — SHARED QUESTION POOL: one user's AI questions stop reaching others.
--
-- Today: any signed-in account can write rows into question_bank_pool (through
-- insert_bank_pool_items, or by calling it directly with any text), and every
-- other account is then served those rows in its 25-question rounds.
--
-- After: an AI-written row is served only to the account that generated it.
-- The hand-written ("authored") bank stays shared with everyone, exactly as now.
-- The app needs NO change — it calls the same four functions with the same
-- arguments and gets the same shapes back.
--
-- Effect on existing data: AI rows written BEFORE this runs have no owner
-- (created_by is null), so they stop being served to anyone. Nothing is
-- deleted. Rounds draw from the authored bank and each account's own AI rows,
-- and generate fresh ones when short (as they already do).
--
-- PART 2 — AI QUOTA: a failed AI call gives the call back.
--
-- Today: the daily call is counted BEFORE the AI is contacted and is never
-- returned, so a failure costs a call, and the app's automatic retry costs a
-- second one. refund_ai_call lets the ai-generate function hand the call back
-- when the AI returned nothing. Only the server (service role) can call it —
-- if a user could, they could refund themselves forever. Capped at 5 refunds a
-- day per account, so even a tampered app cannot use failures to dodge the cap.
-- ============================================================================

-- 1a. who generated an AI row ------------------------------------------------

alter table public.question_bank_pool
  add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.question_bank_pool.created_by is
  'wave74: the account whose AI call produced this row (null for authored rows and for AI rows from before wave74). AI rows are served only to created_by.';

create index if not exists question_bank_pool_created_by_idx
  on public.question_bank_pool (created_by)
  where created_by is not null;

-- 1b. direct table reads follow the same rule ---------------------------------

drop policy if exists question_bank_pool_select_auth on public.question_bank_pool;
create policy question_bank_pool_select_auth on public.question_bank_pool
  for select to authenticated
  using (source = 'authored' or created_by = auth.uid());

-- 1c. the write: stamp the owner ----------------------------------------------

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
      -- wave74: stamp who generated it. On a prompt conflict the existing row is
      -- returned untouched (the no-op update never changes its owner or options).
      insert into public.question_bank_pool (axis, category, prompt, options, source, created_by)
      values (item->>'axis', item->>'category', v_prompt, item->'options', 'ai', uid)
      on conflict (prompt) do update set prompt = excluded.prompt
      returning question_bank_pool.id, question_bank_pool.prompt;
  end loop;
end;
$$;

revoke all on function public.insert_bank_pool_items(jsonb) from public, anon;
grant execute on function public.insert_bank_pool_items(jsonb) to authenticated;

-- 1d. the draw: authored rows + the caller's own AI rows -----------------------

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

  -- Same 25-item ceiling the sibling bank RPCs use (wave50). The caller
  -- over-fetches a small multiple of what it needs so it can still drop
  -- near-duplicates client-side and land close to its target.
  lim := least(greatest(coalesce(p_limit, 0), 0), 100);
  if lim = 0 then
    return;
  end if;

  return query
    select b.id, b.category, b.prompt, b.options
    from public.question_bank_pool b
    where b.axis = p_axis
      -- wave74: the shared set is the AUTHORED bank only. An AI-written row is
      -- served only to the account that generated it.
      and (b.source = 'authored' or b.created_by = uid)
      -- Permanent per-user reroll exclusions (wave49): never again, ever.
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      -- Already served to this user in any earlier pack. Deliberately keyed
      -- on the item EXISTING, not on it being answered: a question sitting
      -- unanswered in an abandoned round was still shown to them, and
      -- re-serving it in a fresh round is the same repeat from their side.
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    -- Least-served first (unchanged), then oldest — a deterministic
    -- tie-break, since times_served is 0 for every row in a freshly
    -- topped-up axis and an unordered tie would make the draw arbitrary.
    order by b.times_served asc, b.created_at asc
    limit lim;
end;
$$;

revoke all on function public.fetch_bank_candidates(text, int) from public, anon;
grant execute on function public.fetch_bank_candidates(text, int) to authenticated;

-- 1e. the depth count: same rule, so depth and the draw never disagree ---------

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

  -- One row per axis PRESENT IN THE POOL. An axis with zero rows is absent
  -- from this result rather than reported as 0 — the caller treats a missing
  -- axis as 0 (see src/lib/questions/prewarm.ts), so a genuinely empty axis
  -- still registers as short and gets topped up.
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

-- 1f. the reroll replacement: same rule ---------------------------------------

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
      -- wave74: same visibility rule as the draw
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

-- 2. refund one AI call (server only) -----------------------------------------

-- How many refunds an account has had today. Caps the refund below, so a
-- tampered app cannot force failures and be refunded without limit.
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

  -- Same lock claim_ai_call takes, so a refund and a claim never interleave.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Never below zero; only today's row (a claim is always today's); at most 5
  -- refunds a day — past that a failure costs its call, as it does today.
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

-- Server only. A user who could call this could refund themselves without limit.
revoke all on function public.refund_ai_call(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_call(uuid, text) to service_role;

comment on function public.refund_ai_call(uuid, text) is
  'wave74: gives back one claim_ai_call unit for today when the vendor returned nothing. service_role only (called by the ai-generate Edge Function) — never grantable to authenticated.';
