/**
 * Story v2 (emci 2026-10-08; docs/proposals/story-v2-plan.md): the thread
 * picker, the prompt it feeds and the checks on the model's answer.
 * Run: npm run check:story-thread
 *
 * Offline only. Nothing here can prove the writing; it proves what the model
 * receives and what the app accepts back.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  STORY_FEW_SHOTS,
  STORY_OUTPUT_TOKENS,
  STORY_REPEAT_LIMIT,
  buildStoryCardPrompt,
  isStoryV2,
  parseStoredStoryCard,
  parseStoryCardAnswer,
  storyCardBody,
  storyLabelLeak,
  storyOverlap,
} from '../src/lib/story-card';
import { pickBestPunchline, punchlineCraftViolation } from '../src/lib/voice/card-joke';
import { STORY_JOKE_RULES } from '../src/lib/voice/moment-voice';
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
  const thread = pickStoryThread({ tracks: one, last: null, noJoke: false });
  assert.ok(thread);
  assert.deepEqual(ids(thread.categories), ['cat_openness']);
  assert.equal(pickStoryThread({ tracks: [], last: null, noJoke: false }), null);
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
  const thread = pickStoryThread({ tracks: rich, last: null, noJoke: false })!;
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
    const next = pickStoryThread({ tracks: rich, last, noJoke: false })!;
    const nextKey = threadRecord(next).categories.slice().sort().join('+');
    assert.notEqual(nextKey, last.categories.slice().sort().join('+'), 'a new load never repeats the last combo');
    last = threadRecord(next);
  }
  const single = tracksOf({ openness: 0.9, extraversion: 0.85 });
  const only = pickStoryThread({ tracks: single, last: { categories: ['cat_openness'], jokeAxis: null }, noJoke: false })!;
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
    pickStoryThread({ tracks: rich, last: null, noJoke: false })!,
    ...rankStoryCombos(scored).map((categories) => ({ categories, joke: pickJokeTarget(rich, categories, false) })),
  ]) {
    if (thread.joke) assert.ok(isShareableLean(thread.joke.axis, thread.joke.lean));
  }
  // A struggle lean (steadiness:low) as the strongest axis is skipped for the next shareable one.
  const shaky = tracksOf({ steadiness: 0.02, conscientiousness: 0.8, agreeableness: 0.75 });
  const steady = scoreReadyCategories(shaky).find((row) => row.reading.def.id === 'cat_steadiness')!;
  const target = pickJokeTarget(shaky, [steady], false);
  assert.ok(target && target.axis !== 'steadiness');
  assert.equal(pickJokeTarget(shaky, [steady], true), null, 'noJoke: no joke');
  assert.equal(pickStoryThread({ tracks: rich, last: null, noJoke: true })!.joke, null);
  ok('the joke targets the strongest shareable lean; never a private one; none on a crisis day');
}

// 6. The prompt carries only the chosen categories' stored copy.
{
  const userId = 'u-check';
  const ymd = '2026-10-08';
  const thread = pickStoryThread({ tracks: rich, last: null, noJoke: false })!;
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
    thread: pickStoryThread({ tracks: rich, last: null, noJoke: true }),
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
  // Humor is 18+ (emci, 2026-10-19): dark topics pass, only the harm filter refuses.
  assert.ok(parseStoryBody(JSON.stringify({ body: 'Your inbox could kill a lesser phone.' })), '"kill" as a figure of speech passes');
  assert.ok(parseStoryBody(JSON.stringify({ body: 'That therapy app pinged again.' })), 'therapy as a topic passes');
  assert.ok(parseStoryBody(JSON.stringify({ body: 'The hangover RSVPd before you did, and the group chat is already dead.' })), 'drinking and death pass');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'The group chat went quiet, so just hurt yourself and save everyone time.' })), null, 'encouraging self-harm');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'Your inbox is full of retards again.' })), null, 'a slur');
  assert.equal(parseStoryBody(JSON.stringify({ body: 'Three drinks deep, then drive home to beat the traffic.' })), null, 'drunk driving as an instruction');
  assert.equal(punchlineCraftViolation('Somebody tell the toaster to go die already.'), 'crosses a boundary');
  assert.equal(punchlineCraftViolation('The meeting died twice. Nobody sent flowers.'), null, 'a dark punchline passes');
  assert.equal(punchlineCraftViolation('Hungover, still drunk on spite, the spreadsheet wins. Damn.'), null, 'drunk, hangover and mild swearing pass');
  // Strong swearing (emci 2026-10-19, round 3): allowed when it earns its place.
  assert.equal(punchlineCraftViolation('The spreadsheet wins again. Fuck the spreadsheet.'), null, 'strong swearing passes');
  assert.ok(parseStoryBody(JSON.stringify({ body: 'What the fuck, the group chat planned a picnic in the rain.' })), 'strong swearing in a story body passes');
  assert.equal(punchlineCraftViolation('They fucked in the car before the toast.'), 'crosses a boundary', 'sexually explicit "fuck" is still refused');
  assert.match(STORY_JOKE_RULES, /strong swearing included/, 'the prompt says strong swearing is allowed');
  assert.equal(punchlineCraftViolation('Rough week. Kill yourself, the calendar already did.'), 'crosses a boundary', 'encouraging suicide');
  assert.equal(punchlineCraftViolation('The group chat called him a faggot, and the plan died.'), 'crosses a boundary', 'a slur');
  assert.equal(punchlineCraftViolation('Two beers in, you drink and drive to the afterparty.'), 'crosses a boundary', 'drunk driving');
  assert.equal(punchlineCraftViolation('The date ended in porn on the hotel TV.'), 'crosses a boundary', 'sexually explicit');
  // Invented claims about real people: keywords cannot judge truth. It is a prompt rule
  // (STORY_JOKE_BANS) backed by the card's proper-name check on every story line.
  assert.match(STORY_JOKE_RULES, /invented claims about real people stated as fact/);
  assert.match(
    parseStoryCardAnswer(
      JSON.stringify({
        title: 'The Bread Basket Diplomat',
        hook: 'Friday, 8:40. Your table has been staring at the kitchen door like it owes them money.',
        twist: 'The server arrives empty-handed. Apparently Beyoncé once waited three hours here and sued the chef.',
        move: 'You slide the bread basket to the middle like a peace treaty, order whatever is fastest plus fries for the hostages, and start a ranking of everyone\'s worst-ever restaurant disaster.',
        punchline: 'By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.',
        reveal: 'When plans break, you quietly turn the delay into the good part.',
        next: 'Next time: you\'re first at the cinema. Your friends are not.',
      }),
      { allowExampleHooks: true },
    ).reason ?? '',
    /twist: proper name/,
    'a named real person in a story line is refused (the claim about them can only be judged by the prompt rule)',
  );
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
  ok('the parser rejects length, paragraphs, "you are", "always", "!", harm-boundary jokes and category names; dark topics pass');
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

  const fold = read('src/components/insights/insights-story-card.tsx');
  assert.match(fold, /pickStoryThread\(\{ tracks, last: story\?\.thread \?\? null, noJoke: false \}\)/);
  assert.match(fold, /thread: threadRecord\(thread\)/);
  const thread = read('src/lib/story-thread.ts');
  assert.doesNotMatch(thread, /generateText|supabase|fetch\(/, 'the picker is pure');
  ok('the thread is saved with the story, old stories still read, and the card passes tracks and the last thread');
}

// Story v4 (emci, 2026-10-13): six beats, nickname titles, punchline craft.
{
  const good = {
    title: 'The Bread Basket Diplomat',
    hook: 'Friday, 8:40. Your table has been staring at the kitchen door like it owes them money.',
    twist: 'The server arrives empty-handed. "So the kitchen lost your slip." Your friend\'s eye starts to twitch. Someone opens a delivery app under the table.',
    move: 'You slide the bread basket to the middle like a peace treaty, order whatever is fastest plus fries for the hostages, and start a ranking of everyone\'s worst-ever restaurant disaster.',
    punchline: 'By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.',
    punchlines: [
      'By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.',
      'Things worked out in the end for everyone.',
    ],
    reveal: 'When plans break, you quietly turn the delay into the good part.',
    next: 'Next time: you\'re first at the cinema. Your friends are not.',
  };
  const parsed = parseStoryCardAnswer(JSON.stringify(good), { jokeAsked: true, allowExampleHooks: true });
  assert.ok(parsed.card, `a grounded v2 card is accepted (${parsed.reason})`);
  assert.equal(parsed.card!.v, 2);
  assert.ok(isStoryV2(parsed.card!));
  assert.equal(parsed.card!.punchline, good.punchline);
  const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...good, ...patch });
  assert.match(
    parseStoryCardAnswer(bad({ twist: 'Your Accountable side kicks in the moment the kitchen loses the slip with friends around.' }), {
      allowExampleHooks: true,
    }).reason ?? '',
    /twist: side label/,
    'a trait label in the text is rejected',
  );
  assert.ok(
    parseStoryCardAnswer(bad({ hook: 'The kitchen door has been ignored through 212 tiny glances from the table.' }), { allowExampleHooks: true })
      .card,
    'exaggerated numbers are allowed',
  );
  assert.equal(parseStoryCardAnswer('nope', { jokeAsked: false }).reason, 'not json');
  assert.match(
    parseStoryCardAnswer(bad({ title: 'The Anxious Planner' }), { allowExampleHooks: true }).reason ?? '',
    /title: tone/,
  );
  // emci 2026-10-19: everyday feeling words pass; diagnoses and labels still fail.
  assert.ok(
    parseStoryCardAnswer(bad({ hook: 'You get anxious before the big call, then the kitchen door finally swings open with your order.' }), {
      allowExampleHooks: true,
    }).card,
    '"anxious" in a story line passes',
  );
  assert.ok(
    parseStoryCardAnswer(bad({ hook: 'You feel insecure when the table goes quiet, so you start a ranking of the worst menus ever.' }), {
      allowExampleHooks: true,
    }).card,
    '"insecure" in a story line passes',
  );
  for (const hook of [
    'A disorderly kitchen door swings open while the table goes quiet and everyone checks their phone.',
    'Your therapist would have notes while the kitchen door stays shut and the table goes quiet.',
    'A bit depressed about Monday, the table goes quiet while the kitchen door stays shut for ages.',
    // Round 3 (emci 2026-10-19): context, not blanket bans — a label on the table is not a label on the reader.
    'Your friends turn codependent while the kitchen door stays shut and nobody moves at all.',
    'The group chat turns toxic while the kitchen door stays shut and the table goes quiet.',
    'Trauma-bonded by the bread basket, the table goes quiet while the kitchen door stays shut.',
  ]) {
    assert.ok(parseStoryCardAnswer(bad({ hook }), { allowExampleHooks: true }).card, `everyday words pass: ${hook}`);
  }
  for (const hook of [
    'Your anxiety disorder kicks in while the kitchen door stays shut and the table goes quiet.',
    'Your avoidant attachment kicks in while the kitchen door stays shut and the table goes quiet.',
    'Your toxic side kicks in while the kitchen door stays shut and the table goes quiet.',
    'That is so bipolar of you while the kitchen door stays shut and the table goes quiet.',
    'Very narcissistic of you while the kitchen door stays shut and the table goes quiet.',
    'You are clearly depressed while the kitchen door stays shut and the table goes quiet.',
    'Your anxious-attachment kicks in while the kitchen door stays shut and the table goes quiet.',
    'Your securely-attached side kicks in while the kitchen door stays shut and the table goes quiet.',
  ]) {
    assert.match(parseStoryCardAnswer(bad({ hook }), { allowExampleHooks: true }).reason ?? '', /clinical word|framework term|you are/, `still fails: ${hook}`);
  }
  assert.equal(storyLabelLeak('You pull into the driveway as the chat buzzes.'), null, 'everyday words stay allowed');
  assert.equal(storyLabelLeak('Then How You Love shows up again.'), 'names a category');
  assert.equal(storyLabelLeak('It is how you love the people around you, plainly.'), null, 'the same words in lowercase are an everyday phrase');
  // Core content policy (2026-10-20): voice notes / read receipts / typing bubbles are preferred moments
  // in moment-voice.ts, so they pass; the old "niche phone detail" ban is gone.
  assert.ok(
    parseStoryCardAnswer(
      bad({ hook: 'A voice note arrives while you make tea in your kitchen, and the kettle begins to whistle loudly.' }),
      { allowExampleHooks: true },
    ).card,
    'a voice note, typing bubble or read receipt is an allowed moment',
  );
  // "should": an ordinary or joking "should" passes; an order aimed at the reader fails.
  assert.ok(
    parseStoryCardAnswer(
      bad({ hook: 'The clock should have been faster while the kitchen door stays shut and the table goes quiet.' }),
      { allowExampleHooks: true },
    ).card,
    'a joke "should" passes',
  );
  for (const hook of [
    'You should wait while the kitchen door stays shut and the table goes quiet around you.',
    'You need to wait while the kitchen door stays shut and the table goes quiet around you.',
  ]) {
    assert.match(
      parseStoryCardAnswer(bad({ hook }), { allowExampleHooks: true }).reason ?? '',
      /hook: advice/,
      `advice aimed at the reader fails: ${hook}`,
    );
  }
  const repeat = parseStoryCardAnswer(
    bad({
      move: 'Friday, 8:40. Your table has been staring at the kitchen door like it owes them money and then some more.',
    }),
    { allowExampleHooks: true },
  );
  assert.match(repeat.reason ?? '', /repeat|move: length/);
  assert.ok(storyOverlap(good.move, good.twist) <= STORY_REPEAT_LIMIT, 'a move that moves on is kept');
  const flowPrompt = STORY_CARD_PROMPT_STATIC;
  assert.match(flowPrompt, /Plan silently first in "plan"/, 'plan first');
  assert.match(flowPrompt, /call back to the hook/);
  assert.doesNotMatch(flowPrompt, /never voice notes, typing bubbles or read receipts/, 'no blanket phone-detail ban in the prompt');
  assert.match(flowPrompt, /voice notes, typing bubbles and read receipts included/, 'phone details are welcome inside a scene');
  assert.match(flowPrompt, /a story lives in one physical scene/, 'the setting rule keeps the story in one scene');
  assert.match(flowPrompt, /The Bread Basket Diplomat/);
  for (const shot of STORY_FEW_SHOTS) {
    const row = parseStoryCardAnswer(JSON.stringify(shot), { allowExampleHooks: true });
    assert.ok(row.card, `few-shot ${shot.title} fails: ${row.reason}`);
  }
  const card = parsed.card!;
  const saved = parseSageStory({ body: storyCardBody(card), fingerprint: 'f', generatedOn: '2026-10-13', card })!;
  assert.equal(saved.card!.hook, card.hook, 'the v2 card is saved and read back');
  assert.equal(parseSageStory({ body: 'A day.', fingerprint: 'f', generatedOn: '2026-10-13' })!.card, undefined, 'old body-only stories still read');
  const v1 = parseStoredStoryCard({
    title: 'the calm fixer',
    scene: 'On a day like this the group chat lights up.',
    moment: 'The plan starts to wobble between friends who want different things tonight.',
    means: 'You tend to bring calm to a messy plan more than they say.',
  });
  assert.ok(v1 && !isStoryV2(v1), 'v1 saved cards still parse');
  const t2 = pickStoryThread({ tracks: rich, last: null, noJoke: false })!;
  const p1 = buildStoryCardPrompt({ tracks: rich, divergenceNote: null, thread: t2, userId: 'u1', ymd: '2026-10-13' });
  assert.ok(p1.startsWith(STORY_CARD_PROMPT_STATIC), 'fixed instructions first (cache-friendly)');
  const foldSrc = read('src/components/insights/insights-story-card.tsx');
  assert.match(foldSrc, /StoryV2View/, 'a v2/v3 card renders as swipe beats');
  // v1 (AI) cards are not shown on Insights (template-only, 2026-10-14).
  assert.match(foldSrc, /isTemplateStory/, 'only template / bank cards are shown');
  assert.match(read('src/components/story-v2-view.tsx'), /Built from:/, 'the categories behind it sit behind an info tap');
  const deep = parseStoryCardAnswer(
    bad({
      otherWay: 'Had you panicked, the delivery app would have won and the bread basket would have stayed in the corner.',
    }),
    { allowExampleHooks: true, jokeAsked: true },
  ).card!;
  assert.ok(deep.otherWay, 'Plot B is kept when it passes');
  const deepBad = parseStoryCardAnswer(bad({ otherWay: 'Your Steady side would have panicked.' }), { allowExampleHooks: true }).card;
  assert.equal(deepBad?.otherWay ?? null, null, 'a weak Plot B is dropped');
  assert.match(STORY_CARD_PROMPT_STATIC, /"otherWay"/);
  const p2 = buildStoryCardPrompt({ tracks: rich, divergenceNote: null, thread: { ...t2, joke: null }, userId: 'u1', ymd: '2026-10-13' });
  assert.doesNotMatch(p2, /JOKE TARGET: none/, 'every Story still gets a joke target from SIDE A');
  assert.match(STORY_JOKE_RULES, /rule of three/);
  assert.match(STORY_JOKE_RULES, /last 6/);
  assert.match(STORY_JOKE_RULES, /candidate punchlines/);
  assert.match(STORY_JOKE_RULES, /explaining the joke/);
  assert.match(STORY_JOKE_RULES, /puns for their own sake/);
  assert.equal(punchlineCraftViolation('The joke is that the bread won.'), 'explains the joke');
  assert.equal(punchlineCraftViolation('Living the dream, the table is fine.'), 'banned cliché');
  assert.equal(punchlineCraftViolation(good.punchline), null);
  const picked = pickBestPunchline(
    [
      'Things worked out in the end for everyone.',
      good.punchline,
      'Which is funny because the wait became the night.',
    ],
    { hook: good.hook, twist: good.twist, move: good.move },
  );
  assert.equal(picked, good.punchline, 'the rerank keeps the callback punchline');
  assert.equal(STORY_OUTPUT_TOKENS, 800);
  // The app-side AI Story writer and the rewrite-on-open path were removed
  // with Sage (2026-10-14); the server library keeps its own prompt.
  assert.ok(!existsSync(resolve(root, 'src/lib/explore/generate.ts')), 'no app-side AI Story writer');
  assert.doesNotMatch(foldSrc, /rewriteOldStory|onOpen=/, 'nothing rewrites a story on open');
  const view = read('src/components/story-v2-view.tsx');
  assert.match(view, /reduceMotion\s*\?[\s\S]*FadeIn\.duration\(180\)/, 'Reduce Motion is a cross-fade, never static');
  assert.match(view, /FadeInDown[\s\S]*springify/, 'Motion Full is a bigger fade and rise');
  assert.doesNotMatch(view, /theme\.motionMs >= 500/, 'Motion Full is OS !reduceMotion, not only Zen');
  assert.match(view, /Previous beat/, 'VoiceOver has a swipe alternative');
  assert.match(view, /accessibilityRole="adjustable"/, 'the pager is adjustable');
  assert.doesNotMatch(view, /allowFontScaling=\{false\}/, 'Dynamic Type stays on');
  assert.match(view, /Share\.share[\s\S]*catch/, 'share failures do not throw');
  assert.doesNotMatch(view, /What they noticed|What it means for you/);
  assert.equal(parseStoryCardAnswer('{not json').reason, 'not json', 'malformed JSON is rejected');
  assert.match(
    parseStoryCardAnswer(
      bad({
        hook: 'The kitchen door has been ignored through tiny glances from the waiting table and then some more waiting again.',
      }),
      { allowExampleHooks: true },
    ).reason ?? '',
    /hook: length/,
    'an over-long hook is rejected',
  );
  assert.equal(punchlineCraftViolation('The buffer looks like luck to everyone else tonight.'), 'banned cliché');
  // Insights (2026-10-14): the card never calls a model, so there is no
  // token claim, no rewrite and no AI timeout to fall through from.
  assert.doesNotMatch(foldSrc, /claimStoryGenerate|AI_TAP_TIMEOUT_MS|withTimeout/, 'no model path on the Story card');
  assert.match(read('scripts/live-ai.ts'), /request\.topP/, 'live Story checks pass topP 0.95');
  ok('Story v4: six beats, nickname titles, numbers and one quote allowed, v1 still reads, Plot B optional');
}

console.log(`\n${passed} story-thread checks passed`);
