/**
 * Museum of legends — offline rules (emci, 2026-10-08).
 * Run: npm run check:legend-roster
 *
 * Pins, like check:question-bank does for the fixed questions:
 * - the roster: permanent ids (roster-ids.json, append-only — an id can never
 *   vanish, be renamed or be reused), the real/animal/story rules (people and
 *   animals died 2005 or earlier; myths labelled; no office-holders), roles
 *   (Leonardo as an artist / as an inventor), a source URL + check phrases on
 *   every fact, moment and birthday, sizes (3–5 facts, 2–3 moments, 4–6 angles,
 *   3–5 tags), voice, and coverage: 12 halls of at least 10, every one of the 32
 *   trait sides on at least 8 visible legends in the full roster, every hall
 *   spread over many sides (low ones too);
 * - the hall walk: locked on a flat profile, three "???" frames per hall,
 *   stable per person and day, refilled in place, no repeats, hidden legends
 *   only when unlocked, On this day first, chapters once a hall is met, one
 *   reveal a day plus the bonus, least-told angle, the "Matched on" line;
 * - the AI story: good answers pass; any number, name or quote not in the
 *   entry, an unknown axis or moment, "you are", "!" or a myth told as history
 *   is rejected; the fallback uses only hand-written words;
 * - the wiring: no model call outside a reveal tap, the AI placeholder never
 *   calls anything and shows pre-launch only, wave89's privacy and chapter
 *   rules, the dev tool inside the tools branch, the review doc and flag.
 *
 * Facts are checked against their sources by hand with network
 * (`npx tsx scripts/legend-roster-verify.ts <cache-dir>`), never in the gate.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLE_NAME } from '../src/lib/axis-poles';
import { LEGEND_FIGURES_COPY_REVIEWED, LEGEND_ROSTER_STAGE } from '../src/lib/legend-figures/flags';
import { AI_LEGEND_PLACEHOLDER, frameA11yLabel } from '../src/lib/legend-figures/labels';
import {
  LEGEND_FRAMES,
  LEGEND_MIN_CLEAR_LEANS,
  chapterKey,
  chapterOrder,
  chooseAngle,
  hallComplete,
  hallFrames,
  hallOrder,
  hasNewSettledLean,
  legendLocked,
  matchedOnLine,
  parseFrameKey,
  revealsLeft,
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
  MEANS_MAX_WORDS,
  MEANS_MIN_WORDS,
  didYouKnowFact,
  entryText,
  legendDiffer,
  nextChapterTeaser,
  titleCase,
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
/** 'halls' and 'full' share the trait and hall bars; only 'full' adds the region bar. */
const grown = LEGEND_ROSTER_STAGE !== 'pilot';

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

