-- wave89_legend_museum.sql
-- The museum of legends (Legends tab rebuilt, emci approved 2026-10-08).
--
-- Everything here copies a path that is already live and tested:
--   1. legend_museum        per-account saved rows (one per legend + chapter:
--                           0 = first meeting, 1+ = a new story about a legend
--                           already met), own-select RLS, written only
--                           through a security-definer RPC (wave58
--                           legend_generations / wave69 daily_insights).
--   2. claim_legend_figure_story  daily cap in app_config, counted in
--                           ai_usage.by_type (wave58 claim_legend_story_generation).
--                           Called BEFORE generateText; the shared AI quota is
--                           still claimed inside ai-generate.
--   3. legend_angle_counts  anonymous totals across accounts (the
--                           daily_pick_split pattern, wave82, approved by emci as
--                           "counts only"): per (angle, moment) of ONE legend,
--                           never who; nothing at all under 5 people for that legend.
--   4. legend_circle_friends  names of connected Circle peers who also met this
--                           legend (the peer_profile / peer_checks membership
--                           check); only if the caller has met it too; never a
--                           story, an angle or a date. New museum rows are
--                           limited to the daily cap, so "met it too" can't be
--                           faked for the whole roster at once.
--   5. reset_my_account / reset_dev_test_user / count_user_rows restated from
--                           wave88 with legend_museum added (pinned by
--                           scripts/reset-account-check.ts).
--
-- Additive: no existing table or row is changed. The phone keeps working if
-- this is not applied yet (the museum stays on the phone and the story uses the
-- hand-written words: no claim, no AI call).

-- 1. The museum -------------------------------------------------------------------

create table public.legend_museum (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legend_id text not null check (legend_id ~ '^lf_[a-z0-9_]{2,40}$'),
  angle_id text not null check (angle_id ~ '^a[1-6]$'),
  moment_id text not null check (moment_id ~ '^m[1-3]$'),
  story jsonb not null check (jsonb_typeof(story) = 'object' and octet_length(story::text) <= 6000),
  chapter int not null default 0 check (chapter between 0 and 20),
  met_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, legend_id, chapter)
);

create index legend_museum_legend_idx on public.legend_museum (legend_id, angle_id, moment_id);

comment on table public.legend_museum is
  'Legends the person has met (museum of legends, 2026-10-08). One row per legend + chapter (0 = first meeting, 1+ = a later story told from a new angle); story = the saved card json (the "you" part). Ids point at the hand-written roster in src/lib/legend-figures (permanent).';

alter table public.legend_museum enable row level security;

create policy legend_museum_select_own on public.legend_museum
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.legend_museum from public, anon, authenticated;

-- 2. The daily claim + save ---------------------------------------------------------

alter table public.app_config
  add column if not exists legend_figure_daily_cap int not null default 2
    check (legend_figure_daily_cap >= 0);

comment on column public.app_config.legend_figure_daily_cap is
  'Per-user daily cap on legend stories (one AI call each): the day''s reveal plus the one bonus reveal a newly settled trait unlocks. Claimed before the vendor call.';

create or replace function public.claim_legend_figure_story()
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

  select legend_figure_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_figure'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'legend_figure')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false, 'reason', 'quota',
      'daily', used, 'daily_cap', cap, 'call_type', 'legend_figure'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{legend_figure}', to_jsonb(used + 1))
    where user_id = uid and day = today
    returning coalesce((by_type->>'legend_figure')::int, 0) into used;

  return jsonb_build_object(
    'ok', true, 'daily', used, 'daily_cap', cap, 'call_type', 'legend_figure'
  );
end;
$$;

revoke all on function public.claim_legend_figure_story() from public, anon;
grant execute on function public.claim_legend_figure_story() to authenticated;

comment on function public.claim_legend_figure_story() is
  'Claim one legend story (legend_figure_daily_cap/day, default 2). Called once per story, BEFORE generateText/ai-generate.';

