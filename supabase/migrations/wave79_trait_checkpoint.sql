-- wave79_trait_checkpoint.sql
--
-- APPLIED 2026-10-03 to the live project (by the agent, through the Supabase
-- connector; emci approved B, 2026-10-03). Verified after: every function body's
-- md5 matches this file.
--
-- Trait checkpoint, step 1 of 2 (emci, 2026-10-03: "ok + b").
--
-- Every trait write moves onto the server. The phone no longer computes and
-- writes scores; it says what happened ("on intake question X I picked option
-- 2", "I set Curiosity to 0.75") and these functions check it and do the
-- scoring themselves, in one transaction, with the `me` row locked.
--
-- ADDITIVE ONLY. Nothing is revoked here: phones still on the previous OTA
-- keep writing directly until step 2 (wave80_trait_lock.sql, prepared, applied
-- only when emci says "lock" after the new OTA has reached phones).
--
-- What is checked:
--   * intake answers   — the question must be one of the 48 (intake_questions,
--                        generated from bank.ts), the option must exist, and
--                        it must be that trait's NEXT intake question (its
--                        report answer_count = set_no - 1). A question the
--                        trait is already past (count >= set_no) is a no-op
--                        that returns the account unchanged, so a re-sent
--                        answer (pager Retry, re-pick after Back) never
--                        double-counts and never blocks the rest of the page.
--   * round answers    — an item already answered is the same no-op.
--   * round answers    — the item must be this user's, unanswered, the option
--                        must exist; the value comes from the stored item.
--   * taps / settings  — any 0..1 (a person may set their own trait), but a
--                        tap NO LONGER COUNTS AS AN ANSWER: it moves the value,
--                        never answer_count or stability. Only questions count
--                        toward sets, settling and the +21 (emci, 2026-10-03).
--   * gut-call game    — 0.2 or 0.8 only, game track only.
--   * dev jumps        — pre-launch only (signup_mode = invite_only), own
--                        account; history rows root only. Same rule as before.
--
-- The scoring is a faithful port of the app's maths (trait-stability.ts
-- applyEwmaAnswer, traits.ts mergeTraitWrite, me.ts persistMergedTraits),
-- double precision like the phone. scripts/trait-checkpoint-check.ts pins the
-- port against golden values produced by the TypeScript functions.

-- 1. The 48 intake questions, server side ------------------------------------

create table if not exists public.intake_questions (
  prompt text primary key,
  axis text not null,
  set_no int not null check (set_no between 1 and 3),
  options jsonb not null check (jsonb_typeof(options) = 'array')
);

comment on table public.intake_questions is
  'wave79: the 48 intake questions (3 per trait), generated from src/lib/questions/bank.ts by scripts/gen-wave79-intake.ts. Read only by answer_intake_question; no client access.';

alter table public.intake_questions enable row level security;
revoke all on table public.intake_questions from public, anon, authenticated;

