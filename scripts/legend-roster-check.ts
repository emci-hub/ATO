/**
 * Museum of legends — offline rules (emci, 2026-10-08).
 * Run: npm run check:legend-roster
 *
 * Pins, like check:question-bank does for the fixed questions:
 * - the roster: permanent ids (roster-ids.json, append-only — an id can never
 *   vanish, be renamed or be reused), the real/story rules (real people died
 *   2005 or earlier; myths labelled), a source URL + check phrases on every
 *   fact, moment and birthday, sizes (3–5 facts, 2–3 moments, 4–6 angles, 3–5
 *   tags), voice, and coverage: every one of the 32 trait sides has at least
 *   1 visible legend in the pilot and at least 8 in the full roster;
 * - the picker: locked on a flat profile, three different legends, stable,
 *   no repeats, hidden legends only when unlocked, On this day, the bonus set,
 *   least-told angle;
 * - the AI story: good answers pass; any number, name or quote not in the
 *   entry, an unknown axis or moment, "you are", "!" or a myth told as history
 *   is rejected; the fallback uses only hand-written words;
 * - the wiring: no model call outside "Meet them", wave89's privacy rules,
 *   the dev tool inside the tools branch, the review doc and flag.
 *
 * Facts are checked against their sources by hand with network
 * (`npx tsx scripts/legend-roster-verify.ts <cache-dir>`), never in the gate.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLE_NAME } from '../src/lib/axis-poles';
import { LEGEND_FIGURES_COPY_REVIEWED, LEGEND_ROSTER_STAGE } from '../src/lib/legend-figures/flags';
import {
  LEGEND_MIN_CLEAR_LEANS,
  chooseAngle,
  hasNewSettledLean,
  legendLocked,
  pickLegendSet,
  scoreLegend,
} from '../src/lib/legend-figures/pick';
import { LEGEND_ROSTER, legendById } from '../src/lib/legend-figures/roster';
import {
  buildLegendPrompt,
  fallbackLegendStory,
  legendLineViolation,
  legendPairs,
  parseLegendStory,
  shownFacts,
  shownMoments,
  type LegendPair,
} from '../src/lib/legend-figures/story';
import { LEGEND_HALLS, LEGEND_REGIONS, type LegendFigure } from '../src/lib/legend-figures/types';
import { rankStoryAxes } from '../src/lib/story-thread';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import { MOMENT_VOICE_BLOCK } from '../src/lib/voice/moment-voice';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}
function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const full = LEGEND_ROSTER_STAGE === 'full';

/* ------------------------------------------------------------------ ids --- */

const manifest = JSON.parse(read('src/lib/legend-figures/roster-ids.json')) as Record<string, string>;
const ids = LEGEND_ROSTER.map((l) => l.id);
assert.equal(new Set(ids).size, ids.length, 'every legend id is unique');
for (const id of ids) assert.match(id, /^lf_[a-z0-9_]{2,40}$/, `id format: ${id}`);
for (const [id, name] of Object.entries(manifest)) {
  const legend = legendById(id);
  assert.ok(legend, `pinned id ${id} (${name}) must stay in the roster — ids are forever (retire, never delete)`);
  assert.equal(legend.name, name, `pinned id ${id} keeps its name (${name}) — never reuse an id for someone else`);
}
for (const id of ids) assert.ok(id in manifest, `new legend ${id} must be appended to roster-ids.json`);
ok(`${ids.length} legends; ids unique, pinned in roster-ids.json, never renamed or removed`);

/* --------------------------------------------------------------- shape --- */

const BANNED_STORED = [/!/, /\balways\b/i, /\p{Extended_Pictographic}/u, /\byou are\b/i, /\bjourney\b/i, /\bself-care\b/i, /\bmanifest\b/i, /\bconsider\b/i];
function storedClean(text: string, where: string) {
  assert.ok(text.trim().length > 0, `${where}: empty`);
  for (const re of BANNED_STORED) assert.doesNotMatch(text, re, `${where}: banned (${re}) in "${text}"`);
  assert.ok(!containsFrameworkTerm(text), `${where}: framework term in "${text}"`);
}