const OFFICE = /\b(president|prime minister|head of state|general|admiral|commander|pope|prophet|emperor|bishop|imam|rabbi|saint)\b/i;
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
    // Vetting: no heads of state, military commanders or religious leaders.
    assert.doesNotMatch(`${l.field} ${l.whoTheyWere}`, OFFICE, `${at}: no office-holders, commanders or religious leaders`);
  } else if (l.kind === 'animal') {
    assert.equal(l.hall, 'animals', `${at}: real animals live in the Animal legends hall`);
    assert.ok(typeof l.died === 'number' && l.died <= 2005, `${at}: a real animal died 2005 or earlier`);
    assert.equal(l.gender, 'none', `${at}: animals take no gender`);
  } else {
    assert.equal(l.died, undefined, `${at}: a story legend has no death year`);
    assert.equal(l.birthday, undefined, `${at}: a story legend has no birthday`);
  }
  if (l.role || l.roleOf) {
    assert.ok(l.role && l.roleOf, `${at}: role and roleOf go together`);
    assert.match(l.role, /^as an? /, `${at}: a role reads "as an artist"`);
    const sides = LEGEND_ROSTER.filter((o) => o.roleOf === l.roleOf);
    assert.ok(sides.length >= 2, `${at}: a role has another side`);
    assert.equal(new Set(sides.map((o) => o.hall)).size, sides.length, `${at}: each side of ${l.roleOf} is in a different hall`);
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
    storedClean(a.name, `${at} ${a.id} name`);
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
ok('every legend: people and animals ≤ 2005, no office-holders, myths labelled, roles paired, sources on every fact, sizes, voice, hidden rules');

/* ------------------------------------------------------------ coverage --- */

const minPerPole = grown ? 8 : 1;
const visible = LEGEND_ROSTER.filter((l) => !l.hidden);
const thin: string[] = [];
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const n = visible.filter((l) => l.tags.some((t) => t.axis === axis && t.lean === lean)).length;
    if (n < minPerPole) thin.push(`${axis}:${lean} (${AXIS_POLE_NAME[axis][lean]}) has ${n}`);
  }
}
assert.deepEqual(thin, [], `every trait side needs ≥ ${minPerPole} visible legends: ${thin.join('; ')}`);
const MIN_HALL = grown ? 10 : 3;
const MIN_HALL_SIDES = 15;
const MIN_HALL_LOW_SIDES = 4;
for (const hall of LEGEND_HALLS) {
  const inHall = LEGEND_ROSTER.filter((l) => l.hall === hall);
  assert.ok(inHall.length >= MIN_HALL, `${hall}: at least ${MIN_HALL} legends (${inHall.length})`);
  if (grown) {
    const sides = new Set(inHall.flatMap((l) => l.tags.map((tg) => `${tg.axis}:${tg.lean}`)));
    const lows = [...sides].filter((s) => s.endsWith(':low')).length;
    assert.ok(sides.size >= MIN_HALL_SIDES, `${hall}: legends spread over ≥ ${MIN_HALL_SIDES} trait sides (${sides.size})`);
    assert.ok(lows >= MIN_HALL_LOW_SIDES, `${hall}: ≥ ${MIN_HALL_LOW_SIDES} low trait sides, so low-pole people match too (${lows})`);
  }
}
const real = LEGEND_ROSTER.filter((l) => l.kind === 'real');
const women = real.filter((l) => l.gender === 'woman').length / real.length;
assert.ok(women >= (grown ? 0.35 : 0.3), `women among real legends: ${(women * 100).toFixed(0)}%`);
const regionCounts = new Map<string, number>();
for (const l of LEGEND_ROSTER) regionCounts.set(l.region, (regionCounts.get(l.region) ?? 0) + 1);
if (full) {
  assert.ok([...regionCounts.values()].filter((n) => n >= 8).length >= 6, 'full roster: 6 regions with 8+ legends');
} else {
  assert.ok(regionCounts.size >= 6, `legends from at least 6 regions (${regionCounts.size})`);
}
const topRegion = Math.max(...regionCounts.values()) / LEGEND_ROSTER.length;
if (grown) assert.ok(topRegion <= 0.45, `no region holds more than 45% of the museum (${(topRegion * 100).toFixed(0)}%)`);
ok(`coverage (${LEGEND_ROSTER_STAGE}): all 32 trait sides ≥ ${minPerPole}; ${LEGEND_HALLS.length} halls ≥ ${MIN_HALL}; women ${(women * 100).toFixed(0)}% of real legends; ${regionCounts.size} regions, largest ${(topRegion * 100).toFixed(0)}%`);

/* ----------------------------------------------------------- hall walk --- */

const NOW = new Date('2026-10-08T12:00:00Z');
function track(axis: TraitAxis, value: number, answers = 6): TraitTrack {
  return { axis, track: 'report', value, stability: 0.9, answerCount: answers, lastTouched: NOW.toISOString(), lastDepthAt: null };
}
function profile(leans: Partial<Record<TraitAxis, number>>): TraitTrack[] {
  return TRAIT_AXES.map((axis) => track(axis, leans[axis] ?? 0.5));
}
const none = new Set<string>();
const YMD = '2026-10-08';

