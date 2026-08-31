-- Wave 21: 16th axis (playfulness), category catalog, dual-consent category share.
-- Categories read report-track only. Full Profile stays private-to-self.

-- 1. playfulness on ME -------------------------------------------------------
alter table public.me
  add column if not exists playfulness numeric,
  add column if not exists close_friends_share boolean not null default false,
  add column if not exists category_spotlight jsonb not null default '{}'::jsonb;

alter table public.me drop constraint if exists me_playfulness_unit;
alter table public.me
  add constraint me_playfulness_unit
  check (playfulness is null or (playfulness >= 0 and playfulness <= 1));

comment on column public.me.playfulness is
  'Optional self-report 0–1. How much lightness a day needs. Coaching tone only. Not a diagnosis. Null when skipped.';
comment on column public.me.close_friends_share is
  'Opt-in to the Close Friends category-share pool. Both people must opt in AND be connected. Off by default.';
comment on column public.me.category_spotlight is
  'Weekly You/Sage category spotlight {weekKey, categoryId}. Separate from the Home teaser.';

-- 2. widen axis CHECKs -------------------------------------------------------
alter table public.trait_history drop constraint if exists trait_history_axis_known;
alter table public.trait_history
  add constraint trait_history_axis_known check (axis in (
    'openness','conscientiousness','extraversion','agreeableness','steadiness',
    'attachment_anxiety','attachment_avoidance',
    'conflict_assertiveness','conflict_cooperativeness',
    'autonomy','competence','relatedness',
    'growth_mindset','locus_of_control','self_efficacy','playfulness'
  ));

