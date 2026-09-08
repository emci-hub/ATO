-- Category batches: a fixed 5-question set per category, independent of
-- Full Profile's axis-count tracking and of Infinite Questions' rotating
-- daily pack (question_packs/question_items — a separate table, kept
-- separate here too so the two features' constraints never entangle).
-- Answers still write trait_tracks on the client via
-- applyQuestionAnswer/mergeTraitWrite, same as every other question source;
-- these tables only track "which 5 questions belong to this category batch
-- and how many are answered." 5 is the proven-reliable single-generation-call
-- size already used by Infinite Questions, so this batch is filled in one
-- call — no chunking/resume logic needed (see composeCategoryBatch in
-- src/lib/questions/category-batch.ts).

create table public.category_question_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (user_id, category_id)
);

comment on table public.category_question_batches is
  'One fixed 5-question batch per (user, category). finalized_at is set only by finalize_category_batches, nothing else reads/writes it.';

create table public.category_question_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.category_question_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_index int not null check (sort_index >= 0 and sort_index < 5),
  axis text not null check (axis in (
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance',
    'conflict_assertiveness', 'conflict_cooperativeness',
    'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'
  )),
  prompt text not null check (char_length(prompt) > 0 and char_length(prompt) <= 400),
  options jsonb not null,
  answered_option int check (answered_option is null or answered_option >= 0),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, sort_index)
);

create index category_question_items_batch_idx on public.category_question_items (batch_id, sort_index);
create index category_question_items_user_idx on public.category_question_items (user_id);

comment on table public.category_question_items is
  'Up to 5 items per category_question_batches row. Skip is not allowed in this mode — no skipped_at column. options is [{text, value}], same shape as question_items.';

alter table public.category_question_batches enable row level security;
alter table public.category_question_items enable row level security;

create policy category_question_batches_select_own on public.category_question_batches
  for select using (auth.uid() = user_id);

create policy category_question_items_select_own on public.category_question_items
  for select using (auth.uid() = user_id);

-- Appends up to 5 items total per (user, category) in one call (a single
-- generateQuestionBatch call is expected to cover the whole batch — see
-- composeCategoryBatch in src/lib/questions/category-batch.ts). Creates the
-- batch row on first call, reuses it if called again for the same category.
create or replace function public.insert_category_batch_items(
  p_category_id text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_batch_id uuid;
  existing_count int;
  entry_count int;
  opt_count int;
  item jsonb;
  idx int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_category_id is null or btrim(p_category_id) = '' then
    raise exception 'category_id required' using errcode = '22023';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 then
    raise exception 'at least one item required' using errcode = '22023';
  end if;

  insert into public.category_question_batches (user_id, category_id)
  values (uid, btrim(p_category_id))
  on conflict (user_id, category_id) do update set category_id = excluded.category_id
  returning id into v_batch_id;

  select count(*)::int into existing_count
  from public.category_question_items
  where batch_id = v_batch_id and user_id = uid;

  if existing_count + entry_count > 5 then
    raise exception 'category batch cannot exceed 5 items' using errcode = '22023';
  end if;

  idx := existing_count;
  for item in select value from jsonb_array_elements(p_items)
  loop
    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2–3 options' using errcode = '22023';
    end if;

    insert into public.category_question_items (
      batch_id, user_id, sort_index, axis, prompt, options
    ) values (
      v_batch_id,
      uid,
      idx,
      item->>'axis',
      left(trim(coalesce(item->>'prompt', '')), 400),
      item->'options'
    );
    idx := idx + 1;
  end loop;

  return v_batch_id;
end;
$$;

revoke all on function public.insert_category_batch_items(text, jsonb) from public, anon;
grant execute on function public.insert_category_batch_items(text, jsonb) to authenticated;

create or replace function public.answer_category_question_item(
  p_item_id uuid,
  p_option_index int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  select jsonb_array_length(options) into n
    from public.category_question_items
    where id = p_item_id and user_id = uid;
  if n is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_option_index >= n then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  update public.category_question_items
    set answered_option = p_option_index,
        answered_at = timezone('utc', now())
    where id = p_item_id
      and user_id = uid
      and answered_at is null;

  if not found then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.answer_category_question_item(uuid, int) from public, anon;
grant execute on function public.answer_category_question_item(uuid, int) to authenticated;

-- Sets finalized_at (nothing else) on every one of the caller's category
-- batches that has all 5 items present and all 5 answered, and isn't
-- already finalized. Returns how many batches it finalized.
create or replace function public.finalize_category_batches()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  with done_batches as (
    select batch_id
    from public.category_question_items
    where user_id = uid
    group by batch_id
    having count(*) >= 5 and count(*) filter (where answered_option is not null) >= 5
  )
  update public.category_question_batches b
    set finalized_at = timezone('utc', now())
    where b.user_id = uid
      and b.finalized_at is null
      and b.id in (select batch_id from done_batches);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.finalize_category_batches() from public, anon;
grant execute on function public.finalize_category_batches() to authenticated;