insert into public.intake_questions (prompt, axis, set_no, options) values
  ('Your Do today was writing down one thing you''re walking into. Was today''s version the safe pick or the different one?', 'openness', 1, '[{"text":"The different one, easily","value":0.8},{"text":"Somewhere in between","value":0.5},{"text":"The safe, familiar one","value":0.2}]'::jsonb),
  ('Same restaurant, and there is a menu item you have never tried.', 'openness', 2, '[{"text":"New one. Obviously","value":0.8},{"text":"Depends on the day","value":0.5},{"text":"I know what I like","value":0.2}]'::jsonb),
  ('A friend wants to drag you to something you would never pick yourself.', 'openness', 3, '[{"text":"I''m in, that''s the fun part","value":0.8},{"text":"I''d probably pass","value":0.2}]'::jsonb),
  ('A plan you made last week hits a boring stretch today.', 'conscientiousness', 1, '[{"text":"I still see it through","value":0.8},{"text":"I keep it if it stays easy","value":0.5},{"text":"I switch to whatever feels better","value":0.2}]'::jsonb),
  ('Something is due Friday. It is Monday.', 'conscientiousness', 2, '[{"text":"I start chipping at it now","value":0.8},{"text":"I start once it feels close","value":0.5},{"text":"Thursday night, same as always","value":0.2}]'::jsonb),
  ('You said you would do a small thing for someone and nobody followed up.', 'conscientiousness', 3, '[{"text":"I still do it","value":0.8},{"text":"It quietly disappears","value":0.2}]'::jsonb),
  ('Saturday afternoon, nobody has plans yet.', 'extraversion', 1, '[{"text":"I''d rather text a few people and make something happen","value":0.8},{"text":"Either way, I''m fine","value":0.5},{"text":"I''d rather keep the time quiet","value":0.2}]'::jsonb),
  ('You walk into a party and know maybe two people.', 'extraversion', 2, '[{"text":"I start talking to someone new","value":0.8},{"text":"I find the two I know","value":0.5},{"text":"I''m counting the minutes","value":0.2}]'::jsonb),
  ('A long week just ended.', 'extraversion', 3, '[{"text":"Going out would recharge me","value":0.8},{"text":"Being alone would recharge me","value":0.2}]'::jsonb),
  ('A group chat is picking a place you don''t really like.', 'agreeableness', 1, '[{"text":"I go along, it''s not worth a fuss","value":0.8},{"text":"I mention it once, then let it go","value":0.5},{"text":"I say I''d rather go somewhere else","value":0.2}]'::jsonb),
  ('Someone takes credit for something that was mostly yours.', 'agreeableness', 2, '[{"text":"I let it slide","value":0.8},{"text":"I mention it lightly, later","value":0.5},{"text":"I correct it on the spot","value":0.2}]'::jsonb),
  ('A stranger is clearly in the wrong and clearly having a bad day.', 'agreeableness', 3, '[{"text":"I give them the benefit of the doubt","value":0.8},{"text":"Bad day or not, wrong is wrong","value":0.2}]'::jsonb),
  ('A small thing goes wrong first thing in the morning.', 'steadiness', 1, '[{"text":"I''m mostly over it by lunch","value":0.8},{"text":"It sits with me a bit, then fades","value":0.5},{"text":"It colors the rest of the day","value":0.2}]'::jsonb),
  ('Plans change on you an hour before.', 'steadiness', 2, '[{"text":"Fine, I roll with it","value":0.8},{"text":"Mild whiplash, then fine","value":0.5},{"text":"It throws off the whole evening","value":0.2}]'::jsonb),
  ('A one-word reply lands and it could be read two ways.', 'steadiness', 3, '[{"text":"I read it plain and move on","value":0.8},{"text":"I reread it once, then let it go","value":0.5},{"text":"I reread it a few times","value":0.2}]'::jsonb),
  ('Someone you like takes a while to reply.', 'attachment_anxiety', 1, '[{"text":"I start wondering if they''re pulling away","value":0.8},{"text":"I notice, then I get on with my day","value":0.5},{"text":"I don''t think much of it","value":0.2}]'::jsonb),
  ('A close friend has been quieter than usual this week.', 'attachment_anxiety', 2, '[{"text":"I assume I did something","value":0.8},{"text":"I wonder for a second, then drop it","value":0.5},{"text":"People get busy","value":0.2}]'::jsonb),
  ('You sent a long message an hour ago. It says Read.', 'attachment_anxiety', 3, '[{"text":"I check back more than I''d admit","value":0.8},{"text":"I notice, then put the phone down","value":0.5},{"text":"I forget I sent it","value":0.2}]'::jsonb),
  ('Someone close to you wants to talk something out in person instead of over text.', 'attachment_avoidance', 1, '[{"text":"Sure, that''s fine when it matters","value":0.2},{"text":"I''d rather keep it lighter, over text","value":0.8}]'::jsonb),
  ('A rough week. Someone asks how you actually are.', 'attachment_avoidance', 2, '[{"text":"I tell them the real version","value":0.2},{"text":"I give them the short version","value":0.5},{"text":"I say I am fine and change the subject","value":0.8}]'::jsonb),
  ('Someone starts texting you good morning every day.', 'attachment_avoidance', 3, '[{"text":"I like it","value":0.2},{"text":"Nice, in small doses","value":0.5},{"text":"My replies get slower","value":0.8}]'::jsonb),
  ('You disagree with someone in the room.', 'conflict_assertiveness', 1, '[{"text":"I say so, even if it gets a little sharp","value":0.8},{"text":"I wait to see if it blows over","value":0.5},{"text":"I let it go rather than push","value":0.2}]'::jsonb),
  ('The order is wrong and the place is busy.', 'conflict_assertiveness', 2, '[{"text":"I send it back","value":0.8},{"text":"Depends how wrong","value":0.5},{"text":"I eat it","value":0.2}]'::jsonb),
  ('You want something and asking might annoy someone.', 'conflict_assertiveness', 3, '[{"text":"I ask anyway","value":0.8},{"text":"I let it go","value":0.2}]'::jsonb),
  ('When you and someone else both want different things with no obvious middle ground, who usually gives first?', 'conflict_cooperativeness', 1, '[{"text":"Probably me","value":0.8},{"text":"Depends who cares more","value":0.5},{"text":"Rarely me","value":0.2}]'::jsonb),
  ('An argument is going nowhere and it is getting late.', 'conflict_cooperativeness', 2, '[{"text":"I look for something we both can live with","value":0.8},{"text":"I park it for tomorrow","value":0.5},{"text":"I hold my line","value":0.2}]'::jsonb),
  ('The group chat is arguing and you know you''re right.', 'conflict_cooperativeness', 3, '[{"text":"I let it go to keep the chat calm","value":0.8},{"text":"I say it once, then drop it","value":0.5},{"text":"I send the link that proves it","value":0.2}]'::jsonb),
  ('Someone hands you a plan that would work fine.', 'autonomy', 1, '[{"text":"I''d still rather do it my way","value":0.8},{"text":"I''ll use theirs if it saves time","value":0.5},{"text":"I''m glad I don''t have to figure it out","value":0.2}]'::jsonb),
  ('You get told exactly how to do something you already know how to do.', 'autonomy', 2, '[{"text":"It gets under my skin","value":0.8},{"text":"I notice it, then let it go","value":0.5},{"text":"Fine by me, less to think about","value":0.2}]'::jsonb),
  ('Saturday''s calendar is empty and nobody has texted.', 'autonomy', 3, '[{"text":"Perfect, the day is mine","value":0.8},{"text":"Nice for a morning, then I make plans","value":0.5},{"text":"I start texting people for plans","value":0.2}]'::jsonb),
  ('A hard task lands on your plate.', 'competence', 1, '[{"text":"I feel like I can handle it","value":0.8},{"text":"Depends how hard, honestly","value":0.5},{"text":"I doubt I can pull it off","value":0.2}]'::jsonb),
  ('You are learning something new and you are still bad at it.', 'competence', 2, '[{"text":"I can feel myself getting better","value":0.8},{"text":"Some days it clicks","value":0.5},{"text":"I mostly feel behind","value":0.2}]'::jsonb),
  ('Someone at work says ''this is your area, right?''', 'competence', 3, '[{"text":"Fair, it is","value":0.8},{"text":"Probably, I''d double-check","value":0.5},{"text":"I''m sure they mean someone else","value":0.2}]'::jsonb),
  ('A friend cancels same-day, no real reason given.', 'relatedness', 1, '[{"text":"I''d want to talk it through","value":0.8},{"text":"I''d let it go, check in eventually","value":0.2}]'::jsonb),
  ('Something good happens to you on an ordinary Tuesday.', 'relatedness', 2, '[{"text":"I''m texting someone before I sit down","value":0.8},{"text":"It comes up next time we talk","value":0.5},{"text":"I just enjoy it","value":0.2}]'::jsonb),
  ('A whole day with no messages from anyone.', 'relatedness', 3, '[{"text":"I feel the gap","value":0.8},{"text":"Bliss","value":0.2}]'::jsonb),
  ('You try something new and it goes badly the first time. What actually happens next?', 'growth_mindset', 1, '[{"text":"I look at what I''d do differently","value":0.8},{"text":"I probably don''t try that again","value":0.2}]'::jsonb),
  ('Someone is much better than you at a thing you care about.', 'growth_mindset', 2, '[{"text":"I want to know how they got there","value":0.8},{"text":"Good for them, different lane","value":0.5},{"text":"Some people just have it","value":0.2}]'::jsonb),
  ('A friend posts day 60 of learning something new.', 'growth_mindset', 3, '[{"text":"Give me 60 days and I could too","value":0.8},{"text":"Depends on the thing","value":0.5},{"text":"Some people are just built for it","value":0.2}]'::jsonb),
  ('A plan you were in on falls apart.', 'locus_of_control', 1, '[{"text":"I look first at what I might have done differently","value":0.8},{"text":"Some of it was me, some of it wasn''t","value":0.5},{"text":"It was bound to happen","value":0.2}]'::jsonb),
  ('A good week. Where does the credit actually go?', 'locus_of_control', 2, '[{"text":"Mostly to what I did","value":0.8},{"text":"A bit of both","value":0.5},{"text":"Mostly to how things fell","value":0.2}]'::jsonb),
  ('Someone asks how next year''s looking.', 'locus_of_control', 3, '[{"text":"Mostly up to what I do","value":0.8},{"text":"Half me, half luck","value":0.5},{"text":"Depends what happens","value":0.2}]'::jsonb),
  ('Everyone at the table already knows their order. You don''t.', 'self_efficacy', 1, '[{"text":"I panic-order whatever''s closest","value":0.2},{"text":"Takes me a sec but I land on something","value":0.5},{"text":"I ask what everyone else got","value":0.8}]'::jsonb),
  ('Something breaks and you have never fixed one before.', 'self_efficacy', 2, '[{"text":"I''ll figure it out","value":0.8},{"text":"I look it up first","value":0.5},{"text":"I find someone who knows","value":0.2}]'::jsonb),
  ('A big task has sat in your to-do app for two weeks.', 'self_efficacy', 3, '[{"text":"I pick any piece and start","value":0.8},{"text":"I break it down, then wait a bit","value":0.5},{"text":"I keep moving it to tomorrow","value":0.2}]'::jsonb),
  ('A dull stretch with nothing required of you.', 'playfulness', 1, '[{"text":"I''d mess around and see what happens","value":0.8},{"text":"Either way, I am fine","value":0.5},{"text":"I''d rather just get through it","value":0.2}]'::jsonb),
  ('A serious conversation hits a genuinely funny moment.', 'playfulness', 2, '[{"text":"I take the joke","value":0.8},{"text":"Depends who is in the room","value":0.5},{"text":"I keep it serious","value":0.2}]'::jsonb),
  ('The group chat has a running joke.', 'playfulness', 3, '[{"text":"I started it","value":0.8},{"text":"I keep it going","value":0.5},{"text":"I just react with a laugh","value":0.2}]'::jsonb)
