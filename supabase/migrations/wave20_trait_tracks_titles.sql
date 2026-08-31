-- Dual EWMA tracks (report vs gut-call), Sage title cache + pushback flags.
-- Title generate has its own daily cap and does NOT increment Talk `calls`.

create table public.trait_tracks (
  user_id uuid not null references auth.users (id) on delete cascade,
  axis text not null,
  track text not null,
  value numeric not null,
  stability numeric not null default 0,
  answer_count int not null default 0,
  last_touched timestamptz not null default now(),
  last_depth_at timestamptz,
  primary key (user_id, axis, track),
  constraint trait_tracks_axis_known check (axis in (
    'openness',
    'conscientiousness',
    'extraversion',
    'agreeableness',
    'steadiness',
    'attachment_anxiety',
    'attachment_avoidance',
    'conflict_assertiveness',
    'conflict_cooperativeness',
    'autonomy',
    'competence',
    'relatedness',
    'growth_mindset',
    'locus_of_control',
    'self_efficacy'
  )),
  constraint trait_tracks_kind check (track in ('report', 'game')),
  constraint trait_tracks_value_01 check (value >= 0 and value <= 1),
  constraint trait_tracks_stability_01 check (stability >= 0 and stability <= 1),
  constraint trait_tracks_count_nonneg check (answer_count >= 0)
);

create index trait_tracks_user_idx on public.trait_tracks (user_id);

comment on table public.trait_tracks is
  'EWMA tracks per axis. report = self-report; game = self_game only. Never blended together. Cascades with auth.users.';

alter table public.trait_tracks enable row level security;

create policy trait_tracks_select_own on public.trait_tracks
  for select using (auth.uid() = user_id);

create policy trait_tracks_insert_own on public.trait_tracks
  for insert with check (auth.uid() = user_id);

create policy trait_tracks_update_own on public.trait_tracks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.trait_tracks to authenticated;
revoke delete on public.trait_tracks from public, anon, authenticated;

insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched)
select
  m.id,
  a.axis,
  case when coalesce(m.trait_sources ->> a.axis, '') = 'self_game' then 'game' else 'report' end,
  a.val,
  0,
  1,
  coalesce((m.trait_touched_at ->> a.axis)::timestamptz, m.updated_at)
from public.me m
cross join lateral (
  values
    ('openness', m.openness),
    ('conscientiousness', m.conscientiousness),
    ('extraversion', m.extraversion),
    ('agreeableness', m.agreeableness),
    ('steadiness', m.steadiness),
    ('attachment_anxiety', m.attachment_anxiety),
    ('attachment_avoidance', m.attachment_avoidance),
    ('conflict_assertiveness', m.conflict_assertiveness),
    ('conflict_cooperativeness', m.conflict_cooperativeness),
    ('autonomy', m.autonomy),
    ('competence', m.competence),
    ('relatedness', m.relatedness),
    ('growth_mindset', m.growth_mindset),
    ('locus_of_control', m.locus_of_control),
    ('self_efficacy', m.self_efficacy)
) as a(axis, val)
where a.val is not null
on conflict (user_id, axis, track) do nothing;

alter table public.me
  add column if not exists sage_title jsonb not null default '{}'::jsonb;

comment on column public.me.sage_title is
  'Cached Sage title {title, lede, fingerprint, generatedOn, axes}. Regenerated from stable report tracks.';

create table public.sage_title_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  lede text not null,
  axes text[] not null default '{}',
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create index sage_title_flags_user_idx on public.sage_title_flags (user_id, created_at desc);

comment on table public.sage_title_flags is
  'User flagged a Sage title as not feeling right. Capture only — no auto-action.';

alter table public.sage_title_flags enable row level security;

create policy sage_title_flags_select_own on public.sage_title_flags
  for select using (auth.uid() = user_id);

create policy sage_title_flags_insert_own on public.sage_title_flags
  for insert with check (auth.uid() = user_id);

grant select, insert on public.sage_title_flags to authenticated;
revoke update, delete on public.sage_title_flags from public, anon, authenticated;

alter table public.app_config
  add column if not exists title_daily_cap int not null default 3
    check (title_daily_cap >= 0);

comment on column public.app_config.title_daily_cap is
  'Per-user daily cap on Sage title generations. Does not increment Talk calls.';

create function public.claim_title_generate()
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

  select title_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':title'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'title')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'title'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{title}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'title')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'title'
  );
end;
$$;

revoke all on function public.claim_title_generate() from public, anon;
grant execute on function public.claim_title_generate() to authenticated;

comment on function public.claim_title_generate() is
  'Claim one Sage title generate. Tags by_type.title only — does not increment Talk calls.';