for (const l of LEGEND_ROSTER) {
  const at = l.id;
  assert.ok((LEGEND_HALLS as readonly string[]).includes(l.hall), `${at}: hall`);
  assert.ok((LEGEND_REGIONS as readonly string[]).includes(l.region), `${at}: region`);
  if (l.kind === 'real') {
    assert.ok(typeof l.died === 'number' && l.died <= 2005, `${at}: a real legend died 2005 or earlier`);
    assert.notEqual(l.gender, 'none', `${at}: a real person has a gender for the spread rule`);
  } else {
    assert.equal(l.died, undefined, `${at}: a story legend has no death year`);
    assert.equal(l.birthday, undefined, `${at}: a story legend has no birthday`);
  }
  assert.ok(l.facts.length >= 3 && l.facts.length <= 5, `${at}: 3–5 facts`);
  assert.ok(l.moments.length >= 2 && l.moments.length <= 3, `${at}: 2–3 moments`);
  assert.ok(l.angles.length >= 4 && l.angles.length <= 6, `${at}: 4–6 angles`);
  assert.ok(l.tags.length >= 3 && l.tags.length <= 5, `${at}: 3–5 trait tags`);
  l.facts.forEach((f, i) => assert.equal(f.id, `f${i + 1}`, `${at}: fact ids f1…`));
  l.moments.forEach((m, i) => assert.equal(m.id, `m${i + 1}`, `${at}: moment ids m1…`));
  l.angles.forEach((a, i) => assert.equal(a.id, `a${i + 1}`, `${at}: angle ids a1…`));
  assert.equal(new Set(l.tags.map((t) => t.axis)).size, l.tags.length, `${at}: one tag per axis`);
  const sources = [...l.facts.map((f) => f.source), ...l.moments.map((m) => m.source), ...(l.birthday ? [l.birthday.source] : [])];
  for (const s of sources) {
    assert.match(s.url, /^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/, `${at}: every fact has a source URL`);
    assert.ok(s.check.length > 0 && s.check.every((c) => c.trim().length > 0), `${at}: every source names the phrases it was checked on`);
  }
  assert.ok(shownFacts(l).length >= 3, `${at}: at least 3 verified facts to show`);
  assert.ok(shownMoments(l).length >= 2, `${at}: at least 2 verified moments to show`);
  if (l.birthday) assert.match(l.birthday.md, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, `${at}: birthday MM-DD`);
  assert.ok(words(l.essence) <= 14, `${at}: essence ≤ 14 words`);
  assert.ok(words(l.whoTheyWere) <= 40, `${at}: who they were ≤ 40 words`);
  assert.ok(words(l.famousFor) <= 30, `${at}: famous for ≤ 30 words`);
  assert.ok(l.vetting.trim().length > 10, `${at}: vetting note`);
  for (const a of l.angles) {
    assert.match(a.teaser, /\?$/, `${at} ${a.id}: a teaser is a question`);
    assert.ok(words(a.teaser) <= 24, `${at} ${a.id}: teaser ≤ 24 words`);
    assert.ok(words(a.meaning) <= 30, `${at} ${a.id}: meaning ≤ 30 words`);
    storedClean(a.teaser, `${at} ${a.id} teaser`);
    storedClean(a.meaning, `${at} ${a.id} meaning`);
  }
  for (const t of l.tags) {
    assert.ok(words(t.them) <= 6, `${at} ${t.axis}: "them" ≤ 6 words`);
    storedClean(t.them, `${at} ${t.axis} them`);
    storedClean(t.why, `${at} ${t.axis} why`);
  }
  for (const text of [l.essence, l.whoTheyWere, l.famousFor, ...l.facts.map((f) => f.text), ...l.moments.map((m) => m.text)]) {
    storedClean(text, `${at} label`);
  }
  if (l.hidden) {
    assert.ok(l.hidden.needs.length >= 2, `${at}: a hidden legend needs at least two trait sides`);
    for (const need of l.hidden.needs) {
      assert.ok(l.tags.some((t) => t.axis === need.axis && t.lean === need.lean), `${at}: hidden needs are its own tags`);
    }
  }
}
ok('every legend: real ≤ 2005 / story labelled, sources on every fact, sizes, voice, hidden rules');

