/**
 * Category deep dive on Home — offline rules (emci, 2026-10-08).
 * Run: npm run check:category-deep-dive
 *
 * Pins: the leanings math ("Adventurous 78%"), the fingerprint that decides
 * when a fresh card is due, the prompt (moment voice, no numbers repeated, the
 * gentle Love / closeness block), the validator (grounded answers pass; digits,
 * names, clinical words, advice, brackets and bad titles are rejected), the
 * wiring (one AI call, only on its button, after consent and the server
 * claim; placed on Home after the insight, hidden on a crisis day), wave90's
 * rules, the consent copy naming this use, and the review gate.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLE_NAME } from '../src/lib/axis-poles';
import { CATEGORY_DEFS } from '../src/lib/categories';
import {
  DIVE_CARDS_PER_CALL,
  DIVE_PROMPT_STATIC,
  buildDiveBundlePrompt,
  diveOutputTokens,
  buildDivePrompt,
  categoryLeans,
  categoryScore,
  diveLineViolation,
  leanPct,
  leansKey,
  parseDive,
  parseDiveBundle,
  parseStoredDive,
  type DiveLean,
} from '../src/lib/category-deep-dive/dive';
import { CATEGORY_DEEP_DIVE_COPY_REVIEWED } from '../src/lib/category-deep-dive/flags';
import { cardJokeStyle } from '../src/lib/voice/card-joke';
import { reasonOnly } from '../src/lib/ai/reject-reason';
import { madeToday, mergeDives, parseDiveState } from '../src/lib/category-deep-dive/state';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import { MOMENT_VOICE_BLOCK } from '../src/lib/voice/moment-voice';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { categoryAxisCodes, categoryDisplayName } from '../src/lib/category-labels';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}

const NOW = new Date('2026-10-08T12:00:00Z');
function profile(leans: Partial<Record<TraitAxis, number>>): TraitTrack[] {
  return TRAIT_AXES.map((axis) => ({
    axis,
    track: 'report',
    value: leans[axis] ?? 0.5,
    stability: 0.9,
    answerCount: 6,
    lastTouched: NOW.toISOString(),
    lastDepthAt: null,
  }));
}
const openDef = CATEGORY_DEFS.find((d) => d.id === 'cat_openness')!;
const loveDef = CATEGORY_DEFS.find((d) => d.id === 'cat_love')!;

/* ------------------------------------------------------------- leanings --- */

assert.equal(leanPct(0.78), 78);
assert.equal(leanPct(0.22), 78, 'the low side reads the same way: 78% toward it');
assert.equal(leanPct(0.5), 50, '50% is the middle');
const tracks = profile({ openness: 0.9, extraversion: 0.2 });
const leans = categoryLeans(openDef, tracks, NOW);
assert.deepEqual(
  leans.map((r) => [r.axis, r.lean, r.pct]),
  [
    ['openness', 'high', 90],
    ['extraversion', 'low', 80],
  ],
  'strongest first, with the side and how far',
);
assert.equal(AXIS_POLE_NAME.openness.high, 'Adventurous');
assert.deepEqual(categoryLeans(openDef, [], NOW), [], 'no stable answers → no leanings, no card');
assert.equal(leansKey(leans), leansKey(categoryLeans(openDef, profile({ openness: 0.91, extraversion: 0.21 }), NOW)), 'a small wobble keeps the card');
assert.notEqual(leansKey(leans), leansKey(categoryLeans(openDef, profile({ openness: 0.9, extraversion: 0.6 }), NOW)), 'a flipped side means a fresh card');
assert.notEqual(leansKey(leans), leansKey(categoryLeans(openDef, profile({ openness: 0.7, extraversion: 0.2 }), NOW)), 'a big move means a fresh card');
ok('leanings: "Adventurous 90%" (side + how far, 50% = middle), strongest first; a fresh card only when a side flips or moves ~10 points');

/* --------------------------------------------------------------- prompt --- */

