-- wave116_quest_runs.sql · ATO-BUILD PHASE-17 (Quests: server, Apply, Undo, flags), 2026-10-28.
-- NOT APPLIED: emci applies it in Supabase (⚑ apply wave116).
--
-- What it adds:
--   1. app_config: quests_enabled, quests_apply_enabled (both default false) and
--      quests_disabled_campaigns. Flip without a rebuild. Root passes the switches (dev override).
--   2. quest_runs: one row per finished run (summary + analytics events). Select own rows only;
--      no direct insert/update/delete for anyone: every write goes through the RPCs below.
--   3. record_quest_run: stores a finished run. Server-side 30-day rule (R09): only the first
--      as-me run of a campaign in 30 days counts; a later one is stored as for_fun.
--   4. apply_quest_result(p_run_id, p_axes [{axis, s, g}]): the R10 option A write
--      (emci 2026-10-28). It never calls _trait_write: _quest_game_write sets ONLY the quest-track
--      value, to = clamp(quest + g·(s − quest), quest ± 0.08) (no quest row yet = start at 0.5),
--      never its stability or answer_count, never the me column or trait_sources, plus one
--      self_quest history row. Quests have their own track ('quest') and history source
--      (self_quest), so they never share a row with scenario picks (game / self_game). Checks: switches, campaign, allow-list (QUEST_AXES), s ∈ [0.2, 0.8],
--      0 < g ≤ 0.25, 1–3 distinct axes, 7 days per axis (R09), the run id once (idempotent, R07).
--   5. undo_quest_result(p_run_id): within 24 h. No newer quest-track write since = put pre_values
--      back exactly (and drop the history row Apply wrote). A newer write = bounded inverse (R08):
--      take the applied delta back, never past pre ± 0.08 or [0.2, 0.8], never moving the value
--      further than Apply did. Port pinned by check:quest-apply (src/lib/quests/apply.ts).
--   6. reset_my_account / reset_dev_test_user / count_user_rows restated with quest_runs (R12);
--      delete-account cascades (user_id references auth.users on delete cascade).
-- Security (R11): every RPC is security definer, search_path = public, pg_temp, rejects a null
-- auth.uid(), then require_adult() (wave101 18+ gate), validates every jsonb field, revoked from
-- public/anon, granted to authenticated.
-- Errors are raised as 'quests:<code>' (the client maps each code to a sentence).

begin;

-- 1. app_config switches ---------------------------------------------------------------------------
alter table public.app_config
  add column if not exists quests_enabled boolean not null default false,
  add column if not exists quests_apply_enabled boolean not null default false,
  add column if not exists quests_disabled_campaigns text[] not null default '{}';

comment on column public.app_config.quests_enabled is
  'Quests on for everyone (PHASE-17). Off: the entry hides and record_quest_run refuses (root passes).';
comment on column public.app_config.quests_apply_enabled is
  'Quests Apply on (PHASE-17). Off: Apply is disabled with a kind note; apply_quest_result refuses (root passes).';
comment on column public.app_config.quests_disabled_campaigns is
  'Campaign ids switched off without a rebuild (hidden; record/apply refuse).';

