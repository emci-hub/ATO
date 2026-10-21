-- wave103: drop the leftover crisis plumbing (Step 3 of docs/master-plan.md, 2026-10-20)
-- NOT APPLIED. Apply AFTER wave102_nights_18_gate.sql (docs/under18-server.md "Apply order").
-- Needs emci's OK before it is applied: it DROPS the table public.crisis_flags, which deletes the
-- tester rows still in it (user + timestamp only, never a message). The crisis system itself was
-- removed from the app on 2026-10-14 (static HelplineRow); nothing in src/ reads or writes the
-- table or home_bootstrap's crisis_since any more (check:no-crisis-reads).
--
-- What this does, in this order (every restated function is the LATEST definition, word for word,
-- with only the crisis lines changed or removed; signature, language, security mode,
-- search_path and grants unchanged):
--   1. _library_crisis(uuid) -> _library_paused(uuid). The table it read is going away, so it can no
--      longer be true: it returns false. The three callers keep their `if ... then return ...` branch
--      and the old reason string 'crisis', so the JSON shape the phone and the Edge Function parse
--      does not change; the branch is unreachable. (Sources: wave101_under18_server_gate.sql for
--      claim_library_write, library_serve, library_want.)
--   2. home_bootstrap() without crisis_since (source: wave35_home_bootstrap.sql). An older phone
--      that still parsed crisis_since would read it as missing and treat it as no flags, which is
--      what it already did (the app stopped reading it on 2026-10-14).
--   3. reset_my_account(), reset_dev_test_user(), count_user_rows(uuid) without their crisis_flags
--      lines (sources: wave97_circle_visits.sql, wave101_under18_server_gate.sql, wave97).
--   4. DROP TABLE public.crisis_flags, then DROP FUNCTION _library_crisis(uuid).
-- No other migration, policy or view references the table (checked 2026-10-20).

begin;

-- 1. Library functions ---------------------------------------------------------------------------

create or replace function public._library_paused(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Always false: the crisis flags that used to pause the library are gone (wave103).
  select false;
$$;
revoke all on function public._library_paused(uuid) from public, anon, authenticated;

-- claim_library_write(text,text,text,text) · source: wave101_under18_server_gate.sql
create or replace function public.claim_library_write(p_kind text, p_mode text, p_bucket text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  res jsonb;
  ai jsonb;
  cap int;
  used int;
  usage_key text;
  pick uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,255}$'
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$' then
    raise exception 'invalid library request' using errcode = '22023';
  end if;

  if p_mode = 'seed' then
    perform public.require_root();
    select library_seed_daily_cap into strict cap from public.app_config where id = 1;
    usage_key := 'lib_seed';
  elsif p_mode = 'free_legend' then
    if p_kind <> 'legend' then
      raise exception 'invalid mode' using errcode = '22023';
    end if;
    select legend_free_daily_cap into strict cap from public.app_config where id = 1;
    usage_key := 'legend_free';
  elsif p_mode = 'paid' then
    usage_key := null;
  else
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  if public._library_paused(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;

  if usage_key is not null then
    perform pg_advisory_xact_lock(hashtext(uid::text || ':' || usage_key));
    insert into public.ai_usage (user_id, day, calls, by_type)
    values (uid, today, 0, '{}'::jsonb)
    on conflict (user_id, day) do nothing;
    select coalesce((by_type->>usage_key)::int, 0) into used
      from public.ai_usage where user_id = uid and day = today;
    if used >= cap then
      return jsonb_build_object('ok', false, 'reason', 'quota');
    end if;
    update public.ai_usage
      set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), array[usage_key], to_jsonb(used + 1))
      where user_id = uid and day = today;
    if p_mode = 'seed' then
      return jsonb_build_object('ok', true, 'mode', p_mode);
    end if;
  else
    res := case p_kind
      when 'deep_dive' then public.claim_category_deep_dive()
      when 'story' then public.claim_story_generate()
      else public.claim_legend_figure_story()
    end;
    if (res->>'ok')::boolean is distinct from true then
      return jsonb_build_object('ok', false, 'reason', coalesce(res->>'reason', 'quota'));
    end if;
  end if;

  -- A Legends reveal is paid for (or free) already: an unseen library card is enough.
  if p_kind = 'legend' then
    pick := public._library_pick(uid, p_kind, p_bucket, p_version);
    if pick is not null then
      return jsonb_build_object('ok', true, 'mode', p_mode, 'served', public._library_give(uid, pick));
    end if;
  end if;

  -- The shared AI cap, same as every other model call. Full = roll it all back.
  ai := public.claim_ai_call('explore');
  if (ai->>'ok')::boolean is distinct from true then
    raise exception 'ai quota' using errcode = 'P0043';
  end if;
  return jsonb_build_object('ok', true, 'mode', p_mode, 'balance', res->'balance');
end;
$$;
revoke all on function public.claim_library_write(text,text,text,text) from public, anon;
grant execute on function public.claim_library_write(text,text,text,text) to authenticated;

-- library_serve(text,text,text) · source: wave101_under18_server_gate.sql
create or replace function public.library_serve(p_kind text, p_bucket text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  usage_key text;
  used int;
  pick uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Legends are not here: a reveal is a game move with its own free/paid rule,
  -- so its library cards come through claim_library_write (below).
  if p_kind is null or p_kind not in ('deep_dive', 'story')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,255}$'
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$' then
    raise exception 'invalid library request' using errcode = '22023';
  end if;
  if public._library_paused(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;

  select library_free_daily_cap into strict cap from public.app_config where id = 1;
  usage_key := 'lib_' || p_kind;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':library'));
  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>usage_key)::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'daily');
  end if;

  pick := public._library_pick(uid, p_kind, p_bucket, p_version);
  if pick is null then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), array[usage_key], to_jsonb(used + 1))
    where user_id = uid and day = today;
  return public._library_give(uid, pick);
