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
  buildDivePrompt,
  categoryLeans,
  diveLineViolation,
  leanPct,
  leansKey,
  parseDive,
  parseStoredDive,
  type DiveLean,
} from '../src/lib/category-deep-dive/dive';
import { CATEGORY_DEEP_DIVE_COPY_REVIEWED } from '../src/lib/category-deep-dive/flags';
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
assert.match(prompt, /"mix"/, 'two leanings → how they mix');
assert.doesNotMatch(prompt, /userId|user_id|@|handle/i, 'no account details in the prompt');
const loveLeans: DiveLean[] = [
  { axis: 'attachment_avoidance', lean: 'low', pct: 74 },
  { axis: 'attachment_anxiety', lean: 'high', pct: 66 },
];
assert.match(buildDivePrompt(loveDef, loveLeans), /Be extra gentle/, 'Love / closeness gets the gentle block');
assert.doesNotMatch(prompt, /Be extra gentle/);
assert.doesNotMatch(buildDivePrompt(openDef, leans.slice(0, 1)), /"mix"/, 'one leaning → no mix asked');
ok('prompt: moment voice, category + sides only, no numbers repeated, gentle block for Love / closeness');

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
  ['digit', bad({ othersNotice: 'Friends notice you try 3 new things a week and still pick small plans over the big ones.' })],
  ['name not allowed', bad({ othersNotice: 'Friends notice you queue up Netflix documentaries about places, and pick small plans over big ones.' })],
  ['clinical word', bad({ othersNotice: 'Friends notice you get a little anxious at big parties and pick small plans over the big ones.' })],
  ['advice', bad({ whatItMeansForYou: 'You keep a list of places to try and visit them alone on a Sunday. You should share that list with someone, it is a good one.' })],
  ['you are', bad({ mix: 'You are curious but solo, so new things tend to arrive through a book, a tab or a long walk instead of a crowd.' })],
  ['always', bad({ mix: 'Your curiosity always travels solo, so new things tend to arrive through a book, a tab or a long walk, not a crowd.' })],
  ['brackets', bad({ mix: 'Your curiosity mostly travels solo, so new things arrive through [one modern moment] rather than a crowd, quietly.' })],
  ['bad title', bad({ title: 'The Curious Homebody Of Sundays' })],
  ['worry title', bad({ title: 'the anxious explorer' })],
  ['wrong axis', bad({ showsUp: [good.showsUp[0], { axis: 'autonomy', line: good.showsUp[1]!.line }] })],
  ['missing leaning', bad({ showsUp: [good.showsUp[0]] })],
  ['duplicate leaning', bad({ showsUp: [good.showsUp[0], good.showsUp[0]] })],
  ['no mix', bad({ mix: undefined })],
  ['too short', bad({ othersNotice: 'You like small plans.' })],
  ['not json', 'Here is your deep dive: title...'],
];
for (const [label, raw] of rejects) assert.equal(parseDive(raw, openDef, leans), null, `rejects: ${label}`);
assert.equal(diveLineViolation('You are calm.', 'x'), 'you are');
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
ok('wave90: own rows only, written by RPC, one new card a day, wiped by Reset account');

const consent = read('src/components/ai-consent-card.tsx');
assert.match(consent, /AI_USE_DISCLOSURE = '[^']*category deep dives/, 'the disclosure names this AI use (Apple 5.1.2)');
assert.match(consent, /category deep dives you ask for/, 'so does the consent ask');
assert.equal(CATEGORY_DEEP_DIVE_COPY_REVIEWED, false, 'ships unreviewed until emci reads the review doc');
assert.match(read('src/components/dev-hub-panels.tsx'), /CATEGORY_DEEP_DIVE_COPY_REVIEWED/, 'listed on the dev hub copy list');
assert.ok(existsSync(resolve(root, 'docs/category-deep-dive-review.md')), 'review doc exists');
assert.ok(read('docs/category-deep-dive-review.md').includes('Be extra gentle'), 'the review doc shows the Love / closeness prompt');
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
assert.match(card, /rowLeans\.map\(\(lean\) => `\$\{leanLabel\(lean\)\} \$\{lean\.pct\}%`\)/, 'every row shows its numbers without a tap');
assert.match(card, /\{on \? detail : null\}/, 'the detail opens right under its row');
ok('friendly names on Home and Explore (catalog names kept for AI), trait letters as a legend, numbers on every row');

console.log(`\ncheck:category-deep-dive — ${passed} groups passed.`);
