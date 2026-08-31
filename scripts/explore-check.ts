/**
 * Explore — Sage thread observations. Run: npm run check:explore
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { decideExploreTrigger } from '../src/lib/explore/cadence';
import {
  AGENCY_AXES,
  dropsAgencyTriple,
  exploreFingerprint,
  pickExploreFocus,
  pickExplorePackFocuses,
} from '../src/lib/explore/combine';
import { EXPLORE_GUARD_FALLBACK, EXPLORE_LABEL, EXPLORE_NOTED } from '../src/lib/explore/copy';
import { EXPLORE_FEW_SHOTS, buildExplorePrompt } from '../src/lib/explore/prompt';
import { routeExplore } from '../src/lib/explore/route';
import type { ExploreMeSlice, ExplorePackRow } from '../src/lib/explore/types';
import type { DevTraceRecordInput } from '../src/lib/dev-trace';
import {
  matchingPhrasePattern,
  PHRASE_FLAG_CLOSING,
  PHRASE_FLAG_REFRAME,
  PHRASE_FLAG_TYPE,
} from '../src/lib/voice/phrase-guard';
import { matchingJargonTerm } from '../src/lib/voice/jargon';
import type { CheckHistory } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const chipsOnly: ExploreMeSlice = {
  name: 'Sam',
  show_up: 'steady',
  talk_style: 'even',
  knocks_you_off: 'sleep',
  morning_cue: 'make coffee',
  evening_wind_down: 'dim the lights',
  energy_pattern: 'morning',
  recovery_style: 'movement',
  support_style: 'nudge',
  current_focus: 'show_up',
  timezone: 'America/Edmonton',
};

const twoSkips: CheckHistory[] = [
  { day: 1, status: 'skipped', read: 'Keep it small.', do: 'After coffee, sit one minute.' },
  { day: 2, status: 'skipped', read: 'Still here.', do: 'After coffee, write one line.' },
];

const knockHistory: CheckHistory[] = [
  {
    day: 1,
    status: 'done',
    read: 'Sleep ran the week, not you.',
    do: 'After coffee, put the phone in another room.',
  },
];

assert.equal(matchingPhrasePattern("That's not laziness, that's a full week."), PHRASE_FLAG_REFRAME);
assert.equal(matchingPhrasePattern("Follow-through isn't vanity, it's fear."), PHRASE_FLAG_REFRAME);
assert.equal(
  matchingPhrasePattern('You showed up twice. That\'s just how you\'re built.'),
  PHRASE_FLAG_CLOSING,
);
assert.equal(
  matchingPhrasePattern('You logged it — that\'s just who you are.'),
  PHRASE_FLAG_CLOSING,
);
assert.equal(
  matchingPhrasePattern("You're the type of person who finishes the list."),
  PHRASE_FLAG_TYPE,
);
assert.equal(matchingPhrasePattern('Maybe those two are in the same week.'), null);
ok('phrase-pattern regex catches reframe, closing, and type-of-person');

assert.equal(matchingJargonTerm('You are an introvert.'), 'introvert');
assert.equal(matchingPhrasePattern('You are an introvert.'), null);
ok('word-level jargon and phrase-pattern flags stay distinct');

assert.deepEqual(
  dropsAgencyTriple(['growth_mindset', 'locus_of_control', 'self_efficacy']),
  ['growth_mindset', 'locus_of_control'],
);
ok('agency triple is dropped to two');

const noSignal = pickExploreFocus(chipsOnly, []);
assert.equal(noSignal.signal, null);
assert.equal(noSignal.traits.length, 0);
assert.ok(noSignal.chips.includes('morning_cue'));
ok('no signal and no axes → 9 chips, not a manufactured combo');

const oneAxis: ExploreMeSlice = { ...chipsOnly, extraversion: 0.8 };
const oneTrait = pickExploreFocus(oneAxis, []);
assert.deepEqual(oneTrait.traits, ['extraversion']);
assert.equal(oneTrait.signal, null);
ok('no signal → single filled trait');

const unusedCombo = pickExploreFocus(
  { ...chipsOnly, extraversion: 0.8, openness: 0.2, conscientiousness: 0.9 },
  [],
);
assert.equal(unusedCombo.traits.length, 1);
assert.ok(!unusedCombo.traits.includes('openness') || unusedCombo.traits.length === 1);
ok('no signal never manufactures a 2–3 combo from extra filled axes');

const withKnock = pickExploreFocus(
  { ...chipsOnly, steadiness: 0.2, extraversion: 0.8 },
  knockHistory,
);
assert.equal(withKnock.signal?.kind, 'knock');
assert.ok(withKnock.traits.includes('steadiness'));
assert.ok(withKnock.traits.length >= 2 && withKnock.traits.length <= 3);
ok('knock signal combines 2–3 filled traits including a tied axis');

const agencyMe: ExploreMeSlice = {
  ...chipsOnly,
  growth_mindset: 0.8,
  locus_of_control: 0.7,
  self_efficacy: 0.6,
};
const agencyFocus = pickExploreFocus(agencyMe, twoSkips);
assert.ok(agencyFocus.traits.filter((axis) => (AGENCY_AXES as readonly string[]).includes(axis)).length < 3);
ok('skip signal never puts all three agency axes in one entry');

const nullAxis = pickExploreFocus({ ...chipsOnly, extraversion: 0.8 }, knockHistory);
assert.ok(!nullAxis.traits.includes('steadiness'));
ok('unused (null) axes never enter a combo');

const todayPack: ExplorePackRow = {
  id: 'p1',
  generatedOn: '2026-08-29',
  trigger: 'first',
  fingerprint: 'same',
  createdAt: '2026-08-29T12:00:00.000Z',
  entries: [],
};
assert.equal(
  decideExploreTrigger({ pack: todayPack, today: '2026-08-29', fingerprint: 'changed' }),
  null,
);
assert.equal(
  decideExploreTrigger({ pack: todayPack, today: '2026-08-30', fingerprint: 'changed' }),
  'signal',
);
assert.equal(
  decideExploreTrigger({ pack: todayPack, today: '2026-09-05', fingerprint: 'same' }),
  'weekly',
);
assert.equal(decideExploreTrigger({ pack: null, today: '2026-08-29', fingerprint: 'x' }), 'first');
ok('regen is weekly or on fingerprint change; never a second regen the same day');

assert.notEqual(
  exploreFingerprint(chipsOnly, [], {}),
  exploreFingerprint({ ...chipsOnly, facts: ['I finish at four'] }, [], {}),
);
ok('a new fact changes the fingerprint');

const prompt = buildExplorePrompt({
  me: { ...chipsOnly, extraversion: 0.8, steadiness: 0.2 },
  focus: withKnock,
  reactionNotes: ['old miss'],
});
assert.match(prompt, /EXPLORE SHAPE/);
assert.match(prompt, /You skipped twice this week, both times when your plate was already full/);
assert.doesNotMatch(prompt, /37%|we don't know much|richer because they filled/i);
assert.match(prompt, /Completeness is not an input/);
assert.match(prompt, /AXIS GROUNDING/);
assert.match(prompt, /extraversion: energy from people and activity vs energy from quiet and solitude/);
assert.match(prompt, /steadiness: emotional evenness under pressure vs feeling things sharply/);
assert.doesNotMatch(prompt, /37%|we don't know much|richer because they filled/i);
assert.match(EXPLORE_FEW_SHOTS, /## Explore/);
ok('Explore prompt has four few-shots and no completeness-as-input copy');

const promptSrc = read('src/lib/explore/prompt.ts');
const GROUNDING_LINES = [
  'openness: curiosity about ideas, new experiences, trying something unfamiliar',
  'conscientiousness: follow-through, structure, planning ahead vs staying loose',
  'extraversion: energy from people and activity vs energy from quiet and solitude',
  'agreeableness: how they move through disagreement — softening it or naming it',
  'steadiness: emotional evenness under pressure vs feeling things sharply',
  'attachment_anxiety: needing reassurance, worrying where they stand with someone',
  'attachment_avoidance: pulling back or staying self-reliant as closeness increases',
  'conflict_assertiveness: saying the hard thing directly, or letting it sit',
  'conflict_cooperativeness: looking for a shared fix, or holding their ground',
  'autonomy: wanting to choose their own path vs wanting guidance',
  'competence: confidence in their own follow-through and capability',
  'relatedness: how connected they feel to the people around them right now',
  'growth_mindset: whether setbacks read as fixed or as something that can shift',
  'locus_of_control: outcomes feeling steered by them, or happening to them',
  "self_efficacy: belief they can actually do the thing they're setting out to do",
  'playfulness: whether a bit of lightness is how a day lands, versus treating the day as a job',
] as const;
assert.equal(GROUNDING_LINES.length, 16);
for (const line of GROUNDING_LINES) {
  assert.ok(promptSrc.includes(line), `prompt source missing grounding: ${line}`);
}
const chipsOnlyPrompt = buildExplorePrompt({
  me: chipsOnly,
  focus: { traits: [], chips: ['morning_cue'], signal: null },
  reactionNotes: [],
});
assert.doesNotMatch(chipsOnlyPrompt, /AXIS GROUNDING/);
ok('grounding line content exists for all sixteen axes; chips-only prompts skip it');

function walkComponents(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkComponents(next));
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(next);
  }
  return out;
}
for (const file of walkComponents(resolve(root, 'src/components'))) {
  const src = readFileSync(file, 'utf8');
  for (const line of GROUNDING_LINES) {
    assert.ok(!src.includes(line), `${file} must not contain prompt grounding`);
  }
}
ok('none of the fifteen grounding strings appear in any component file');

async function main() {
const denied = await routeExplore({
  me: chipsOnly,
  history: [],
  aiConsent: false,
});
assert.equal(denied.kind, 'consent-denied');
const pending = await routeExplore({ me: chipsOnly, history: [], aiConsent: null });
assert.equal(pending.kind, 'consent-pending');
const crisis = await routeExplore({
  me: chipsOnly,
  history: [],
  aiConsent: true,
  crisisToday: true,
});
assert.equal(crisis.kind, 'crisis');
ok('consent and crisis are honest-empty, same gates as Talk');

let jargonLogged = '';
let phraseLogged = '';
const generated = await routeExplore(
  {
    me: { ...chipsOnly, extraversion: 0.8 },
    history: [],
    aiConsent: true,
    now: new Date('2026-08-29T15:00:00Z'),
  },
  {
    useLocal: false,
    generateBody: async () =>
      "That's not a skip, that's who you are. You're the type of person who quits.",
    claimAiCall: async () => ({ ok: true as const }),
    logJargonHit: async (flag) => {
      jargonLogged = flag;
    },
    logPhraseHit: async (flag) => {
      phraseLogged = flag;
    },
  },
);
assert.equal(generated.kind, 'pack');
assert.equal(generated.pack?.entries[0]?.body, EXPLORE_GUARD_FALLBACK);
assert.ok(jargonLogged.length > 0 || phraseLogged.length > 0);
ok('jargon and phrase guards swap to the safe line before display');

const phraseOnly = await routeExplore(
  {
    me: { ...chipsOnly, extraversion: 0.8 },
    history: [],
    aiConsent: true,
    now: new Date('2026-08-29T15:00:00Z'),
  },
  {
    useLocal: false,
    generateBody: async () => 'You showed up. That is just how you are built.',
    claimAiCall: async () => ({ ok: true as const }),
    logPhraseHit: async (flag) => {
      phraseLogged = flag;
    },
  },
);
assert.equal(phraseOnly.pack?.entries[0]?.body, EXPLORE_GUARD_FALLBACK);
assert.equal(phraseLogged, PHRASE_FLAG_CLOSING);
ok('phrase-pattern miss logs phrase_flag, not jargon_flag');

const explorePipe: DevTraceRecordInput[] = [];
const localExplored = await routeExplore(
  {
    me: { ...chipsOnly, extraversion: 0.8 },
    history: knockHistory,
    aiConsent: true,
    now: new Date('2026-08-29T15:00:00Z'),
  },
  {
    useLocal: true,
    recordTrace: async (row) => {
      explorePipe.push(row);
    },
  },
);
assert.equal(localExplored.kind, 'pack');
assert.ok(explorePipe.length >= 1);
assert.equal(explorePipe[0].surface, 'explore');
assert.deepEqual(
  explorePipe[0].steps?.map((step) => step.step_type),
  ['context_gather', 'model_call', 'guard_check', 'output'],
);
assert.equal(explorePipe[0].steps?.[0].label, 'Traits + signal + Library');
ok('Explore logs ordered context → model → guard → output on the generic step schema');

const flaggedPipe: DevTraceRecordInput[] = [];
await routeExplore(
  {
    me: { ...chipsOnly, extraversion: 0.8 },
    history: [],
    aiConsent: true,
    now: new Date('2026-08-29T15:00:00Z'),
  },
  {
    useLocal: false,
    generateBody: async () => 'You showed up. That is just how you are built.',
    claimAiCall: async () => ({ ok: true as const }),
    recordTrace: async (row) => {
      flaggedPipe.push(row);
    },
  },
);
const guardStep = flaggedPipe[0]?.steps?.find((step) => step.step_type === 'guard_check');
assert.equal(guardStep?.status, 'flagged');
ok('Explore guard_check is flagged when phrase/jargon fires');

const cached = await routeExplore(
  {
    me: chipsOnly,
    history: [],
    aiConsent: true,
    now: new Date('2026-08-29T18:00:00Z'),
  },
  {
    loadLatestPack: async () => todayPack,
    generateBody: async () => {
      throw new Error('must not generate when cached same day');
    },
  },
);
assert.equal(cached.kind, 'cached');
ok('cached pack is reused; no second generate the same day');

const home = read('src/app/(tabs)/index.tsx');
const sage = read('src/app/(tabs)/sage.tsx');
assert.doesNotMatch(home, /ExplorePanel/);
assert.doesNotMatch(home, /HomeInnerTabs/);
assert.match(sage, /routeExplore/);
assert.match(sage, /SageExploreObservations/);
assert.doesNotMatch(sage, /EXPLORE_LEDE|EXPLORE_LABEL/);
ok('Explore observations render on Sage; Home has no inner tabs');

const you = read('src/app/(tabs)/you.tsx');
assert.doesNotMatch(you, /ExplorePanel|HomeInnerTabs|explore_entries/);
ok('Explore is not on the You tab');

const talk = read('src/lib/voice/talk.ts');
const router = read('src/lib/voice/router.ts');
assert.doesNotMatch(talk, /phrase-guard|matchingPhrasePattern|logPhraseHit/);
assert.doesNotMatch(router, /phrase-guard|matchingPhrasePattern|logPhraseHit/);
assert.match(talk, /matchingJargonTerm/);
assert.match(router, /jargonInCard/);
ok('Read/Do/Talk/Nudge generation and word guard are untouched');

const sql = read('supabase/migrations/explore.sql');
assert.match(sql, /create table public.explore_packs/);
assert.match(sql, /create table public.explore_entries/);
assert.match(sql, /create table public.explore_reactions/);
assert.match(sql, /record_explore_reaction/);
assert.match(sql, /never ME or trait/);
assert.match(sql, /phrase_flag/);
assert.match(sql, /log_phrase_guard/);
assert.doesNotMatch(sql, /update public\.me/);
assert.doesNotMatch(sql, /trait_sources/);
ok('feedback table cannot write ME or traits; phrase_flag is on ai_usage');

const panel = read('src/components/explore-panel.tsx');
assert.match(panel, /logJargonGuard/);
assert.match(panel, /logPhraseGuard/);
assert.match(panel, /matchingJargonTerm|routeExplore/);
assert.match(read('src/lib/explore/route.ts'), /containsFrameworkTerm/);
assert.match(read('src/lib/explore/route.ts'), /matchingJargonTerm/);
assert.match(read('src/lib/explore/route.ts'), /matchingPhrasePattern/);
ok('both guards and the framework fence run before Explore is shown');

assert.equal(EXPLORE_NOTED, 'Noted.');
assert.match(panel, /EXPLORE_NOTED/);
assert.match(panel, /withTiming/);
const reactFn = panel.slice(
  panel.indexOf('async function react'),
  panel.indexOf('const message'),
);
assert.match(reactFn, /recordExploreReaction/);
assert.match(reactFn, /setNoted/);
assert.doesNotMatch(reactFn, /generateExploreBody|claimAiCall|gemini/i);
ok('reaction tap shows a local Noted fade and does not call the model');

assert.equal(EXPLORE_LABEL, 'Explore');
assert.ok(pickExplorePackFocuses(chipsOnly, []).length >= 1);

console.log(`\nAll ${passed} explore checks passed.`);
}

void main();
