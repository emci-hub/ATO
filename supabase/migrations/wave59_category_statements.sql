-- wave59_category_statements.sql
-- Read-only AI-generated statements replacing category_question_items Q&A (core loop redesign §3).

create table public.category_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  statement text not null check (char_length(statement) > 0 and char_length(statement) <= 600),
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index category_statements_user_category_idx
  on public.category_statements (user_id, category_id, created_at desc);

comment on table public.category_statements is
  'Read-only AI-generated statement per (user, category), core loop redesign §3. superseded_at set when replaced; null = currently visible one.';

alter table public.category_statements enable row level security;

create policy category_statements_select_own on public.category_statements
  for select using (auth.uid() = user_id);

-- Supersedes any current row per category_id, then inserts the new ones. All-or-nothing per call.
-- Cap (32) is a sanity/abuse guard only, not a business-logic freeze — category_defs stays the
-- live catalog (see categories.ts: "do not freeze a count"), so category_id is validated against
-- that table, not a hardcoded list.
create or replace function public.insert_category_statements(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  v_category_id text;
  entry_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 or entry_count > 32 then
    raise exception 'expected 1–32 items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    v_category_id := btrim(coalesce(item->>'category_id', ''));
    if v_category_id = '' then
      raise exception 'category_id required' using errcode = '22023';
    end if;
    if not exists (select 1 from public.category_defs where id = v_category_id) then
      raise exception 'unknown category_id: %', v_category_id using errcode = '22023';
    end if;

    update public.category_statements
      set superseded_at = timezone('utc', now())
      where user_id = uid and category_id = v_category_id and superseded_at is null;

    insert into public.category_statements (user_id, category_id, statement)
    values (uid, v_category_id, left(trim(coalesce(item->>'statement', '')), 600));
  end loop;
end;
$$;

revoke all on function public.insert_category_statements(jsonb) from public, anon;
grant execute on function public.insert_category_statements(jsonb) to authenticated;
