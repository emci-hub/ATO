-- Wave 32: Legends repeat policy — a figure can resurface via story variants.
--
-- Why: today `legends` is one row per person/mythical figure with exactly one
-- story, and user_legend_history unique (user_id, legend_id) means a figure is
-- served once per user, ever. New policy: the figure is no longer blocked —
-- only the story variant that was shown is. A figure may resurface later with
-- a different variant (a new angle on the same archetype, or a different
-- archetype if they fit more than one).
--
-- Shape (normalized, shipped end-to-end):
--   legend_figures    id, canonical_slug UNIQUE, name, era_title, type   (the person)
--   legend_variants   id, figure_id FK, variant_key, teaser, full_story,
--                     fact_checked; UNIQUE (figure_id, variant_key)       (the story)
--   legend_archetypes  legend_id now FK -> legend_variants (link is per variant)
--   user_legend_history legend_id now FK -> legend_variants (tracks the variant shown)
--
-- Data migration: each current `legends` row becomes a figure + its first
-- variant (variant_key 'v1'), and the current legend UUID is REUSED as the
-- variant UUID. legend_archetypes and user_legend_history rows already carry
-- those legend ids, so after re-pointing their FKs to legend_variants every
-- existing row stays valid with zero data rewrite.
--
-- The old `legends` table is dropped here because the client moves to the
-- variant model in the same pass (store.ts reads legend_variants). Idempotent
-- re-run is NOT supported (table dropped), matching other applied migrations.

begin;

-- 1. New content tables ------------------------------------------------------

create table public.legend_figures (
  id uuid primary key default gen_random_uuid(),
  canonical_slug text not null unique,
  name text not null,
  era_title text not null,
  type text not null
    check (type in ('historical', 'modern-deceased', 'mythical')),
  created_at timestamptz not null default now()
);

comment on table public.legend_figures is
  'A person or mythical figure that can be served to users. Read-only content for clients. A figure is not shown once and retired — it resurfaces through its story variants.';
comment on column public.legend_figures.canonical_slug is 'Figure identity, e.g. leonardo-da-vinci-1452. Unique per figure; shared by every story variant of that figure.';
comment on column public.legend_figures.type is 'historical | modern-deceased | mythical.';

create table public.legend_variants (
  id uuid primary key default gen_random_uuid(),
  figure_id uuid not null references public.legend_figures (id) on delete cascade,
  variant_key text not null,
  teaser text not null,
  full_story text not null,
  fact_checked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint legend_variants_figure_variant unique (figure_id, variant_key)
);

create index legend_variants_figure_idx
  on public.legend_variants (figure_id);

comment on table public.legend_variants is
  'One story variant of a figure — a distinct angle on the archetype or a different archetype the figure fits. Read-only content for clients. user_legend_history blocks a variant once shown; a figure can resurface through its other variants. fact_checked gates presentation.';
comment on column public.legend_variants.variant_key is 'Stable authoring key within a figure, e.g. v1 / v2. Unique per figure.';
comment on column public.legend_variants.teaser is 'One-sentence hook shown on cards.';
comment on column public.legend_variants.full_story is 'Full story body.';
comment on column public.legend_variants.fact_checked is 'False until a human verified the story. Unchecked variants must never be presented as fact.';

-- 2. Migrate existing legends rows -> figure + first variant ------------------
-- Figure ids are freshly generated; variant ids REUSE current legend ids, so
-- the existing junction/history rows match legend_variants with no rewrite.

insert into public.legend_figures
  (id, canonical_slug, name, era_title, type, created_at)
select
  gen_random_uuid(), canonical_slug, name, era_title, type, created_at
from public.legends;

insert into public.legend_variants
  (id, figure_id, variant_key, teaser, full_story, fact_checked, created_at)
select
  l.id, f.id, 'v1', l.teaser, l.full_story, l.fact_checked, l.created_at
from public.legends l
join public.legend_figures f on f.canonical_slug = l.canonical_slug;

-- 3. Re-point junction + history to variants, then drop the old table ---------

alter table public.legend_archetypes
  drop constraint legend_archetypes_legend_id_fkey;

alter table public.user_legend_history
  drop constraint user_legend_history_legend_id_fkey;

drop table public.legends;

alter table public.legend_archetypes
  add constraint legend_archetypes_legend_id_fkey
  foreign key (legend_id) references public.legend_variants (id) on delete cascade;

alter table public.user_legend_history
  add constraint user_legend_history_legend_id_fkey
  foreign key (legend_id) references public.legend_variants (id) on delete cascade;

-- 4. RLS for the new content tables (mirror wave25 content-table grants) -------

alter table public.legend_figures enable row level security;

drop policy if exists legend_figures_select_auth on public.legend_figures;
create policy legend_figures_select_auth on public.legend_figures
  for select to authenticated using (true);

grant select on public.legend_figures to authenticated;
revoke insert, update, delete on public.legend_figures from public, anon, authenticated;

alter table public.legend_variants enable row level security;

drop policy if exists legend_variants_select_auth on public.legend_variants;
create policy legend_variants_select_auth on public.legend_variants
  for select to authenticated using (true);

grant select on public.legend_variants to authenticated;
revoke insert, update, delete on public.legend_variants from public, anon, authenticated;

-- 5. user_legend_history semantics now = a VARIANT never repeats ---------------

comment on table public.user_legend_history is
  'Append-only log of which story variants each user was served and in which weekly batch. Cascades with auth.users. A variant is served at most once to a user across any batch; the figure itself may resurface through a different variant. week_batch_id is still stored for batch queries.';

commit;
