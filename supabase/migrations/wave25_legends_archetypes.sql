-- Wave 25: Legend discovery — archetype catalog + legends content + user history.
-- Applied to production 2026-09-02 (project aijzsmupaaaxjctfgwpl, migration
-- 20260902164233_wave25_legends_archetypes).
--
-- Design (decided with emci 2026-09-02):
--   * archetype_defs (not "categories" — avoids confusion with category_defs, the
--     You-tab profile-category catalog from wave21).
--   * legends <-> archetypes is a real many-to-many via junction legend_archetypes.
--   * trait_axis speaks the app's 16-axis vocabulary (same list as trait_history /
--     trait_tracks / question_items), not Big Five.
-- archetype_defs, legends, legend_archetypes are read-only content for clients
-- (report-track only, like category_defs). user_legend_history is the only
-- user-owned table here. A legend never repeats for a user across any batch.

-- 1. trait_axis validation -----------------------------------------------------
-- archetype_defs.trait_axis is a comma-separated combo string, e.g.
-- 'openness:high, conscientiousness:low'. Enforced as the 16-axis vocabulary the
-- app already guards everywhere, with high|low poles only.

create or replace function public.trait_axis_valid(p_trait_axis text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  tok text;
  parts text[];
begin
  if p_trait_axis is null or p_trait_axis = '' then
    return false;
  end if;
  for tok in select trim(unnest(string_to_array(p_trait_axis, ','))) loop
    parts := string_to_array(tok, ':');
    if cardinality(parts) <> 2 then
      return false;
    end if;
    if parts[1] not in (
      'openness','conscientiousness','extraversion','agreeableness','steadiness',
      'attachment_anxiety','attachment_avoidance',
      'conflict_assertiveness','conflict_cooperativeness',
      'autonomy','competence','relatedness',
      'growth_mindset','locus_of_control','self_efficacy','playfulness'
    ) then
      return false;
    end if;
    if parts[2] not in ('high','low') then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.trait_axis_valid(text) from public, anon, authenticated;

comment on function public.trait_axis_valid(text) is
  'True when trait_axis is a comma-separated 16-axis combo, each entry "axis:high|low". Keeps archetype content on the same axis vocabulary as user trait data. Clients never call it; it backs the archetype_defs CHECK.';

-- 2. archetype_defs (content catalog) ------------------------------------------

create table public.archetype_defs (
  id text primary key,
  formal_name text not null,
  slang_name text not null,
  slang_definition text not null,
  anime_flavor_tag text not null,
  trait_axis text not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint archetype_defs_trait_axis_valid
    check (public.trait_axis_valid(trait_axis))
);

comment on table public.archetype_defs is
  'Catalog of personality-flavored archetypes a legend can embody. Read-only for clients. trait_axis matches the 16-axis vocabulary so archetypes can be matched to user trait data.';
comment on column public.archetype_defs.id is 'Stable seeded id, e.g. arch_the_visionary.';
comment on column public.archetype_defs.formal_name is 'Grown-up display name.';
comment on column public.archetype_defs.slang_name is 'Short everyday name used in legend cards.';
comment on column public.archetype_defs.slang_definition is 'One-line plain-English definition of the slang name.';
comment on column public.archetype_defs.anime_flavor_tag is 'Pop-culture flavor tag for the archetype, e.g. a trope name.';
comment on column public.archetype_defs.trait_axis is 'Comma-separated 16-axis combo this archetype indexes on, e.g. openness:high, conscientiousness:low.';
comment on column public.archetype_defs.description is 'Paragraph description for the archetype profile.';

alter table public.archetype_defs enable row level security;

drop policy if exists archetype_defs_select_auth on public.archetype_defs;
create policy archetype_defs_select_auth on public.archetype_defs
  for select to authenticated using (true);

grant select on public.archetype_defs to authenticated;
revoke insert, update, delete on public.archetype_defs from public, anon, authenticated;

-- 3. legends (content catalog) ---------------------------------------------------

create table public.legends (
  id uuid primary key default gen_random_uuid(),
  canonical_slug text not null unique,
  name text not null,
  era_title text not null,
  type text not null
    check (type in ('historical', 'modern-deceased', 'mythical')),
  teaser text not null,
  full_story text not null,
  fact_checked boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.legends is
  'Legendary figures served to users and matched to archetypes. Read-only content for clients. Dedup at seed time via canonical_slug; fact_checked gates presentation.';
comment on column public.legends.canonical_slug is 'name + birth year slug, e.g. marie-curie-1867. Unique dedup key for authored content.';
comment on column public.legends.name is 'Display name.';
comment on column public.legends.era_title is 'Human label for the figure''s era or setting, e.g. Victorian England.';
comment on column public.legends.type is 'historical | modern-deceased | mythical.';
comment on column public.legends.teaser is 'One-sentence hook shown on cards.';
comment on column public.legends.full_story is 'Full story body.';
comment on column public.legends.fact_checked is 'False until a human verified the story. Unchecked legends must never be presented as fact.';

alter table public.legends enable row level security;

drop policy if exists legends_select_auth on public.legends;
create policy legends_select_auth on public.legends
  for select to authenticated using (true);

grant select on public.legends to authenticated;
revoke insert, update, delete on public.legends from public, anon, authenticated;

-- 4. legend_archetypes (junction) -------------------------------------------------

create table public.legend_archetypes (
  legend_id uuid not null references public.legends (id) on delete cascade,
  archetype_id text not null references public.archetype_defs (id) on delete cascade,
  primary key (legend_id, archetype_id)
);

create index legend_archetypes_archetype_idx
  on public.legend_archetypes (archetype_id);

comment on table public.legend_archetypes is
  'Many-to-many links between legends and archetypes. Read-only content.';

alter table public.legend_archetypes enable row level security;

drop policy if exists legend_archetypes_select_auth on public.legend_archetypes;
create policy legend_archetypes_select_auth on public.legend_archetypes
  for select to authenticated using (true);

grant select on public.legend_archetypes to authenticated;
revoke insert, update, delete on public.legend_archetypes from public, anon, authenticated;

-- 5. user_legend_history (user-owned) ----------------------------------------------

create table public.user_legend_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legend_id uuid not null references public.legends (id) on delete cascade,
  shown_at timestamptz not null default now(),
  week_batch_id text not null,
  constraint user_legend_history_never_repeat
    unique (user_id, legend_id)
);

create index user_legend_history_user_batch_idx
  on public.user_legend_history (user_id, week_batch_id);

comment on table public.user_legend_history is
  'Append-only log of which legends each user was served and in which weekly batch. Cascades with auth.users. A legend is served at most once to a user across any batch — never repeats. week_batch_id is still stored for batch queries.';
comment on column public.user_legend_history.week_batch_id is 'Week the legend was served, e.g. 2026-W36. Derived client batch key — no batches table; batch queries read this column.';
comment on column public.user_legend_history.shown_at is 'Reveal time. A batch may serve several legends per user.';

alter table public.user_legend_history enable row level security;

drop policy if exists user_legend_history_select_own on public.user_legend_history;
create policy user_legend_history_select_own on public.user_legend_history
  for select using (auth.uid() = user_id);

drop policy if exists user_legend_history_insert_own on public.user_legend_history;
create policy user_legend_history_insert_own on public.user_legend_history
  for insert with check (auth.uid() = user_id);

grant select, insert on public.user_legend_history to authenticated;
revoke update, delete on public.user_legend_history from public, anon, authenticated;
