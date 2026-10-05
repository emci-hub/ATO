-- wave82_daily_pick.sql
--
-- APPLIED 2026-10-05 to the live project (by the agent, through the Supabase
-- connector; emci approved the split function). Verified: 64 pool rows, and
-- daily_pick_position gives the same pick as the app (2026-10-05 = p22,
-- 2026-10-06 = p26). The pool rows below are kept in step with the app list;
-- three answer texts (p14, p46, p63) were reworded live by wave83, and the
-- split function was replaced there (one day, rounded to 5%).
--
-- Today's Pick (emci, 2026-10-05): one either/or question a day, the same for
-- everyone, answered with one tap. Replaces the daily line on Home.
--
-- COPIES a tested path (wave77 daily_line_pool / daily_line_days): an
-- authored pool every signed-in account can read, one row per user per day
-- that only the owner can read, and every write through a definer RPC.
--
-- ONE NEW KIND OF THING, approved by emci 2026-10-05: daily_pick_split, the
-- first function that counts across accounts. It returns ONLY two totals for
-- one pick, never who picked what; only to someone who has answered that
-- pick; and nothing at all under 20 answers, so a small invite-only group can
-- never be read back to a person.
--
-- Trait write: through the wave79 checkpoint helper `_trait_write`, source
-- self_situation. It counts as a real answer ('answer') only on a trait whose
-- three intake answers are done; before that it moves the value without
-- counting ('direct', like a tap) so it can never jump the intake order
-- (answer_intake_question needs answer_count = set_no - 1).
--
-- Everything is additive. No existing table, function or row is touched.
-- Account deletion needs nothing extra: daily_pick_answers cascades with
-- auth.users. The phone keeps working if this is not applied (it shows the
-- pick and the reaction from its own copy; the answer just is not saved).

-- 1. The pool (generated from src/lib/daily-pick/bank.ts by
--    scripts/gen-wave82-picks.ts) -------------------------------------------

create table public.daily_pick_pool (
  id text primary key check (id ~ '^p[0-9]{2,3}$'),
  position int not null unique check (position >= 0),
  axis text not null,
  prompt text not null check (char_length(prompt) between 1 and 200),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 2),
  created_at timestamptz not null default now()
);

alter table public.daily_pick_pool enable row level security;

create policy daily_pick_pool_select_auth on public.daily_pick_pool
  for select to authenticated
  using (true);

grant select on public.daily_pick_pool to authenticated;
revoke insert, update, delete on public.daily_pick_pool from public, anon, authenticated;
revoke all on public.daily_pick_pool from anon;