const prompt = buildDivePrompt(openDef, leans);
assert.ok(prompt.includes(MOMENT_VOICE_BLOCK), 'moment voice');
assert.ok(prompt.includes('THE CATEGORY: Openness to life'));
assert.ok(!/\b90\b|\b80\b/.test(prompt), 'the percentages are never sent as numbers (the card shows them, the AI never repeats them)');
assert.match(prompt, /MIX: yes/, 'two leanings → how they mix');
assert.doesNotMatch(prompt, /userId|user_id|@|handle/i, 'no account details in the prompt');
const loveLeans: DiveLean[] = [
  { axis: 'attachment_avoidance', lean: 'low', pct: 74 },
  { axis: 'attachment_anxiety', lean: 'high', pct: 66 },
];
assert.match(buildDivePrompt(loveDef, loveLeans), /THE CATEGORY: Love \/ closeness \(GENTLE\)/, 'Love / closeness is marked GENTLE');
assert.match(DIVE_PROMPT_STATIC, /A card marked GENTLE is about closeness/, 'and the gentle rules are in every prompt');
assert.doesNotMatch(prompt, /\(GENTLE\)/);
assert.match(buildDivePrompt(openDef, leans.slice(0, 1)), /MIX: no/, 'one leaning → no mix asked');
assert.match(prompt, /CLEAR FIRST, MOMENT SECOND/, 'plain insight first, one realistic example second');
assert.match(prompt, /No counting and no exaggeration/);
assert.match(prompt, /A low or "quiet" side is a style with an upside/);
assert.ok(leansKey(leans).startsWith('v2|'), 'cards from the old prompt offer a rewrite');
ok('prompt: moment voice + clear-first style, category + sides only, no numbers or counting, gentle block for Love / closeness');

/* ------------------------------------------------------------ validator --- */