-- 2. quest_runs ------------------------------------------------------------------------------------
create table public.quest_runs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id text not null check (campaign_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  content_version int not null check (content_version between 1 and 100000),
  ending_id text not null check (ending_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  for_fun boolean not null,
  applied jsonb,
  pre_values jsonb,
  stats jsonb not null,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz
);

create index quest_runs_user_campaign_idx on public.quest_runs (user_id, campaign_id, created_at desc);
create index quest_runs_user_applied_idx on public.quest_runs (user_id, applied_at desc) where applied_at is not null;

alter table public.quest_runs enable row level security;

create policy quest_runs_select_own on public.quest_runs
  for select using (user_id = auth.uid());

revoke all on public.quest_runs from public, anon, authenticated;
grant select on public.quest_runs to authenticated;

comment on table public.quest_runs is
  'One finished Quests run per row (PHASE-17). Own rows readable; writes only via record_quest_run / apply_quest_result / undo_quest_result.';

-- 3. helpers (private) -----------------------------------------------------------------------------
-- The switches: quests on (and apply on, when asked) and the campaign not disabled. Root passes the
-- two switches so emci can try Quests before they are on for everyone; a disabled campaign is off
-- for root too.
create or replace function public._quests_gate(p_campaign_id text, p_apply boolean)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c record;
begin
  select quests_enabled, quests_apply_enabled, quests_disabled_campaigns into c
    from public.app_config where id = 1;
  if not public.is_root() then
    if not coalesce(c.quests_enabled, false) then
      raise exception 'quests:quests_disabled' using errcode = 'P0001';
    end if;
    if p_apply and not coalesce(c.quests_apply_enabled, false) then
      raise exception 'quests:apply_disabled' using errcode = 'P0001';
    end if;
  end if;
  if p_campaign_id = any (coalesce(c.quests_disabled_campaigns, '{}')) then
    raise exception 'quests:campaign_disabled' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public._quests_gate(text, boolean) from public, anon, authenticated;

-- Quests keep their own track and history source (docs/quests-game-track-plan.md §5): 'quest' next to
-- 'report' and 'game' (wave21 drop/re-add pattern; wave20 stays as written), and self_quest next to the
-- 8 sources wave38 lists, so a scenario pick (game / self_game) and a Quest run never share a row and
-- Undo finds exactly the history row Apply wrote. The client TraitSource list does not include
-- self_quest, so fetchTraitHistory drops it (Quest values stay out of "How this has shifted").
alter table public.trait_tracks drop constraint if exists trait_tracks_kind;
alter table public.trait_tracks
  add constraint trait_tracks_kind check (track in ('report', 'game', 'quest'));

alter table public.trait_history drop constraint if exists trait_history_source_known;
alter table public.trait_history
  add constraint trait_history_source_known check (source in (
    'self_slider',
    'self_tap',
    'self_confirm',
    'self_settings',
    'self_scenario',
    'self_grid',
    'self_situation',
    'self_game',
    'self_quest'
  ));

-- The R10 option A write: ONLY the quest-track value (insert starts stability 0, answer_count 0;
-- an update never touches them), plus one self_quest history row. Never me, never trait_sources,
-- never the report or game track.
create or replace function public._quest_game_write(p_uid uuid, p_axis text, p_value double precision)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_value is null or p_value <> p_value or p_value < 0 or p_value > 1 then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;
  insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched)
    values (p_uid, p_axis, 'quest', p_value, 0, 0, now())
    on conflict (user_id, axis, track) do update set value = excluded.value;
  insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, p_value, 'self_quest');
end;
$$;
revoke all on function public._quest_game_write(uuid, text, double precision) from public, anon, authenticated;