insert into public.daily_pick_pool (id, position, axis, prompt, options) values
  ('p01', 0, 'openness', 'The group chat suggests a restaurant none of you can pronounce.', '[{"text":"I’m in","value":0.8},{"text":"Our usual place?","value":0.2}]'::jsonb),
  ('p02', 1, 'openness', 'Your playlist ended and autoplay picked a song you’ve never heard.', '[{"text":"Back to my songs","value":0.2},{"text":"Let it play","value":0.8}]'::jsonb),
  ('p03', 2, 'openness', 'A friend sends a 40-minute video essay at midnight.', '[{"text":"Watching it now","value":0.8},{"text":"Saved for never","value":0.2}]'::jsonb),
  ('p04', 3, 'openness', 'The app you open every day just redesigned everything.', '[{"text":"Where did it all go","value":0.2},{"text":"Ooh, new buttons","value":0.8}]'::jsonb),
  ('p05', 4, 'conscientiousness', 'Sunday night. Monday’s calendar is already three colors.', '[{"text":"Plan the week now","value":0.8},{"text":"Monday’s problem","value":0.2}]'::jsonb),
  ('p06', 5, 'conscientiousness', 'You told someone you’d reply to their long email “later.”', '[{"text":"Later is a feeling","value":0.2},{"text":"Reminder set","value":0.8}]'::jsonb),
  ('p07', 6, 'conscientiousness', 'The trip is in two weeks. The group chat has zero plans.', '[{"text":"Starting the doc","value":0.8},{"text":"We’ll figure it out","value":0.2}]'::jsonb),
  ('p08', 7, 'conscientiousness', 'Your phone says 2% and the charger is in another room.', '[{"text":"See how far it goes","value":0.2},{"text":"Go get it","value":0.8}]'::jsonb),
  ('p09', 8, 'extraversion', 'Someone in the group chat asks, “who’s around tonight?”', '[{"text":"Me!","value":0.8},{"text":"Typed it, deleted it","value":0.2}]'::jsonb),
  ('p10', 9, 'extraversion', 'Plans got cancelled an hour before.', '[{"text":"A quiet win","value":0.2},{"text":"Who else is free?","value":0.8}]'::jsonb),
  ('p11', 10, 'extraversion', 'A four-minute voice note arrives.', '[{"text":"Calling them back","value":0.8},{"text":"Reading the transcript","value":0.2}]'::jsonb),
  ('p12', 11, 'extraversion', 'You walk into a party and know exactly one person.', '[{"text":"Stuck to that person","value":0.2},{"text":"New people, let’s go","value":0.8}]'::jsonb),
  ('p13', 12, 'agreeableness', 'Everyone wants pizza. You wanted literally anything else.', '[{"text":"Pizza’s fine","value":0.8},{"text":"Counteroffer: tacos","value":0.2}]'::jsonb),
  ('p14', 13, 'agreeableness', 'A friend asks if their new haircut looks good. It doesn’t.', '[{"text":"The honest answer","value":0.2},{"text":"Something kind and true","value":0.8}]'::jsonb),
  ('p15', 14, 'agreeableness', 'The group picks a movie you’ve already seen twice.', '[{"text":"Third time it is","value":0.8},{"text":"Pitch another one","value":0.2}]'::jsonb),
  ('p16', 15, 'agreeableness', 'Someone reheats fish in the office microwave.', '[{"text":"Say something","value":0.2},{"text":"Let it go","value":0.8}]'::jsonb),
  ('p17', 16, 'steadiness', 'Your boss sends “got a minute?” with no context.', '[{"text":"Probably nothing","value":0.8},{"text":"Replaying the whole week","value":0.2}]'::jsonb),
  ('p18', 17, 'steadiness', 'Your flight is delayed and the gate keeps changing.', '[{"text":"Refreshing the app","value":0.2},{"text":"Snack and wait","value":0.8}]'::jsonb),
  ('p19', 18, 'steadiness', 'You hit send and spot the typo one second later.', '[{"text":"It’s fine","value":0.8},{"text":"Replaying it tonight","value":0.2}]'::jsonb),
  ('p20', 19, 'steadiness', 'The Wi-Fi drops halfway through your video call.', '[{"text":"Quiet panic","value":0.2},{"text":"Rejoin and keep going","value":0.8}]'::jsonb),
  ('p21', 20, 'attachment_anxiety', 'They left you on read for three hours.', '[{"text":"Double-text","value":0.8},{"text":"Wait it out","value":0.2}]'::jsonb),
  ('p22', 21, 'attachment_anxiety', 'Your friend’s whole reply is “k.”', '[{"text":"They’re busy","value":0.2},{"text":"What did I do","value":0.8}]'::jsonb),
  ('p23', 22, 'attachment_anxiety', 'The typing bubble appears, disappears, appears again.', '[{"text":"Watching it closely","value":0.8},{"text":"Phone down","value":0.2}]'::jsonb),
  ('p24', 23, 'attachment_anxiety', 'Your friends posted a hangout you weren’t at.', '[{"text":"Glad they had fun","value":0.2},{"text":"Wait, when was this","value":0.8}]'::jsonb),
  ('p25', 24, 'attachment_avoidance', 'Someone you just met wants to share locations.', '[{"text":"Maybe later","value":0.8},{"text":"Sure, send it","value":0.2}]'::jsonb),
  ('p26', 25, 'attachment_avoidance', 'A friend asks, “how are you, really?”', '[{"text":"Okay, so…","value":0.2},{"text":"Fine, haha","value":0.8}]'::jsonb),
  ('p27', 26, 'attachment_avoidance', 'Your phone lights up: “can we talk tonight?”', '[{"text":"Need a minute first","value":0.8},{"text":"Call me now","value":0.2}]'::jsonb),
  ('p28', 27, 'attachment_avoidance', 'Movie night: one couch, five people.', '[{"text":"Pile on","value":0.2},{"text":"Claim the armrest","value":0.8}]'::jsonb),
  ('p29', 28, 'conflict_assertiveness', 'The barista got your order wrong.', '[{"text":"Ask them to fix it","value":0.8},{"text":"Drink it anyway","value":0.2}]'::jsonb),
  ('p30', 29, 'conflict_assertiveness', 'A friend keeps “borrowing” your charger.', '[{"text":"Buy another charger","value":0.2},{"text":"Bring it up","value":0.8}]'::jsonb),
  ('p31', 30, 'conflict_assertiveness', 'Your idea got credited to someone else in the meeting.', '[{"text":"Speak up","value":0.8},{"text":"Let it slide","value":0.2}]'::jsonb),
  ('p32', 31, 'conflict_assertiveness', 'The group chat’s plan doesn’t work for you.', '[{"text":"Make it work anyway","value":0.2},{"text":"Say so","value":0.8}]'::jsonb),
  ('p33', 32, 'conflict_cooperativeness', 'Two friends want different weekends for the trip.', '[{"text":"Find a middle","value":0.8},{"text":"Back the better one","value":0.2}]'::jsonb),
  ('p34', 33, 'conflict_cooperativeness', 'You and your roommate both reach for the last slice.', '[{"text":"Called it first","value":0.2},{"text":"Split it","value":0.8}]'::jsonb),
  ('p35', 34, 'conflict_cooperativeness', 'The thermostat war has started again.', '[{"text":"Meet in the middle","value":0.8},{"text":"Hold the line","value":0.2}]'::jsonb),
  ('p36', 35, 'conflict_cooperativeness', 'Your friend wants sushi. You want burgers.', '[{"text":"Burger night","value":0.2},{"text":"A place with both","value":0.8}]'::jsonb),
  ('p37', 36, 'autonomy', 'There’s a step-by-step guide. There’s also your gut.', '[{"text":"Gut","value":0.8},{"text":"The guide","value":0.2}]'::jsonb),
  ('p38', 37, 'autonomy', 'Flat-pack furniture. The manual is 40 pages.', '[{"text":"Page one","value":0.2},{"text":"Wing it","value":0.8}]'::jsonb),
  ('p39', 38, 'autonomy', 'Your boss says, “do it however you want.”', '[{"text":"Finally","value":0.8},{"text":"But how do they want it","value":0.2}]'::jsonb),
  ('p40', 39, 'autonomy', 'Everyone else booked the group tour.', '[{"text":"Joining the tour","value":0.2},{"text":"Exploring solo","value":0.8}]'::jsonb),
  ('p41', 40, 'competence', 'Someone asks who can fix the printer.', '[{"text":"I’ll take a look","value":0.8},{"text":"Not it","value":0.2}]'::jsonb),
  ('p42', 41, 'competence', 'A new tool at work. No tutorial.', '[{"text":"Wait for the training","value":0.2},{"text":"Figure it out","value":0.8}]'::jsonb),
  ('p43', 42, 'competence', 'Karaoke. Your name is next on the screen.', '[{"text":"Grab the mic","value":0.8},{"text":"Pass the mic","value":0.2}]'::jsonb),
  ('p44', 43, 'competence', 'The recipe says “easy, 20 minutes.”', '[{"text":"Ordering backup","value":0.2},{"text":"Easy, sure","value":0.8}]'::jsonb),
  ('p45', 44, 'relatedness', 'Good news just landed.', '[{"text":"Telling everyone","value":0.8},{"text":"Enjoying it alone first","value":0.2}]'::jsonb),
  ('p46', 45, 'relatedness', 'A free Saturday with nothing planned.', '[{"text":"A day to myself","value":0.2},{"text":"Texting everyone","value":0.8}]'::jsonb),
  ('p47', 46, 'relatedness', 'Your birthday is next week.', '[{"text":"Party planning","value":0.8},{"text":"Low-key, please","value":0.2}]'::jsonb),
  ('p48', 47, 'relatedness', 'Someone you haven’t talked to in a year liked your post.', '[{"text":"Like one of theirs","value":0.2},{"text":"Message them","value":0.8}]'::jsonb),
  ('p49', 48, 'growth_mindset', 'You lost the board game. Badly.', '[{"text":"Rematch","value":0.8},{"text":"Not my game","value":0.2}]'::jsonb),
  ('p50', 49, 'growth_mindset', 'The language app says you’ve missed six days.', '[{"text":"Maybe not for me","value":0.2},{"text":"Back at it today","value":0.8}]'::jsonb),
  ('p51', 50, 'growth_mindset', 'Someone corrects how you pronounce a word.', '[{"text":"Oh, thanks","value":0.8},{"text":"Keeping mine","value":0.2}]'::jsonb),
  ('p52', 51, 'growth_mindset', 'First pottery class. Your bowl came out a plate.', '[{"text":"Plates are fine","value":0.2},{"text":"Next one’s a bowl","value":0.8}]'::jsonb),
  ('p53', 52, 'locus_of_control', 'You missed the train by one minute.', '[{"text":"Should’ve left earlier","value":0.8},{"text":"Trains, honestly","value":0.2}]'::jsonb),
  ('p54', 53, 'locus_of_control', 'The group project went sideways.', '[{"text":"Some things just happen","value":0.2},{"text":"What could I change","value":0.8}]'::jsonb),
  ('p55', 54, 'locus_of_control', 'Your plant died. Again.', '[{"text":"Overwatered it","value":0.8},{"text":"Bad plant luck","value":0.2}]'::jsonb),
  ('p56', 55, 'locus_of_control', 'You slept through the alarm.', '[{"text":"The alarm’s fault","value":0.2},{"text":"Snoozed it myself","value":0.8}]'::jsonb),
  ('p57', 56, 'self_efficacy', 'The job post asks for five years. You have three.', '[{"text":"Applying anyway","value":0.8},{"text":"Not ready yet","value":0.2}]'::jsonb),
  ('p58', 57, 'self_efficacy', 'Someone dares you to text first.', '[{"text":"A draft, forever","value":0.2},{"text":"Sending it","value":0.8}]'::jsonb),
  ('p59', 58, 'self_efficacy', 'The open mic sign-up sheet is right there.', '[{"text":"Writing my name","value":0.8},{"text":"Just watching","value":0.2}]'::jsonb),
  ('p60', 59, 'self_efficacy', 'The hike has a harder trail option.', '[{"text":"The nice one","value":0.2},{"text":"The harder one","value":0.8}]'::jsonb),
  ('p61', 60, 'playfulness', 'The meeting starts with an icebreaker.', '[{"text":"Going all in","value":0.8},{"text":"Shortest answer possible","value":0.2}]'::jsonb),
  ('p62', 61, 'playfulness', 'The group chat is just memes at this point.', '[{"text":"Muted","value":0.2},{"text":"Adding more","value":0.8}]'::jsonb),
  ('p63', 62, 'playfulness', 'Someone suggests matching costumes.', '[{"text":"Obviously yes","value":0.8},{"text":"No thanks","value":0.2}]'::jsonb),
  ('p64', 63, 'playfulness', 'A kid challenges you to a dance-off in the supermarket.', '[{"text":"Polite smile","value":0.2},{"text":"Accepted","value":0.8}]'::jsonb)