alter table public.trait_tracks drop constraint if exists trait_tracks_axis_known;
alter table public.trait_tracks
  add constraint trait_tracks_axis_known check (axis in (
    'openness','conscientiousness','extraversion','agreeableness','steadiness',
    'attachment_anxiety','attachment_avoidance',
    'conflict_assertiveness','conflict_cooperativeness',
    'autonomy','competence','relatedness',
    'growth_mindset','locus_of_control','self_efficacy','playfulness'
  ));

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.question_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%axis in%'
  loop
    execute format('alter table public.question_items drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.question_items
  add constraint question_items_axis_known check (axis in (
    'openness','conscientiousness','extraversion','agreeableness','steadiness',
    'attachment_anxiety','attachment_avoidance',
    'conflict_assertiveness','conflict_cooperativeness',
    'autonomy','competence','relatedness',
    'growth_mindset','locus_of_control','self_efficacy','playfulness'
  ));

-- 3. category catalog (read-only for clients) --------------------------------
create table if not exists public.category_defs (
  id text primary key,
  name text not null,
  shape text not null check (shape in ('bar', 'map')),
  axis_weights jsonb not null,
  min_axes_required_stable int not null check (min_axes_required_stable >= 1),
  texture_axes text[] not null default '{}'
);

comment on table public.category_defs is
  'Catalog of the 8 profile categories. Math lives in the app; this is the named definition. Report-track only.';

alter table public.category_defs enable row level security;

drop policy if exists category_defs_select_auth on public.category_defs;
create policy category_defs_select_auth on public.category_defs
  for select to authenticated using (true);

grant select on public.category_defs to authenticated;
revoke insert, update, delete on public.category_defs from public, anon, authenticated;

insert into public.category_defs (id, name, shape, axis_weights, min_axes_required_stable, texture_axes) values
  ('cat_steadiness', 'Steadiness', 'bar',
    '{"conscientiousness":1,"agreeableness":1,"steadiness":1}'::jsonb, 2, '{}'),
  ('cat_openness', 'Openness to life', 'bar',
    '{"openness":1,"extraversion":1}'::jsonb, 2, '{}'),
  ('cat_drive', 'Drive', 'bar',
    '{"autonomy":1,"competence":1,"relatedness":1}'::jsonb, 2, '{}'),
  ('cat_agency', 'Agency', 'bar',
    '{"growth_mindset":1,"locus_of_control":1,"self_efficacy":1}'::jsonb, 2, '{}'),
  ('cat_social', 'Everyday social energy', 'bar',
    '{"extraversion":1,"agreeableness":1,"playfulness":1}'::jsonb, 2, '{}'),
  ('cat_communication', 'Communication', 'bar',
    '{"conflict_assertiveness":1,"conflict_cooperativeness":1}'::jsonb, 2, '{}'),
  ('cat_love', 'Love / closeness', 'map',
    '{"attachment_anxiety":1,"attachment_avoidance":1}'::jsonb, 2,
    '{conflict_assertiveness,conflict_cooperativeness}'),
  ('cat_independence', 'Independence & closeness', 'map',
    '{"autonomy":1,"relatedness":1}'::jsonb, 2, '{}')
on conflict (id) do update set
  name = excluded.name,
  shape = excluded.shape,
  axis_weights = excluded.axis_weights,
  min_axes_required_stable = excluded.min_axes_required_stable,
  texture_axes = excluded.texture_axes;

-- 4. per-friend category share (off by default; both must enable) ------------
create table if not exists public.category_share (
  user_id uuid not null references auth.users (id) on delete cascade,
  peer_id uuid not null references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  constraint category_share_not_self check (user_id <> peer_id)
);

comment on table public.category_share is
  'Per-friend opt-in to share category cards. Both rows must be enabled before either sees the other. Cascades with auth.users.';

create index if not exists category_share_peer_idx on public.category_share (peer_id);

alter table public.category_share enable row level security;

drop policy if exists category_share_select_own on public.category_share;
create policy category_share_select_own on public.category_share
  for select using (auth.uid() = user_id);

drop policy if exists category_share_insert_own on public.category_share;
create policy category_share_insert_own on public.category_share
  for insert with check (auth.uid() = user_id);

drop policy if exists category_share_update_own on public.category_share;
create policy category_share_update_own on public.category_share
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.category_share to authenticated;
revoke delete on public.category_share from public, anon, authenticated;

-- 5. peer category snapshot (compact cards only — never Full Profile) --------
create or replace function public.categories_share_allowed(p_peer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_peer is not null
    and auth.uid() <> p_peer
    and exists (
      select 1 from public.connections c
      where c.user_id = auth.uid() and c.peer_id = p_peer
    )
    and (
      (
        coalesce((select close_friends_share from public.me where id = auth.uid()), false)
        and coalesce((select close_friends_share from public.me where id = p_peer), false)
      )
      or (
        exists (
          select 1 from public.category_share s
          where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
        )
        and exists (
          select 1 from public.category_share s
          where s.user_id = p_peer and s.peer_id = auth.uid() and s.enabled
        )
      )
    );
$$;

revoke all on function public.categories_share_allowed(uuid) from public, anon;
grant execute on function public.categories_share_allowed(uuid) to authenticated;

create or replace function public.peer_category_pack(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.categories_share_allowed(p_user_id)
    then coalesce((select sage_title from public.me where id = p_user_id), '{}'::jsonb)
    else null
  end;
$$;

revoke all on function public.peer_category_pack(uuid) from public, anon;
grant execute on function public.peer_category_pack(uuid) to authenticated;

comment on function public.peer_category_pack(uuid) is
  'Compact Sage title + category summaries for a connected peer, only when dual consent (per-friend or Close Friends pool) is on. Never Full Profile axes.';

create or replace function public.category_share_status(p_peer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or p_peer is null or auth.uid() = p_peer then null
    when not exists (
      select 1 from public.connections c
      where c.user_id = auth.uid() and c.peer_id = p_peer
    ) then null
    else jsonb_build_object(
      'allowed', public.categories_share_allowed(p_peer),
      'mine', exists (
        select 1 from public.category_share s
        where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
      ),
      'via_pool', (
        coalesce((select close_friends_share from public.me where id = auth.uid()), false)
        and coalesce((select close_friends_share from public.me where id = p_peer), false)
      )
    )
  end;
$$;

revoke all on function public.category_share_status(uuid) from public, anon;
grant execute on function public.category_share_status(uuid) to authenticated;

comment on function public.category_share_status(uuid) is
  'Handshake for category comparison: whether I opted in, whether the Close Friends pool covers us, and whether dual consent currently allows a pack.';
