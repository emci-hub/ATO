/**
 * Story v2 (emci 2026-10-08; docs/proposals/story-v2-plan.md): the thread
 * picker, the prompt it feeds and the checks on the model's answer.
 * Run: npm run check:story-thread
 *
 * Offline only. Nothing here can prove the writing; it proves what the model
 * receives and what the app accepts back.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATEGORY_DEFS, readCategory, type CategoryId } from '../src/lib/categories';
import { pickCategoryCard } from '../src/lib/category-bank';
import { isShareableLean } from '../src/lib/legends64/identity';
import {
  buildStoryPrompt,
  parseSageStory,
  parseStoryAnswer,
  parseStoryBody,
  STORY_MAX_WORDS,
} from '../src/lib/sage-story';
import {
  STORY_CARD_PROMPT_STATIC,
  STORY_REPEAT_LIMIT,
  buildStoryCardPrompt,
  parseStoryCardAnswer,
  storyCardBody,
  storyLabelLeak,
  storyOverlap,
} from '../src/lib/story-card';
import {
  partnerScore,
  pickJokeTarget,
  pickStoryThread,
  rankStoryAxes,
  rankStoryCombos,
  scoreReadyCategories,
  STORY_B_MIN_SHARE,
  threadRecord,
  type ScoredCategory,
} from '../src/lib/story-thread';
import { applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';
import { STORY_JOKE_RULES } from '../src/lib/voice/moment-voice';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const NOW_ISO = new Date().toISOString();
function stable(axis: TraitAxis, value: number): TraitTrack {
  let row = applyEwmaAnswer(null, axis, 'report', value, NOW_ISO);
  row = applyEwmaAnswer(row, axis, 'report', value, NOW_ISO);
  return applyEwmaAnswer(row, axis, 'report', value, NOW_ISO);
}
function tracksOf(values: Partial<Record<TraitAxis, number>>): TraitTrack[] {
  return (Object.entries(values) as [TraitAxis, number][]).map(([axis, value]) => stable(axis, value));
}
const ids = (rows: readonly ScoredCategory[]) => rows.map((row) => row.reading.def.id);
const def = (id: CategoryId) => CATEGORY_DEFS.find((row) => row.id === id)!;

console.log('Story v2 — thread picker');

// 1. Ranking: strongest lean first; middle values and unanswered axes are out.
{
  const tracks = tracksOf({ openness: 0.62, extraversion: 0.1, conscientiousness: 0.95, agreeableness: 0.53 });
  const ranked = rankStoryAxes(tracks).map((row) => row.axis);
  assert.deepEqual(ranked.slice(0, 3), ['conscientiousness', 'extraversion', 'openness']);
  assert.ok(!ranked.includes('agreeableness'), 'a lean under 0.1 does not count');
  const zero = [{ ...stable('playfulness', 0.95), answerCount: 0 }];
  assert.deepEqual(rankStoryAxes(zero), [], 'an unanswered axis does not count');
  ok('axes rank by |value − 0.5|, clear leans only');
}

// 2. Pair rules on hand-built scores: overlap, tension bonus, 60% floor.
{
  const fake = (id: CategoryId, score: number, lead: { axis: TraitAxis; lean: 'low' | 'high' }): ScoredCategory => ({
    reading: { def: def(id), ready: true, bar: 0.5, map: null, stableAxes: [...def(id).axes], texture: [] },
    score,
    lead: { axis: lead.axis, lean: lead.lean, value: lead.lean === 'high' ? 0.9 : 0.1, strength: 0.4 },
  });
  const a = fake('cat_levity', 1, { axis: 'playfulness', lean: 'high' });
  // Communication shares two axes with Levity: never a partner.
  assert.equal(partnerScore(a, fake('cat_communication', 5, { axis: 'conflict_assertiveness', lean: 'high' })), null);
  // Social shares one (playfulness): half score.
  assert.equal(partnerScore(a, fake('cat_social', 1.5, { axis: 'extraversion', lean: 'high' })), 0.75);
  // No overlap, same lean: full score.
  assert.equal(partnerScore(a, fake('cat_drive', 0.8, { axis: 'autonomy', lean: 'high' })), 0.8);
  // No overlap, opposite lean: +25%.
  assert.equal(partnerScore(a, fake('cat_drive', 0.8, { axis: 'autonomy', lean: 'low' })), 1);
  // Under 60% of A: single-category story.
  assert.equal(partnerScore(a, fake('cat_drive', STORY_B_MIN_SHARE - 0.01, { axis: 'autonomy', lean: 'high' })), null);
  // The tension bonus can lift B over the floor.
  assert.ok(partnerScore(a, fake('cat_drive', 0.5, { axis: 'autonomy', lean: 'low' })) != null);
  ok('B shares at most 1 axis (−50% each), +25% for an opposite lean, and must reach 60% of A');
}

// 3. Single-category fallback, and locked when nothing is ready.
{
  const one = tracksOf({ openness: 0.9, extraversion: 0.85 });
  const thread = pickStoryThread({ tracks: one, last: null, crisisToday: false });
  assert.ok(thread);
  assert.deepEqual(ids(thread.categories), ['cat_openness']);
  assert.equal(pickStoryThread({ tracks: [], last: null, crisisToday: false }), null);
  ok('one ready category → a single-category story; none ready → no thread');
}

// 4. A real profile: A is the top score; B obeys the rules; rotation never repeats.
const rich = tracksOf({
  openness: 0.92,
  extraversion: 0.88,
  conscientiousness: 0.12,
  agreeableness: 0.6,
  steadiness: 0.7,
  autonomy: 0.85,
  competence: 0.75,
  relatedness: 0.3,
  playfulness: 0.8,
  conflict_assertiveness: 0.25,
  conflict_cooperativeness: 0.7,
  growth_mindset: 0.7,
  locus_of_control: 0.65,
  self_efficacy: 0.7,
  attachment_anxiety: 0.97,
  attachment_avoidance: 0.95,
});
{
  const scored = scoreReadyCategories(rich);
  assert.ok(scored.length >= 4);
  for (let i = 1; i < scored.length; i += 1) assert.ok(scored[i - 1]!.score >= scored[i]!.score);
  const thread = pickStoryThread({ tracks: rich, last: null, crisisToday: false })!;
  assert.equal(thread.categories[0]!.reading.def.id, scored[0]!.reading.def.id, 'A is the best score');
  assert.ok(thread.categories.length <= 2);
  if (thread.categories.length === 2) {
    const [a, b] = thread.categories as [ScoredCategory, ScoredCategory];
    assert.ok(partnerScore(a, b) != null, 'B passes the pair rules');
  }

  const combos = rankStoryCombos(scored);
  assert.ok(combos.length >= 2 && combos.length <= 3);
  const keys = combos.map((row) => ids(row).sort().join('+'));
  assert.equal(new Set(keys).size, keys.length, 'combos are distinct');
  let last = threadRecord(thread);
  for (let i = 0; i < 6; i += 1) {
    const next = pickStoryThread({ tracks: rich, last, crisisToday: false })!;
    const nextKey = threadRecord(next).categories.slice().sort().join('+');
    assert.notEqual(nextKey, last.categories.slice().sort().join('+'), 'a new load never repeats the last combo');
    last = threadRecord(next);
  }
  const single = tracksOf({ openness: 0.9, extraversion: 0.85 });
  const only = pickStoryThread({ tracks: single, last: { categories: ['cat_openness'], jokeAxis: null }, crisisToday: false })!;
  assert.deepEqual(ids(only.categories), ['cat_openness'], 'with one combo, it is reused');
  ok('A is the top category, B passes the rules, and "Load a new story" rotates without repeating');
}

// 5. The joke: never a private lean, never on a crisis day.
{
  // The two closeness axes are the most extreme here, and private.
  const scored = scoreReadyCategories(rich);
  const love = scored.find((row) => row.reading.def.id === 'cat_love')!;
  assert.ok(love, 'Love is ready in this fixture');
  assert.equal(pickJokeTarget(rich, [love], false), null, 'no joke about attachment axes, ever');
  for (const thread of [
    pickStoryThread({ tracks: rich, last: null, crisisToday: false })!,
    ...rankStoryCombos(scored).map((categories) => ({ categories, joke: pickJokeTarget(rich, categories, false) })),
  ]) {
    if (thread.joke) assert.ok(isShareableLean(thread.joke.axis, thread.joke.lean));
  }
  // A struggle lean (steadiness:low) as the strongest axis is skipped for the next shareable one.
  const shaky = tracksOf({ steadiness: 0.02, conscientiousness: 0.8, agreeableness: 0.75 });
  const steady = scoreReadyCategories(shaky).find((row) => row.reading.def.id === 'cat_steadiness')!;
  const target = pickJokeTarget(shaky, [steady], false);
  assert.ok(target && target.axis !== 'steadiness');
  assert.equal(pickJokeTarget(shaky, [steady], true), null, 'crisis: no joke');
  assert.equal(pickStoryThread({ tracks: rich, last: null, crisisToday: true })!.joke, null);
  ok('the joke targets the strongest shareable lean; never a private one; none on a crisis day');
}

// 6. The prompt carries only the chosen categories' stored copy.
{
  const userId = 'u-check';
  const ymd = '2026-10-08';
  const thread = pickStoryThread({ tracks: rich, last: null, crisisToday: false })!;
  const prompt = buildStoryPrompt({ tracks: rich, divergenceNote: null, thread, userId, ymd });
  const chosen = new Set(ids(thread.categories));
  for (const row of scoreReadyCategories(rich)) {
    const card = pickCategoryCard({ userId, reading: row.reading, ymd });
    if (!card) continue;
    if (chosen.has(row.reading.def.id)) {
      assert.ok(prompt.includes(card.summary), `${row.reading.def.id} copy is in`);
    } else {
      assert.ok(!prompt.includes(card.summary), `${row.reading.def.id} copy is out`);
    }
  }
  for (const d of CATEGORY_DEFS) assert.ok(!prompt.includes(d.name), `no category name (${d.name}) in the prompt`);
  assert.match(prompt, /ONE ordinary day, ONE setting/);
  assert.match(prompt, /90–160 words, at most 3 short paragraphs/);
  assert.match(prompt, /"thread":/);
  assert.match(prompt, /"joke":/);
  assert.equal(prompt.includes(STORY_JOKE_RULES), thread.joke != null);
  const noJoke = buildStoryPrompt({
    tracks: rich,
    divergenceNote: null,
    thread: pickStoryThread({ tracks: rich, last: null, crisisToday: true }),
  });
  assert.match(noJoke, /JOKE: none this time/);
  assert.ok(!noJoke.includes(STORY_JOKE_RULES));
  // Tension only when its axis is inside the thread.
  const inside = thread.categories[0]!.reading.def.axes[0]!;
  const allThreadAxes = new Set(thread.categories.flatMap((row) => row.reading.def.axes));
  const outside = (['openness', 'extraversion', 'conscientiousness', 'playfulness', 'attachment_anxiety', 'autonomy', 'growth_mindset'] as TraitAxis[]).find(
    (axis) => !allThreadAxes.has(axis),
  );
  const note = 'You said one thing, but you go a different way.';
  assert.ok(buildStoryPrompt({ tracks: rich, divergenceNote: note, divergenceAxis: inside, thread }).includes(note));
  if (outside) {
    assert.ok(!buildStoryPrompt({ tracks: rich, divergenceNote: note, divergenceAxis: outside, thread }).includes(note));
  }
  // Callers without a thread (rolls) still get one, with no joke.
  assert.match(buildStoryPrompt({ tracks: rich, divergenceNote: null }), /JOKE: none this time/);
  ok('the prompt holds only A/B stored copy, the four-part shape, the JSON plan, and the joke only when picked');
}

// 7. Checks on the answer.
{
  const good = 'On a day like this, the group chat lights up before lunch. You might mute it, then check it twice.';
  assert.ok(parseStoryBody(JSON.stringify({ body: good })));
  const long = Array.from({ length: STORY_MAX_WORDS + 1 }, () => 'word').join(' ');
  assert.equal(parseStoryBody(JSON.stringify({ body: long })), null, 'over 180 words');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'One.\n\nTwo.\n\nThree.\n\nFour.' })), null, 'over 3 paragraphs');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'One.\nTwo.\nThree.\nFour.' })), null, 'single line breaks count too');
  assert.ok(parseStoryBody(JSON.stringify({ body: 'One.\n\nTwo.\n\nThree.' })), '3 paragraphs is fine');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'You are the planner of the group.' })), null, '"you are"');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'You always reply first.' })), null, '"always"');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'The calendar wins again!' })), null, '"!"');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'Your inbox could kill a lesser phone.' })), null, 'banned topic');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'That therapy app pinged again.' })), null, 'banned topic');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'Resilience under pressure looks like this.' })), null, 'names a category');
  assert.ok(parseStoryBody(JSON.stringify({ body: 'The deadline moved and you were deadpan about it.' })), 'deadline/deadpan are fine');

  const joke = 'Your to-do list has a longer memory than your phone.';
  const withJoke = parseStoryAnswer(JSON.stringify({ thread: 'Plans meet a busy chat.', joke, body: `${good} ${joke}` }))!;
  assert.equal(withJoke.joke, joke);
  assert.equal(withJoke.thread, 'Plans meet a busy chat.');
  const missing = parseStoryAnswer(JSON.stringify({ joke: 'A line that is not there.', body: good }))!;
  assert.equal(missing.body, good, 'a joke missing from the body keeps the body');
  assert.equal(missing.joke, null, '…and drops the joke field');
  const labelled = parseStoryAnswer(JSON.stringify({ thread: 'Their Drive against Levity.', body: good }))!;
  assert.equal(labelled.thread, null, 'a plan line naming a category is dropped');
  ok('the parser rejects length, paragraphs, "you are", "always", "!", banned topics and category names');
}

// 8. The saved record and the fold.
{
  const saved = parseSageStory({
    body: 'A day.',
    fingerprint: 'f',
    generatedOn: '2026-10-08',
    categoryIds: ['cat_drive'],
    thread: { categories: ['cat_drive', 'cat_levity'], jokeAxis: 'playfulness' },
  })!;
  assert.deepEqual(saved.thread, { categories: ['cat_drive', 'cat_levity'], jokeAxis: 'playfulness' });
  const junk = parseSageStory({ body: 'A day.', fingerprint: 'f', generatedOn: '2026-10-08', thread: { categories: 'x' } })!;
  assert.ok(junk, 'a bad thread never breaks the saved story');
  assert.equal(junk.thread, undefined);
  const old = parseSageStory({ body: 'A day.', fingerprint: 'f', generatedOn: '2026-10-08' })!;
  assert.equal(old.thread, undefined, 'stories saved before v2 still read');

  const fold = read('src/components/sage-story-fold.tsx');
  assert.match(fold, /pickStoryThread\(\{ tracks, last: story\?\.thread \?\? null, crisisToday \}\)/);
  assert.match(fold, /thread: threadRecord\(thread\)/);
  assert.match(fold, /divergenceAxis, thread, userId: me\.id, ymd/);
  const thread = read('src/lib/story-thread.ts');
  assert.doesNotMatch(thread, /generateText|supabase|fetch\(/, 'the picker is pure');
  ok('the thread is saved with the story, old stories still read, and the fold passes tracks, last thread and crisis');
}

// Story v3 (emci, 2026-10-09): the Story as a card, checked part by part.
{
  const good = {
    title: 'the calm fixer',
    scene: 'On a day like this, the group chat lights up about a dinner plan while you finish up at work.',
    moment: 'The plan starts to wobble, and you notice you want it settled while a friend wants to keep it loose.',
    handle: 'You might offer a simple time and place, then leave a little room for the others to add to it.',
    means: 'You tend to bring calm to a messy plan, and people quietly count on that more than they say.',
    joke: 'Your calendar has seen more drafts of this dinner than the restaurant has seen guests.',
  };
  const parsed = parseStoryCardAnswer(JSON.stringify(good), { jokeAsked: true });
  assert.ok(parsed.card, `a grounded card is accepted (${parsed.reason})`);
  assert.equal(parsed.card!.joke, good.joke);
  assert.equal(parseStoryCardAnswer(JSON.stringify(good), { jokeAsked: false }).card!.joke, null, 'no joke asked → none kept');
  const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...good, ...patch });
  assert.match(parseStoryCardAnswer(bad({ moment: 'Your Accountable side kicks in the moment the dinner plan starts to wobble with friends.' }), { jokeAsked: false }).reason ?? '', /moment: side label/, 'a trait label in the text is rejected');
  assert.match(parseStoryCardAnswer(bad({ scene: 'On a day like this, twelve messages about dinner arrive before you finish work.' }), { jokeAsked: false }).reason ?? '', /count word/, 'no counting');
  assert.equal(parseStoryCardAnswer('nope', { jokeAsked: false }).reason, 'not json');
  const noHandle = parseStoryCardAnswer(bad({ handle: 'Your Steady side handles it.' }), { jokeAsked: false }).card!;
  assert.equal(noHandle.handle, null, 'a bad optional part is dropped, never shown, not paid for twice');
  assert.equal(parseStoryCardAnswer(bad({ title: 'the anxious planner' }), { jokeAsked: false }).card!.title, null);
  assert.equal(storyLabelLeak('You pull into the driveway as the chat buzzes.'), null, 'everyday words stay allowed');
  assert.equal(storyLabelLeak('Then How You Love shows up again.'), 'names a category');
  assert.equal(storyLabelLeak('It is how you love the people around you, plainly.'), null, 'the same words in lowercase are an everyday phrase');
  assert.equal(parseStoryCardAnswer(bad({ title: 'the steady planner' }), { jokeAsked: false }).card!.title, 'the steady planner', 'a plain describing title is kept (emci 2026-10-09)');
  assert.equal(parseStoryCardAnswer(bad({ title: 'the anxious planner' }), { jokeAsked: false }).card!.title, null, 'a worry title is still dropped');
  // Flow (emci 2026-10-09): everyday settings, no niche phone details, no repeated part.
  assert.match(
    parseStoryCardAnswer(bad({ scene: 'A voice note arrives while you make tea in your kitchen, and the kettle begins to whistle loudly.' }), { jokeAsked: false }).reason ?? '',
    /scene: niche phone detail/,
    'no voice notes, typing bubbles or read receipts',
  );
  const repeat = parseStoryCardAnswer(
    bad({ handle: 'The dinner plan starts to wobble, and you want it settled while a friend wants to keep things loose.' }),
    { jokeAsked: false },
  ).card!;
  assert.equal(repeat.handle, null, 'a handle that repeats the moment is dropped');
  assert.ok(storyOverlap(good.handle, good.moment) <= STORY_REPEAT_LIMIT, 'a handle that moves on is kept');
  const flowPrompt = STORY_CARD_PROMPT_STATIC;
  assert.match(flowPrompt, /"plan" — write this FIRST/, 'plan first');
  assert.match(flowPrompt, /CALLS BACK to one concrete detail from the scene/, 'callback joke');
  assert.match(flowPrompt, /never voice notes, typing bubbles or read receipts/);
  assert.match(flowPrompt, /this overrides the "how people live now" list/, 'the setting rule wins over the voice block');
  assert.equal(parseStoryCardAnswer(bad({ joke: 'Your voice notes about dinner are longer than the dinner itself.' }), { jokeAsked: true }).card!.joke, null, 'no niche phone details in the joke either');
  const card = parsed.card!;
  const saved = parseSageStory({ body: storyCardBody(card), fingerprint: 'f', generatedOn: '2026-10-09', card })!;
  assert.deepEqual(saved.card, card, 'the card is saved and read back');
  assert.equal(parseSageStory({ body: 'A day.', fingerprint: 'f', generatedOn: '2026-10-09' })!.card, undefined, 'old body-only stories still read');
  const t2 = pickStoryThread({ tracks: rich, last: null, crisisToday: false })!;
  const p1 = buildStoryCardPrompt({ tracks: rich, divergenceNote: null, thread: t2, userId: 'u1', ymd: '2026-10-09' });
  assert.ok(p1.startsWith(STORY_CARD_PROMPT_STATIC), 'fixed instructions first (cache-friendly)');
  const foldSrc = read('src/components/sage-story-fold.tsx');
  assert.match(foldSrc, /story\?\.card \? \(\s*<>\s*<StoryCardView/, 'a card story renders as parts');
  assert.match(foldSrc, /Built from: /, 'the categories behind it show as a label');
  assert.match(foldSrc, /logAiReject\('story'/, 'a rejection is logged with its reason only');
  // Deeper Story (emci 2026-10-09): what they noticed, the other way, next time — optional, checked, dropped when weak.
  const deep = parseStoryCardAnswer(
    bad({
      noticed: 'Your friend notices you made the plan easier for everyone without making a big deal of it.',
      otherWay: 'Had you leaned the other way, you might have let the plan drift and enjoyed seeing where the evening took everyone.',
      nextTime: 'What happens when the plan is yours to make?',
    }),
    { jokeAsked: true },
  ).card!;
  assert.ok(deep.noticed && deep.otherWay && deep.nextTime, 'the deeper parts are kept when they pass');
  const deepBad = parseStoryCardAnswer(
    bad({ noticed: 'Your Steady side was obvious.', nextTime: 'Next time, a new plan.' }),
    { jokeAsked: true },
  ).card!;
  assert.equal(deepBad.noticed, null, 'a weak noticed line is dropped');
  assert.equal(deepBad.nextTime, null, 'next time must be a question');
  assert.match(STORY_CARD_PROMPT_STATIC, /"otherWay" — /);
  const p2 = buildStoryCardPrompt({ tracks: rich, divergenceNote: null, thread: { ...t2, joke: null }, userId: 'u1', ymd: '2026-10-09' });
  assert.doesNotMatch(p2, /JOKE TARGET: none/, 'every Story gets its joke now');
  ok('Story v3: a card in parts, no trait words in the text, optional parts dropped, old stories still read, deeper parts checked');
}

console.log(`\n${passed} story-thread checks passed`);
