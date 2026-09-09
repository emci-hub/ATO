-- wave49_question_bank_pool.sql
--
-- T-01 (core loop redesign, docs/CORE_LOOP_REDESIGN_PLAN.md §2/§8): the
-- shared, growing question bank for the post-50 "ongoing round" loop, plus
-- the small question_packs/question_items additions the plan's §7-§11
-- gap review (2026-09-09 checkpoint) called for. Applied to the live DB
-- 2026-09-09.
--
-- 1. question_bank_pool: shared, not user-scoped, catalog-style table
--    (same RLS shape as archetype_defs/legends, wave25) — every axis-tagged
--    question available to draw into an ongoing round. Seeded below with
--    the existing 50-question QUESTIONS_BANK (source='authored'); T-02's
--    bank-pool.ts adds AI-generated rows (source='ai') when an axis runs
--    short, per the plan's "bank-first, AI-fallback" rule.
-- 2. question_bank_reroll_exclusions: permanent per-user "never show this
--    again" list a reroll writes to (T-02). Strictly per-user — never
--    hides a row from any other user.
-- 3. question_packs gains `kind` (distinguishes Infinite Questions packs
--    from future ongoing-round packs) and `completed_at` (explicit
--    completion signal for T-05's claim_ongoing_round_complete, per
--    emci's call at the 2026-09-09 checkpoint — not derived by counting
--    answered question_items rows).
-- 4. question_items gains `question_bank_item_id` (nullable FK) — null for
--    every existing/Infinite-Questions row (inserted via insert_question_pack,
--    which has no bank concept and is NOT touched by this migration), always
--    populated for kind='ongoing_round' rows once T-02 lands.
--
-- Nothing here changes insert_question_pack, RLS on the two existing
-- tables, or any existing check constraint — question_items.axis already
-- covers all 16 axes as of wave21/wave27 (an earlier investigation pass
-- flagged this as a gap; re-verified this session and confirmed stale —
-- no fix needed).

-- 1. question_bank_pool ------------------------------------------------------

create table if not exists public.question_bank_pool (
  id uuid primary key default gen_random_uuid(),
  axis text not null check (axis in (
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance',
    'conflict_assertiveness', 'conflict_cooperativeness',
    'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'
  )),
  category text,
  prompt text not null unique check (char_length(prompt) > 0 and char_length(prompt) <= 400),
  options jsonb not null,
  source text not null check (source in ('authored', 'ai')),
  times_served int not null default 0 check (times_served >= 0),
  created_at timestamptz not null default now()
);

comment on table public.question_bank_pool is
  'Shared, growing question bank for the post-50 ongoing-round loop (core loop redesign §2). Not user-scoped — every row is a candidate for any user, filtered per-user by their own answer history and question_bank_reroll_exclusions. Seeded from QUESTIONS_BANK (source=authored); T-02 appends source=ai rows when an axis runs short.';
comment on column public.question_bank_pool.prompt is 'Unique so seeding/AI-generation can upsert with on conflict do nothing instead of risking exact-duplicate content.';
comment on column public.question_bank_pool.times_served is 'Bumped by T-02''s recordBankUsage — informational, not itself an exclusion mechanism.';

create index question_bank_pool_axis_idx on public.question_bank_pool (axis);

alter table public.question_bank_pool enable row level security;

drop policy if exists question_bank_pool_select_auth on public.question_bank_pool;
create policy question_bank_pool_select_auth on public.question_bank_pool
  for select to authenticated using (true);

grant select on public.question_bank_pool to authenticated;
revoke insert, update, delete on public.question_bank_pool from public, anon, authenticated;

-- 2. question_bank_reroll_exclusions -----------------------------------------

create table if not exists public.question_bank_reroll_exclusions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_bank_item_id uuid not null references public.question_bank_pool(id) on delete cascade,
  excluded_at timestamptz not null default now(),
  unique (user_id, question_bank_item_id)
);

