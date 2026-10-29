-- wave118_game_pick_no_me.sql · Quests own-number plan, D6 (emci ok 2026-10-29).
-- NOT APPLIED: emci applies it in Supabase. It does not depend on wave115/116 (they never touch _trait_write).
--
-- What it changes: a scenario pick (record_game_pick -> _trait_write mode 'game') no longer writes the
-- original me.<axis> column (any of the 16 axes), me.trait_sources[axis] or me.trait_touched_at.
-- It still moves the 'game' track (answer-mode EWMA, answer_count) and still inserts one 'self_game'
-- trait_history row, so nothing on the game side is lost. Existing me values are NOT touched (no backfill).
-- Everything else is the wave79 body, restated with exactly two condition edits:
--   1. the me update + me-diff history row now run only when p_mode <> 'game';
--   2. the 'self_game' history row is inserted for every game write (the me-diff row it used to
--      dedupe against no longer exists in game mode).
-- Same restate technique as record_game_pick (wave79 -> wave101): no data altered, no new pattern.

begin;

create or replace function public._trait_write(
  p_uid uuid,
  p_axis text,
  p_source text,
  p_sample double precision,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me jsonb;
  v_cur double precision;
  v_cur_src text;
  v_rejected boolean;
  v_merged double precision;
  v_new_me double precision;
  v_now timestamptz := now();
  v_now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_track text := case when p_mode = 'game' then 'game' else 'report' end;
  v_sample double precision;
  t record;
  s record;
  v_track_value double precision;
  v_diff_row boolean := false;
  v_found boolean;
begin
  if p_axis is null or p_axis not in (
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance', 'conflict_assertiveness',
    'conflict_cooperativeness', 'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'
  ) then
    raise exception 'unknown trait' using errcode = '22023';
  end if;

  select to_jsonb(m) into v_me from public.me m where m.id = p_uid for update;
  if v_me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_cur := nullif(v_me ->> p_axis, '')::double precision;
  v_cur_src := v_me -> 'trait_sources' ->> p_axis;

  if p_mode = 'confirm' then
    if v_cur is null then
      return;
    end if;
    update public.me
      set trait_sources = coalesce(trait_sources, '{}'::jsonb) || jsonb_build_object(p_axis, 'self_confirm'),
          trait_touched_at = coalesce(trait_touched_at, '{}'::jsonb) || jsonb_build_object(p_axis, v_now_iso)
      where id = p_uid;
    return;
  end if;

  if p_sample is null or p_sample <> p_sample then
    raise exception 'invalid value' using errcode = '22023';
  end if;

  v_rejected := v_cur is not null and public.trait_is_direct_source(v_cur_src) and not public.trait_is_direct_source(p_source);
  if v_rejected then
    v_merged := v_cur;
  elsif public.trait_is_direct_source(p_source) then
    v_merged := round(least(1::float8, greatest(0::float8, p_sample)) * 100) / 100;
  else
    v_merged := round(least(1::float8, greatest(0::float8,
      0.12::float8 * p_sample + 0.88::float8 * coalesce(v_cur, 0.5::float8))) * 100) / 100;
  end if;

  select * into t from public.trait_tracks
    where user_id = p_uid and axis = p_axis and track = v_track
    for update;
  v_found := found;

  if p_mode = 'answer' and v_rejected then
    if not v_found or t.answer_count <= 0 then
      insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
        values (p_uid, p_axis, 'report', least(1::float8, greatest(0::float8, coalesce(v_cur, p_sample))), 0, 1, v_now,
                case when v_found then t.last_depth_at else null end)
        on conflict (user_id, axis, track) do update
          set value = excluded.value, stability = 0, answer_count = 1, last_touched = excluded.last_touched;
    else
      update public.trait_tracks
        set answer_count = t.answer_count + 1, last_touched = v_now
        where user_id = p_uid and axis = p_axis and track = 'report';
    end if;
    v_new_me := v_cur;
  else
    v_sample := case when p_mode = 'direct' then v_merged else p_sample end;
    if v_found then
      s := public.trait_ewma_step(t.value::float8, t.stability::float8, t.answer_count, v_sample,
                                  case when p_mode = 'direct' then 'direct' else 'answer' end);
    else
      s := public.trait_ewma_step(null, null, 0, v_sample,
                                  case when p_mode = 'direct' then 'direct' else 'answer' end);
    end if;
    insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
      values (p_uid, p_axis, v_track, s.value, s.stability, s.answer_count, v_now,
              case when v_found then t.last_depth_at else null end)
      on conflict (user_id, axis, track) do update
        set value = excluded.value, stability = excluded.stability, answer_count = excluded.answer_count,
            last_touched = excluded.last_touched;
    v_track_value := s.value;
    if v_rejected then
      v_new_me := v_cur;
    elsif v_track = 'report' then
      v_new_me := s.value;
    else
      v_new_me := v_merged;
    end if;
  end if;

  if not v_rejected and p_mode <> 'game' then
    execute format(
      'update public.me set %I = $1, trait_sources = coalesce(trait_sources, ''{}''::jsonb) || jsonb_build_object($2, $3::text), trait_touched_at = coalesce(trait_touched_at, ''{}''::jsonb) || jsonb_build_object($2, $4::text) where id = $5',
      p_axis
    ) using v_new_me, p_axis, p_source, v_now_iso, p_uid;
    if v_new_me is not null and (v_cur is null or round(v_cur * 100) <> round(v_new_me * 100)) then
      insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_new_me, p_source);
      v_diff_row := true;
    end if;
  end if;

  if p_mode = 'game' then
    insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_track_value, 'self_game');
  end if;
  if p_mode = 'answer' and v_rejected and v_cur is not null then
    insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_cur, 'self_situation');
  end if;
end;
$$;

revoke all on function public._trait_write(uuid, text, text, double precision, text) from public, anon, authenticated;

commit;
