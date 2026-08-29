-- Explore: cached Home inner-tab observations + phrasing-only reactions.
-- Reactions never write ME or trait scores. 1 pack per user per local calendar day.

alter table public.ai_usage
  add column if not exists phrase_flag text,
  add column if not exists phrase_at timestamptz;

comment on column public.ai_usage.phrase_flag is
  'Last phrase-pattern-guard id that fired this UTC day (reframe/closing/type-of-person). Flag only; never the generated line.';
comment on column public.ai_usage.phrase_at is
  'When the last phrase-pattern-guard fire was logged this UTC day.';

create or replace function public.log_phrase_guard(p_flag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  flag text := left(trim(coalesce(p_flag, '')), 80);
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if flag = '' then
    return;
  end if;

  insert into public.ai_usage (user_id, day, calls, phrase_flag, phrase_at)
  values (uid, today, 0, flag, timezone('utc', now()))
  on conflict (user_id, day) do update
    set phrase_flag = excluded.phrase_flag,
        phrase_at = excluded.phrase_at;
end;
$$;

revoke all on function public.log_phrase_guard(text) from public, anon;
grant execute on function public.log_phrase_guard(text) to authenticated;

comment on function public.log_phrase_guard(text) is
  'Record a phrase-pattern-guard fire for the signed-in user. Does not increment model-call quota.';

create table public.explore_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_on date not null,
  trigger text not null check (trigger in ('first', 'weekly', 'signal')),
  fingerprint text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, generated_on)
);

create index explore_packs_user_created_idx on public.explore_packs (user_id, created_at desc);

comment on table public.explore_packs is
  'One Explore regeneration per user per local calendar day. Cached until weekly or a meaningful signal/trait change.';

create table public.explore_entries (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.explore_packs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_index int not null check (sort_index >= 0 and sort_index < 8),
  body text not null check (char_length(body) > 0 and char_length(body) <= 1200),
  traits text[] not null default '{}',
  chips text[] not null default '{}',
  signal_kind text check (signal_kind is null or signal_kind in ('fact', 'knock', 'check')),
  created_at timestamptz not null default now()
);

create index explore_entries_pack_idx on public.explore_entries (pack_id, sort_index);
create index explore_entries_user_idx on public.explore_entries (user_id);

comment on table public.explore_entries is
  'Cached Explore observations for a pack. traits[] is what Sage combined; never a score.';

create table public.explore_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.explore_entries(id) on delete cascade,
  landed boolean not null,
  created_at timestamptz not null default now(),
  unique (user_id, entry_id)
);

create index explore_reactions_user_idx on public.explore_reactions (user_id, created_at desc);

comment on table public.explore_reactions is
  'Did-this-land? on Explore entries. Phrasing/angle only — no path into trait scores.';

alter table public.explore_packs enable row level security;
alter table public.explore_entries enable row level security;
alter table public.explore_reactions enable row level security;

create policy explore_packs_select_own on public.explore_packs
  for select using (auth.uid() = user_id);

create policy explore_entries_select_own on public.explore_entries
  for select using (auth.uid() = user_id);

create policy explore_reactions_select_own on public.explore_reactions
  for select using (auth.uid() = user_id);

create or replace function public.insert_explore_pack(
  p_generated_on date,
  p_trigger text,
  p_fingerprint text,
  p_entries jsonb
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
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_trigger not in ('first', 'weekly', 'signal') then
    raise exception 'invalid trigger' using errcode = '22023';
  end if;
  if p_generated_on is null then
    raise exception 'generated_on required' using errcode = '22023';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb));
  if entry_count < 1 or entry_count > 3 then
    raise exception 'explore pack must have 1–3 entries' using errcode = '22023';
  end if;

  insert into public.explore_packs (user_id, generated_on, trigger, fingerprint)
  values (uid, p_generated_on, p_trigger, left(coalesce(p_fingerprint, ''), 2000))
  returning id into pack_id;

  for item in select value from jsonb_array_elements(p_entries)
  loop
    insert into public.explore_entries (
      pack_id, user_id, sort_index, body, traits, chips, signal_kind
    ) values (
      pack_id,
      uid,
      idx,
      left(trim(coalesce(item->>'body', '')), 1200),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(item->'traits', '[]'::jsonb))),
        '{}'
      ),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(item->'chips', '[]'::jsonb))),
        '{}'
      ),
      nullif(item->>'signal_kind', '')
    );
    idx := idx + 1;
  end loop;

  return pack_id;
end;
$$;

revoke all on function public.insert_explore_pack(date, text, text, jsonb) from public, anon;
grant execute on function public.insert_explore_pack(date, text, text, jsonb) to authenticated;

comment on function public.insert_explore_pack(date, text, text, jsonb) is
  'Insert one Explore pack for the signed-in user. Unique (user_id, generated_on) is the 1/day cap. Does not touch ME or traits.';

create or replace function public.record_explore_reaction(
  p_entry_id uuid,
  p_landed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_entry_id is null or p_landed is null then
    raise exception 'entry and landed required' using errcode = '22023';
  end if;

  select user_id into owner
  from public.explore_entries
  where id = p_entry_id;

  if owner is null or owner <> uid then
    raise exception 'not found' using errcode = '42501';
  end if;

  insert into public.explore_reactions (user_id, entry_id, landed)
  values (uid, p_entry_id, p_landed)
  on conflict (user_id, entry_id) do update
    set landed = excluded.landed,
        created_at = timezone('utc', now());
end;
$$;

revoke all on function public.record_explore_reaction(uuid, boolean) from public, anon;
grant execute on function public.record_explore_reaction(uuid, boolean) to authenticated;

comment on function public.record_explore_reaction(uuid, boolean) is
  'Did-this-land? for one Explore entry. Updates only explore_reactions — never ME or trait columns.';

create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
  + (select count(*) from public.crisis_flags where user_id = p_user_id)
  + (select count(*) from public.connections where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.messages where sender_id = p_user_id)
  + (select count(*) from public.threads where user_a = p_user_id or user_b = p_user_id)
  + (select count(*) from public.blocks where blocked_by = p_user_id or blocked_user = p_user_id)
  + (select count(*) from public.mutes where muter = p_user_id or muted_user = p_user_id)
  + (select count(*) from public.reports where "from" = p_user_id or user_id = p_user_id)
  + (select count(*) from public.sage_messages where user_id = p_user_id)
  + (select count(*) from public.apple_credentials where user_id = p_user_id)
  + (select count(*) from public.invite_codes where owner_id = p_user_id)
  + (select count(*) from public.explore_packs where user_id = p_user_id)
  + (select count(*) from public.explore_entries where user_id = p_user_id)
  + (select count(*) from public.explore_reactions where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
