/**
 * "The pet that knows you" check (hideout roadmap step 3, 2026-10-15).
 * Run: npm run check:pet-knows-you
 *
 * - Bank: all 16 traits have lines for BOTH ends (3+ each), ids unique and shaped right, every line
 *   ≤ 10 words and ≤ 48 characters, moment voice (no "you are"/"you're"/"always"), no clinical or
 *   label words, no banned Play words, curly apostrophes only, ships behind COPY_REVIEWED = false.
 * - Rules: rare (one per visit, cooldown across visits, a roll), never the same line back to back,
 *   never the same trait twice in a row, thin data → a hedge (never null), a broken streak → no
 *   streak line, the talk style only moves how readily it speaks.
 * - Fallbacks: preview / signed out / offline all end in a hedge; the cache holds ends only and
 *   belongs to one account.
 * - Isolation: no model call, nothing in the cloud save / away card, only the pet screen uses it,
 *   and it is wired to the idle timer only (never a tap).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { TRAIT_AXES } from '../src/lib/traits';
import type { TraitTrack } from '../src/lib/trait-stability';
import {
  PET_KNOWS_YOU_COPY_REVIEWED,
  PKY_MAX_CHARS,
  PKY_MAX_WORDS,
  PKY_STREAK_TIERS,
  PKY_THIN_LINES,
  PKY_TRAIT_LINES,
  allPkyLines,
  axisOfPkyId,
} from '../src/play/pet-knows-you-bank';
import {
  PKY_AXIS_GAP,
  PKY_COOLDOWN_MS,
  PKY_MAX_PER_VISIT,
  PKY_MIN_ANSWERS,
  PKY_MIN_AXES,
  PKY_RECENT_CAP,
  PKY_ROLL,
  buildEnds,
  emptyState,
  parseState,
  isThin,
  personalLineAllowed,
  pickPersonalLine,
  rememberShown,
  streakPool,
  styleCooldownMs,
  styleRoll,
  talkStyle,
  THIN_PROFILE,
  type PetKnowsProfile,
} from '../src/play/pet-knows-you';
import { PET_BANNED_WORDS } from '../src/play/pet-talk';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/* ------------------------------------------------------------------ bank --- */

const CLINICAL =
  /\b(anxious|anxiety|insecure|insecurity|avoidant|avoidance|attachment|disorder|trauma|toxic|needy|clingy|codependent|diagnos\w*|therapy|therapist|symptom\w*|red flag|neurotic|neuroticism|introvert\w*|extrovert\w*|depress\w*|narcis\w*|obsessive|compulsive|flaw\w*|weakness|defect\w*|broken|fear\w*|panic|stress\w*|mental|cope|coping)\b/i;
