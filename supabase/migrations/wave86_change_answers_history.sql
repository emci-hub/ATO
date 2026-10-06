-- wave86_change_answers_history.sql
--
-- NOT APPLIED. Written 2026-10-06 on branch feat/profile-history-cards,
-- stacked on wave85 (PR #18). Apply only after wave85 + wave85b, and only
-- after emci approves this PR.
--
-- emci 2026-10-06: Change answers + Undo replace Retest; a monthly profile
-- history that keeps only meaningful changes; every saved profile renders as
-- a collectible card. No AI anywhere. Premium gate stays OFF.
--
-- What this adds (each piece copies a path already live here):
--   trait_profile_snapshots  reasons widen to start_fresh / change_answers /
--                            monthly. Payload made lighter (_profile_payload):
--                            16 values, sources, {axis: [stability, count]},
--                            flags, answer count and the 9-letter type code.
--                            ~1.3 KB a row (measured in check:profile-history).
--   _profile_code()          the 9-letter H/L type code, the same letters
--                            src/lib/legends64/classify.ts uses (>= 0.5 is H):
--                            core C-E-O, modifier A-As-R, third G-S-P.
--   _profile_changed()       "meaningful": a pole flip, any trait moving 0.1
--                            or more, a trait appearing/disappearing, or a
--                            different type code.
--   change_bank_answer()     the first change of a visit (p_session null)
--                            saves the change_answers snapshot first, in the
--                            same transaction, and returns it as the session.
--                            Each change replaces one answered question's answer —
--                            the same delete / log / _trait_replay as wave85's
--                            retest branch — and writes the old answer rows to
--                            trait_answer_changes so Undo can put them back.
--   undo_change_session()    puts every changed answer back, restores the
--                            touched traits from the session snapshot, then
--                            deletes that snapshot (it no longer differs from
--                            the live profile, so it is not history).
--   snapshot_profiles_monthly() + pg_cron 'profile-history-monthly'
--                            on the 1st at 03:07 UTC, copying dev-trace-expire
--                            (dev_access.sql): one 'monthly' row per person
--                            per month, only when the profile meaningfully
--                            changed since their latest saved card. Nothing is
--                            ever auto-deleted.
--   start_fresh(p_keep_history default true)  keep (default) or wipe the
--                            saved cards. Wipe leaves one payload-free
--                            start_fresh marker, so wave85's "no payouts after
--                            a Start Fresh" rule still sees the reset.
--
-- Retired: Retest. serve_bank_retest loses its client grant and any open
-- retest pack is closed (its answered questions were already applied).
-- NEEDS EMCI'S OK: closing open retest packs changes existing rows (marks
-- their unanswered items skipped). Harmless before wave85 has any users.
-- answer_bank_item's retest branch stays for any in-flight call.
--
-- Tokens: nothing here pays or spends. History, Change answers and Undo can
-- never earn a token; no token function is touched.

-- 1. Snapshots: reasons, undo bookkeeping ------------------------------------

alter table public.trait_profile_snapshots drop constraint if exists trait_profile_snapshots_reason_check;
alter table public.trait_profile_snapshots add constraint trait_profile_snapshots_reason_check
  check (reason in ('start_fresh', 'change_answers', 'monthly'));

comment on table public.trait_profile_snapshots is
  'Saved profiles (wave85/86): start_fresh, change_answers (taken before the first change of a session) and monthly (only when meaningfully changed). Each renders as a card. Read-only for the owner; never auto-deleted. An empty profile ({}) is a wiped-history start_fresh marker.';

create table if not exists public.trait_answer_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_id uuid not null references public.trait_profile_snapshots (id) on delete cascade,
  axis text not null,
  question_id text not null references public.question_bank (id),
  old_rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
comment on table public.trait_answer_changes is
  'wave86: one row per Change answers edit, holding the trait_answers rows it replaced, so undo_change_session can put them back. Server-only.';
create index if not exists trait_answer_changes_snapshot_idx on public.trait_answer_changes (snapshot_id, created_at);
alter table public.trait_answer_changes enable row level security;
revoke all on table public.trait_answer_changes from public, anon, authenticated;