comment on table public.question_bank_reroll_exclusions is
  'Permanent per-user exclusion list (core loop redesign §2/§7 Q8, resolved: permanent-forever, per-user only). A reroll (T-02, 1 ATO token) inserts here; this bank item must never be drawn for this user again. Never hides the row from any other user.';

create index question_bank_reroll_exclusions_user_idx on public.question_bank_reroll_exclusions (user_id);
create index question_bank_reroll_exclusions_item_idx on public.question_bank_reroll_exclusions (question_bank_item_id);

alter table public.question_bank_reroll_exclusions enable row level security;

drop policy if exists question_bank_reroll_exclusions_select_own on public.question_bank_reroll_exclusions;
create policy question_bank_reroll_exclusions_select_own on public.question_bank_reroll_exclusions
  for select using (auth.uid() = user_id);

-- No insert policy: writes happen only via T-02's reroll RPC
-- (security definer), same as question_items/question_packs' own
-- write-only-through-RPC convention.

-- 3. question_packs additions -------------------------------------------------

alter table public.question_packs
  add column if not exists kind text not null default 'infinite_questions'
    check (kind in ('infinite_questions', 'ongoing_round'));

alter table public.question_packs
  add column if not exists completed_at timestamptz;

comment on column public.question_packs.kind is
  'infinite_questions (default, existing behavior) | ongoing_round (core loop redesign §2, T-02). Distinguishes the two pack-generation paths sharing this table.';
comment on column public.question_packs.completed_at is
  'Explicit completion signal for an ongoing_round pack (all 25 answered) — T-05''s claim_ongoing_round_complete checks this is set and not already claimed, rather than counting question_items rows. Always null for kind=infinite_questions (that path has no round-completion concept).';
comment on column public.question_packs.generated_on is
  'Infinite-Questions daily-cache field ("cached until exhausted or a new local day") — vestigial/unused for kind=ongoing_round rows, which track completion via completed_at instead, not a calendar day.';

-- 4. question_items addition ---------------------------------------------------

alter table public.question_items
  add column if not exists question_bank_item_id uuid references public.question_bank_pool(id) on delete set null;

comment on column public.question_items.question_bank_item_id is
  'Which question_bank_pool row this came from. Null for every Infinite Questions row (inserted via insert_question_pack, which has no bank concept and is unchanged by this migration). Always populated for kind=ongoing_round rows once T-02 lands — every ongoing-round question, whether bank-drawn or freshly AI-generated, is written into question_bank_pool first (core loop redesign §7 Q9, resolved: same durable reroll-exclusion guarantee regardless of source).';

-- 5. Seed: the existing 50-question QUESTIONS_BANK (src/lib/questions/bank.ts) --
-- Generated programmatically from the live TS source (not hand-transcribed)
-- to avoid transcription error. source='authored' for all 50 rows.