const LABELS = /\b(extraversion|openness|conscientiousness|agreeableness|steadiness|autonomy|competence|relatedness|growth mindset|locus of control|self[- ]efficacy|playfulness|assertiveness|cooperativeness|trait|score|percent|%)\b/i;
const VOICE_BAN = /\b(you are|you['’]re|always|never)\b/i;
const banned = new RegExp(`\\b(${PET_BANNED_WORDS.join('|')})\\b`, 'i');

assert.equal(PET_KNOWS_YOU_COPY_REVIEWED, true, 'emci read and approved the bank (2026-10-15); a new edit resets this to false until re-read');
for (const axis of TRAIT_AXES) {
  const ends = PKY_TRAIT_LINES[axis];
  assert.ok(ends, `${axis}: no lines`);
  for (const end of ['high', 'low'] as const) {
    assert.ok(ends[end].length >= 3, `${axis}/${end}: ${ends[end].length} lines, needs 3`);
  }
}
assert.equal(Object.keys(PKY_TRAIT_LINES).length, TRAIT_AXES.length, 'no extra axes in the bank');
ok(`all ${TRAIT_AXES.length} traits have 3+ lines for both ends`);

const all = allPkyLines();
const ids = all.map((l) => l.id);
assert.equal(new Set(ids).size, ids.length, 'ids are unique');
assert.equal(new Set(all.map((l) => l.text)).size, all.length, 'no duplicate line text');
for (const axis of TRAIT_AXES) {
  for (const end of ['high', 'low'] as const) {
    const code = end === 'high' ? 'h' : 'l';
    PKY_TRAIT_LINES[axis][end].forEach((l, i) => {
      assert.equal(l.id, `pky_${axis}_${code}_${String(i + 1).padStart(2, '0')}`, `${l.id}: id shape / order`);
    });
  }
}
PKY_THIN_LINES.forEach((l, i) => assert.equal(l.id, `pky_thin_${String(i + 1).padStart(2, '0')}`));
for (const tier of PKY_STREAK_TIERS) {
  tier.lines.forEach((l, i) => assert.equal(l.id, `pky_streak_${tier.tier}_${String(i + 1).padStart(2, '0')}`));
}
assert.ok(PKY_THIN_LINES.length >= 6, 'enough hedge lines that thin data does not repeat fast');
assert.deepEqual(
  PKY_STREAK_TIERS.map((t) => t.min),
  [...PKY_STREAK_TIERS.map((t) => t.min)].sort((a, b) => a - b),
  'streak tiers ascend',
);
assert.equal(PKY_STREAK_TIERS[0].min, 1);
ok(`${all.length} lines, ids unique and in order, hedges and streak tiers present`);

for (const l of all) {
  assert.ok(words(l.text) <= PKY_MAX_WORDS, `${l.id}: "${l.text}" is over ${PKY_MAX_WORDS} words`);
  assert.ok(l.text.length <= PKY_MAX_CHARS, `${l.id}: "${l.text}" is over ${PKY_MAX_CHARS} characters`);
  assert.ok(!/['"]/.test(l.text), `${l.id}: use curly quotes / apostrophes`);
  assert.ok(!CLINICAL.test(l.text), `${l.id}: "${l.text}" has a clinical word`);
  assert.ok(!LABELS.test(l.text), `${l.id}: "${l.text}" names a trait or a number`);
  assert.ok(!VOICE_BAN.test(l.text), `${l.id}: "${l.text}" breaks the moment voice`);
  assert.ok(!banned.test(l.text), `${l.id}: banned Play word`);
  assert.ok(!/\d/.test(l.text), `${l.id}: no digits`);
  assert.ok(!/[!?]{2,}|\p{Extended_Pictographic}/u.test(l.text), `${l.id}: no emoji or shouting`);
  assert.ok(/[.?”]$/.test(l.text), `${l.id}: ends like a sentence`);
}
ok(`every line ≤ ${PKY_MAX_WORDS} words / ${PKY_MAX_CHARS} chars, no clinical or label words, moment voice, curly quotes`);

/* ----------------------------------------------------------------- rules --- */

let s = 424242;
const rng = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};

const track = (axis: (typeof TRAIT_AXES)[number], value: number, answerCount = 5, kind: 'report' | 'game' = 'report'): TraitTrack => ({
  axis,
  track: kind,
  value,
  stability: 0.4,
  answerCount,
  lastTouched: '',
  lastDepthAt: null,
});

// What counts as "known": report track, enough answers, a clear end.
const ends = buildEnds([
  track('openness', 0.9),
  track('conscientiousness', 0.1),
  track('extraversion', 0.5), // mid → no end
  track('agreeableness', 0.9, PKY_MIN_ANSWERS - 1), // too few answers
  track('steadiness', 0.9, 6, 'game'), // game track is a gut call → ignored
  track('playfulness', 0.35), // the cut belongs to the band above (mid)
  track('autonomy', 0.65), // the cut belongs to high
]);
assert.deepEqual(ends, { openness: 'high', conscientiousness: 'low', autonomy: 'high' });
assert.deepEqual(buildEnds([]), {});
ok('known traits = report track, 3+ answers, a clear end (mid, thin and game-only are not spoken about)');

const rich = (over: Partial<PetKnowsProfile> = {}): PetKnowsProfile => ({
  ends: Object.fromEntries(TRAIT_AXES.map((a, i) => [a, i % 2 === 0 ? 'high' : 'low'])),
  streak: 0,
  doneToday: false,
  ...over,
});
assert.ok(isThin(THIN_PROFILE));
assert.ok(isThin({ ...THIN_PROFILE, ends: { openness: 'high', autonomy: 'low' } }));
assert.ok(!isThin({ ...THIN_PROFILE, ends: { openness: 'high', autonomy: 'low', competence: 'high' } }));
assert.equal(PKY_MIN_AXES, 3);

// Thin data: always a hedge, never nothing, never the same twice in a row.
{
  let recent: string[] = [];
  let last: string | null = null;
  for (let i = 0; i < 400; i += 1) {
    const pick = pickPersonalLine(THIN_PROFILE, recent, rng);
    assert.equal(pick.kind, 'thin');
    assert.ok(PKY_THIN_LINES.some((l) => l.id === pick.line.id), 'a hedge line');
    assert.notEqual(pick.line.id, last);
    last = pick.line.id;
    recent = rememberShown(recent, pick.line.id);
  }
}
ok('thin data → a hedge line every time, never silence, never the same line twice in a row');

// Rich data: never the same line or the same trait back to back; every axis and both ends get heard.
{
  const profile = rich();
  let recent: string[] = [];
  let last: string | null = null;
  const lastAxes: string[] = [];
  const heard = new Set<string>();
  for (let i = 0; i < 3000; i += 1) {
    const pick = pickPersonalLine(profile, recent, rng);
    assert.equal(pick.kind, 'trait');
    assert.notEqual(pick.line.id, last, 'same line twice in a row');
    const axis = axisOfPkyId(pick.line.id);
    assert.ok(axis, 'a trait line has an axis');
    assert.ok(!lastAxes.slice(-PKY_AXIS_GAP).includes(axis as string), `trait "${axis}" came again too soon`);
    lastAxes.push(axis as string);
    assert.equal(pick.line.id.includes(profile.ends[axis as (typeof TRAIT_AXES)[number]] === 'high' ? '_h_' : '_l_'), true, 'the line is for the person’s end');
    heard.add(pick.line.id);
    last = pick.line.id;
    recent = rememberShown(recent, pick.line.id);
    assert.ok(recent.length <= PKY_RECENT_CAP);
  }
  assert.equal(heard.size, TRAIT_AXES.length * 3, 'every line for the person’s ends gets its turn');
}
ok('trait lines: match the person’s end, never the same line or trait back to back, every line gets a turn');

// Both ends are reachable: flip the profile and the other lines come out.
{
  const flipped: PetKnowsProfile = rich({ ends: Object.fromEntries(TRAIT_AXES.map((a, i) => [a, i % 2 === 0 ? 'low' : 'high'])) });
  const seen = new Set<string>();
  let recent: string[] = [];
  for (let i = 0; i < 3000; i += 1) {
    const pick = pickPersonalLine(flipped, recent, rng);
    seen.add(pick.line.id);
    recent = rememberShown(recent, pick.line.id);
  }
  assert.equal(seen.size, TRAIT_AXES.length * 3);
}
ok('both ends of every trait are spoken (lows as warmly as highs)');

// Streak: only from the right tier, none when broken, a share of the picks, never when thin data is the only thing.
assert.equal(streakPool(0).length, 0, 'a broken streak (0) has no line');
assert.equal(streakPool(1)[0].id.startsWith('pky_streak_start_'), true);
assert.equal(streakPool(2)[0].id.startsWith('pky_streak_early_'), true);
assert.equal(streakPool(3)[0].id.startsWith('pky_streak_early_'), true);
assert.equal(streakPool(5)[0].id.startsWith('pky_streak_building_'), true);
assert.equal(streakPool(9)[0].id.startsWith('pky_streak_week_'), true);
assert.equal(streakPool(30)[0].id.startsWith('pky_streak_habit_'), true);
{
  let streakCount = 0;
  const n = 4000;
  for (let i = 0; i < n; i += 1) {
    const pick = pickPersonalLine(rich({ streak: 9, doneToday: true }), [], rng);
    if (pick.kind === 'streak') {
      streakCount += 1;
      assert.ok(streakPool(9).some((l) => l.id === pick.line.id), 'streak line from the wrong tier');
    }
  }
  assert.ok(streakCount / n > 0.2 && streakCount / n < 0.4, `streak share ${streakCount / n}`);
  for (let i = 0; i < 500; i += 1) assert.notEqual(pickPersonalLine(rich({ streak: 0, doneToday: true }), [], rng).kind, 'streak');
  // The streak survives a day without a check-in, so a streak line waits for today's check-in (it must be true).
  for (let i = 0; i < 500; i += 1) assert.notEqual(pickPersonalLine(rich({ streak: 9, doneToday: false }), [], rng).kind, 'streak');
  // Thin data with a streak still talks (a streak line or a hedge).
  for (let i = 0; i < 200; i += 1) assert.ok(['streak', 'thin'].includes(pickPersonalLine({ ...THIN_PROFILE, streak: 3, doneToday: true }, [], rng).kind));
}
ok('streak lines: right tier only, about 30% of picks, only after today’s check-in, none for a broken streak');

// Rarity: one per visit, cooldown across visits, a roll, busy = silent.
{
  const style = talkStyle(rich({ ends: {} }));
  assert.equal(style, 'steady');
  const gate = { nowMs: 10_000_000, lastShownAt: null as number | null, shownThisVisit: 0, busy: false };
  assert.ok(personalLineAllowed(gate, style));
  assert.ok(!personalLineAllowed({ ...gate, busy: true }, style), 'egg / away / sheet open → silent');
  assert.ok(!personalLineAllowed({ ...gate, shownThisVisit: PKY_MAX_PER_VISIT }, style), 'one per visit');
  assert.ok(!personalLineAllowed({ ...gate, lastShownAt: gate.nowMs - (PKY_COOLDOWN_MS - 1) }, style), 'cooldown holds');
  assert.ok(personalLineAllowed({ ...gate, lastShownAt: gate.nowMs - PKY_COOLDOWN_MS }, style), 'cooldown ends');
  assert.equal(PKY_MAX_PER_VISIT, 1);
  assert.ok(PKY_ROLL > 0 && PKY_ROLL <= 0.5, 'a roll, not every tick');
  assert.ok(PKY_COOLDOWN_MS >= 15 * 60 * 1000, 'cooldown is minutes, not seconds');
}
ok('rare: 1 per visit, 25-minute cooldown across visits, a roll on each idle tick, silent when busy');

// Talk style shifts how readily it speaks, never what it says.
{
  const lively = talkStyle({ ...THIN_PROFILE, ends: { extraversion: 'high' } });
  const calm = talkStyle({ ...THIN_PROFILE, ends: { extraversion: 'low' } });
  const calm2 = talkStyle({ ...THIN_PROFILE, ends: { steadiness: 'low' } });
  const mixed = talkStyle({ ...THIN_PROFILE, ends: { extraversion: 'high', steadiness: 'low' } });
  assert.deepEqual([lively, calm, calm2, mixed], ['lively', 'calm', 'calm', 'steady']);
  assert.equal(talkStyle({ ...THIN_PROFILE, ends: { playfulness: 'high' } }), 'lively');
  assert.ok(styleCooldownMs('lively') < styleCooldownMs('steady') && styleCooldownMs('steady') < styleCooldownMs('calm'));
  assert.ok(styleRoll('lively') > styleRoll('steady') && styleRoll('steady') > styleRoll('calm'));
  assert.ok(styleRoll('lively') <= 0.5, 'even the liveliest pet stays rare');
}
ok('talk style (lively / steady / calm) moves the cooldown and the roll only');

/* ------------------------------------------------------------- fallbacks --- */

{
  assert.deepEqual(parseState(null, 'u1'), emptyState('u1'));
  assert.deepEqual(parseState('not json', 'u1'), emptyState('u1'));
  const mine = JSON.stringify({
    v: 1,
    userId: 'u1',
    cache: { at: 5, ends: { openness: 'high', autonomy: 'sideways', bogus: 'low' } },
    lastShownAt: 7,
    recent: ['a', 3, 'b'],
  });
  const got = parseState(mine, 'u1');
  assert.equal(got.cache?.at, 5);
  assert.equal(got.lastShownAt, 7);
  assert.deepEqual(got.recent, ['a', 'b']);
  assert.equal(got.cache?.ends.openness, 'high');
  assert.equal(got.cache?.ends.autonomy, undefined, 'only high / low survive');
  assert.deepEqual(parseState(mine, 'u2'), emptyState('u2'), 'another account’s cache is ignored');
  assert.deepEqual(parseState(JSON.stringify({ v: 2, userId: 'u1' }), 'u1'), emptyState('u1'));
}
ok('cache: tolerant parse, ends only, one account only');

const store = read('src/play/pet-knows-you-store.ts');
{
  const load = store.indexOf('export async function loadPetKnows');
  const preview = store.indexOf('isPreviewing()', load);
  const session = store.indexOf('supabase.auth.getSession', load);
  const cacheRead = store.indexOf('AsyncStorage.getItem(PET_KNOWS_YOU_KEY)', load);
  assert.ok(preview > 0 && preview < session && session < cacheRead, 'preview, then signed-out, THEN the cache is read');
  assert.match(store, /if \(isPreviewing\(\)\) return thin/, 'Preview as new user: thin profile');
  assert.match(store, /if \(!userId\) return thin/, 'signed out: thin profile');
  assert.match(store, /catch \{\s*\n\s*return thin;/, 'any failure → thin, never a throw');
  assert.match(store, /Offline or a read error: keep whatever the cache had/, 'offline keeps the cached profile');
  assert.match(store, /withTimeout\(fetchTraitTracks/, 'the read has a timeout');
  assert.match(store, /fetchTraitTracks/, 'reads the app’s own trait tracks');
  assert.match(store, /currentStreak/, 'reads the app’s own streak');
  assert.match(store, /DAILY_INSIGHTS_STATE_KEY/, 'reads the daily-insights store');
  assert.ok(!/\.insert\(|\.upsert\(|\.rpc\(|\.update\(|\.delete\(/.test(store), 'the adapter only reads');
}
ok('adapter: preview → signed out → cache order, thin on every failure, offline keeps the cache, read-only');

/* ------------------------------------------------------------- isolation --- */

const own = ['src/play/pet-knows-you.ts', 'src/play/pet-knows-you-bank.ts', 'src/play/pet-knows-you-store.ts', 'src/play/use-pet-knows-you.ts'];
for (const file of own) {
  const src = read(file);
  assert.ok(!/generateText|ai-generate|ai-library|functions\.invoke|EXPO_PUBLIC_|fetch\(/.test(src), `${file}: no model call, no network of its own`);
  assert.ok(!/from '@\/app\//.test(src), `${file}: imports no app screen`);
}
ok('no model call anywhere in the feature');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const importers = walk(resolve(root, 'src'))
  .map((f) => relative(root, f).replace(/\\/g, '/'))
  .filter((f) => !own.includes(f))
  .filter((f) => /pet-knows-you|use-pet-knows-you/.test(read(f)));
assert.deepEqual(importers, ['src/play/pet-screen.tsx'], 'only the pet screen uses the feature (never Circle, the cloud save, the away card or any share)');
for (const file of ['src/play/cloud-save-model.ts', 'src/play/cloud-save.ts', 'src/play/playStore.ts', 'src/play/away-summary.ts', 'src/play/away-card.tsx']) {
  assert.ok(!/pet-knows-you/.test(read(file)), `${file} must not touch it`);
}
ok('only the pet screen uses it; the cloud save, the save doc and the away card never see a personal line');

{
  const hook = read('src/play/use-pet-knows-you.ts');
  assert.match(hook, /if \(isPreviewing\(\)\) loaded = \{ profile: THIN_PROFILE/, 'preview is re-checked on every line, not only at load');
  assert.match(hook, /savePetKnowsState\(next, true\)/, 'a late write never revives a wiped account');
  assert.match(store, /requireExisting && \(await AsyncStorage\.getItem\(PET_KNOWS_YOU_KEY\)\) == null/);
}
ok('hook: preview re-checked per line; no write after sign-out / Reset wiped the key');

const screen = read('src/play/pet-screen.tsx');
{
  assert.match(screen, /usePetKnowsYou\(\)/);
  const idleStart = screen.indexOf('const { maybeLine: maybePersonalLine }');
  const idleEnd = screen.indexOf('Shards ready to trade up');
  assert.ok(idleStart > 0 && idleEnd > idleStart);
  const idle = screen.slice(idleStart, idleEnd);
  assert.match(idle, /maybePersonalLine\(eggRef\.current \|\| awayRef\.current\)/, 'idle timer, never while an egg or away');
  assert.match(idle, /idleTalkDelayMs\(chatter/, 'Chatter Off still means silence');
  assert.equal((screen.match(/maybePersonalLine\(/g) ?? []).length, 1, 'one call site: the idle timer');
  const tap = screen.slice(screen.indexOf('const tapPet'), screen.indexOf('/* ---------------------------------------------------------- sheets'));
  assert.ok(!/maybePersonalLine|PersonalLine/.test(tap), 'a tap never triggers a personal line');
}
ok('wired to the idle timer only (Chatter Off keeps it silent; never on a tap, an egg or while away)');

console.log(`\ncheck:pet-knows-you — ${passed} groups passed.`);