-- 2. Type code, payload, "meaningful change" ----------------------------------

create or replace function public._profile_code(p_values jsonb)
returns text
language sql
immutable
as $$
  select string_agg(
           case when nullif(p_values ->> axis, '')::double precision >= 0.5 then 'H' else 'L' end,
           '' order by ord)
         filter (where ord between 1 and 3)
         || '-' ||
         string_agg(
           case when nullif(p_values ->> axis, '')::double precision >= 0.5 then 'H' else 'L' end,
           '' order by ord)
         filter (where ord between 4 and 6)
         || '-' ||
         string_agg(
           case when nullif(p_values ->> axis, '')::double precision >= 0.5 then 'H' else 'L' end,
           '' order by ord)
         filter (where ord between 7 and 9)
    from unnest(array[
      'conscientiousness', 'extraversion', 'openness',
      'agreeableness', 'conflict_assertiveness', 'relatedness',
      'growth_mindset', 'steadiness', 'playfulness'
    ]) with ordinality as a(axis, ord);
$$;
revoke all on function public._profile_code(jsonb) from public, anon, authenticated;

create or replace function public._profile_payload(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select jsonb_build_object(
      'openness', round(m.openness::numeric, 3), 'conscientiousness', round(m.conscientiousness::numeric, 3),
      'extraversion', round(m.extraversion::numeric, 3), 'agreeableness', round(m.agreeableness::numeric, 3),
      'steadiness', round(m.steadiness::numeric, 3), 'attachment_anxiety', round(m.attachment_anxiety::numeric, 3),
      'attachment_avoidance', round(m.attachment_avoidance::numeric, 3),
      'conflict_assertiveness', round(m.conflict_assertiveness::numeric, 3),
      'conflict_cooperativeness', round(m.conflict_cooperativeness::numeric, 3),
      'autonomy', round(m.autonomy::numeric, 3), 'competence', round(m.competence::numeric, 3),
      'relatedness', round(m.relatedness::numeric, 3), 'growth_mindset', round(m.growth_mindset::numeric, 3),
      'locus_of_control', round(m.locus_of_control::numeric, 3),
      'self_efficacy', round(m.self_efficacy::numeric, 3), 'playfulness', round(m.playfulness::numeric, 3)
    ) as vals, coalesce(m.trait_sources, '{}'::jsonb) as sources
    from public.me m where m.id = p_uid
  )
  select jsonb_build_object(
    'values', v.vals,
    'sources', v.sources,
    'tracks', coalesce((select jsonb_object_agg(t.axis, jsonb_build_array(round(t.stability::numeric, 2), t.answer_count))
                          from public.trait_tracks t where t.user_id = p_uid and t.track = 'report'), '{}'::jsonb),
    'flags', coalesce((select jsonb_agg(f.axis order by f.axis) from public.trait_flags f where f.user_id = p_uid), '[]'::jsonb),
    'answers', (select count(*) from public.trait_answers a where a.user_id = p_uid),
    'code', public._profile_code(v.vals)
  )
  from v;
$$;
revoke all on function public._profile_payload(uuid) from public, anon, authenticated;

create or replace function public._profile_changed(p_old jsonb, p_new jsonb)
returns boolean
language sql
immutable
as $$
  select p_old is null
      or coalesce(p_old ->> 'code', '') is distinct from coalesce(p_new ->> 'code', '')
      or exists (
        select 1
          from jsonb_object_keys(coalesce(p_new -> 'values', '{}'::jsonb)) as k(axis),
               lateral (select nullif(p_old -> 'values' ->> k.axis, '')::double precision as a,
                               nullif(p_new -> 'values' ->> k.axis, '')::double precision as b) d
         where (d.a is null) <> (d.b is null)
            or (d.a is not null and d.b is not null
                and ((d.a >= 0.5) <> (d.b >= 0.5) or abs(d.b - d.a) >= 0.1))
      );
$$;
revoke all on function public._profile_changed(jsonb, jsonb) from public, anon, authenticated;