/* ------------------------------------------------------------ coverage --- */

const minPerPole = full ? 8 : 1;
const visible = LEGEND_ROSTER.filter((l) => !l.hidden);
const thin: string[] = [];
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const n = visible.filter((l) => l.tags.some((t) => t.axis === axis && t.lean === lean)).length;
    if (n < minPerPole) thin.push(`${axis}:${lean} (${AXIS_POLE_NAME[axis][lean]}) has ${n}`);
  }
}
assert.deepEqual(thin, [], `every trait side needs ≥ ${minPerPole} visible legends: ${thin.join('; ')}`);
for (const hall of LEGEND_HALLS) {
  assert.ok(LEGEND_ROSTER.filter((l) => l.hall === hall).length >= 3, `${hall}: at least 3 legends`);
}
const real = LEGEND_ROSTER.filter((l) => l.kind === 'real');
const women = real.filter((l) => l.gender === 'woman').length / real.length;
assert.ok(women >= (full ? 0.35 : 0.3), `women among real legends: ${(women * 100).toFixed(0)}%`);
const regionCounts = new Map<string, number>();
for (const l of LEGEND_ROSTER) regionCounts.set(l.region, (regionCounts.get(l.region) ?? 0) + 1);
if (full) {
  assert.ok([...regionCounts.values()].filter((n) => n >= 8).length >= 6, 'full roster: 6 regions with 8+ legends');
} else {
  assert.ok(regionCounts.size >= 6, `pilot: legends from at least 6 regions (${regionCounts.size})`);
}
ok(`coverage (${LEGEND_ROSTER_STAGE}): all 32 trait sides ≥ ${minPerPole}; every hall ≥ 3; women ${(women * 100).toFixed(0)}% of real legends; ${regionCounts.size} regions`);

/* -------------------------------------------------------------- picker --- */

const NOW = new Date('2026-10-08T12:00:00Z');
function track(axis: TraitAxis, value: number, answers = 6): TraitTrack {
  return { axis, track: 'report', value, stability: 0.9, answerCount: answers, lastTouched: NOW.toISOString(), lastDepthAt: null };
}
function profile(leans: Partial<Record<TraitAxis, number>>): TraitTrack[] {
  return TRAIT_AXES.map((axis) => track(axis, leans[axis] ?? 0.5));
}
const none = new Set<string>();

assert.equal(legendLocked(profile({})), true, 'a flat profile is locked');
assert.equal(legendLocked(profile({ openness: 0.9 })), true, `one clear lean is not enough (need ${LEGEND_MIN_CLEAR_LEANS})`);
assert.equal(pickLegendSet({ tracks: profile({ openness: 0.9 }), userId: 'u1', ymd: '2026-10-08', setNo: 0, met: none, now: NOW }), null);
ok('flat or one-lean profiles are locked (no set, no AI)');

