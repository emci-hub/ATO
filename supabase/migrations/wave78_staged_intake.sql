-- wave78_staged_intake.sql
--
-- APPLIED 2026-10-02 to the live project (by the agent, through the Supabase
-- connector; approved in emci's brief). Verified after: 70 authored pool rows
-- (50 + 20), both claim functions security definer with the new rules.
--
-- Staged intake (emci, 2026-10-02): the intake is 48 = 3 per
-- trait, asked as 3 sets of 16, and ongoing rounds are 16, allocated per trait
-- by the adaptive rule (src/lib/questions/tiered-axis-plan.ts allocateRound).
--
-- Approved changes to existing server code (emci, in the brief):
--
-- 1. claim_full_profile_complete (wave52) — the +21 for finishing the intake.
--    It counted 50 `self_situation` trait_history rows. trait_history writes a
--    row only when a value changes, so it is not one row per answer, and a
--    48-answer intake could never reach 50. It now pays when ANY of:
--      a. every one of the 16 traits has 3+ answers on its report track
--         (trait_tracks.answer_count — the same count the app's stage reads).
--         A client can upsert its own trait_tracks rows (wave20 own-row RLS),
--         just as it could insert the 50 history rows the old rule counted,
--         so this is no new exposure; the payout stays once ever;
--      b. the account filled the OLD tiered 50 (each trait counted up to its
--         old size: 6/6/6, 4/4/4, 2 on the other ten — the app's
--         finishedLegacyIntake);
--      c. the old rule: 50 `self_situation` history rows.
--    b and c keep every account that qualified before able to claim. The
--    once-ever insert, the lock and the balance write are unchanged.
--
-- 2. claim_ongoing_round_complete (wave52) — the +21 per round. It required
--    exactly 25 items. A round is now 16; a round of 25 started before this
--    change still pays. Every other rule is unchanged (owner, every item
--    genuinely answered, once per pack).
--
-- 3. 20 new authored question_bank_pool rows (wave49 style, generated from
--    bank.ts by scripts/gen-wave78-rows.ts): the ten restored third intake
--    questions and the ten original wordings they were rewritten from. The
--    twelve extras that left the intake are already in the pool (wave49).
--    `on conflict (prompt) do nothing`.
--
-- No existing row is altered or deleted. No table, column or policy changes.

-- 1. claim_full_profile_complete ----------------------------------------------

create or replace function public.claim_full_profile_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 21;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_full_axes int;
  v_legacy_answered int;
  v_answer_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- a. every trait has its 3 (staged intake)
  select count(*) into v_full_axes
  from public.trait_tracks
  where user_id = uid and track = 'report' and answer_count >= 3;

  -- b. the old tiered 50, each trait capped at its old size
  select coalesce(sum(least(t.answer_count, l.old_count)), 0) into v_legacy_answered
  from (values
    ('openness', 6), ('conscientiousness', 6), ('extraversion', 6),
    ('agreeableness', 4), ('steadiness', 2), ('attachment_anxiety', 2),
    ('attachment_avoidance', 2), ('conflict_assertiveness', 4),
    ('conflict_cooperativeness', 2), ('autonomy', 2), ('competence', 2),
    ('relatedness', 4), ('growth_mindset', 2), ('locus_of_control', 2),
    ('self_efficacy', 2), ('playfulness', 2)
  ) as l(axis, old_count)
  join public.trait_tracks t
    on t.user_id = uid and t.track = 'report' and t.axis = l.axis;

  -- c. the wave52 rule, kept
  select count(*) into v_answer_count
  from public.trait_history
  where user_id = uid and source = 'self_situation';

  if v_full_axes < 16 and v_legacy_answered < 50 and v_answer_count < 50 then
    raise exception 'full profile not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'full_profile_complete', today)
  on conflict (user_id) where reason = 'full_profile_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'full_profile_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'full_profile_complete'
  );
end;
$$;

-- 2. claim_ongoing_round_complete ---------------------------------------------

create or replace function public.claim_ongoing_round_complete(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 21;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_pack_owner uuid;
  v_total_items int;
  v_unanswered int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_pack_owner
  from public.question_packs
  where id = p_pack_id and kind = 'ongoing_round';
  if v_pack_owner is null or v_pack_owner is distinct from uid then
    raise exception 'pack not found' using errcode = '22023';
  end if;

  -- A round is 16 (staged intake). A round of 25 from before still pays.
  select count(*) into v_total_items
  from public.question_items
  where pack_id = p_pack_id;
  if v_total_items < 16 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  select count(*) into v_unanswered
  from public.question_items
  where pack_id = p_pack_id and answered_option is null;
  if v_unanswered > 0 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, pack_id, local_day)
  values (uid, amount, 'ongoing_round_complete', p_pack_id, today)
  on conflict (user_id, pack_id) where reason = 'ongoing_round_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'ongoing_round_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  update public.question_packs
    set completed_at = now()
    where id = p_pack_id and completed_at is null;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'ongoing_round_complete'
  );
end;
$$;

-- 3. The 20 authored pool rows (generated by scripts/gen-wave78-rows.ts) -------