-- 3. The premium gate (still OFF) ---------------------------------------------

-- 'change_answers' replaces 'retest' (kept so an in-flight retest call still
-- reads null). Mirrors src/lib/questions/premium-gate.ts.
create or replace function public._bank_premium_price(p_action text)
returns int
language sql
immutable
as $$
  select null::int where p_action in ('change_answers', 'retest', 'start_fresh');
$$;
revoke all on function public._bank_premium_price(text) from public, anon, authenticated;

-- 4. Change answers -------------------------------------------------------------

-- The session is valid only while it is this person's newest change_answers
-- snapshot: an older session can no longer be changed or undone. Known edge:
-- a Today's Pick answered mid-session on a touched trait is rolled back by
-- Undo (the trait returns to the snapshot exactly).
create or replace function public._change_session_ok(p_uid uuid, p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce: no session row at all must read as false, never NULL (a NULL
  -- would slip past `if not ...`).
  select coalesce(
    p_session is not null
    and p_session = (
      select s.id from public.trait_profile_snapshots s
       where s.user_id = p_uid and s.reason = 'change_answers'
       order by s.created_at desc, s.id desc
       limit 1)
    -- A Start Fresh after the session ends it: Undo must never bring wiped
    -- answers back.
    and not exists (
      select 1 from public.trait_profile_snapshots f
       where f.user_id = p_uid and f.reason = 'start_fresh'
         and f.created_at > (select s.created_at from public.trait_profile_snapshots s
                              where s.id = p_session and s.user_id = p_uid)),
    false);
$$;
revoke all on function public._change_session_ok(uuid, uuid) from public, anon, authenticated;

-- The first change of a visit passes p_session = null: the Undo point is
-- saved here, in the same transaction as the change, so a failed first change
-- leaves no stray card. Later changes pass the returned session id.
create or replace function public.change_bank_answer(p_session uuid, p_question_id text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  v_opt jsonb;
  v_value double precision;
  v_unlogged int;
  v_old jsonb;
  v_session uuid := p_session;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  perform 1 from public.me where id = uid for update;
  if v_session is null then
    if not public._bank_all_done(uid) then
      raise exception 'change answers opens after all 25 sets' using errcode = 'P0001';
    end if;
    -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
    if public._bank_premium_price('change_answers') is not null then
      raise exception 'premium tokens required' using errcode = 'P0042';
    end if;
  elsif not public._change_session_ok(uid, v_session) then
    raise exception 'change session is closed' using errcode = 'P0001';
  end if;
  select * into q from public.question_bank where id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  if not exists (select 1 from public._bank_answered_ids(uid) a where a.question_id = q.id) then
    raise exception 'only an answered question can be changed' using errcode = 'P0001';
  end if;
  -- The value comes from the bank row, never from the phone.
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  if v_session is null then
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'change_answers', public._profile_payload(uid))
      returning id into v_session;
  end if;

  -- Same REPLACE as wave85's retest branch, keeping what it removes.
  select greatest(0, coalesce((select answer_count from public.trait_tracks
                                where user_id = uid and axis = q.axis and track = 'report'), 0)
                     - (select count(*) from public.trait_answers where user_id = uid and axis = q.axis))
    into v_unlogged;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_old
    from public.trait_answers a
   where a.user_id = uid and a.axis = q.axis
     and ((a.kind = 'bank' and a.question_key = q.id)
          or (a.kind = 'intake' and a.question_key = any (q.legacy_prompts)));
  delete from public.trait_answers
    where user_id = uid and axis = q.axis
      and ((kind = 'bank' and question_key = q.id)
           or (kind = 'intake' and question_key = any (q.legacy_prompts)));
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
  perform public._trait_replay(uid, q.axis, v_unlogged);
  insert into public.trait_answer_changes (user_id, snapshot_id, axis, question_id, old_rows)
    values (uid, v_session, q.axis, q.id, v_old);

  return jsonb_build_object('session', v_session);
end;
$$;
revoke all on function public.change_bank_answer(uuid, text, int) from public, anon;
grant execute on function public.change_bank_answer(uuid, text, int) to authenticated;

create or replace function public.undo_change_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_snap jsonb;
  c record;
  r jsonb;
  ax text;
  v_val double precision;
  v_cur double precision;
  v_track jsonb;
  v_n int := 0;
  v_now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._change_session_ok(uid, p_session) then
    raise exception 'change session is closed' using errcode = 'P0001';
  end if;
  select profile into v_snap from public.trait_profile_snapshots where id = p_session and user_id = uid;

  -- Answers back, newest change first: a question changed twice ends on the
  -- answer it had before the session.
  for c in
    select * from public.trait_answer_changes
     where snapshot_id = p_session and user_id = uid
     order by created_at desc, id desc
  loop
    delete from public.trait_answers
      where user_id = uid and kind = 'bank' and question_key = c.question_id;
    for r in select value from jsonb_array_elements(c.old_rows)
    loop
      insert into public.trait_answers (id, user_id, kind, question_key, axis, option_index, value, created_at)
        values ((r ->> 'id')::uuid, uid, r ->> 'kind', r ->> 'question_key', r ->> 'axis',
                (r ->> 'option_index')::int, (r ->> 'value')::numeric, (r ->> 'created_at')::timestamptz)
        on conflict (id) do nothing;
    end loop;
    v_n := v_n + 1;
  end loop;

  -- Each touched trait goes back to what the snapshot saved (values at 3
  -- decimals, stability at 2: the payload's precision).
  for ax in select distinct axis from public.trait_answer_changes where snapshot_id = p_session and user_id = uid
  loop
    v_val := nullif(v_snap -> 'values' ->> ax, '')::double precision;
    v_track := v_snap -> 'tracks' -> ax;
    if v_track is null then
      delete from public.trait_tracks where user_id = uid and axis = ax and track = 'report';
    else
      insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched)
        values (uid, ax, 'report', coalesce(v_val, 0.5), (v_track ->> 0)::double precision, (v_track ->> 1)::int, now())
        on conflict (user_id, axis, track) do update
          set value = excluded.value, stability = excluded.stability,
              answer_count = excluded.answer_count, last_touched = excluded.last_touched;
    end if;
    execute format('select %I from public.me where id = $1', ax) into v_cur using uid;
    execute format(
      'update public.me set %I = $1, trait_sources = case when $2::text is null then coalesce(trait_sources, ''{}''::jsonb) - $3 else coalesce(trait_sources, ''{}''::jsonb) || jsonb_build_object($3, $2::text) end, trait_touched_at = coalesce(trait_touched_at, ''{}''::jsonb) || jsonb_build_object($3, $4::text) where id = $5',
      ax
    ) using v_val, v_snap -> 'sources' ->> ax, ax, v_now_iso, uid;
    if v_val is not null and (v_cur is null or round(v_cur * 100) <> round(v_val * 100)) then
      insert into public.trait_history (user_id, axis, value, source)
        values (uid, ax, v_val, coalesce(v_snap -> 'sources' ->> ax, 'self_situation'));
    end if;
  end loop;

  -- The session snapshot now equals the live profile: not history. Its change
  -- rows go with it (on delete cascade).
  delete from public.trait_profile_snapshots where id = p_session and user_id = uid;

  return jsonb_build_object('ok', true, 'undone', v_n);
end;
$$;
revoke all on function public.undo_change_session(uuid) from public, anon;
grant execute on function public.undo_change_session(uuid) to authenticated;

-- 5. Retest retired --------------------------------------------------------------

revoke execute on function public.serve_bank_retest(text, int) from authenticated;
update public.question_items i set skipped_at = timezone('utc', now())
  from public.question_packs p
 where i.pack_id = p.id and p.kind = 'bank_retest'
   and i.answered_option is null and i.skipped_at is null;

-- 6. Start Fresh: keep or wipe the saved cards --------------------------------

drop function if exists public.start_fresh();

create or replace function public.start_fresh(p_keep_history boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_snapshot uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._bank_all_done(uid) then
    raise exception 'start fresh opens after all 25 sets' using errcode = 'P0001';
  end if;

  -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
  if public._bank_premium_price('start_fresh') is not null then
    raise exception 'premium tokens required' using errcode = 'P0042';
  end if;

  if coalesce(p_keep_history, true) then
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'start_fresh', public._profile_payload(uid))
      returning id into v_snapshot;
  else
    -- Wipe: every saved card goes. One payload-free marker stays so wave85's
    -- serve_bank_set still knows this account started fresh (no re-earning).
    delete from public.trait_profile_snapshots where user_id = uid;
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'start_fresh', '{}'::jsonb)
      returning id into v_snapshot;
  end if;

  -- HARD DELETE (emci 2026-10-06), exactly as wave85.
  delete from public.trait_answers where user_id = uid;
  delete from public.trait_tracks where user_id = uid and track = 'report';
  delete from public.trait_history where user_id = uid;
  delete from public.trait_flags where user_id = uid;
  delete from public.question_packs p
   where p.user_id = uid and (p.set_no is not null or p.kind = 'bank_retest')
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null);

  update public.me
    set
      openness = null, conscientiousness = null, extraversion = null, agreeableness = null,
      steadiness = null, attachment_anxiety = null, attachment_avoidance = null,
      conflict_assertiveness = null, conflict_cooperativeness = null,
      autonomy = null, competence = null, relatedness = null,
      growth_mindset = null, locus_of_control = null, self_efficacy = null, playfulness = null,
      trait_sources = '{}'::jsonb,
      trait_touched_at = '{}'::jsonb
    where id = uid;

  return jsonb_build_object('ok', true, 'snapshot_id', v_snapshot, 'kept_history', coalesce(p_keep_history, true));