-- 4. record_quest_run ------------------------------------------------------------------------------
create or replace function public.record_quest_run(
  p_run_id uuid,
  p_campaign_id text,
  p_content_version int,
  p_ending_id text,
  p_for_fun boolean,
  p_stats jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  r record;
  e jsonb;
  k text;
  v_for_fun boolean;
begin
  if uid is null then
    raise exception 'quests:not_signed_in' using errcode = '28000';
  end if;
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if p_run_id is null or p_for_fun is null
     or p_campaign_id is null or p_campaign_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_ending_id is null or p_ending_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_content_version is null or p_content_version not between 1 and 100000 then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;

  -- stats: exactly supplies, morale, renown, whole numbers 0–6.
  if p_stats is null or jsonb_typeof(p_stats) <> 'object'
     or (select count(*) from jsonb_object_keys(p_stats)) <> 3 then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;
  foreach k in array array['supplies', 'morale', 'renown'] loop
    if jsonb_typeof(p_stats -> k) is distinct from 'number'
       or (p_stats ->> k)::numeric not in (0, 1, 2, 3, 4, 5, 6) then
      raise exception 'quests:bad_input' using errcode = 'P0001';
    end if;
  end loop;

  -- events: up to 300 small objects {t, s?, c?, n?}; t from the analytics list.
  if p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) > 300 or pg_column_size(p_events) > 32768 then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;
  for e in select * from jsonb_array_elements(p_events) loop
    if jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) x where x not in ('t', 's', 'c', 'n'))
       or (e ->> 't') is null
       or (e ->> 't') not in ('quest_start', 'scene_view', 'commit', 'rewind', 'd20', 'quit', 'ending', 'said_view', 'for_fun')
       or (e ? 's' and (jsonb_typeof(e -> 's') <> 'string' or (e ->> 's') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'))
       or (e ? 'c' and (jsonb_typeof(e -> 'c') <> 'string' or (e ->> 'c') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'))
       or (e ? 'n' and (jsonb_typeof(e -> 'n') <> 'number' or (e ->> 'n')::numeric not between 0 and 1000)) then
      raise exception 'quests:bad_input' using errcode = 'P0001';
    end if;
  end loop;

  -- One account at a time: two records can't both be "the first as-me run in 30 days".
  perform pg_advisory_xact_lock(hashtext('quest_runs:' || uid::text));

  select id, user_id, for_fun into r from public.quest_runs where id = p_run_id;
  if found then
    if r.user_id is distinct from uid then
      raise exception 'quests:run_taken' using errcode = 'P0001';
    end if;
    return jsonb_build_object('ok', true, 'already', true, 'counts', not r.for_fun);
  end if;

  perform public._quests_gate(p_campaign_id, false);

  -- R09: the server's 30-day evidence rule, from quest_runs (a clock change can't move it).
  v_for_fun := p_for_fun or exists (
    select 1 from public.quest_runs q
    where q.user_id = uid and q.campaign_id = p_campaign_id and not q.for_fun
      and q.created_at > now() - interval '30 days'
  );

  insert into public.quest_runs (id, user_id, campaign_id, content_version, ending_id, for_fun, stats, events)
    values (p_run_id, uid, p_campaign_id, p_content_version, p_ending_id, v_for_fun, p_stats, p_events);

  return jsonb_build_object('ok', true, 'already', false, 'counts', not v_for_fun);
end;
$$;
revoke all on function public.record_quest_run(uuid, text, int, text, boolean, jsonb, jsonb) from public, anon;
grant execute on function public.record_quest_run(uuid, text, int, text, boolean, jsonb, jsonb) to authenticated;

-- 5. apply_quest_result ----------------------------------------------------------------------------
create or replace function public.apply_quest_result(p_run_id uuid, p_axes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  r record;
  a jsonb;
  v_axis text;
  v_s double precision;
  v_g double precision;
  v_from double precision;
  v_to double precision;
  v_found boolean;
  v_seen text[] := '{}';
  v_applied jsonb := '[]'::jsonb;
  v_pre jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'quests:not_signed_in' using errcode = '28000';
  end if;
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if p_run_id is null then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('quest_runs:' || uid::text));

  select * into r from public.quest_runs where id = p_run_id and user_id = uid for update;
  if not found then
    raise exception 'quests:run_not_found' using errcode = 'P0001';
  end if;
  -- R07: the run id is used once. A retry of the same Apply gets the stored answer, no new write.
  if r.applied_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'applied', r.applied, 'applied_at', r.applied_at);
  end if;
  if r.undone_at is not null then
    raise exception 'quests:run_used' using errcode = 'P0001';
  end if;
  if r.for_fun then
    raise exception 'quests:not_evidence' using errcode = 'P0001';
  end if;

  perform public._quests_gate(r.campaign_id, true);

  if p_axes is null or jsonb_typeof(p_axes) <> 'array' or jsonb_array_length(p_axes) < 1 then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_axes) > 3 then
    raise exception 'quests:too_many_axes' using errcode = 'P0001';
  end if;

  for a in select * from jsonb_array_elements(p_axes) loop
    if jsonb_typeof(a) <> 'object'
       or exists (select 1 from jsonb_object_keys(a) x where x not in ('axis', 's', 'g'))
       or jsonb_typeof(a -> 'axis') is distinct from 'string'
       or jsonb_typeof(a -> 's') is distinct from 'number'
       or jsonb_typeof(a -> 'g') is distinct from 'number' then
      raise exception 'quests:bad_input' using errcode = 'P0001';
    end if;
    v_axis := a ->> 'axis';
    v_s := (a ->> 's')::double precision;
    v_g := (a ->> 'g')::double precision;
    -- The Quests allow-list (src/lib/quests/types.ts QUEST_AXES).
    if v_axis not in (
      'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'conflict_assertiveness',
      'conflict_cooperativeness', 'autonomy', 'playfulness', 'self_efficacy', 'locus_of_control'
    ) then
      raise exception 'quests:axis_not_allowed' using errcode = 'P0001';
    end if;
    if v_axis = any (v_seen) or v_s not between 0.2 and 0.8 or v_g <= 0 or v_g > 0.25 then
      raise exception 'quests:bad_input' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_axis;
    -- R09: 7 days per axis, from quest_runs (an undone Apply frees the axis).
    if exists (
      select 1 from public.quest_runs q
      where q.user_id = uid and q.applied_at > now() - interval '7 days' and q.undone_at is null
        and q.applied @> jsonb_build_array(jsonb_build_object('axis', v_axis))
    ) then
      raise exception 'quests:axis_cooldown' using errcode = 'P0001';
    end if;
  end loop;

  for a in select * from jsonb_array_elements(p_axes) loop
    v_axis := a ->> 'axis';
    v_s := (a ->> 's')::double precision;
    v_g := (a ->> 'g')::double precision;
    select value::double precision into v_from from public.trait_tracks
      where user_id = uid and axis = v_axis and track = 'quest' for update;
    v_found := found;
    -- No quest row yet = start at 0.5, like score.ts.
    v_to := coalesce(v_from, 0.5) + v_g * (v_s - coalesce(v_from, 0.5));
    v_to := least(coalesce(v_from, 0.5) + 0.08, greatest(coalesce(v_from, 0.5) - 0.08, v_to));
    v_to := round(least(1::float8, greatest(0::float8, v_to))::numeric, 4)::double precision;
    perform public._quest_game_write(uid, v_axis, v_to);
    v_pre := v_pre || jsonb_build_object(v_axis, case when v_found then to_jsonb(v_from) else 'null'::jsonb end);
    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'axis', v_axis, 's', v_s, 'g', v_g, 'from', coalesce(v_from, 0.5), 'to', v_to));
  end loop;

  update public.quest_runs
    set applied = v_applied,
        pre_values = v_pre,
        applied_at = now(),
        events = events || jsonb_build_array(jsonb_build_object('t', 'apply', 'n', jsonb_array_length(v_applied)))
    where id = p_run_id;

  return jsonb_build_object('ok', true, 'already', false, 'applied', v_applied, 'applied_at', now());