assert.equal(legendLocked(profile({})), true, 'a flat profile is locked');
assert.equal(legendLocked(profile({ openness: 0.9 })), true, `one clear lean is not enough (need ${LEGEND_MIN_CLEAR_LEANS})`);
assert.equal(hallOrder({ tracks: profile({ openness: 0.9 }), userId: 'u1', ymd: YMD, hall: 'art', met: none, now: NOW }), null);
ok('flat or one-lean profiles are locked (no frames, no AI)');

const mixed = profile({ openness: 0.92, extraversion: 0.2, playfulness: 0.8, steadiness: 0.3 });
const orderA = hallOrder({ tracks: mixed, userId: 'u1', ymd: YMD, hall: 'art', met: none, now: NOW })!;
const orderA2 = hallOrder({ tracks: mixed, userId: 'u1', ymd: YMD, hall: 'art', met: none, now: NOW })!;
assert.deepEqual(orderA, orderA2, 'same person, same day, same hall → same order');
const artOpen = LEGEND_ROSTER.filter((l) => l.hall === 'art' && !l.hidden);
assert.equal(orderA.length, artOpen.length, 'the order holds every open legend in the hall');
for (const id of orderA) assert.equal(legendById(id)!.hall, 'art', 'only legends from the chosen hall');
const framesA = hallFrames(orderA, none, 'u1|seed');
assert.equal(framesA.length, LEGEND_FRAMES, 'three frames');
assert.equal(new Set(framesA).size, 3, 'three different legends');
assert.deepEqual(new Set(framesA), new Set(orderA.slice(0, 3)), 'the frames are the order’s first three');
const seenFirst = new Set<string>();
for (let u = 0; u < 40; u += 1) {
  const o = hallOrder({ tracks: mixed, userId: `user-${u}`, ymd: YMD, hall: 'art', met: none, now: NOW })!;
  seenFirst.add([...o.slice(0, 3)].sort().join(','));
}
assert.ok(seenFirst.size >= 8, `different people with the same profile get different frames (${seenFirst.size} distinct of 40)`);
ok(`three "???" frames per hall, stable per person and day, varied across people (${seenFirst.size}/40 distinct)`);

// Reveal refills that frame in place; met legends never come back.
const used = new Set([framesA[1]!]);
const refilled = hallFrames(orderA, used, 'u1|seed');
assert.equal(refilled[0], framesA[0], 'the other frames stay put');
assert.equal(refilled[2], framesA[2], 'the other frames stay put');
assert.equal(refilled[1], orderA[3], 'the revealed frame refills with the next legend');
const metArt = new Set(orderA.slice(0, 4));
const nextDay = hallOrder({ tracks: mixed, userId: 'u1', ymd: '2026-10-09', hall: 'art', met: metArt, now: NOW })!;
for (const id of nextDay) assert.ok(!metArt.has(id), 'a met legend is not hidden behind a frame again');
const allUsed = new Set(orderA);
assert.deepEqual(hallFrames(orderA, allUsed, 'u1|seed'), [null, null, null], 'an emptied hall shows no frames');
// Two reveals in one day (the bonus): each refills its own frame.
const seq = [framesA[1]!, framesA[0]!];
const twice = hallFrames(orderA, new Set(seq), 'u1|seed', seq);
assert.equal(twice[2], framesA[2], 'the untouched frame stays put');
assert.equal(twice[1], orderA[3], 'the first reveal’s frame keeps its refill');
assert.equal(twice[0], orderA[4], 'the second reveal’s frame gets the next one');
ok('a reveal refills its frame in place (also after the bonus reveal); no repeats; an emptied hall has no frames');

// Strong matches come first more often than weak ones.
let topHits = 0;
for (let u = 0; u < 60; u += 1) {
  const o = hallOrder({ tracks: mixed, userId: `bias-${u}`, ymd: YMD, hall: 'words', met: none, now: NOW })!;
  const ranked = rankStoryAxes(mixed);
  const first = legendById(o[0]!)!;
  const last = legendById(o[o.length - 1]!)!;
  if (scoreLegend(first, ranked, new Set()).score >= scoreLegend(last, ranked, new Set()).score) topHits += 1;
}
assert.ok(topHits >= 45, `the first frame usually matches better than the last (${topHits}/60)`);