on conflict (prompt) do nothing;

-- 2. The answer log -------------------------------------------------------------

create table if not exists public.trait_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('intake', 'round')),
  question_key text not null,
  axis text not null,
  option_index int not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

comment on table public.trait_answers is
  'wave79: every question answer the server accepted (intake by prompt, round by question_items.id). Written only by answer_intake_question / answer_round_item.';

create index if not exists trait_answers_user_idx on public.trait_answers (user_id, created_at desc);

alter table public.trait_answers enable row level security;
drop policy if exists trait_answers_select_own on public.trait_answers;
create policy trait_answers_select_own on public.trait_answers
  for select to authenticated using (auth.uid() = user_id);
revoke all on table public.trait_answers from public, anon, authenticated;
grant select on table public.trait_answers to authenticated;

-- 3. The maths ----------------------------------------------------------------------

create or replace function public.trait_is_direct_source(p_source text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_source in ('self_slider', 'self_tap', 'self_confirm', 'self_settings', 'self_scenario'), false);
$$;

-- applyEwmaAnswer (mode 'answer') and the tap rule (mode 'direct': the value
-- moves the same way, answer_count and stability do not).
create or replace function public.trait_ewma_step(
  p_value double precision,
  p_stability double precision,
  p_count int,
  p_sample double precision,
  p_mode text,
  out value double precision,
  out stability double precision,
  out answer_count int
)
language plpgsql
immutable
as $$
declare
  v_signal double precision := least(1::float8, greatest(0::float8, p_sample));
  v_alpha double precision := 0.35::float8;
  v_agree double precision;
  v_prior double precision;
  v_gain double precision;