const good = {
  title: 'the curious homebody',
  showsUp: [
    { axis: 'openness', line: 'You save a recipe from a cuisine you have never tried, then actually cook it on a quiet weeknight.' },
    { axis: 'extraversion', line: 'You leave the party a little early and feel completely fine about it, already picturing a slow morning.' },
  ],
  mix: 'Your curiosity mostly travels solo, so new things tend to arrive through a book, a tab or a long walk rather than a crowd.',
  othersNotice: 'Friends notice you bring back the strangest good finds, and that you pick small plans over big ones.',
  whatItMeansForYou: 'You keep a list of places to try and visit them alone on a Sunday. That quiet kind of exploring says you trust your own taste.',
};
const parsed = parseDive(JSON.stringify(good), openDef, leans);
assert.ok(parsed, 'a grounded answer is accepted');
assert.equal(parsed.leansKey, leansKey(leans));
assert.equal(parsed.categoryId, 'cat_openness');
const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...good, ...patch });
const rejects: [string, string][] = [
  ['digit', bad({ whatItMeansForYou: 'You try 3 new places a month and go to them alone on a Sunday. That quiet kind of exploring says you trust your own taste.' })],
  ['count word', bad({ whatItMeansForYou: 'You open twelve tabs about a trip and still visit one place alone on a Sunday. That quiet kind of exploring says you trust your own taste.' })],
  ['name not allowed', bad({ whatItMeansForYou: 'You queue up Netflix documentaries about places and visit one alone on a Sunday. That quiet kind of exploring says you trust your own taste.' })],
  ['clinical word', bad({ whatItMeansForYou: 'You get a little anxious at big parties and visit new places alone on a Sunday. That quiet kind of exploring says you trust your own taste.' })],
  ['advice', bad({ whatItMeansForYou: 'You keep a list of places to try and visit them alone on a Sunday. You should share that list with someone, it is a good one.' })],
  ['you are', bad({ whatItMeansForYou: 'You are curious but solo, so new places arrive on a quiet Sunday walk. That quiet kind of exploring says you trust your own taste.' })],
  ['always', bad({ whatItMeansForYou: 'Your curiosity always travels solo, so new places arrive on a quiet Sunday walk. That quiet kind of exploring says you trust your own taste.' })],
  ['brackets', bad({ whatItMeansForYou: 'Your curiosity mostly travels solo, so new things arrive through [one modern moment] instead. That quiet kind of exploring says you trust your own taste.' })],
  ['bad title', bad({ title: 'The Curious Homebody Of Sundays' })],
  ['worry title', bad({ title: 'the anxious explorer' })],
  ['wrong axis', bad({ showsUp: [good.showsUp[0], { axis: 'autonomy', line: good.showsUp[1]!.line }] })],
  ['missing leaning', bad({ showsUp: [good.showsUp[0]] })],
  ['duplicate leaning', bad({ showsUp: [good.showsUp[0], good.showsUp[0]] })],
  ['short meaning', bad({ whatItMeansForYou: 'You trust your taste.' })],
  ['bad shows-up line', bad({ showsUp: [good.showsUp[0], { axis: 'extraversion', line: 'You leave the party early, all twelve times this year, and feel fine.' }] })],
  ['not json', 'Here is your deep dive: title...'],
];
for (const [label, raw] of rejects) assert.equal(parseDive(raw, openDef, leans), null, `rejects: ${label}`);
// Each line-rule case is long enough to pass the length rule, so it fails for its named reason.
for (const [label, raw] of rejects) {
  if (!['digit', 'count word', 'name not allowed', 'clinical word', 'advice', 'you are', 'always', 'brackets'].includes(label)) continue;
  const means = (JSON.parse(raw) as { whatItMeansForYou: string }).whatItMeansForYou;
  const n = means.trim().split(/\s+/).length;
  assert.ok(n >= 20 && n <= 60, `${label}: within the length limits (${n})`);
  assert.ok(diveLineViolation(means, 'Openness to life Adventurous Curiosity Reserved Sociability'), `${label}: rejected by the line rules themselves`);
}
assert.equal(diveLineViolation('You are calm.', 'x'), 'you are');
// Optional parts are DROPPED when they fail (never shown, never a second paid call).
assert.equal(parseDive(bad({ mix: undefined }), openDef, leans)?.mix, null, 'a missing mix drops only the mix');
assert.equal(parseDive(bad({ othersNotice: 'You like small plans.' }), openDef, leans)?.othersNotice, null, 'a too-short notice is dropped');
assert.equal(
  parseDive(bad({ othersNotice: 'Friends notice you open twelve tabs about a trip and still pick small plans over the big ones.' }), openDef, leans)?.othersNotice,
  null,
  'a counting notice is dropped',
);
// Bundle: two cards in one call; the first must pass, a failed extra is left out.
const socialDef = CATEGORY_DEFS.find((d) => d.id === 'cat_social')!;
const socialLeans = categoryLeans(socialDef, profile({ openness: 0.9, extraversion: 0.2, agreeableness: 0.7, playfulness: 0.8 }), NOW);
const specA = { def: openDef, leans, jokeStyle: cardJokeStyle('u1|cat_openness|2026-10-08') };
const specB = { def: socialDef, leans: socialLeans, jokeStyle: null };
const bundlePrompt = buildDiveBundlePrompt([specA, specB]);
assert.ok(bundlePrompt.startsWith(DIVE_PROMPT_STATIC), 'fixed instructions first (cache-friendly)');
assert.match(bundlePrompt, /CARD 1 — THE CATEGORY: Openness to life[\s\S]*CARD 2 — THE CATEGORY: Everyday social energy/);
assert.ok(!DIVE_PROMPT_STATIC.includes('Openness to life'), 'nothing card-specific in the fixed block');
const socialCard = {
  title: 'the easy company',
  showsUp: socialLeans.slice(0, 3).map((row) => ({ axis: row.axis, line: 'You make room for people around you and keep the mood light, like when you start the silly thread everyone joins.' })),
  whatItMeansForYou: 'You bring an easy warmth to the people around you. You see it when a quiet group chat wakes up after your message. That says people feel at home with you.',
};
const both = parseDiveBundle(JSON.stringify({ cards: [{ ...good, funny: 'Your saved recipes folder is a travel blog that never left the kitchen.' }, socialCard] }), [specA, specB]);
assert.ok(both.dives[0] && both.dives[1], 'both cards kept');
assert.equal(both.dives[0]!.joke, 'Your saved recipes folder is a travel blog that never left the kitchen.', 'the funny part is kept');
assert.equal(both.dives[1]!.joke, undefined, 'no joke asked for the extra → none kept');
const firstBad = parseDiveBundle(JSON.stringify({ cards: [{ ...good, title: 'the anxious one' }, socialCard] }), [specA, specB]);
assert.deepEqual(firstBad.dives, [], 'the tapped card must pass, or the answer is rejected');
assert.match(firstBad.reason ?? '', /^title:/, 'with its reason (logged, never the text)');
const extraBad = parseDiveBundle(JSON.stringify({ cards: [good, { ...socialCard, whatItMeansForYou: 'Short.' }] }), [specA, specB]);
assert.ok(extraBad.dives[0] && !extraBad.dives[1], 'a failed extra card is simply left out');
assert.equal(
  parseDiveBundle(JSON.stringify({ cards: [{ ...good, funny: 'Your plants have died of politeness twice this month, honestly.' }] }), [specA]).dives[0]?.joke,
  undefined,
  'a banned joke topic is dropped',
);
assert.equal(diveOutputTokens(1), 600, 'one card: a trimmed answer budget');
assert.ok(diveOutputTokens(2) <= 1024, 'two cards stay under the server’s 1024 output cap');
assert.equal(DIVE_CARDS_PER_CALL, 2);
assert.match(read('src/lib/category-deep-dive/generate.ts'), /const specs = pass === 1 \? bundle : \[input\.main\];/, 'the retry asks for the tapped card only');
assert.equal(reasonOnly('moment line: name not in entry: Kyoto'), 'moment line: name not in entry', 'logs keep the rule, never the quoted word');
assert.equal(reasonOnly('means: number not in entry: 5'), 'means: number not in entry');
assert.equal(reasonOnly('not json'), 'not json');
ok(`AI answers: grounded ones pass; ${rejects.length} kinds of made-up, clinical or off-voice answers are rejected`);