end;
$$;
revoke all on function public.apply_quest_result(uuid, jsonb) from public, anon;
grant execute on function public.apply_quest_result(uuid, jsonb) to authenticated;

-- 6. undo_quest_result -----------------------------------------------------------------------------
create or replace function public.undo_quest_result(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  r record;
  a jsonb;
  v_axis text;
  v_pre double precision;
  v_had boolean;
  v_to double precision;
  v_delta double precision;
  v_cur double precision;
  v_new double precision;
  v_lo double precision;
  v_hi double precision;
  v_newer boolean;
begin
  if uid is null then
    raise exception 'quests:not_signed_in' using errcode = '28000';
  end if;
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if p_run_id is null then
    raise exception 'quests:bad_input' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('quest_runs:' || uid::text));

  select * into r from public.quest_runs where id = p_run_id and user_id = uid for update;
  if not found then
    raise exception 'quests:run_not_found' using errcode = 'P0001';
  end if;
  if r.undone_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if r.applied_at is null then
    raise exception 'quests:not_applied' using errcode = 'P0001';
  end if;
  if r.applied_at < now() - interval '24 hours' then
    raise exception 'quests:undo_expired' using errcode = 'P0001';
  end if;

  for a in select * from jsonb_array_elements(coalesce(r.applied, '[]'::jsonb)) loop
    v_axis := a ->> 'axis';
    v_to := (a ->> 'to')::double precision;
    v_delta := v_to - (a ->> 'from')::double precision;
    v_had := jsonb_typeof(r.pre_values -> v_axis) = 'number';
    v_pre := case when v_had then (r.pre_values ->> v_axis)::double precision else 0.5 end;

    select value::double precision into v_cur from public.trait_tracks
      where user_id = uid and axis = v_axis and track = 'quest' for update;
    if not found then
      continue;  -- the track is gone (a reset): nothing to take back
    end if;

    -- A newer quest-track write: the value moved, or another self_quest row landed after Apply.
    v_newer := round(v_cur::numeric, 4) <> round(v_to::numeric, 4) or exists (
      select 1 from public.trait_history h
      where h.user_id = uid and h.axis = v_axis and h.source = 'self_quest' and h.created_at > r.applied_at
    );

    if not v_newer then
      -- Put it back exactly and drop the history row Apply wrote.
      if v_had then
        update public.trait_tracks set value = v_pre
          where user_id = uid and axis = v_axis and track = 'quest';
      else
        delete from public.trait_tracks where user_id = uid and axis = v_axis and track = 'quest';
      end if;
      delete from public.trait_history
        where user_id = uid and axis = v_axis and source = 'self_quest' and created_at = r.applied_at;
    else
      -- R08 bounded inverse: take the delta back, inside pre ± 0.08 and [0.2, 0.8], never
      -- move the value further than Apply did (|new − cur| ≤ |delta|), and only ever against
      -- Apply's direction (never past the current value the way Apply went).
      v_lo := greatest(0.2, v_pre - 0.08);
      v_hi := least(0.8, v_pre + 0.08);
      v_new := least(v_hi, greatest(v_lo, v_cur - v_delta));
      v_new := least(v_cur + abs(v_delta), greatest(v_cur - abs(v_delta), v_new));
      v_new := case when v_delta >= 0 then least(v_new, v_cur) else greatest(v_new, v_cur) end;
      v_new := round(least(1::float8, greatest(0::float8, v_new))::numeric, 4)::double precision;
      perform public._quest_game_write(uid, v_axis, v_new);
    end if;
  end loop;

  update public.quest_runs
    set undone_at = now(),
        events = events || jsonb_build_array(jsonb_build_object('t', 'undo'))
    where id = p_run_id;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;
