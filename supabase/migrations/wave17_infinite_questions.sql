-- Infinite Questions: cached batches of 5, 3 batch-regens/day, own ai_usage tag.
-- Answering cached items is free. Does not increment the Sage/Explore 20/day `calls` cap.

alter table public.app_config
  add column if not exists questions_daily_cap int not null default 3
    check (questions_daily_cap >= 0);

comment on column public.app_config.questions_daily_cap is
  'Per-user daily cap on Infinite Questions batch regenerations (not answers).';

alter table public.ai_usage
  add column if not exists by_type jsonb not null default '{}'::jsonb;

comment on column public.ai_usage.by_type is
  'Per-surface model-call counts for this UTC day, keyed by call_type (sage, explore, questions).';

drop function if exists public.claim_ai_call();

create function public.claim_ai_call(p_call_type text default 'sage')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  daily_cap int;
  monthly_cap int;
  today date := (timezone('utc', now()))::date;
  month_start date := date_trunc('month', timezone('utc', now()))::date;
  daily_count int;
  monthly_count int;
  call_type text := lower(btrim(coalesce(p_call_type, 'sage')));
  typed int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if call_type not in ('sage', 'explore') then
    raise exception 'invalid call type' using errcode = '22023';
  end if;

  select ai_daily_cap, ai_monthly_cap
    into strict daily_cap, monthly_cap
    from public.app_config
    where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select calls into strict daily_count
    from public.ai_usage
    where user_id = uid and day = today;

  select coalesce(sum(calls), 0) into monthly_count
    from public.ai_usage
    where user_id = uid and day >= month_start and day <= today;

  if daily_count >= daily_cap or monthly_count >= monthly_cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', daily_count,
      'daily_cap', daily_cap,
      'monthly', monthly_count,
      'monthly_cap', monthly_cap
    );
  end if;

  update public.ai_usage
    set
      calls = calls + 1,
      by_type = jsonb_set(
        coalesce(by_type, '{}'::jsonb),
        array[call_type],
        to_jsonb(coalesce((by_type->>call_type)::int, 0) + 1)
      )
    where user_id = uid and day = today
    returning calls, coalesce((by_type->>call_type)::int, 0) into daily_count, typed;

  return jsonb_build_object(
    'ok', true,
    'daily', daily_count,
    'daily_cap', daily_cap,
    'monthly', monthly_count + 1,
    'monthly_cap', monthly_cap,
    'call_type', call_type,
    'typed', typed
  );
end;
$$;

revoke all on function public.claim_ai_call(text) from public, anon;
grant execute on function public.claim_ai_call(text) to authenticated;

comment on function public.claim_ai_call(text) is
  'Atomically claim one Sage/Explore model call against the shared daily/monthly cap. Tags ai_usage.by_type.';

create or replace function public.claim_questions_batch()
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

  select questions_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':questions'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'questions')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'questions'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{questions}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'questions')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'questions'
  );
end;
$$;

revoke all on function public.claim_questions_batch() from public, anon;
grant execute on function public.claim_questions_batch() to authenticated;

comment on function public.claim_questions_batch() is
  'Claim one Infinite Questions batch regeneration (3/UTC-day). Does not increment Sage/Explore calls.';

create table public.question_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_on date not null,
  created_at timestamptz not null default now()
);

create index question_packs_user_created_idx on public.question_packs (user_id, created_at desc);

comment on table public.question_packs is
  'One Infinite Questions batch. Cached until exhausted or a new local day. Regen capped in claim_questions_batch.';

create table public.question_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.question_packs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_index int not null check (sort_index >= 0 and sort_index < 5),
  axis text not null check (axis in (
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance',
    'conflict_assertiveness', 'conflict_cooperativeness',
    'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy'
  )),
  prompt text not null check (char_length(prompt) > 0 and char_length(prompt) <= 400),
  options jsonb not null,
  answered_option int check (answered_option is null or answered_option >= 0),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pack_id, sort_index)
);

create index question_items_pack_idx on public.question_items (pack_id, sort_index);
create index question_items_user_idx on public.question_items (user_id);

comment on table public.question_items is
  'Cached multiple-choice items for a questions pack. options is [{text, value}]. Answers write ME traits on the client via mergeTraitWrite.';

alter table public.question_packs enable row level security;
alter table public.question_items enable row level security;

create policy question_packs_select_own on public.question_packs
  for select using (auth.uid() = user_id);

create policy question_items_select_own on public.question_items
  for select using (auth.uid() = user_id);

create or replace function public.insert_question_pack(
  p_generated_on date,
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
  if p_generated_on is null then
    raise exception 'generated_on required' using errcode = '22023';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 or entry_count > 5 then
    raise exception 'question pack must have 1–5 items' using errcode = '22023';
  end if;

  insert into public.question_packs (user_id, generated_on)
  values (uid, p_generated_on)
  returning id into pack_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2–3 options' using errcode = '22023';
    end if;

    insert into public.question_items (
      pack_id, user_id, sort_index, axis, prompt, options
    ) values (
      pack_id,
      uid,
      idx,
      item->>'axis',
      left(trim(coalesce(item->>'prompt', '')), 400),
      item->'options'
    );
    idx := idx + 1;
  end loop;

  return pack_id;
end;
$$;

revoke all on function public.insert_question_pack(date, jsonb) from public, anon;
grant execute on function public.insert_question_pack(date, jsonb) to authenticated;

create or replace function public.answer_question_item(
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
    from public.question_items
    where id = p_item_id and user_id = uid;
  if n is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_option_index >= n then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  update public.question_items
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

revoke all on function public.answer_question_item(uuid, int) from public, anon;
grant execute on function public.answer_question_item(uuid, int) to authenticated;