begin
  if p_count is null or p_count <= 0 then
    value := v_signal;
    stability := 0;
    answer_count := case when p_mode = 'direct' then 0 else 1 end;
    return;
  end if;
  v_agree := 1::float8 - least(1::float8, greatest(0::float8, abs(v_signal - p_value) / 0.5::float8));
  v_prior := greatest(0.05::float8, 1::float8 - p_stability);
  v_gain := v_prior / (v_prior + (1::float8 - v_alpha) / v_alpha);
  value := least(1::float8, greatest(0::float8, p_value + v_gain * (v_signal - p_value)));
  if p_mode = 'direct' then
    stability := p_stability;
    answer_count := p_count;
  else
    stability := least(1::float8, greatest(0::float8, v_alpha * v_agree + (1::float8 - v_alpha) * p_stability));
    answer_count := p_count + 1;
  end if;
end;
$$;

-- One trait write: merge into me, step the track, log history. Inside:
--   mergeTraitWrite — direct is sticky over inferred (only while the trait
--     HAS a value: a leftover direct label on an empty trait, e.g. after a
--     reset, never blocks it); direct full-replaces,
--     inferred blends 0.12 * signal + 0.88 * prior (0.5 when unset); 2 dp.
--   an answer on a direct-owned trait is count-only (applyCountOnlyAnswer).
--   taps step with the merged (2 dp) value; answers and the game with the raw one.
--   the me column mirrors the report track; the game track never overrides me.
--   history: a row when the 2-dp value moved, plus persistMergedTraits' two
--     explicit rows (game, count-only).
--   answer_intake_question locks the account before reading the count, so two
--     answers cannot both read the same count.
-- Modes:
--   'answer'  a question answer (self_situation): report track, counts
--   'direct'  a tap / setting (self_tap, self_settings, self_scenario): report
--             track value only, never counts
--   'game'    gut-call (self_game): game track, counts on the game track
--   'confirm' upgrade the source to self_confirm, number unchanged
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

  if not v_rejected then
    execute format(
      'update public.me set %I = $1, trait_sources = coalesce(trait_sources, ''{}''::jsonb) || jsonb_build_object($2, $3::text), trait_touched_at = coalesce(trait_touched_at, ''{}''::jsonb) || jsonb_build_object($2, $4::text) where id = $5',
      p_axis
    ) using v_new_me, p_axis, p_source, v_now_iso, p_uid;
    if v_new_me is not null and (v_cur is null or round(v_cur * 100) <> round(v_new_me * 100)) then
      insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_new_me, p_source);
      v_diff_row := true;
    end if;
  end if;

  if p_mode = 'game' and not (v_diff_row and p_source = 'self_game') then
    insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_track_value, 'self_game');
  end if;
  if p_mode = 'answer' and v_rejected and v_cur is not null then
    insert into public.trait_history (user_id, axis, value, source) values (p_uid, p_axis, v_cur, 'self_situation');
  end if;