// Every trait side finds a legend tagged with it, in some hall's frames.
const misses: string[] = [];
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const other = TRAIT_AXES.find((a) => a !== axis)!;
    const tracks = profile({ [axis]: lean === 'high' ? 0.95 : 0.05, [other]: 0.62 });
    const ranked = rankStoryAxes(tracks);
    const best = [...visible]
      .map((l) => ({ l, ...scoreLegend(l, ranked, new Set()) }))
      .sort((a, b) => b.score - a.score)[0]!;
    if (!best.l.tags.some((tg) => tg.axis === axis && tg.lean === lean)) misses.push(`${axis}:${lean}`);
    const shown = LEGEND_HALLS.flatMap((hall) => {
      const o = hallOrder({ tracks, userId: `pole-${axis}-${lean}`, ymd: YMD, hall, met: none, now: NOW })!;
      return hallFrames(o, none, `pole|${hall}`).filter((k): k is string => k != null);
    });
    if (!shown.some((id) => legendById(id)!.tags.some((tg) => tg.axis === axis && tg.lean === lean))) misses.push(`${axis}:${lean} (frames)`);
  }
}
assert.deepEqual(misses, [], `a strong lean on each of the 32 sides is matched: ${misses.join(', ')}`);
ok(`best matches come first (${topHits}/60); all 32 trait sides (high AND low) appear behind some hall’s frames`);

// Hidden legends: never behind a frame until unlocked.
const hiddenOnes = LEGEND_ROSTER.filter((l) => l.hidden);
for (const h of hiddenOnes) {
  const o = hallOrder({ tracks: mixed, userId: 'h1', ymd: YMD, hall: h.hall, met: none, now: NOW })!;
  const ranked = rankStoryAxes(mixed);
  const open = h.hidden!.needs.every((n) => ranked.some((r) => r.axis === n.axis && r.lean === n.lean));
  assert.equal(o.includes(h.id), open, `${h.id} is behind a frame only when unlocked`);
}
const tanuki = hiddenOnes.find((l) => l.id === 'lf_tanuki')!;
const unlockTracks = profile(Object.fromEntries(tanuki.hidden!.needs.map((n) => [n.axis, n.lean === 'high' ? 0.9 : 0.1])));
assert.ok(hallOrder({ tracks: unlockTracks, userId: 'u9', ymd: YMD, hall: tanuki.hall, met: none, now: NOW })!.includes(tanuki.id));
ok(`hidden legends (${hiddenOnes.length}) join a hall only for their trait combo`);

// On this day: a legend born today is first in its hall.
const curie = legendById('lf_marie_curie')!;
const bday = hallOrder({ tracks: mixed, userId: 'u1', ymd: `2026-${curie.birthday!.md}`, hall: curie.hall, met: none, now: NOW })!;
assert.equal(bday[0], curie.id, 'a legend born on today’s date is first in its hall');
ok('On this day: a legend born today goes behind the first frame');

// Chapters: once every open legend in a hall is met.
const artAll = new Set(LEGEND_ROSTER.filter((l) => l.hall === 'art').map((l) => l.id));
assert.equal(hallComplete('art', mixed, new Set(orderA.slice(0, 3))), false);
assert.equal(hallComplete('art', mixed, artAll), true, 'every open legend met → the hall is complete');
const told = new Map([...artAll].map((id) => [id, new Set(['a1'])]));
const chapters = chapterOrder({ tracks: mixed, userId: 'u1', ymd: YMD, hall: 'art', told, now: NOW });
const untoldTotal = LEGEND_ROSTER.filter((l) => l.hall === 'art').reduce((n, l) => n + l.angles.length - 1, 0);
assert.equal(chapters.length, untoldTotal, 'every untold angle becomes a chapter');
assert.equal(new Set(chapters).size, chapters.length, 'no chapter twice');
for (const key of chapters) {
  const { legendId, angleId } = parseFrameKey(key);
  assert.ok(artAll.has(legendId) && angleId && angleId !== 'a1', `${key}: an untold angle of a met legend`);
}
const firstRound = chapters.slice(0, artAll.size).map((k) => parseFrameKey(k).legendId);
assert.equal(new Set(firstRound).size, artAll.size, 'every met legend gets a new chapter before any gets two');
assert.equal(chapterKey('lf_hokusai', 'a3'), 'lf_hokusai#a3');
const chFrames = hallFrames(chapters, new Set([chapters[0]!]), 'u1|ch');
assert.ok(!chFrames.includes(chapters[0]!), 'a told chapter is not offered again');
ok('chapters: a finished hall offers untold angles of met legends, least-chaptered first, never twice');