on conflict (id) do nothing;

-- 2. One answer per user per local day -------------------------------------

create table public.daily_pick_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  ymd date not null,
  pick_id text not null references public.daily_pick_pool(id),
  option_index smallint not null check (option_index in (0, 1)),
  counted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, ymd)
);

create index daily_pick_answers_pick_idx on public.daily_pick_answers (pick_id, option_index);

alter table public.daily_pick_answers enable row level security;

create policy daily_pick_answers_select_own on public.daily_pick_answers
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.daily_pick_answers to authenticated;
revoke insert, update, delete on public.daily_pick_answers from public, anon, authenticated;
revoke all on public.daily_pick_answers from anon;

-- 3. Which pick a date gets: same rule as pickIndexForYmd (bank.ts) --------
-- 64 picks, 4 per trait in TRAIT_AXES order; the rotation steps through the
-- 16 traits first so the same trait never comes up two days running.

create function public.daily_pick_position(p_ymd date)
returns int
language sql
immutable
as $$
  select ((((p_ymd - date '2026-01-01') % 64) + 64) % 64 % 16) * 4
       + ((((p_ymd - date '2026-01-01') % 64) + 64) % 64 / 16);
$$;

-- 4. Answer it -------------------------------------------------------------

create function public.answer_daily_pick(p_ymd date, p_pick_id text, p_option_index int)
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
  if not found or p.position <> public.daily_pick_position(p_ymd) then
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

revoke all on function public.answer_daily_pick(date, text, int) from public, anon;
grant execute on function public.answer_daily_pick(date, text, int) to authenticated;

-- 5. How everyone split (the new kind: totals only) -------------------------

create function public.daily_pick_split(p_pick_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_a int;
  v_b int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Only someone who has answered this pick sees how it split.
  if not exists (select 1 from public.daily_pick_answers where user_id = uid and pick_id = p_pick_id) then
    return null;
  end if;
  select count(*) filter (where option_index = 0), count(*) filter (where option_index = 1)
    into v_a, v_b
    from public.daily_pick_answers where pick_id = p_pick_id;
  if v_a + v_b < 20 then
    return null;
  end if;
  return jsonb_build_object('total', v_a + v_b, 'counts', jsonb_build_array(v_a, v_b));
end;
$$;

revoke all on function public.daily_pick_split(text) from public, anon;
grant execute on function public.daily_pick_split(text) to authenticated;
