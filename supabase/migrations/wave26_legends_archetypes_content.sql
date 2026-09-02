-- Wave 26: Legends — archetype_defs content seed + two flavor columns.
-- Applied to production 2026-09-02 (project aijzsmupaaaxjctfgwpl, migration
-- 20260902175327_wave26_legends_archetypes_content).
--
-- wave25 shipped archetype_defs empty. This migration (1) adds two card-flavor
-- columns (throwback_voice, party_build) and (2) seeds the first 12
-- archetypes. trait_axis on each row is a hand-mapped combo from the same
-- 16-axis vocabulary trait_axis_valid() enforces (high|low poles, no dupes
-- across the 12 rows). Remap pass 2 (emci 2026-09-02): Watcher/Architect
-- widened apart (were openness+conscientiousness twins), Disruptor left the
-- conscientiousness:low pool, Wanderer de-twin'd from Disruptor.
-- Remap pass 3 (emci 2026-09-02): Alchemist and Warm One each dropped the
-- axis they shared with Anchor (steadiness, conflict_cooperativeness) for
-- attachment_anxiety:low / attachment_avoidance:low — Anchor kept intact, so
-- no pair of archetypes now shares more than one axis-pole.

-- 1. archetype_defs: throwback_voice + party_build ---------------------------

alter table public.archetype_defs
  add column if not exists throwback_voice text,
  add column if not exists party_build text;

comment on column public.archetype_defs.throwback_voice is
  'Nostalgic nickname for the energy this archetype carries, e.g. Born to Lead.';
comment on column public.archetype_defs.party_build is
  'Light party-game class name for how the archetype shows up in a group, e.g. Speedrunner.';

-- 2. Seed the 12 archetypes ---------------------------------------------------

insert into public.archetype_defs
  (id, formal_name, slang_name, slang_definition, anime_flavor_tag,
   trait_axis, description, throwback_voice, party_build)
values
  ('arch_the_front_liner', 'The Front-Liner', 'Main Character Energy',
   'When someone moves through the day like every scene is theirs to carry.',
   'Shonen Protagonist',
   'extraversion:high, openness:high, self_efficacy:high',
   'The Front-Liner steps forward before anyone has finished the prompt. Quick to act, eager for the untried, and usually the one who ends up carrying the story.',
   'Born to Lead', 'Speedrunner'),
  ('arch_the_watcher', 'The Watcher', 'Big Brain',
   'The friend who stays quiet for ten minutes, then calls the exact move nobody saw coming.',
   'Strategist Character',
   'extraversion:low, openness:high, conflict_assertiveness:low',
   'The Watcher reads the whole board while everyone else is still reacting. They hold back, let the group burn its first idea, then hand over the plan they already finished.',
   'The Overthinker', 'Support Class'),
  ('arch_the_architect', 'The Architect', 'Plan Goblin',
   'Someone with a plan, a backup plan, and a backup for the backup.',
   'Wildcard Creative',
   'conscientiousness:high, autonomy:high, locus_of_control:high',
   'The Architect maps the whole thing out before anyone has picked a lane. They build the structure that keeps a group''s chaos running on time, and quietly glow when a plan lands exactly as drawn.',
   'The Overplanner', 'Builder Class'),
  ('arch_the_commander', 'The Commander', 'CEO Brain',
   'Running every group thing like a board meeting, down to everyone''s assignments.',
   'Final Boss Energy',
   'conscientiousness:high, conflict_assertiveness:high, competence:high',
   'The Commander treats a group chat like an org chart and a night out like a mission. Decisive and clear, they are who you want in charge when something has to actually happen.',
   'Type A Energy', 'Guild Leader'),
  ('arch_the_alchemist', 'The Alchemist', 'Vibe Reader',
   'Someone who reads the mood of a room before a word is said, then meets it.',
   'Mystic Support Character',
   'openness:high, relatedness:high, attachment_anxiety:low',
   'The Alchemist feels the emotional current under the conversation and shifts it without making a show. Old-souled and even-tempered, they are the reason tense rooms go calm.',
   'Old Soul', 'Support Mage'),
  ('arch_the_warm_one', 'The Warm One', 'Soft Launch',
   'Easing people in gently instead of dropping the whole situation at once.',
   'Healer Character',
   'agreeableness:high, relatedness:high, attachment_avoidance:low',
   'The Warm One shows up soft and safe — the first person you text when a day goes sideways. They care in small steady ways: the check-in, the meal, the place to land.',
   'The Nurturer', 'Healer Class'),
  ('arch_the_chaos_agent', 'The Chaos Agent', 'Unserious',
   'Choosing the joke over the stakes, every single time.',
   'Comic Relief Character',
   'extraversion:high, playfulness:high, conscientiousness:low',
   'The Chaos Agent is here for the bit, not the agenda. Unpredictable on purpose, they will derail a serious moment if boring is the alternative — and the group is usually better for it.',
   'The Wildcard', 'Chaos Build'),
  ('arch_the_steady_one', 'The Steady One', 'No Cap Just Real',
   'No exaggeration, no performance — what you see is what you get.',
   'Slice-of-Life Protagonist',
   'steadiness:high, conscientiousness:high, extraversion:low',
   'The Steady One says the actual thing in the same calm voice, whether it is good news or a hard truth. Even-keeled and dependable, they are the constant that makes everyone else''s swings feel safe.',
   'The Reliable One', 'Balanced Build'),
  ('arch_the_anchor', 'The Anchor', 'Mom/Dad Friend',
   'The friend who makes sure everyone eats, gets home, and texts when they arrive.',
   'Guardian Character',
   'steadiness:high, relatedness:high, conflict_cooperativeness:high',
   'The Anchor is the group''s center of gravity. When everything wobbles they stay put — everyone leans on them, and somehow they have room for all of it.',
   'The Glue', 'Tank Class'),
  ('arch_the_disruptor', 'The Disruptor', 'Villain Arc',
   'The shift where someone stops playing nice and starts playing to win.',
   'Anti-Hero',
   'agreeableness:low, autonomy:high, conflict_assertiveness:high',
   'The Disruptor ran out of patience for the rules and now does things their own way, on their own timeline. Sharp, unbothered by your approval, and done asking permission.',
   'The Rebel', 'Rogue Class'),
  ('arch_the_wanderer', 'The Wanderer', 'Side Quest Energy',
   'Main story, who? The detour is where the good stuff actually lives.',
   'Adventurer Protagonist',
   'openness:high, conscientiousness:low, attachment_avoidance:high',
   'The Wanderer lives for the path that is not on the map. Commitments feel like cages, so they keep moving — collecting stories and friends wherever the detour lands.',
   'The Free Spirit', 'Open World Type'),
  ('arch_the_believer', 'The Believer', 'Golden Retriever Energy',
   'Loyal, eager, and genuinely delighted that you showed up.',
   'Pure-Hearted Protagonist',
   'extraversion:high, agreeableness:high, growth_mindset:high',
   'The Believer greets the day like it owes them something good — and usually collects. They see the best in people, stay through the hard parts, and their optimism keeps the whole group going.',
   'The Optimist', 'Support Healer')
on conflict (id) do update set
  formal_name = excluded.formal_name,
  slang_name = excluded.slang_name,
  slang_definition = excluded.slang_definition,
  anime_flavor_tag = excluded.anime_flavor_tag,
  trait_axis = excluded.trait_axis,
  description = excluded.description,
  throwback_voice = excluded.throwback_voice,
  party_build = excluded.party_build;