// Pace: one reveal a day, plus one when a new trait side settles.
assert.equal(revealsLeft(0, false), 1);
assert.equal(revealsLeft(1, false), 0);
assert.equal(revealsLeft(1, true), 1, 'the bonus opens one more');
assert.equal(revealsLeft(2, true), 0);
assert.equal(hasNewSettledLean('openness:high', 'openness:high'), false);
assert.equal(hasNewSettledLean('openness:high', 'extraversion:low,openness:high'), true);
assert.equal(hasNewSettledLean('openness:high,playfulness:high', 'openness:high'), false, 'losing a lean is not a bonus');
ok('one reveal a day; one bonus only when a new trait side settles');

// Least-told angle; chapters pin theirs.
const hok = legendById('lf_hokusai')!;
const counts = { 'a1|m1': 9, 'a1|m2': 9, 'a2|m1': 4, 'a2|m2': 4, 'a3|m1': 0, 'a3|m2': 1, 'a4|m1': 7, 'a4|m2': 7 };
assert.deepEqual(chooseAngle(hok, 'anyone', counts), { angleId: 'a3', momentId: 'm1' }, 'least-told angle, then least-told moment');
assert.equal(chooseAngle(hok, 'anyone', counts, { onlyAngle: 'a4' }).angleId, 'a4', 'a chapter keeps its own angle');
assert.notEqual(chooseAngle(hok, 'anyone', counts, { skipAngles: new Set(['a3']) }).angleId, 'a3', 'a told angle is skipped');
const spread = new Set<string>();
for (let u = 0; u < 30; u += 1) spread.add(chooseAngle(hok, `p${u}`, null).angleId);
assert.ok(spread.size >= 3, 'with no counts, people still get different angles');
ok('angles: the least-told one first (anonymous counts); chapters keep theirs; seeded per person when there are none');

// "Matched on" line.
const hokTracks = profile({ growth_mindset: 0.95, openness: 0.9 });
const line = matchedOnLine(hok, hokTracks, NOW);
assert.ok(line && line.startsWith('Matched on: '), 'the matched-on line starts "Matched on:"');
assert.ok(line!.includes(AXIS_POLE_NAME.growth_mindset.high) && line!.includes(AXIS_POLE_NAME.openness.high), 'it names the shared sides');
assert.equal(matchedOnLine(hok, profile({ extraversion: 0.05, agreeableness: 0.05 }), NOW), null, 'no shared side → no line');
assert.equal(frameA11yLabel(0, 3, false), 'Hidden legend 1 of 3, double tap to reveal', 'screen readers hear the frame, never the name');
ok('"Matched on" names the shared sides (and the category when one is ready); frames read as "Hidden legend 1 of 3"');

/* --------------------------------------------------------------- story --- */