revoke all on function public.undo_quest_result(uuid) from public, anon;
grant execute on function public.undo_quest_result(uuid) to authenticated;

-- 7. Reset RPCs and the row count, + quest_runs (R12) ------------------------------------------------
-- Each body = its source + one quest_runs line, nothing else changed.

-- reset_my_account() · source: wave103_drop_crisis_plumbing.sql + quest_runs
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
  delete from public.quest_runs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;

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

-- reset_dev_test_user() · source: wave104_circle_safety.sql + quest_runs
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
  delete from public.circle_requests where from_user = v_dev_id or to_user = v_dev_id;
  delete from public.quest_runs where user_id = v_dev_id;
  delete from public.me where id = v_dev_id;
end;
$$;
revoke all on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows(uuid) · source: wave108_circle_chat.sql + quest_runs
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
  + (select count(*) from public.dev_access_grants where user_id = p_user_id or granted_by = p_user_id)
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
  + (select count(*) from public.circle_requests where from_user = p_user_id or to_user = p_user_id)
  + (select count(*) from public.circle_compare_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.ai_library_seen where user_id = p_user_id)
  + (select count(*) from public.ai_library_reports where user_id = p_user_id)
  + (select count(*) from public.ai_library_wanted where user_id = p_user_id)
  + (select count(*) from public.ai_library_cards where created_by = p_user_id)
  + (select count(*) from public.daily_line_pool where created_by = p_user_id)
  + (select count(*) from public.question_bank_pool where created_by = p_user_id)
  + (select count(*) from public.me where referred_by = p_user_id)
  + (select count(*) from public.chat_keys where user_id = p_user_id)
  + (select count(*) from public.chat_messages where sender_id = p_user_id or recipient_id = p_user_id)
  + (select count(*) from public.chat_restrictions where user_id = p_user_id)
  + (select count(*) from public.quest_runs where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

commit;