end;
$$;

revoke all on function public._trait_write(uuid, text, text, double precision, text) from public, anon, authenticated;
revoke all on function public.trait_ewma_step(double precision, double precision, int, double precision, text) from public, anon, authenticated;
revoke all on function public.trait_is_direct_source(text) from public, anon, authenticated;

-- 4. The checkpoints -------------------------------------------------------------

create or replace function public.answer_intake_question(p_prompt text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  v_opt jsonb;
  v_count int;
  v_value double precision;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into q from public.intake_questions where prompt = p_prompt;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  perform 1 from public.me where id = uid for update;
  select coalesce(max(answer_count), 0) into v_count
    from public.trait_tracks where user_id = uid and axis = q.axis and track = 'report';
  if v_count >= q.set_no then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if v_count <> q.set_no - 1 then
    raise exception 'question not open' using errcode = '22023';
  end if;

  perform public._trait_write(uid, q.axis, 'self_situation', v_value, 'answer');
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'intake', p_prompt, q.axis, p_option_index, v_value);

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

create or replace function public.answer_round_item(p_item_id uuid, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it record;
  v_opt jsonb;
  v_value double precision;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  select * into it from public.question_items
    where id = p_item_id and user_id = uid
    for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if it.answered_at is not null then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if it.skipped_at is not null then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  v_opt := it.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  update public.question_items
    set answered_option = p_option_index, answered_at = timezone('utc', now())
    where id = p_item_id;
  perform public._trait_write(uid, it.axis, 'self_situation', v_value, 'answer');
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'round', p_item_id::text, it.axis, p_option_index, v_value);

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