const mixed = profile({ openness: 0.92, extraversion: 0.2, playfulness: 0.8, steadiness: 0.3 });
const setA = pickLegendSet({ tracks: mixed, userId: 'u1', ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
const setA2 = pickLegendSet({ tracks: mixed, userId: 'u1', ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
assert.deepEqual(setA, setA2, 'same person, same day → same three');
assert.equal(setA.offers.length, 3, 'three labels');
assert.equal(new Set(setA.offers.map((o) => o.legendId)).size, 3, 'three different legends');
assert.deepEqual(setA.offers.map((o) => o.slot).slice(0, 2), ['close', 'surprise']);
const closeHall = legendById(setA.offers[0]!.legendId)!.hall;
assert.notEqual(legendById(setA.offers[1]!.legendId)!.hall, closeHall, 'the surprise is from another hall');
const seen = new Set<string>();
for (let u = 0; u < 40; u += 1) {
  const s = pickLegendSet({ tracks: mixed, userId: `user-${u}`, ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
  seen.add(s.offers.map((o) => o.legendId).join(','));
}
assert.ok(seen.size >= 5, `different people with the same profile get different sets (${seen.size} distinct of 40)`);
ok(`three distinct labels, stable per person and day, varied across people (${seen.size}/40 distinct)`);

// No repeats: met legends are skipped until fewer than three are left.
const metSome = new Set(setA.offers.map((o) => o.legendId));
const next = pickLegendSet({ tracks: mixed, userId: 'u1', ymd: '2026-10-09', setNo: 0, met: metSome, now: NOW })!;
for (const o of next.offers) assert.ok(!metSome.has(o.legendId), 'a met legend is not offered again');
const almostAll = new Set(LEGEND_ROSTER.map((l) => l.id).slice(0, LEGEND_ROSTER.length - 1));
const dry = pickLegendSet({ tracks: mixed, userId: 'u1', ymd: '2026-10-10', setNo: 0, met: almostAll, now: NOW })!;
assert.equal(dry.offers.length, 3, 'a nearly full museum still gets three (repeat rather than an empty wall)');
ok('no repeats while fresh legends remain; never an empty set');

// Every trait side finds a legend tagged with it.
const misses: string[] = [];
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const other = TRAIT_AXES.find((a) => a !== axis)!;
    const tracks = profile({ [axis]: lean === 'high' ? 0.95 : 0.05, [other]: 0.62 });
    const ranked = rankStoryAxes(tracks);
    const best = [...visible]
      .map((l) => ({ l, ...scoreLegend(l, ranked, new Set()) }))
      .sort((a, b) => b.score - a.score)[0]!;
    if (!best.l.tags.some((t) => t.axis === axis && t.lean === lean)) misses.push(`${axis}:${lean}`);
    const set = pickLegendSet({ tracks, userId: `pole-${axis}-${lean}`, ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
    if (!set.offers.some((o) => o.matched.includes(axis))) misses.push(`${axis}:${lean} (set)`);
  }
}
assert.deepEqual(misses, [], `a strong lean on each of the 32 sides is matched: ${misses.join(', ')}`);
ok('all 32 trait sides (high AND low): the best match carries that side, and the set offers it');

// Hidden legends: never offered until unlocked; then as the surprise.
const hiddenOnes = LEGEND_ROSTER.filter((l) => l.hidden);
for (let u = 0; u < 30; u += 1) {
  const s = pickLegendSet({ tracks: mixed, userId: `h-${u}`, ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
  for (const o of s.offers) {
    const l = legendById(o.legendId)!;
    if (l.hidden) {
      const ranked = rankStoryAxes(mixed);
      assert.ok(l.hidden.needs.every((n) => ranked.some((r) => r.axis === n.axis && r.lean === n.lean)), `${l.id} offered while locked`);
    }
  }
}
const tanuki = hiddenOnes.find((l) => l.id === 'lf_tanuki')!;
const unlockTracks = profile(Object.fromEntries(tanuki.hidden!.needs.map((n) => [n.axis, n.lean === 'high' ? 0.9 : 0.1])));
const unlocked = pickLegendSet({ tracks: unlockTracks, userId: 'u9', ymd: '2026-10-08', setNo: 0, met: none, now: NOW })!;
const hiddenOffer = unlocked.offers.find((o) => o.hidden);
assert.ok(hiddenOffer && hiddenOffer.slot === 'surprise', 'an unlocked hidden legend comes as the surprise');
ok(`hidden legends (${hiddenOnes.length}) appear only for their trait combo, as the surprise`);

// On this day.
const curie = legendById('lf_marie_curie')!;
const bday = pickLegendSet({ tracks: profile({ playfulness: 0.9, agreeableness: 0.85 }), userId: 'u1', ymd: `2026-${curie.birthday!.md}`, setNo: 0, met: none, now: NOW })!;
assert.ok(bday.offers.some((o) => o.legendId === curie.id && (o.slot === 'on_this_day' || o.slot === 'close' || o.slot === 'surprise')), 'a legend born today is in the set');
assert.ok(bday.offers.some((o) => o.slot === 'on_this_day') || bday.offers.slice(0, 2).some((o) => o.legendId === curie.id));
ok('On this day: a legend born on today’s date takes the third slot');

// The bonus set: only for a newly settled lean.
assert.equal(hasNewSettledLean('openness:high', 'openness:high'), false);
assert.equal(hasNewSettledLean('openness:high', 'extraversion:low,openness:high'), true);
assert.equal(hasNewSettledLean('openness:high,playfulness:high', 'openness:high'), false, 'losing a lean is not a bonus');
const bonus = pickLegendSet({ tracks: mixed, userId: 'u1', ymd: '2026-10-08', setNo: 1, met: metSome, now: NOW })!;
assert.notDeepEqual(bonus.offers.map((o) => o.legendId), setA.offers.map((o) => o.legendId), 'the bonus set differs');
ok('bonus set only when a new trait side settles; it differs from the day’s set');

// Least-told angle.
const hok = legendById('lf_hokusai')!;
const counts = { 'a1|m1': 9, 'a1|m2': 9, 'a2|m1': 4, 'a2|m2': 4, 'a3|m1': 0, 'a3|m2': 1, 'a4|m1': 7, 'a4|m2': 7 };
assert.deepEqual(chooseAngle(hok, 'anyone', counts), { angleId: 'a3', momentId: 'm1' }, 'least-told angle, then least-told moment');
const spread = new Set<string>();
for (let u = 0; u < 30; u += 1) spread.add(chooseAngle(hok, `p${u}`, null).angleId);
assert.ok(spread.size >= 3, 'with no counts, people still get different angles');
ok('angles: the least-told one first (anonymous counts); seeded per person when there are none');

/* --------------------------------------------------------------- story --- */

const ctxPairs: LegendPair[] = legendPairs(hok, [
  { axis: 'growth_mindset', lean: 'high', strength: 0.4 },
  { axis: 'openness', lean: 'high', strength: 0.3 },
]);
assert.equal(ctxPairs.length, 2);
const angle = hok.angles[0]!;
const ctx = { legend: hok, angle, momentId: 'm1', pairs: ctxPairs };
const good = JSON.stringify({
  whereYouMatch: [
    { axis: 'growth_mindset', them: 'still improving at seventy' },
    { axis: 'openness', them: 'kept trying new styles' },
  ],
  howTheTraitWon: [{ axis: 'growth_mindset', momentId: 'm1', line: 'He looked back at decades of work and decided the best part was still ahead, which is how you treat a draft you keep reopening.' }],
  whatItMeansForYou: 'That note titled try again later is not a failure pile. It is your Mount Fuji, and you get to keep drawing it.',
});
const parsed = parseLegendStory(good, ctx);
assert.ok(parsed, 'a grounded answer is accepted');
assert.equal(parsed.source, 'ai');
assert.equal(parsed.whereYouMatch[0]!.lean, 'high', 'the side comes from the pairing, never the model');
const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(good), ...patch });
const rejects: [string, string][] = [
  ['unknown axis', bad({ whereYouMatch: [{ axis: 'autonomy', them: 'renamed himself' }] })],
  ['made-up moment', bad({ howTheTraitWon: [{ axis: 'openness', momentId: 'm3', line: 'A fine line.' }] })],
  ['number not in entry', bad({ whatItMeansForYou: 'He made 300 prints in a single year, and so can you with your tabs and notes this week.' })],
  ['name not in entry', bad({ whatItMeansForYou: 'Like his friend Hiroshige, you keep a notebook of every view you ever liked, which is very you.' })],
  ['invented quote', bad({ whatItMeansForYou: 'He once said “keep going” to a student, and your group chat could use that energy tonight.' })],
  ['you are', bad({ whatItMeansForYou: 'You are a late bloomer at heart, the kind who reopens the draft after everyone else logged off.' })],
  ['exclamation', bad({ whatItMeansForYou: 'Your best work is still ahead of you, so keep that tab open and keep tinkering at it!' })],
  ['too long', bad({ whatItMeansForYou: Array.from({ length: 60 }, () => 'word').join(' ') })],
  ['not json', 'Here is your card: whereYouMatch...'],
];
for (const [label, raw] of rejects) assert.equal(parseLegendStory(raw, ctx), null, `rejects: ${label}`);
const mulan = legendById('lf_hua_mulan')!;
const mulanPairs = legendPairs(mulan, [{ axis: 'self_efficacy', lean: 'high', strength: 0.4 }]);
assert.equal(
  legendLineViolation('Historically she served for twelve years.', 'twelve years', true),
  'story told as history',
  'a myth is never told as history',
);
assert.ok(mulanPairs.length === 1);
// Review fixes (2026-10-08): numbers compare whole, accented capitals count,
// a sentence after a closing quote is a sentence start, and the prompt asks for
// numbers as words / no quotes / no brands so good answers are not wasted.
const hokAllowed = 'At 51 he took a new name. Hokusai';
assert.equal(legendLineViolation('You started at 5 and kept going.', hokAllowed, false), 'number not in entry: 5', 'a number must match whole');
assert.equal(legendLineViolation('You reopened it at 51, like him.', hokAllowed, false), null, 'a number from the entry is fine');
assert.match(legendLineViolation('Your note to Émile can wait.', hokAllowed, false) ?? '', /name not in entry/, 'accented names are checked too');
assert.equal(legendLineViolation('He kept going. Your draft can too.', hokAllowed, false), null, 'a new sentence may start with a capital');
assert.match(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs }), /Write numbers as words, use no quotation marks, and name no apps, brands or people/);
ok(`AI answers: grounded ones pass; ${rejects.length} kinds of made-up or off-voice answers are rejected; numbers whole, accents checked`);

const fb = fallbackLegendStory(ctx);
assert.equal(fb.source, 'fallback');
assert.deepEqual(fb.whereYouMatch.map((r) => r.them), ctxPairs.map((p) => p.tag.them), 'fallback uses the hand-written tag phrases');
assert.equal(fb.whatItMeansForYou, angle.meaning, 'fallback uses the angle’s hand-written meaning');
const contrast = legendPairs(hok, [{ axis: 'conflict_assertiveness', lean: 'low', strength: 0.4 }]);
assert.equal(contrast.length, 1);
assert.equal(contrast[0]!.contrast, true, 'no shared side → one contrast pair, never empty');
ok('fallback story: every word hand-written; a no-match legend still gets a contrast pair');

const prompt = buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs });
assert.ok(prompt.includes(MOMENT_VOICE_BLOCK), 'the prompt carries the moment voice');
assert.match(prompt, /ONLY facts you may use/);
for (const f of hok.facts.filter((x) => !x.source.verified)) assert.ok(!prompt.includes(f.text), 'unverified facts never reach the AI');
assert.doesNotMatch(prompt, /userId|user_id|@|handle/i, 'no account details in the prompt');
const storyPrompt = buildLegendPrompt({ legend: mulan, angle: mulan.angles[0]!, focusMomentId: 'm1', pairs: mulanPairs });
assert.match(storyPrompt, /This is a story, not history/);
ok('prompt: moment voice, entry-only facts, verified only, no account details, myths flagged');

/* -------------------------------------------------------------- wiring --- */

const screen = read('src/app/(tabs)/legends.tsx');
assert.doesNotMatch(screen, /generateText\(/, 'the screen never calls the model directly');
const meetStart = screen.indexOf('const meet = useCallback');
assert.ok(meetStart > 0 && screen.indexOf('writeLegendStory(') > meetStart, 'the story is written only inside "Meet them"');
assert.equal(screen.split('writeLegendStory(').length - 1, 1, 'exactly one call site');
assert.match(screen, /legendsUnlocked\(tracks\)/, 'same unlock as the rest of the app');
const gen = read('src/lib/legend-figures/generate.ts');
assert.ok(gen.indexOf('claimLegendStory()') < gen.indexOf('generateText('), 'the server claim comes before the call');
assert.match(gen, /if \(!\(await claimLegendStory\(\)\)\) return fallback\(\);/, 'no claim, no AI call');
assert.match(screen, /meetingRef\.current\) return;/, 'a second tap while a story is being written does nothing');
assert.match(screen, /if \(!meetingRef\.current\) persist\(withDay\);/, 'a reload never overwrites a pick being saved');
assert.match(screen, /LegendShareSheet/, 'share uses the on-screen Modal capture (share-card.tsx pattern)');
assert.doesNotMatch(read('src/components/legend-figure-card.tsx'), /left: -10000/, 'never an off-screen capture');
ok('one AI call, only on "Meet them", after the server claim; double taps and reloads can’t pay twice or lose a pick');

const sql = read('supabase/migrations/wave89_legend_museum.sql');
assert.match(sql, /create policy legend_museum_select_own on public\.legend_museum\s+for select using \(auth\.uid\(\) = user_id\);/);
assert.match(sql, /revoke insert, update, delete on public\.legend_museum from public, anon, authenticated;/);
assert.match(sql, /< 5 then\s+return;/, 'angle counts: nothing under 5');
assert.doesNotMatch(sql.slice(sql.indexOf('legend_angle_counts'), sql.indexOf('legend_circle_friends')), /user_id\s*,|select m\.user_id|lm\.user_id/, 'angle counts never return who');
const friends = sql.slice(sql.indexOf('create or replace function public.legend_circle_friends'));
assert.match(friends, /from public\.connections c/, 'Circle line: connected friends only');
assert.match(friends, /mine\.user_id = auth\.uid\(\) and mine\.legend_id = p_legend_id/, 'only if you met them too');
assert.match(friends, /from public\.blocks b/, 'blocked people never appear');
assert.match(friends, /returns table \(name text\)/, 'names only — never a story');
for (const fn of ['claim_legend_figure_story()', 'save_legend_figure_story(text, text, text, jsonb, date)', 'legend_angle_counts(text)', 'legend_circle_friends(text)']) {
  assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon;`), `${fn} revoked from anon`);
}
assert.match(sql, /added_today >= cap then\s+raise exception 'daily limit'/, 'new museum rows are limited to the daily cap');
ok('wave89: own rows only, written by RPC at the daily pace; counts anonymous (≥5); Circle names only, connected and unblocked');

const devLab = read('src/app/dev-lab.tsx');
const toolsStart = devLab.indexOf('{tools ? (');
const toolsEnd = devLab.indexOf(') : null}', toolsStart);
const devAt = devLab.indexOf('<LegendFiguresDev');
assert.ok(devAt > toolsStart && devAt < toolsEnd, 'the dev tool sits inside the tools branch (pre-launch only)');
assert.equal(LEGEND_FIGURES_COPY_REVIEWED, false, 'ships unreviewed until emci ticks the review doc');
assert.match(read('src/components/dev-hub-panels.tsx'), /LEGEND_FIGURES_COPY_REVIEWED/, 'listed on the dev hub copy list');
assert.ok(existsSync(resolve(root, 'docs/legend-figures-review.md')), 'review doc exists');
const review = read('docs/legend-figures-review.md');
for (const l of LEGEND_ROSTER) assert.ok(review.includes(`\`${l.id}\``), `review doc lists ${l.id}`);
assert.doesNotMatch(screen, /COPY_REVIEWED|draft/i, 'no draft badge in the app');
ok('dev tool pre-launch only; flag off; review doc lists every legend; no draft badge');

console.log(`\ncheck:legend-roster — ${passed} groups passed.`);