end;
$$;
revoke all on function public.library_serve(text,text,text) from public, anon;
grant execute on function public.library_serve(text,text,text) to authenticated;

-- library_want(text,text[],text) · source: wave101_under18_server_gate.sql
create or replace function public.library_want(p_kind text, p_buckets text[], p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  b text;
  i int := 0;
  n int := 0;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$'
     or p_buckets is null or coalesce(array_length(p_buckets, 1), 0) not between 1 and 11 then
    raise exception 'invalid library request' using errcode = '22023';
  end if;
  if public._library_paused(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;
  cap := case p_kind when 'deep_dive' then 11 when 'story' then 3 else 6 end;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':library_want'));
  -- The phone sends its groups best first: earlier in the list = newer here, so
  -- the trim below keeps the best ones (no tie between rows of one call).
  foreach b in array p_buckets loop
    i := i + 1;
    if b is null or b !~ '^[a-z0-9_|:=+,.!-]{3,255}$' then
      continue;
    end if;
    insert into public.ai_library_wanted (user_id, kind, bucket_key, version, wanted_at)
    values (uid, p_kind, b, p_version, now() - make_interval(secs => i / 1000.0))
    on conflict (user_id, kind, bucket_key) do update
      set version = excluded.version, wanted_at = excluded.wanted_at;
    n := n + 1;
  end loop;
  -- Keep only the newest `cap` groups per kind for this account.
  delete from public.ai_library_wanted w
    where w.user_id = uid and w.kind = p_kind
      and w.bucket_key not in (
        select x.bucket_key from public.ai_library_wanted x
        where x.user_id = uid and x.kind = p_kind
        order by x.wanted_at desc
        limit cap
      );
  return jsonb_build_object('ok', true, 'saved', n);
end;
$$;
revoke all on function public.library_want(text,text[],text) from public, anon;
grant execute on function public.library_want(text,text[],text) to authenticated;

-- 2. home_bootstrap without crisis_since ------------------------------------------------------------

-- home_bootstrap() · source: wave35_home_bootstrap.sql
create or replace function public.home_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_checks jsonb;
  v_tracks jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Same shape and order as fetchChecks(): every row, oldest first.
  select coalesce(jsonb_agg(to_jsonb(c) order by c.day), '[]'::jsonb)
    into v_checks
  from public.checks c
  where c.user_id = uid;

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'axis', t.axis,
             'track', t.track,
             'value', t.value,
             'stability', t.stability,
             'answer_count', t.answer_count,
             'last_touched', t.last_touched,
             'last_depth_at', t.last_depth_at
           )),
           '[]'::jsonb)
    into v_tracks
  from public.trait_tracks t
  where t.user_id = uid;

  return jsonb_build_object(
    'checks', v_checks,
    'trait_tracks', v_tracks
  );
end;
$$;

revoke all on function public.home_bootstrap() from public, anon;
grant execute on function public.home_bootstrap() to authenticated;

comment on function public.home_bootstrap() is
  'One-round-trip Home mount payload for the signed-in user: checks and trait_tracks.';

-- 3. Reset RPCs and the row count, without crisis_flags ---------------------------------------------

-- reset_my_account() · source: wave97_circle_visits.sql
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
  -- Divecore Circle visits (wave97): everything shared, both directions (my switches and my
  -- friends' switches for me; gifts I left and gifts left for me).
  delete from public.circle_gifts where user_id = uid or peer_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.circle_visit_share where user_id = uid or peer_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
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

-- reset_dev_test_user() · source: wave101_under18_server_gate.sql
create or replace function public.reset_dev_test_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev_id constant uuid := 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if auth.uid() is distinct from v_dev_id then
    raise exception 'reset_dev_test_user: only the dev-test account may call this';
  end if;
  delete from public.checks where user_id = v_dev_id;
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
  delete from public.trait_answer_changes where user_id = v_dev_id;
  delete from public.trait_profile_snapshots where user_id = v_dev_id;
  delete from public.trait_answers where user_id = v_dev_id;
  delete from public.trait_flags where user_id = v_dev_id;
  delete from public.daily_pick_answers where user_id = v_dev_id;
  delete from public.daily_line_days where user_id = v_dev_id;
  delete from public.daily_line_pool where created_by = v_dev_id and source = 'ai';
  delete from public.legend_museum where user_id = v_dev_id;
  delete from public.category_deep_dives where user_id = v_dev_id;
  delete from public.play_saves where user_id = v_dev_id;
  delete from public.circle_gifts where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.circle_visit_share where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.me where id = v_dev_id;
end;
$$;
revoke all on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows(uuid) · source: wave97_circle_visits.sql
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
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
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  + (select count(*) from public.legend_museum where user_id = p_user_id)
  + (select count(*) from public.category_deep_dives where user_id = p_user_id)
  + (select count(*) from public.play_saves where user_id = p_user_id)
  + (select count(*) from public.circle_gifts where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_visit_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

-- 4. Drop the table and the old helper --------------------------------------------------------------

drop table if exists public.crisis_flags;
drop function if exists public._library_crisis(uuid);

commit;