-- Save one met legend (chapter 0) or a later chapter of one already met.
create or replace function public.save_legend_figure_story(
  p_legend_id text,
  p_chapter int,
  p_angle_id text,
  p_moment_id text,
  p_story jsonb,
  p_met_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  cap int;
  added_today int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- New legends join at the same pace as the app offers them (the daily cap),
  -- so nobody can fill the museum at once to read which legends Circle friends met.
  -- One save at a time per account, so two quick saves can't both slip past the limit.
  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_museum'));
  if p_chapter is null or p_chapter < 0 or p_chapter > 20 then
    raise exception 'invalid chapter' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.legend_museum where user_id = uid and legend_id = p_legend_id and chapter = p_chapter
  ) then
    select legend_figure_daily_cap into strict cap from public.app_config where id = 1;
    -- Counted on the person's own day (met_on, which must be within a day of now).
    select count(*) into added_today from public.legend_museum
      where user_id = uid and met_on = p_met_on;
    if added_today >= cap then
      raise exception 'daily limit' using errcode = '42501';
    end if;
  end if;
  if p_legend_id is null or p_legend_id !~ '^lf_[a-z0-9_]{2,40}$' then
    raise exception 'invalid legend_id' using errcode = '22023';
  end if;
  if p_angle_id is null or p_angle_id !~ '^a[1-6]$' or p_moment_id is null or p_moment_id !~ '^m[1-3]$' then
    raise exception 'invalid angle or moment' using errcode = '22023';
  end if;
  if p_story is null or jsonb_typeof(p_story) <> 'object' or octet_length(p_story::text) > 6000 then
    raise exception 'invalid story' using errcode = '22023';
  end if;
  if p_met_on is null
     or p_met_on > (timezone('utc', now()))::date + 1
     or p_met_on < (timezone('utc', now()))::date - 1 then
    raise exception 'met_on must be today' using errcode = '22023';
  end if;

  insert into public.legend_museum (user_id, legend_id, chapter, angle_id, moment_id, story, met_on)
  values (uid, p_legend_id, p_chapter, p_angle_id, p_moment_id, p_story, p_met_on)
  on conflict (user_id, legend_id, chapter) do update
    set angle_id = excluded.angle_id,
        moment_id = excluded.moment_id,
        story = excluded.story
        -- met_on is kept: the first save's day counts toward the daily limit.
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_legend_figure_story(text, int, text, text, jsonb, date) from public, anon;
grant execute on function public.save_legend_figure_story(text, int, text, text, jsonb, date) to authenticated;

-- 3. Anonymous "how often told" ------------------------------------------------------

create or replace function public.legend_angle_counts(p_legend_id text)
returns table (angle_id text, moment_id text, n int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Nothing under 5 people, so a small invite-only group can never be read back.
  if (select count(distinct lm.user_id) from public.legend_museum lm where lm.legend_id = p_legend_id) < 5 then
    return;
  end if;
  return query
    select lm.angle_id, lm.moment_id, count(*)::int
    from public.legend_museum lm
    where lm.legend_id = p_legend_id
    group by lm.angle_id, lm.moment_id;
end;
$$;

revoke all on function public.legend_angle_counts(text) from public, anon;
grant execute on function public.legend_angle_counts(text) to authenticated;

-- 4. "You and Sam both met Hokusai" -----------------------------------------------

create or replace function public.legend_circle_friends(p_legend_id text)
returns table (name text)
language sql
security definer
set search_path = public
as $$
  -- One row per friend (exists, not a join), however many chapters they have heard.
  select m.name
  from public.me m
  where m.id <> auth.uid()
    and exists (
      select 1 from public.legend_museum lm
      where lm.user_id = m.id and lm.legend_id = p_legend_id
    )
    and exists (
      select 1 from public.legend_museum mine
      where mine.user_id = auth.uid() and mine.legend_id = p_legend_id
    )
    and exists (
      select 1 from public.connections c
      where (c.user_id = auth.uid() and c.peer_id = m.id)
         or (c.user_id = m.id and c.peer_id = auth.uid())
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocked_by = auth.uid() and b.blocked_user = m.id)
         or (b.blocked_by = m.id and b.blocked_user = auth.uid())
    )
  order by m.name
  limit 10
$$;

revoke all on function public.legend_circle_friends(text) from public, anon;
grant execute on function public.legend_circle_friends(text) to authenticated;

-- 5. Account reset / dev reset / row count, restated with legend_museum ---------------

create or replace function public.reset_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  v_mode text;
  v_rows int := 0;
  n int;
begin
  uid := public.require_root();

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'reset_my_account is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- Children before parents (question_items -> question_packs, explore_*,
  -- trait_answer_changes -> trait_profile_snapshots), though each FK cascades.
  delete from public.ato_token_events where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.token_events where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_items where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_packs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_bank_reroll_exclusions where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_answer_changes where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_profile_snapshots where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_answers where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_history where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_tracks where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_insights where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.category_statements where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.legend_generations where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.legend_museum where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_roll_snapshots where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_rolls where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.sage_title_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_reactions where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_entries where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_packs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_pick_answers where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_line_days where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.checks where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.crisis_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  -- This account's own AI-written daily lines (owner-only rows). Written,
  -- shared lines (source 'authored') are never touched.
  delete from public.daily_line_pool where created_by = uid and source = 'ai'; get diagnostics n = row_count; v_rows := v_rows + n;

  -- Balances are guarded by triggers (me_ato_tokens_guard, me_tokens_guard):
  -- only a write that sets these transaction-local flags may change them,
  -- the same way the earn/spend functions do.
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
      milestones_celebrated = '{}'::jsonb,
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      ato_tokens = 0,
      tokens = 0,
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null
    where id = uid;

  perform set_config('ato.allow_ato_token_write', '0', true);
  perform set_config('ato.allow_token_write', '0', true);

  return jsonb_build_object('ok', true, 'rows_deleted', v_rows);
end;
$$;