const stored = parseStoredDive(JSON.parse(JSON.stringify(parsed)));
assert.deepEqual(stored, parsed, 'a saved card reads back the same');
const state = parseDiveState(JSON.stringify({ userId: 'u1', dives: { cat_openness: { dive: parsed, madeOn: '2026-10-08' } } }), 'u1');
assert.ok(state.dives.cat_openness, 'phone cache parses');
assert.deepEqual(parseDiveState(JSON.stringify({ userId: 'other', dives: {} }), 'u1').dives, {}, 'never another account’s cards');
assert.equal(madeToday(state.dives, '2026-10-08'), true, 'one card today → today’s deep dive is used');
assert.equal(madeToday(state.dives, '2026-10-09'), false);
const older = { dive: { ...parsed, title: 'the old one' }, madeOn: '2026-10-01' };
assert.equal(mergeDives([older], state.dives).cat_openness!.dive.title, 'the curious homebody', 'the newer card wins');
ok('saved cards: read back the same, per account only, newest per category, one new card a day');

/* --------------------------------------------------------------- wiring --- */

const card = read('src/components/category-deep-dive-card.tsx');
assert.doesNotMatch(card, /generateText\(/, 'the card never calls the model directly');
const writeAt = card.indexOf('const write = useCallback');
assert.ok(writeAt > 0 && card.indexOf('writeCategoryDeepDive(') > writeAt, 'the call is only inside the button handler');
assert.equal(card.split('writeCategoryDeepDive(').length - 1, 1, 'exactly one call site');
assert.match(card, /if \(!def \|\| writingRef\.current \|\| leans\.length === 0\) return;/, 'a double tap does nothing');
assert.match(card, /if \(epochRef\.current !== epochAtStart\) return;/, 'a wipe while writing is never written back');
assert.doesNotMatch(card, /COPY_REVIEWED|[Dd]raft/, 'no draft badge in the app');
const gen = read('src/lib/category-deep-dive/generate.ts');
assert.ok(gen.indexOf('consentGranted') < gen.indexOf('claimCategoryDeepDive()'), 'consent before the claim');
assert.ok(gen.indexOf('claimCategoryDeepDive()') < gen.indexOf('generateText('), 'the server claim before the call');
assert.match(gen, /const claim = await claimCategoryDeepDive\(\);\s*if \(claim !== 'ok'\) return \{ ok: false,/, 'no claim, no AI call');
assert.match(read('src/lib/category-deep-dive/store.ts'), /PGRST202/, 'before wave90 is applied it says "not switched on yet", never "used"');
assert.match(card, /madeToday\(state\.dives, diveDay\(\)\)/, 'the phone counts the day the way the server does (UTC)');
assert.match(card, /outcome = await pending;/, 'a slow answer is waited for, never thrown away (the claim is spent)');
const home = read('src/app/(tabs)/index.tsx');
const state2 = home.indexOf('STATE 2');
const cardAt = home.indexOf('<CategoryDeepDiveCard');
assert.ok(state2 > 0 && cardAt > state2, 'only in State 2 (after Questions are finished)');
assert.ok(cardAt > home.indexOf('INSIGHT_LOAD_LABEL}'), 'under the daily insight');
assert.ok(cardAt < home.lastIndexOf('{pickBlock}'), 'above Today’s Pick');
assert.match(home, /!crisisToday \? \(\s*<CategoryDeepDiveCard/, 'hidden on a crisis day');
assert.equal(home.split('<CategoryDeepDiveCard').length - 1, 1);
ok('one AI call, only on "Write my deep dive", after consent and the server claim; on Home under the insight, State 2 only, hidden on a crisis day');

const sql = read('supabase/migrations/wave90_category_deep_dive.sql');
assert.match(sql, /create policy category_deep_dives_select_own on public\.category_deep_dives\s+for select using \(auth\.uid\(\) = user_id\);/);
assert.match(sql, /revoke insert, update, delete on public\.category_deep_dives from public, anon, authenticated;/);
assert.match(sql, /category_deep_dive_daily_cap int not null default 1/, 'one a day (emci)');
assert.match(sql, /added_today >= cap then\s+raise exception 'daily limit'/, 'new rows limited to the daily cap');
for (const fn of ['claim_category_deep_dive()', 'save_category_deep_dive(text, text, jsonb, date)']) {
  assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon;`), `${fn} revoked from anon`);
}
assert.match(sql, /delete from public\.category_deep_dives where user_id = uid;/, 'Reset account wipes the deep dives');
const sql91 = read('supabase/migrations/wave91_category_deep_dive_bundle.sql');
assert.match(sql91, /added_today >= cap \* 2 then\s+raise exception 'daily limit'/, 'wave91: two new cards per claimed call (the bundle)');
assert.doesNotMatch(sql91, /claim_category_deep_dive\(\)\s*returns/, 'the one-call-a-day claim is unchanged');
assert.match(card, /opensOn: diveDay\(new Date\(Date\.now\(\) \+ 86_400_000\)\)/, 'the extra card opens tomorrow');
assert.match(card, /opensLater \? \(/, 'and stays closed until then');
ok('wave90: own rows only, written by RPC, one new card a day, wiped by Reset account');

const consent = read('src/components/ai-consent-card.tsx');
assert.match(consent, /AI_USE_DISCLOSURE = '[^']*category deep dives/, 'the disclosure names this AI use (Apple 5.1.2)');
assert.match(consent, /category deep dives you ask for/, 'so does the consent ask');
assert.equal(CATEGORY_DEEP_DIVE_COPY_REVIEWED, false, 'ships unreviewed until emci reads the review doc');
assert.match(read('src/components/dev-hub-panels.tsx'), /CATEGORY_DEEP_DIVE_COPY_REVIEWED/, 'listed on the dev hub copy list');
assert.ok(existsSync(resolve(root, 'docs/category-deep-dive-review.md')), 'review doc exists');
assert.ok(read('docs/category-deep-dive-review.md').includes('(GENTLE)'), 'the review doc shows the Love / closeness prompt');
ok('consent copy names deep dives; flag off; review doc with both sample prompts');

// Friendly names + the two-letter legend (emci, 2026-10-08), shared by Home and Explore.
for (const def of CATEGORY_DEFS) {
  const shown = categoryDisplayName(def);
  assert.ok(shown && shown !== def.name, `${def.id} has a friendly name`);
  assert.ok(!containsFrameworkTerm(shown), `${def.id}: no framework word in "${shown}"`);
}
assert.equal(new Set(CATEGORY_DEFS.map((d) => categoryDisplayName(d))).size, CATEGORY_DEFS.length, 'every name is different');
assert.equal(categoryDisplayName(openDef), 'Your Sense of Adventure');
assert.equal(categoryAxisCodes(openDef), 'OP·EX');
assert.match(read('src/components/categories-fold.tsx'), /from '@\/lib\/category-labels'/, 'Explore uses the same names');
assert.match(card, /categoryAxisCodes\(row\)/, 'each row shows its trait letters');
assert.match(card, /\{score\}/, 'every row shows its one number without a tap');
assert.match(card, /rowLeans\.map\(\(lean\) => leanLabel\(lean\)\)/, 'and its sides in words (the per-trait numbers open on tap)');
assert.match(card, /\{on \? detail : null\}/, 'the detail opens right under its row');
assert.equal(categoryScore([{ axis: 'steadiness', lean: 'high', pct: 72 }, { axis: 'agreeableness', lean: 'low', pct: 63 }, { axis: 'conscientiousness', lean: 'high', pct: 52 }]), 62, 'equal confidence → the average lean');
assert.equal(
  categoryScore([
    { axis: 'steadiness', lean: 'high', pct: 90, confidence: 0.9 },
    { axis: 'agreeableness', lean: 'low', pct: 50, confidence: 0.1 },
  ]),
  86,
  'the surer answer counts most (a shaky trait barely moves the number)',
);
assert.equal(
  categoryScore([
    { axis: 'steadiness', lean: 'high', pct: 80, weight: 2 },
    { axis: 'agreeableness', lean: 'high', pct: 50, weight: 1 },
  ]),
  70,
  'the category’s own weights count',
);
const realLeans = categoryLeans(openDef, tracks, NOW);
assert.ok(realLeans.every((r) => typeof r.confidence === 'number' && r.confidence > 0), 'real leanings carry their confidence');
assert.equal(categoryScore([]), null, 'a locked category has no number');
assert.match(card, /\.sort\(\(a, b\) => \(b\.score \?\? -1\) - \(a\.score \?\? -1\) \|\| a\.index - b\.index\)/, 'strongest first, locked last');
ok('one number per category (lean weighted by the category’s weights and answer confidence), sorted strongest first');
ok('friendly names on Home and Explore (catalog names kept for AI), trait letters as a legend, numbers on every row');

console.log(`\ncheck:category-deep-dive — ${passed} groups passed.`);
