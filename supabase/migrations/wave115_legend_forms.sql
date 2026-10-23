-- wave115_legend_forms.sql
-- Legend history for the 64 names (trait-accuracy scoring change).
--
-- Not applied. Apply by hand with the other pending waves. No existing row
-- is rewritten: the phone archives a previous name once, the first time the
-- new score disagrees with it.
--
-- Copies the legend_museum path: own-select RLS, writes only through a
-- security-definer RPC. reset_my_account / reset_dev_test_user /
-- count_user_rows are the newest bodies plus these two tables.
--
-- A picked display name is not a row. record_legend_form takes one computed
-- code. p_archive is honoured only on the one-time migration.

create table public.legend_forms (
  user_id uuid not null references auth.users (id) on delete cascade,
  legend_id text not null check (legend_id ~ '^[HL]{3}-[HL]{3}$'),
  first_earned_at timestamptz not null,
  archived_at timestamptz,
  restored_at timestamptz,
  primary key (user_id, legend_id)
);

comment on table public.legend_forms is
  'wave115: 64-name history per account. One row per computed legend. archived_at set means a past form they have grown out of. restored_at is the last time that name matched again. A picked borderline title is never a row.';

alter table public.legend_forms enable row level security;

create policy legend_forms_select_own on public.legend_forms
  for select to authenticated using (auth.uid() = user_id);

revoke all on table public.legend_forms from public, anon, authenticated;
grant select on table public.legend_forms to authenticated;

create table public.legend_form_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  migrated_at timestamptz not null
);

comment on table public.legend_form_state is
  'wave115: the scoring migration has run for this account. A second call cannot archive a different previous name.';

alter table public.legend_form_state enable row level security;

create policy legend_form_state_select_own on public.legend_form_state
  for select to authenticated using (auth.uid() = user_id);

revoke all on table public.legend_form_state from public, anon, authenticated;
grant select on table public.legend_form_state to authenticated;

create or replace function public.record_legend_form(p_current text, p_archive text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  migrated timestamptz;
  current_id text;
  did_restore boolean := false;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_current is not null and p_current !~ '^[HL]{3}-[HL]{3}$' then
    raise exception 'bad legend' using errcode = '22023';
  end if;
  if p_archive is not null and p_archive !~ '^[HL]{3}-[HL]{3}$' then
    raise exception 'bad legend' using errcode = '22023';
  end if;

  select migrated_at into migrated from public.legend_form_state where user_id = uid;

  -- p_archive is honoured only on the one-time migration.
  if migrated is null then
    if p_archive is not null and p_archive is distinct from p_current then
      insert into public.legend_forms (user_id, legend_id, first_earned_at, archived_at)
      values (uid, p_archive, now(), now())
      on conflict (user_id, legend_id) do update
        set archived_at = coalesce(legend_forms.archived_at, excluded.archived_at);
    end if;
    if p_current is not null then
      insert into public.legend_forms (user_id, legend_id, first_earned_at, archived_at)
      values (uid, p_current, now(), null)
      on conflict (user_id, legend_id) do update
        set archived_at = null;
    end if;
    insert into public.legend_form_state (user_id, migrated_at) values (uid, now());
    return jsonb_build_object('ok', true, 'migrated', true);
  end if;

  if p_current is null then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  select legend_id into current_id
  from public.legend_forms
  where user_id = uid and archived_at is null
  limit 1;

  if current_id is not distinct from p_current then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  if current_id is not null then
    update public.legend_forms
      set archived_at = now()
      where user_id = uid and legend_id = current_id and archived_at is null;
  end if;

  if exists (select 1 from public.legend_forms where user_id = uid and legend_id = p_current and archived_at is not null) then
    update public.legend_forms
      set archived_at = null, restored_at = now()
      where user_id = uid and legend_id = p_current;
    did_restore := true;
  elsif exists (select 1 from public.legend_forms where user_id = uid and legend_id = p_current) then
    update public.legend_forms
      set archived_at = null
      where user_id = uid and legend_id = p_current;
  else
    insert into public.legend_forms (user_id, legend_id, first_earned_at, archived_at, restored_at)
    values (uid, p_current, now(), null, null);
  end if;

  return jsonb_build_object('ok', true, 'restored', did_restore);
end;
$$;

revoke all on function public.record_legend_form(text, text) from public, anon;
grant execute on function public.record_legend_form(text, text) to authenticated;

comment on function public.record_legend_form(text, text) is
  'wave115: store the one computed 64-code. The archive argument is kept only while legend_form_state has no row, so the scoring migration cannot be replayed.';

-- reset_my_account() · source: wave103_drop_crisis_plumbing.sql + legend forms
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
  delete from public.legend_forms where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.legend_form_state where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
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

-- reset_dev_test_user() · source: wave104_circle_safety.sql + legend forms
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
  delete from public.circle_requests where from_user = v_dev_id or to_user = v_dev_id;
  delete from public.legend_forms where user_id = v_dev_id;
  delete from public.legend_form_state where user_id = v_dev_id;
  delete from public.me where id = v_dev_id;
end;
$$;
revoke all on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows(uuid) · source: wave108_circle_chat.sql + legend forms
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
  + (select count(*) from public.legend_forms where user_id = p_user_id)
  + (select count(*) from public.legend_form_state where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
