-- wave119_pick_cutover.sql · PHASE-27 (emci 2026-10-30: there are no other users, so no slow-updater delay).
-- APPLIED 2026-10-30 (emci said "apply"; verified read-only: both functions carry 2026-11-01, anon cannot execute).
--
-- What it changes: the Pick cutover moves from 2027-02-01 to 2026-11-01. daily_pick_position and
-- answer_daily_pick are wave117's bodies restated word for word with that one date changed (in the
-- position branch and in the 14-day overlap). No data is touched, no table changes. The app side is
-- ALMANAC_PICK_CUTOVER in src/lib/daily-pick/bank.ts and must match (check:daily-pick pins both).

begin;

create or replace function public.daily_pick_position(p_ymd date)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when p_ymd < date '2026-11-01' then public.daily_pick_legacy_position(p_ymd)
    when s.n / 16 < 4 then (s.n % 16) * 4 + s.n / 16
    else 64 + (s.n % 16) * 19 + (s.n / 16 - 4)
  end
  from (select (((p_ymd - date '2026-01-01') % 368) + 368) % 368 as n) s;
$$;

create or replace function public.answer_daily_pick(p_ymd date, p_pick_id text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p record;
  v_opt jsonb;
  v_value double precision;
  v_count int;
  v_mode text;
  v_prev record;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- A local date: today somewhere on Earth, never a past or future day.
  if p_ymd is null
     or p_ymd < (timezone('utc', now()))::date - 1
     or p_ymd > (timezone('utc', now()))::date + 1 then
    raise exception 'not today' using errcode = '22023';
  end if;
  select * into p from public.daily_pick_pool where id = p_pick_id;
  if not found or not (
       p.position = public.daily_pick_position(p_ymd)
       or (p_ymd < date '2026-11-01' + 14 and p.position = public.daily_pick_legacy_position(p_ymd))
       or exists (select 1 from public.daily_pick_event_override o where o.ymd = p_ymd and o.pick_id = p.id)
     ) then
    raise exception 'not the pick for that day' using errcode = '22023';
  end if;
  if p_option_index is null or p_option_index not in (0, 1) then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  perform 1 from public.me where id = uid for update;

  -- One answer a day: a second tap returns the first answer unchanged.
  select * into v_prev from public.daily_pick_answers where user_id = uid and ymd = p_ymd;
  if found then
    return jsonb_build_object('option_index', v_prev.option_index, 'counted', v_prev.counted, 'already', true);
  end if;

  -- An event Pick has no trait: save the answer, move nothing.
  if p.axis is null then
    insert into public.daily_pick_answers (user_id, ymd, pick_id, option_index, counted)
      values (uid, p_ymd, p_pick_id, p_option_index, false);
    return jsonb_build_object('option_index', p_option_index, 'counted', false, 'already', false);
  end if;

  v_opt := p.options -> p_option_index;
  v_value := (v_opt ->> 'value')::double precision;

  select coalesce(max(answer_count), 0) into v_count
    from public.trait_tracks where user_id = uid and axis = p.axis and track = 'report';
  v_mode := case when v_count >= 3 then 'answer' else 'direct' end;

  perform public._trait_write(uid, p.axis, 'self_situation', v_value, v_mode);
  insert into public.daily_pick_answers (user_id, ymd, pick_id, option_index, counted)
    values (uid, p_ymd, p_pick_id, p_option_index, v_mode = 'answer');

  return jsonb_build_object('option_index', p_option_index, 'counted', v_mode = 'answer', 'already', false);
end;
$$;
revoke all on function public.answer_daily_pick(date,text,integer) from public, anon;
grant execute on function public.answer_daily_pick(date,text,integer) to authenticated;

commit;