const ctxPairs: LegendPair[] = legendPairs(hok, [
  { axis: 'growth_mindset', lean: 'high', strength: 0.4 },
  { axis: 'openness', lean: 'high', strength: 0.3 },
]);
assert.equal(ctxPairs.length, 2);
const angle = hok.angles[0]!;
const ctx = { legend: hok, angle, momentId: 'm1', pairs: ctxPairs };
const good = JSON.stringify({
  title: 'the late bloomer',
  metScene: 'You spend a quiet afternoon beside Hokusai while he sketches the same mountain again. He would notice how you reopen a finished draft just to make one line a little better.',
  howTheTraitWon: [{ axis: 'growth_mindset', momentId: 'm1', line: 'He looked back at decades of work and decided the best part was still ahead, which is how you treat a draft you keep reopening.' }],
  whatItMeansForYou: 'That note titled try again later is not a failure pile. It is your Mount Fuji, and you get to keep drawing it.',
});
const parsed = parseLegendStory(good, ctx);
assert.ok(parsed, 'a grounded answer is accepted');
assert.equal(parsed.source, 'ai');
assert.equal(parsed.whereYouMatch[0]!.lean, 'high', 'the side comes from the pairing, never the model');
assert.deepEqual(parsed.whereYouMatch.map((r) => r.them), ctxPairs.map((p) => p.tag.them), 'Where you match is the hand-written tag phrases');
assert.equal(parsed.title, 'the late bloomer');
assert.equal(titleCase(parsed.title!), 'The Late Bloomer');
assert.ok(parsed.metScene && !parsed.differ, 'no differ asked → none stored');
const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(good), ...patch });
const rejects: [string, string][] = [
  ['unknown axis', bad({ howTheTraitWon: [{ axis: 'autonomy', momentId: 'm1', line: 'A fine line.' }] })],
  ['no title', bad({ title: undefined })],
  ['title without the', bad({ title: 'a late bloomer' })],
  ['title too long', bad({ title: 'the late bloomer of every mountain' })],
  ['title about worry', bad({ title: 'the anxious redrawer' })],
  ['title overthinker', bad({ title: 'the quiet overthinker' })],
  ['title template', bad({ title: 'the [title]' })],
  ['no scene', bad({ metScene: undefined })],
  ['scene too short', bad({ metScene: 'You draw a mountain with him.' })],
  ['made-up moment', bad({ howTheTraitWon: [{ axis: 'openness', momentId: 'm3', line: 'A fine line.' }] })],
  ['number not in entry', bad({ whatItMeansForYou: 'He made 300 prints in a single year, and so can you with your tabs and notes this week. Somewhere in the middle of a busy week, that small habit quietly says a lot about you.' })],
  ['name not in entry', bad({ whatItMeansForYou: 'Like his friend Hiroshige, you keep a notebook of every view you ever liked, which is very you. Somewhere in the middle of a busy week, that small habit quietly says a lot about you.' })],
  ['invented quote', bad({ whatItMeansForYou: 'He once said “keep going” to a student, and your group chat could use that energy tonight. Somewhere in the middle of a busy week, that small habit quietly says a lot about you.' })],
  ['you are', bad({ whatItMeansForYou: 'You are a late bloomer at heart, the kind who reopens the draft after everyone else logged off. Somewhere in the middle of a busy week, that small habit quietly says a lot about you.' })],
  ['exclamation', bad({ whatItMeansForYou: 'Your best work is still ahead of you, so keep that tab open and keep tinkering at it! Somewhere in the middle of a busy week, that small habit quietly says a lot about you.' })],
  ['too long', bad({ whatItMeansForYou: Array.from({ length: MEANS_MAX_WORDS + 1 }, () => 'word').join(' ') })],
  ['too short', bad({ whatItMeansForYou: 'You keep the tab open, which is very him.' })],
  ['template left in', bad({ whatItMeansForYou: 'Hokusai kept drawing the mountain. You do a smaller version of that when [one modern moment showing the same side], and it suits you well.' })],
  ['not json', 'Here is your card: whereYouMatch...'],
];
for (const [label, raw] of rejects) assert.equal(parseLegendStory(raw, ctx), null, `rejects: ${label}`);
// Each "bad line" case must be long enough to pass the length rule, so it is
// rejected for the reason it is named after, not for being short.
const hokAllowedAll = entryText(hok, angle);
for (const [label, raw] of rejects) {
  if (!['number not in entry', 'name not in entry', 'invented quote', 'you are', 'exclamation', 'template left in'].includes(label)) continue;
  const means = (JSON.parse(raw) as { whatItMeansForYou: string }).whatItMeansForYou;
  assert.ok(words(means) >= MEANS_MIN_WORDS && words(means) <= MEANS_MAX_WORDS, `${label}: fixture is within the length limits`);
  assert.ok(legendLineViolation(means, hokAllowedAll, false), `${label}: rejected by the line rules themselves`);
}
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
assert.match(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs }), new RegExp(`The bridge: say plainly what ${hok.name} did`), 'what it means starts from what the legend did');
assert.match(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs }), /must make physical sense/, 'the everyday moment must make sense');
// Where you differ: asked only when the reader has a side the legend doesn't share.
const differCtx = { ...ctx, differ: legendDiffer(hok, [{ axis: 'extraversion', lean: 'high', strength: 0.4 }]) };
assert.ok(differCtx.differ && differCtx.differ.tag === null, 'a trait the label never shows');
const opposite = legendDiffer(hok, [{ axis: 'growth_mindset', lean: 'low', strength: 0.4 }]);
assert.ok(opposite && opposite.tag?.lean === 'high', 'an outright opposite comes first');
assert.equal(parseLegendStory(good, differCtx), null, 'differ asked but missing → rejected');
const withDiffer = parseLegendStory(
  bad({ differ: 'He kept his attention on one mountain for decades, while you light up when the group chat gets loud and busy.' }),
  differCtx,
);
assert.ok(withDiffer?.differ?.axis === 'extraversion' && withDiffer.differ.lean === 'high', 'the differ side comes from the code, never the model');
assert.equal(
  parseLegendStory(bad({ differ: 'Unlike his friend Hiroshige, he kept to one mountain while you light up in a loud and busy group chat.' }), differCtx),
  null,
  'a made-up name in Where you differ is rejected',
);
assert.equal(
  parseLegendStory(bad({ metScene: 'You and Hokusai take the train to Kyoto with his student Hiroshige and sketch the river together all afternoon.' }), ctx),
  null,
  'a made-up place or person in If you’d met is rejected',
);
assert.equal(
  legendDiffer(hok, [{ axis: 'extraversion', lean: 'high', strength: 0.4 }], new Set(['extraversion'] as const)),
  null,
  'Where you differ never repeats a trait shown under Where you match',
);
assert.match(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs, differ: differCtx.differ }), /"differ"/);
assert.doesNotMatch(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs, differ: null }), /"differ"/);
assert.match(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs }), /"title"[\s\S]*"metScene"/);
assert.doesNotMatch(buildLegendPrompt({ legend: hok, angle, focusMomentId: 'm1', pairs: ctxPairs }), /"whereYouMatch"/, 'the model no longer rewrites Where you match');
// Free extras: no AI.
const dyk = didYouKnowFact(hok, parsed, 'u1');
assert.ok(dyk && shownFacts(hok).some((f) => f.id === dyk.id), 'Did you know is a verified fact');
assert.deepEqual(didYouKnowFact(hok, parsed, 'u1'), dyk, 'stable per person');
assert.equal(nextChapterTeaser(hok, new Set(['a1'])), hok.angles[1]!.teaser, 'Still to come: an untold angle');
assert.equal(nextChapterTeaser(hok, new Set(hok.angles.map((a) => a.id))), null, 'nothing left → nothing shown');
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
const revealStart = screen.indexOf('const reveal = useCallback');
assert.ok(revealStart > 0 && screen.indexOf('writeLegendStory(') > revealStart, 'the story is written only inside a reveal tap');
assert.equal(screen.split('writeLegendStory(').length - 1, 1, 'exactly one call site');
assert.match(screen, /legendsUnlocked\(tracks\)/, 'same unlock as the rest of the app');
const gen = read('src/lib/legend-figures/generate.ts');
assert.ok(gen.indexOf('claimLegendStory()') < gen.indexOf('generateText('), 'the server claim comes before the call');
assert.match(gen, /if \(!\(await claimLegendStory\(\)\)\) return fallback\(\);/, 'no claim, no AI call');
assert.match(screen, /meetingRef\.current\) return;/, 'a second tap while a story is being written does nothing');
assert.match(screen, /if \(revealsLeft\(revealedBefore, bonus\) <= 0\) return;/, 'no reveal past the day’s allowance');
assert.match(screen, /if \(!meetingRef\.current\) persist\(next\);/, 'a reload never overwrites a reveal being saved');
assert.match(screen, /LegendShareSheet/, 'share uses the on-screen Modal capture (share-card.tsx pattern)');
const cardSrc = read('src/components/legend-figure-card.tsx');
assert.doesNotMatch(cardSrc, /left: -10000/, 'never an off-screen capture');
// Notes like "Born on this day" / "Hidden legend found" are set only by a reveal.
assert.equal(screen.split('setRevealNotes((prev)').length - 1, 1);
assert.ok(screen.indexOf('setRevealNotes((prev)') > revealStart, 'reveal-only notes');
ok('one AI call, only on a reveal tap, after the server claim; double taps and reloads can’t pay twice or lose a reveal');