create or replace function public.set_trait_direct(p_axis text, p_value double precision, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_source is null or p_source not in ('self_tap', 'self_settings', 'self_scenario') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_value is null or p_value < 0 or p_value > 1 then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  perform public._trait_write(uid, p_axis, p_source, p_value, 'direct');
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

create or replace function public.record_game_pick(p_axis text, p_value double precision)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_value is null or p_value not in (0.2::float8, 0.8::float8) then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  perform public._trait_write(uid, p_axis, 'self_game', p_value, 'game');
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

create or replace function public.confirm_trait_sources(p_axes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_axis text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  foreach v_axis in array coalesce(p_axes, '{}'::text[]) loop
    perform public._trait_write(uid, v_axis, 'self_confirm', null, 'confirm');
  end loop;
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;

create or replace function public.stamp_axis_depth(p_axis text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.trait_tracks set last_depth_at = now()
    where user_id = uid and axis = p_axis;
end;
$$;

-- Dev "Jump this account": pre-launch only, own account. The rows are the
-- client's faithful replay (dev-intake-stages.ts devIntakeTracks); history
-- rows only for root, as before. Refuses once sign-up is public.
create or replace function public.apply_dev_trait_preset(
  p_values jsonb,
  p_sources jsonb,
  p_touched jsonb,
  p_tracks jsonb,
  p_history jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
  v_axis text;
  r jsonb;
  v_axes text[] := array[
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance', 'conflict_assertiveness',
    'conflict_cooperativeness', 'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'dev jumps are disabled once sign-up is public' using errcode = '42501';
  end if;
  if jsonb_typeof(p_values) <> 'object' or jsonb_typeof(p_sources) <> 'object'
     or jsonb_typeof(p_touched) <> 'object' or jsonb_typeof(p_tracks) <> 'array'
     or jsonb_typeof(coalesce(p_history, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid preset' using errcode = '22023';
  end if;

  perform 1 from public.me where id = uid for update;
  foreach v_axis in array v_axes loop
    execute format('update public.me set %I = $1 where id = $2', v_axis)
      using nullif(p_values ->> v_axis, '')::numeric, uid;
  end loop;
  update public.me set trait_sources = p_sources, trait_touched_at = p_touched where id = uid;

  for r in select * from jsonb_array_elements(p_tracks) loop
    if not (r ->> 'axis' = any (v_axes)) or (r ->> 'track') not in ('report', 'game') then
      raise exception 'invalid track row' using errcode = '22023';
    end if;
    insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
      values (uid, r ->> 'axis', r ->> 'track', (r ->> 'value')::numeric, (r ->> 'stability')::numeric,
              (r ->> 'answer_count')::int, coalesce(nullif(r ->> 'last_touched', '')::timestamptz, now()),
              nullif(r ->> 'last_depth_at', '')::timestamptz)
      on conflict (user_id, axis, track) do update
        set value = excluded.value, stability = excluded.stability, answer_count = excluded.answer_count,
            last_touched = excluded.last_touched, last_depth_at = excluded.last_depth_at;
  end loop;

  if public.is_root() then
    for r in select * from jsonb_array_elements(coalesce(p_history, '[]'::jsonb)) loop
      if not (r ->> 'axis' = any (v_axes)) then
        raise exception 'invalid history row' using errcode = '22023';
      end if;
      insert into public.trait_history (user_id, axis, value, source)
        values (uid, r ->> 'axis', (r ->> 'value')::numeric, r ->> 'source');
    end loop;
  end if;
end;
$$;

revoke all on function public.answer_intake_question(text, int) from public, anon;
revoke all on function public.answer_round_item(uuid, int) from public, anon;
revoke all on function public.set_trait_direct(text, double precision, text) from public, anon;
revoke all on function public.record_game_pick(text, double precision) from public, anon;
revoke all on function public.confirm_trait_sources(text[]) from public, anon;
revoke all on function public.stamp_axis_depth(text) from public, anon;
revoke all on function public.apply_dev_trait_preset(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.answer_intake_question(text, int) to authenticated;
grant execute on function public.answer_round_item(uuid, int) to authenticated;
grant execute on function public.set_trait_direct(text, double precision, text) to authenticated;
grant execute on function public.record_game_pick(text, double precision) to authenticated;
grant execute on function public.confirm_trait_sources(text[]) to authenticated;
grant execute on function public.stamp_axis_depth(text) to authenticated;
grant execute on function public.apply_dev_trait_preset(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