insert into public.question_bank_pool (axis, category, prompt, options, source) values
  ('openness', 'cat_openness', 'Your Do today was writing down one thing you''re walking into. Was today''s version the safe pick or the different one?', '[{"text":"The different one, easily","value":0.8},{"text":"Somewhere in between","value":0.5},{"text":"The safe, familiar one","value":0.2}]'::jsonb, 'authored'),
  ('openness', 'cat_openness', 'Same restaurant, and there is a menu item you have never tried.', '[{"text":"New one. Obviously","value":0.8},{"text":"Depends on the day","value":0.5},{"text":"I know what I like","value":0.2}]'::jsonb, 'authored'),
  ('openness', 'cat_openness', 'A friend wants to drag you to something you would never pick yourself.', '[{"text":"I''m in, that''s the fun part","value":0.8},{"text":"I''d probably pass","value":0.2}]'::jsonb, 'authored'),
  ('openness', 'cat_openness', 'You''re picking a show to watch and there''s something new in your queue you haven''t tried.', '[{"text":"New one","value":0.8},{"text":"Depends on my mood","value":0.5},{"text":"Something familiar","value":0.2}]'::jsonb, 'authored'),
  ('openness', 'cat_openness', 'A coworker suggests doing the project a totally different way than you planned.', '[{"text":"I''m curious, let''s see","value":0.8},{"text":"I''ll hear them out","value":0.5},{"text":"I''d rather stick to the plan","value":0.2}]'::jsonb, 'authored'),
  ('openness', 'cat_openness', 'You have a free Saturday and someone mentions a class or hobby you''ve never tried.', '[{"text":"I''d sign up","value":0.8},{"text":"Maybe another time","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'A plan you made last week hits a boring stretch today.', '[{"text":"I still see it through","value":0.8},{"text":"I keep it if it stays easy","value":0.5},{"text":"I switch to whatever feels better","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'Something is due Friday. It is Monday.', '[{"text":"I start chipping at it now","value":0.8},{"text":"I start once it feels close","value":0.5},{"text":"Thursday night, same as always","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'You said you would do a small thing for someone and nobody followed up.', '[{"text":"I still do it","value":0.8},{"text":"It quietly disappears","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'Your alarm goes off and you already know today''s to-do list is long.', '[{"text":"I get moving right away","value":0.8},{"text":"I ease into it","value":0.5},{"text":"I hit snooze","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'You told yourself you''d clean up before bed, and you''re tired.', '[{"text":"I still do it","value":0.8},{"text":"I do the bare minimum","value":0.5},{"text":"It waits until tomorrow","value":0.2}]'::jsonb, 'authored'),
  ('conscientiousness', 'cat_steadiness', 'A form needs three pieces of information and you only have two handy.', '[{"text":"I track down the third one now","value":0.8},{"text":"I fill in what I can and come back","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'Saturday afternoon, nobody has plans yet.', '[{"text":"I''d rather text a few people and make something happen","value":0.8},{"text":"Either way, I''m fine","value":0.5},{"text":"I''d rather keep the time quiet","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'You walk into a party and know maybe two people.', '[{"text":"I start talking to someone new","value":0.8},{"text":"I find the two I know","value":0.5},{"text":"I''m counting the minutes","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'A long week just ended.', '[{"text":"Going out would recharge me","value":0.8},{"text":"Being alone would recharge me","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'You''ve been working alone for hours and hit a wall.', '[{"text":"I go find someone to talk to","value":0.8},{"text":"Either way","value":0.5},{"text":"I push through alone","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'A coworker asks if you want to grab lunch with the group instead of eating at your desk.', '[{"text":"Yes, easily","value":0.8},{"text":"Depends on the day","value":0.5},{"text":"I''d rather eat alone","value":0.2}]'::jsonb, 'authored'),
  ('extraversion', 'cat_openness', 'You''re the one who has to make small talk with someone new at an event.', '[{"text":"I don''t mind starting it","value":0.8},{"text":"I''ll follow their lead","value":0.2}]'::jsonb, 'authored'),
  ('agreeableness', 'cat_steadiness', 'A group chat is picking a place you don''t really like.', '[{"text":"I go along, it''s not worth a fuss","value":0.8},{"text":"I mention it once, then let it go","value":0.5},{"text":"I say I''d rather go somewhere else","value":0.2}]'::jsonb, 'authored'),
  ('agreeableness', 'cat_steadiness', 'Someone takes credit for something that was mostly yours.', '[{"text":"I let it slide","value":0.8},{"text":"I mention it lightly, later","value":0.5},{"text":"I correct it on the spot","value":0.2}]'::jsonb, 'authored'),
  ('agreeableness', 'cat_steadiness', 'A stranger is clearly in the wrong and clearly having a bad day.', '[{"text":"I give them the benefit of the doubt","value":0.8},{"text":"Bad day or not, wrong is wrong","value":0.2}]'::jsonb, 'authored'),
  ('agreeableness', 'cat_steadiness', 'Someone asks for a favor that''s a genuine inconvenience for you.', '[{"text":"I usually say yes anyway","value":0.8},{"text":"Depends how big a favor","value":0.5},{"text":"I say no if it''s a real hassle","value":0.2}]'::jsonb, 'authored'),
  ('steadiness', 'cat_steadiness', 'A small thing goes wrong first thing in the morning.', '[{"text":"I''m mostly over it by lunch","value":0.8},{"text":"It sits with me a bit, then fades","value":0.5},{"text":"It colors the rest of the day","value":0.2}]'::jsonb, 'authored'),
  ('steadiness', 'cat_steadiness', 'Plans change on you an hour before.', '[{"text":"Fine, I roll with it","value":0.8},{"text":"Mild whiplash, then fine","value":0.5},{"text":"It throws off the whole evening","value":0.2}]'::jsonb, 'authored'),
  ('attachment_anxiety', 'cat_love', 'Someone you like takes a while to reply.', '[{"text":"I start wondering if they''re pulling away","value":0.8},{"text":"I notice, then I get on with my day","value":0.5},{"text":"I don''t think much of it","value":0.2}]'::jsonb, 'authored'),
  ('attachment_anxiety', 'cat_love', 'A close friend has been quieter than usual this week.', '[{"text":"I assume I did something","value":0.8},{"text":"I wonder for a second, then drop it","value":0.5},{"text":"People get busy","value":0.2}]'::jsonb, 'authored'),
  ('attachment_avoidance', 'cat_love', 'Someone close to you wants to talk something out in person instead of over text.', '[{"text":"Sure, that''s fine when it matters","value":0.2},{"text":"I''d rather keep it lighter, over text","value":0.8}]'::jsonb, 'authored'),
  ('attachment_avoidance', 'cat_love', 'A rough week. Someone asks how you actually are.', '[{"text":"I tell them the real version","value":0.2},{"text":"I give them the short version","value":0.5},{"text":"I say I am fine and change the subject","value":0.8}]'::jsonb, 'authored'),
  ('conflict_assertiveness', 'cat_communication', 'You disagree with someone in the room.', '[{"text":"I say so, even if it gets a little sharp","value":0.8},{"text":"I wait to see if it blows over","value":0.5},{"text":"I let it go rather than push","value":0.2}]'::jsonb, 'authored'),
  ('conflict_assertiveness', 'cat_communication', 'The order is wrong and the place is busy.', '[{"text":"I send it back","value":0.8},{"text":"Depends how wrong","value":0.5},{"text":"I eat it","value":0.2}]'::jsonb, 'authored'),
  ('conflict_assertiveness', 'cat_communication', 'You want something and asking might annoy someone.', '[{"text":"I ask anyway","value":0.8},{"text":"I let it go","value":0.2}]'::jsonb, 'authored'),
  ('conflict_assertiveness', 'cat_communication', 'A friend keeps borrowing money and hasn''t paid you back.', '[{"text":"I bring it up directly","value":0.8},{"text":"I hint at it","value":0.5},{"text":"I let it slide","value":0.2}]'::jsonb, 'authored'),
  ('conflict_cooperativeness', 'cat_communication', 'When you and someone else both want different things with no obvious middle ground, who usually gives first?', '[{"text":"Probably me","value":0.8},{"text":"Depends who cares more","value":0.5},{"text":"Rarely me","value":0.2}]'::jsonb, 'authored'),
  ('conflict_cooperativeness', 'cat_communication', 'An argument is going nowhere and it is getting late.', '[{"text":"I look for something we both can live with","value":0.8},{"text":"I park it for tomorrow","value":0.5},{"text":"I hold my line","value":0.2}]'::jsonb, 'authored'),
  ('autonomy', 'cat_drive', 'Someone hands you a plan that would work fine.', '[{"text":"I''d still rather do it my way","value":0.8},{"text":"I''ll use theirs if it saves time","value":0.5},{"text":"I''m glad I don''t have to figure it out","value":0.2}]'::jsonb, 'authored'),
  ('autonomy', 'cat_drive', 'You get told exactly how to do something you already know how to do.', '[{"text":"It gets under my skin","value":0.8},{"text":"I notice it, then let it go","value":0.5},{"text":"Fine by me, less to think about","value":0.2}]'::jsonb, 'authored'),
  ('competence', 'cat_drive', 'A hard task lands on your plate.', '[{"text":"I feel like I can handle it","value":0.8},{"text":"Depends how hard, honestly","value":0.5},{"text":"I doubt I can pull it off","value":0.2}]'::jsonb, 'authored'),
  ('competence', 'cat_drive', 'You are learning something new and you are still bad at it.', '[{"text":"I can feel myself getting better","value":0.8},{"text":"Some days it clicks","value":0.5},{"text":"I mostly feel behind","value":0.2}]'::jsonb, 'authored'),
  ('relatedness', 'cat_drive', 'A friend cancels same-day, no real reason given.', '[{"text":"I''d want to talk it through","value":0.8},{"text":"I''d let it go, check in eventually","value":0.2}]'::jsonb, 'authored'),
  ('relatedness', 'cat_drive', 'Something good happens to you on an ordinary Tuesday.', '[{"text":"I''m texting someone before I sit down","value":0.8},{"text":"It comes up next time we talk","value":0.5},{"text":"I just enjoy it","value":0.2}]'::jsonb, 'authored'),
  ('relatedness', 'cat_drive', 'A whole day with no messages from anyone.', '[{"text":"I feel the gap","value":0.8},{"text":"Bliss","value":0.2}]'::jsonb, 'authored'),
  ('relatedness', 'cat_drive', 'You just finished something you''re proud of.', '[{"text":"I want to tell someone right away","value":0.8},{"text":"It can wait until it comes up","value":0.5},{"text":"I keep it to myself","value":0.2}]'::jsonb, 'authored'),
  ('growth_mindset', 'cat_agency', 'You try something new and it goes badly the first time. What actually happens next?', '[{"text":"I look at what I''d do differently","value":0.8},{"text":"I probably don''t try that again","value":0.2}]'::jsonb, 'authored'),
  ('growth_mindset', 'cat_agency', 'Someone is much better than you at a thing you care about.', '[{"text":"I want to know how they got there","value":0.8},{"text":"Good for them, different lane","value":0.5},{"text":"Some people just have it","value":0.2}]'::jsonb, 'authored'),
  ('locus_of_control', 'cat_agency', 'A plan you were in on falls apart.', '[{"text":"I look first at what I might have done differently","value":0.8},{"text":"Some of it was me, some of it wasn''t","value":0.5},{"text":"It was bound to happen","value":0.2}]'::jsonb, 'authored'),
  ('locus_of_control', 'cat_agency', 'A good week. Where does the credit actually go?', '[{"text":"Mostly to what I did","value":0.8},{"text":"A bit of both","value":0.5},{"text":"Mostly to how things fell","value":0.2}]'::jsonb, 'authored'),
  ('self_efficacy', 'cat_agency', 'Everyone at the table already knows their order. You don''t.', '[{"text":"I panic-order whatever''s closest","value":0.2},{"text":"Takes me a sec but I land on something","value":0.5},{"text":"I ask what everyone else got","value":0.75}]'::jsonb, 'authored'),
  ('self_efficacy', 'cat_agency', 'Something breaks and you have never fixed one before.', '[{"text":"I''ll figure it out","value":0.8},{"text":"I look it up first","value":0.5},{"text":"I find someone who knows","value":0.2}]'::jsonb, 'authored'),
  ('playfulness', 'cat_social', 'A dull stretch with nothing required of you.', '[{"text":"I''d mess around and see what happens","value":0.8},{"text":"Either way, I am fine","value":0.5},{"text":"I''d rather just get through it","value":0.2}]'::jsonb, 'authored'),
  ('playfulness', 'cat_social', 'A serious conversation hits a genuinely funny moment.', '[{"text":"I take the joke","value":0.8},{"text":"Depends who is in the room","value":0.5},{"text":"I keep it serious","value":0.2}]'::jsonb, 'authored')
on conflict (prompt) do nothing;