end;
$$;
revoke all on function public.start_fresh(boolean) from public, anon;
grant execute on function public.start_fresh(boolean) to authenticated;

-- 7. Monthly history ----------------------------------------------------------------

-- One 'monthly' card per person per calendar month (UTC), only when the
-- profile meaningfully changed since their newest saved card (any reason;
-- wiped-history markers are skipped). Everyone with at least one answered
-- trait counts as active. Idempotent: a second run in the same month adds
-- nothing.
create or replace function public.snapshot_profiles_monthly()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  v_new jsonb;
  v_old jsonb;
  v_n int := 0;
  v_month_start timestamptz := date_trunc('month', timezone('utc', now())) at time zone 'utc';
begin
  for u in
    select distinct t.user_id
      from public.trait_tracks t
      join public.me m on m.id = t.user_id
     where t.track = 'report' and t.answer_count > 0
  loop
    if exists (select 1 from public.trait_profile_snapshots s
                where s.user_id = u.user_id and s.reason = 'monthly' and s.created_at >= v_month_start) then
      continue;
    end if;
    v_new := public._profile_payload(u.user_id);
    select s.profile into v_old
      from public.trait_profile_snapshots s
     where s.user_id = u.user_id and s.profile <> '{}'::jsonb
     order by s.created_at desc, s.id desc
     limit 1;
    if public._profile_changed(v_old, v_new) then
      insert into public.trait_profile_snapshots (user_id, reason, profile)
        values (u.user_id, 'monthly', v_new);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.snapshot_profiles_monthly() from public, anon, authenticated;

do $cron$
begin
  begin
    perform cron.unschedule('profile-history-monthly');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'profile-history-monthly',
    '7 3 1 * *',
    $job$select public.snapshot_profiles_monthly();$job$
  );
exception when others then
  raise notice 'pg_cron not available; schedule profile-history-monthly by hand: %', sqlerrm;
end
$cron$;

-- BEFORE APPLYING, CHECK:
--   1. wave85 and wave85b are applied (this file needs question_bank,
--      trait_profile_snapshots, _trait_replay and _bank_answered_ids).
--   2. select * from cron.job where jobname = 'profile-history-monthly'
--      after applying; if missing, the notice above says why.
--   3. To fill the first month right away (optional):
--      select public.snapshot_profiles_monthly();
