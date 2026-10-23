-- wave90_category_deep_dive.sql
-- The category deep dive on Home (emci approved 2026-10-08).
--
-- Copies the wave89 Legends museum path exactly (live and tested):
--   1. category_deep_dives      per-account saved cards (one per category +
--                               leanings fingerprint), own-select RLS, written
--                               only through a security-definer RPC.
--   2. claim_category_deep_dive daily cap in app_config (default 1), counted in
--                               ai_usage.by_type. Called BEFORE generateText;
--                               the shared AI quota is still claimed inside
--                               ai-generate.
--   3. save_category_deep_dive  new rows limited to the daily cap.
--   4. reset_my_account / reset_dev_test_user / count_user_rows restated from
--                               wave89 with category_deep_dives added (pinned by
--                               scripts/reset-account-check.ts).
--
-- Additive: no existing table or row is changed. The phone keeps working if
-- this is not applied yet (no claim = no AI call; the leanings still show).

-- 1. The cards ----------------------------------------------------------------------

create table public.category_deep_dives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null check (category_id ~ '^cat_[a-z]{2,20}$'),
  leans_key text not null check (char_length(leans_key) between 1 and 400),
  story jsonb not null check (jsonb_typeof(story) = 'object' and octet_length(story::text) <= 6000),
  made_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, leans_key)
);

create index category_deep_dives_user_idx on public.category_deep_dives (user_id, created_at desc);

comment on table public.category_deep_dives is
  'Category deep dives (Home, 2026-10-08). One row per category + leanings fingerprint; story = the saved card json (AI-written, validated on the phone). A new card is written only when the leanings move.';

alter table public.category_deep_dives enable row level security;

create policy category_deep_dives_select_own on public.category_deep_dives
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.category_deep_dives from public, anon, authenticated;

-- 2. The daily claim + save ---------------------------------------------------------

alter table public.app_config
  add column if not exists category_deep_dive_daily_cap int not null default 1
    check (category_deep_dive_daily_cap >= 0);

comment on column public.app_config.category_deep_dive_daily_cap is
  'Per-user daily cap on category deep dives (one AI call each). Claimed before the vendor call.';

create or replace function public.claim_category_deep_dive()
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

  select category_deep_dive_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':category_deep_dive'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'category_deep_dive')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false, 'reason', 'quota',
      'daily', used, 'daily_cap', cap, 'call_type', 'category_deep_dive'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{category_deep_dive}', to_jsonb(used + 1))
    where user_id = uid and day = today
    returning coalesce((by_type->>'category_deep_dive')::int, 0) into used;

  return jsonb_build_object(
    'ok', true, 'daily', used, 'daily_cap', cap, 'call_type', 'category_deep_dive'
  );
end;
$$;

revoke all on function public.claim_category_deep_dive() from public, anon;
grant execute on function public.claim_category_deep_dive() to authenticated;

comment on function public.claim_category_deep_dive() is
  'Claim one category deep dive (category_deep_dive_daily_cap/day, default 1). Called once per card, BEFORE generateText/ai-generate.';

create or replace function public.save_category_deep_dive(
  p_category_id text,
  p_leans_key text,
  p_story jsonb,
  p_made_on date
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
  -- One save at a time per account, so two quick saves can't both slip past the limit.
  perform pg_advisory_xact_lock(hashtext(uid::text || ':category_deep_dives'));
  if p_category_id is null or p_category_id !~ '^cat_[a-z]{2,20}$' then
    raise exception 'invalid category_id' using errcode = '22023';
  end if;
  if p_leans_key is null or char_length(p_leans_key) not between 1 and 400 then
    raise exception 'invalid leans_key' using errcode = '22023';
  end if;
  if p_story is null or jsonb_typeof(p_story) <> 'object' or octet_length(p_story::text) > 6000 then
    raise exception 'invalid story' using errcode = '22023';
  end if;
  if p_made_on is null
     or p_made_on > (timezone('utc', now()))::date + 1
     or p_made_on < (timezone('utc', now()))::date - 1 then
    raise exception 'made_on must be today' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.category_deep_dives
    where user_id = uid and category_id = p_category_id and leans_key = p_leans_key
  ) then
    select category_deep_dive_daily_cap into strict cap from public.app_config where id = 1;
    select count(*) into added_today from public.category_deep_dives
      where user_id = uid and made_on = p_made_on;
    if added_today >= cap then
      raise exception 'daily limit' using errcode = '42501';
    end if;
  end if;

  insert into public.category_deep_dives (user_id, category_id, leans_key, story, made_on)
  values (uid, p_category_id, p_leans_key, p_story, p_made_on)
  on conflict (user_id, category_id, leans_key) do update
    set story = excluded.story
        -- made_on is kept: the first save's day counts toward the daily limit.
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_category_deep_dive(text, text, jsonb, date) from public, anon;
grant execute on function public.save_category_deep_dive(text, text, jsonb, date) to authenticated;

-- 3. Account reset / dev reset / row count, restated with category_deep_dives -------

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
  delete from public.category_deep_dives where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
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

-- reset_dev_test_user: the wave89 body + category_deep_dives. Gate and every
-- other line unchanged.
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
  -- wave90 addition:
  delete from public.category_deep_dives where user_id = v_dev_id;

  -- Last: deleting me cascades dev_access_grants, dev_trace_sessions,
  -- dev_trace_events and invite_codes.owner_id. auth.users itself is untouched,
  -- so the session stays signed in and the app routes into onboarding.
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows: the wave89 body + category_deep_dives (cascades on account delete).
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
  -- wave90 addition:
  + (select count(*) from public.category_deep_dives where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