revoke all on function public.reset_my_account() from public, anon;
grant execute on function public.reset_my_account() to authenticated;

-- reset_dev_test_user: the wave88 body + legend_museum. Gate and every other
-- line unchanged.
create or replace function public.reset_dev_test_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev_id constant uuid := 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';
begin
  if auth.uid() is distinct from v_dev_id then
    raise exception 'reset_dev_test_user: only the dev-test account may call this';
  end if;

  delete from public.checks where user_id = v_dev_id;
  delete from public.crisis_flags where user_id = v_dev_id;
  delete from public.connections where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.messages where sender_id = v_dev_id;
  delete from public.threads where user_a = v_dev_id or user_b = v_dev_id;
  delete from public.blocks where blocked_by = v_dev_id or blocked_user = v_dev_id;
  delete from public.mutes where muter = v_dev_id or muted_user = v_dev_id;
  delete from public.reports where "from" = v_dev_id or user_id = v_dev_id;
  delete from public.apple_credentials where user_id = v_dev_id;
  delete from public.explore_packs where user_id = v_dev_id;
  delete from public.explore_entries where user_id = v_dev_id;
  delete from public.explore_reactions where user_id = v_dev_id;
  delete from public.ai_provider_log where user_id = v_dev_id;
  delete from public.ai_usage where user_id = v_dev_id;
  delete from public.question_packs where user_id = v_dev_id;
  delete from public.question_items where user_id = v_dev_id;
  delete from public.trait_history where user_id = v_dev_id;
  delete from public.token_events where user_id = v_dev_id;
  delete from public.trait_tracks where user_id = v_dev_id;
  delete from public.sage_title_flags where user_id = v_dev_id;
  delete from public.category_share where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.going where user_id = v_dev_id;
  delete from public.trait_rolls where user_id = v_dev_id;
  delete from public.trait_roll_snapshots where user_id = v_dev_id;
  delete from public.question_bank_reroll_exclusions where user_id = v_dev_id;
  delete from public.ato_token_events where user_id = v_dev_id;
  delete from public.legend_generations where user_id = v_dev_id;
  delete from public.category_statements where user_id = v_dev_id;
  delete from public.daily_insights where user_id = v_dev_id;
  -- wave88 additions:
  delete from public.trait_answer_changes where user_id = v_dev_id;
  delete from public.trait_profile_snapshots where user_id = v_dev_id;
  delete from public.trait_answers where user_id = v_dev_id;
  delete from public.trait_flags where user_id = v_dev_id;
  delete from public.daily_pick_answers where user_id = v_dev_id;
  delete from public.daily_line_days where user_id = v_dev_id;
  delete from public.daily_line_pool where created_by = v_dev_id and source = 'ai';
  -- wave89 addition:
  delete from public.legend_museum where user_id = v_dev_id;

  -- Last: deleting me cascades dev_access_grants, dev_trace_sessions,
  -- dev_trace_events and invite_codes.owner_id. auth.users itself is untouched,
  -- so the session stays signed in and the app routes into onboarding.
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows: the wave88 body + legend_museum (cascades on account delete).
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
  + (select count(*) from public.apple_credentials where user_id = p_user_id)
  + (select count(*) from public.explore_packs where user_id = p_user_id)
  + (select count(*) from public.explore_entries where user_id = p_user_id)
  + (select count(*) from public.explore_reactions where user_id = p_user_id)
  + (select count(*) from public.ai_provider_log where user_id = p_user_id)
  + (select count(*) from public.ai_usage where user_id = p_user_id)
  + (select count(*) from public.question_packs where user_id = p_user_id)
  + (select count(*) from public.question_items where user_id = p_user_id)
  + (select count(*) from public.trait_history where user_id = p_user_id)
  + (select count(*) from public.token_events where user_id = p_user_id)
  + (select count(*) from public.trait_tracks where user_id = p_user_id)
  + (select count(*) from public.sage_title_flags where user_id = p_user_id)
  + (select count(*) from public.category_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.going where user_id = p_user_id)
  + (select count(*) from public.trait_rolls where user_id = p_user_id)
  + (select count(*) from public.trait_roll_snapshots where user_id = p_user_id)
  + (select count(*) from public.question_bank_reroll_exclusions where user_id = p_user_id)
  + (select count(*) from public.ato_token_events where user_id = p_user_id)
  + (select count(*) from public.legend_generations where user_id = p_user_id)
  + (select count(*) from public.category_statements where user_id = p_user_id)
  + (select count(*) from public.daily_insights where user_id = p_user_id)
  + (select count(*) from public.invite_codes where owner_id = p_user_id)
  + (select count(*) from public.dev_access_grants where user_id = p_user_id)
  + (select count(*) from public.dev_trace_sessions where user_id = p_user_id)
  + (select count(*) from public.dev_trace_events where user_id = p_user_id)
  -- wave88 additions:
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  -- wave89 addition:
  + (select count(*) from public.legend_museum where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