// The "find a new legend with AI" placeholder: disabled, last, pre-launch only.
const placeholderSrc = cardSrc.slice(cardSrc.indexOf('export function LegendAiPlaceholder'), cardSrc.indexOf('export function circleLine'));
assert.doesNotMatch(placeholderSrc, /onPress|generateText|writeLegendStory|supabase/, 'the placeholder does nothing');
assert.match(placeholderSrc, /accessibilityState=\{\{ disabled: true \}\}/, 'announced as disabled');
assert.match(AI_LEGEND_PLACEHOLDER, /coming soon/);
assert.match(screen, /\{PRE_LAUNCH_DEV \? \(\s*<View style=\{styles\.placeholder\}>\s*<LegendAiPlaceholder \/>/, 'shown only while PRE_LAUNCH_DEV');
assert.equal(screen.split('<LegendAiPlaceholder').length - 1, 1, 'one placeholder');
const hallViewEnd = screen.indexOf(') : (\n                card');
assert.ok(screen.indexOf('<LegendAiPlaceholder') < hallViewEnd && screen.lastIndexOf('<LegendFrame') < screen.indexOf('<LegendAiPlaceholder'), 'the placeholder comes last in a hall');
ok('AI placeholder: disabled, last in the hall, pre-launch builds only, never calls anything');

const sql = read('supabase/migrations/wave89_legend_museum.sql');
assert.match(sql, /create policy legend_museum_select_own on public\.legend_museum\s+for select using \(auth\.uid\(\) = user_id\);/);
assert.match(sql, /revoke insert, update, delete on public\.legend_museum from public, anon, authenticated;/);
assert.match(sql, /count\(distinct lm\.user_id\)[^;]*< 5 then\s+return;/, 'angle counts: nothing under 5 people');
assert.match(sql, /unique \(user_id, legend_id, chapter\)/, 'one row per legend + chapter');
assert.match(sql, /invalid chapter/, 'chapter numbers are bounded');
assert.doesNotMatch(sql.slice(sql.indexOf('legend_angle_counts'), sql.indexOf('legend_circle_friends')), /user_id\s*,|select m\.user_id|lm\.user_id/, 'angle counts never return who');
const friends = sql.slice(sql.indexOf('create or replace function public.legend_circle_friends'));
assert.match(friends, /from public\.connections c/, 'Circle line: connected friends only');
assert.match(friends, /mine\.user_id = auth\.uid\(\) and mine\.legend_id = p_legend_id/, 'only if you met them too');
assert.match(friends, /from public\.blocks b/, 'blocked people never appear');
assert.match(friends, /returns table \(name text\)/, 'names only — never a story');
assert.doesNotMatch(friends.slice(0, friends.indexOf('where')), /join public\.legend_museum/, 'each friend once (exists, not a join), however many chapters');
for (const fn of ['claim_legend_figure_story()', 'save_legend_figure_story(text, int, text, text, jsonb, date)', 'legend_angle_counts(text)', 'legend_circle_friends(text)']) {
  assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon;`), `${fn} revoked from anon`);
}
assert.match(sql, /added_today >= cap then\s+raise exception 'daily limit'/, 'new museum rows are limited to the daily cap');
ok('wave89: own rows only (one per legend + chapter), written by RPC at the daily pace; counts anonymous (≥5 people); Circle names once, connected and unblocked');

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