insert into public.question_bank_pool (axis, category, prompt, options, source) values
  ('steadiness', 'cat_steadiness', 'A one-word reply lands and it could be read two ways.', '[{"text":"I read it plain and move on","value":0.8},{"text":"I reread it once, then let it go","value":0.5},{"text":"I reread it a few times","value":0.2}]'::jsonb, 'authored'),
  ('attachment_anxiety', 'cat_love', 'You sent a long message an hour ago. It says Read.', '[{"text":"I check back more than I''d admit","value":0.8},{"text":"I notice, then put the phone down","value":0.5},{"text":"I forget I sent it","value":0.2}]'::jsonb, 'authored'),
  ('attachment_avoidance', 'cat_love', 'Someone starts texting you good morning every day.', '[{"text":"I like it","value":0.2},{"text":"Nice, in small doses","value":0.5},{"text":"My replies get slower","value":0.8}]'::jsonb, 'authored'),
  ('conflict_cooperativeness', 'cat_communication', 'The group chat is arguing and you know you''re right.', '[{"text":"I let it go to keep the chat calm","value":0.8},{"text":"I say it once, then drop it","value":0.5},{"text":"I send the link that proves it","value":0.2}]'::jsonb, 'authored'),
  ('autonomy', 'cat_drive', 'Saturday''s calendar is empty and nobody has texted.', '[{"text":"Perfect, the day is mine","value":0.8},{"text":"Nice for a morning, then I make plans","value":0.5},{"text":"I start texting people for plans","value":0.2}]'::jsonb, 'authored'),
  ('competence', 'cat_drive', 'Someone at work says ''this is your area, right?''', '[{"text":"Fair, it is","value":0.8},{"text":"Probably, I''d double-check","value":0.5},{"text":"I''m sure they mean someone else","value":0.2}]'::jsonb, 'authored'),
  ('growth_mindset', 'cat_agency', 'A friend posts day 60 of learning something new.', '[{"text":"Give me 60 days and I could too","value":0.8},{"text":"Depends on the thing","value":0.5},{"text":"Some people are just built for it","value":0.2}]'::jsonb, 'authored'),
  ('locus_of_control', 'cat_agency', 'Someone asks how next year''s looking.', '[{"text":"Mostly up to what I do","value":0.8},{"text":"Half me, half luck","value":0.5},{"text":"Depends what happens","value":0.2}]'::jsonb, 'authored'),
  ('self_efficacy', 'cat_agency', 'A big task has sat in your to-do app for two weeks.', '[{"text":"I pick any piece and start","value":0.8},{"text":"I break it down, then wait a bit","value":0.5},{"text":"I keep moving it to tomorrow","value":0.2}]'::jsonb, 'authored'),
  ('playfulness', 'cat_social', 'The group chat has a running joke.', '[{"text":"I started it","value":0.8},{"text":"I keep it going","value":0.5},{"text":"I just react with a laugh","value":0.2}]'::jsonb, 'authored'),
  ('steadiness', 'cat_steadiness', 'Someone sends a short reply that could be read two ways.', '[{"text":"I read it the plain way and move on","value":0.8},{"text":"I reread it a few times","value":0.2}]'::jsonb, 'authored'),
  ('attachment_anxiety', 'cat_love', 'You need reassurance more often than you would like to admit.', '[{"text":"Yeah, that lands","value":0.8},{"text":"Not really me","value":0.2}]'::jsonb, 'authored'),
  ('attachment_avoidance', 'cat_love', 'Things are getting closer with someone.', '[{"text":"I lean in","value":0.2},{"text":"I want a bit of room","value":0.8}]'::jsonb, 'authored'),
  ('conflict_cooperativeness', 'cat_communication', 'Winning the point matters more than keeping the peace.', '[{"text":"Not for me, usually","value":0.8},{"text":"Honestly, sometimes yes","value":0.2}]'::jsonb, 'authored'),
  ('autonomy', 'cat_drive', 'A free day with nothing scheduled and nobody asking anything of you.', '[{"text":"That is the best kind of day","value":0.8},{"text":"I''d rather have a plan","value":0.2}]'::jsonb, 'authored'),
  ('competence', 'cat_drive', 'Someone says you are good at something you do a lot.', '[{"text":"Yeah, I think so too","value":0.8},{"text":"I brush it off","value":0.2}]'::jsonb, 'authored'),
  ('growth_mindset', 'cat_agency', 'You can get noticeably better at almost anything with enough reps.', '[{"text":"I believe that","value":0.8},{"text":"Only up to a point","value":0.2}]'::jsonb, 'authored'),
  ('locus_of_control', 'cat_agency', 'How next year goes is mostly up to you.', '[{"text":"Mostly, yes","value":0.8},{"text":"Timing decides more than I do","value":0.2}]'::jsonb, 'authored'),
  ('self_efficacy', 'cat_agency', 'A big thing you have to do, and no obvious first step.', '[{"text":"I start somewhere and adjust","value":0.8},{"text":"I stall until it gets urgent","value":0.2}]'::jsonb, 'authored'),
  ('playfulness', 'cat_social', 'People would say you are one of the sillier people they know.', '[{"text":"That tracks","value":0.8},{"text":"Not the word they would use","value":0.2}]'::jsonb, 'authored')
on conflict (prompt) do nothing;
