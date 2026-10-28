/**
 * Almanac engine core (ATO-BUILD PHASE-11a).
 * Run: npm run check:almanac
 *
 * Runs the real engine on a small fixture bank (the reviewed bank lands in
 * PHASE-11c). Pins: same input → same card; no repeat within min(pool, 90) days
 * over a 400-day run for 3 sample profiles; the pick comes from the top 8;
 * filters (reviewed, weekday, minDataDays, event/phase, axes); slot fallbacks
 * (alt, dropped, framework fence, 120 chars, {streak} = streakWithRest); the
 * base Pick stays the global rotation; the cache key includes bankVersion; the
 * seen-set caps at 400 and is owner-stamped; the engine files stay pure.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ALMANAC_TODAY_KEY,
  emptyTodayCache,
  parseTodayCache,
  readCached,
  writeCached,
} from '../src/lib/almanac/cache';
import { ALMANAC_BANK, ALMANAC_BANK_VERSION, cacheKey, loadToday, today } from '../src/lib/almanac/index';
import {
  ALMANAC_SEEN_CAP,
  ALMANAC_SEEN_KEY,
  addSeen,
  emptySeen,
  parseSeen,
  seenFor,
} from '../src/lib/almanac/seen-store';
import { almanacYmd, weekdayOfYmd } from '../src/lib/almanac/seed';
import { TOP_K, candidatesFor, rankCandidates, repeatWindowDays } from '../src/lib/almanac/select';
import { ALMANAC_MAX_CHARS, fillCard } from '../src/lib/almanac/slots';
import type {
  AlmanacCard,
  AlmanacContext,
  AlmanacLeanKey,
  AlmanacResult,
  AlmanacSurface,
  KeyValueStore,
  SeenEntry,
} from '../src/lib/almanac/types';
import type { ClearLean } from '../src/lib/daily-line/pick';
import { pickIndexForYmd } from '../src/lib/daily-pick/bank';
import { streakWithRest } from '../src/lib/home-path';
import { addDaysYmd } from '../src/lib/local-date';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '../src/lib/traits';
import { matchingFrameworkTerms } from '../src/lib/voice/framework-fence';

function ok(label: string): void {
  console.log(`  ok  ${label}`);
}

// ---------------------------------------------------------------- fixture bank
const short = (lean: TraitLean) => (lean === 'high' ? 'h' : 'l');
const nn = (n: number) => String(n).padStart(2, '0');

const bank: AlmanacCard[] = [];
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const key: AlmanacLeanKey = `${axis}:${lean}`;
    for (let i = 1; i <= 6; i++) {
      bank.push({ id: `alm_line_${axis}_${short(lean)}_${nn(i)}`, kind: 'line', axes: [key], text: `{axis} at {axisPct}%, line ${i}.`, reviewed: true });
    }
    for (let i = 1; i <= 4; i++) {
      bank.push({ id: `alm_try_${axis}_${short(lean)}_${nn(i)}`, kind: 'try', axes: [key], text: `Try ${i} for {axis}.`, reviewed: true });
    }
  }
}
const PAIRS: [AlmanacLeanKey, AlmanacLeanKey][] = [
  ['openness:high', 'conscientiousness:low'],
  ['extraversion:high', 'steadiness:low'],
  ['agreeableness:high', 'conflict_assertiveness:low'],
];
PAIRS.forEach((pair, p) => {
  for (let i = 1; i <= 3; i++) {
    bank.push({ id: `alm_line_pair${p}_${nn(i)}`, kind: 'line', axes: pair, text: `{axis} and {pairAxis}, pair ${i}.`, reviewed: true });
  }
});
for (let i = 1; i <= 12; i++) bank.push({ id: `alm_line_any_${nn(i)}`, kind: 'line', text: `A line for anyone, ${i}.`, reviewed: true });
for (let i = 1; i <= 10; i++) bank.push({ id: `alm_try_any_${nn(i)}`, kind: 'try', text: `A small try, ${i}.`, reviewed: true });
for (let i = 1; i <= 30; i++) bank.push({ id: `alm_fact_any_${nn(i)}`, kind: 'fact', text: `A fact, ${i}.`, reviewed: true });
for (let i = 1; i <= 5; i++) bank.push({ id: `alm_teaser_any_${nn(i)}`, kind: 'teaser', text: `Something is coming, ${i}.`, reviewed: true });
// Never shown: not reviewed, or needs more data than anyone in the sim has.
bank.push({ id: 'alm_line_openness_h_99', kind: 'line', axes: ['openness:high'], text: 'Unreviewed.', reviewed: false, weight: 50 });
bank.push({ id: 'alm_line_any_98', kind: 'line', text: 'Needs a year of data.', reviewed: true, minDataDays: 365, weight: 50 });
// Calendar-bound: only with a live event / arc.
bank.push({ id: 'alm_line_halloween_01', kind: 'line', event: 'halloween', phase: 'peak', text: '{eventName}, day {daysInto}.', reviewed: true, weight: 50 });
bank.push({ id: 'alm_line_arc_quiet_01', kind: 'line', arc: 'quiet', text: 'Quiet stretch.', reviewed: true, weight: 50 });
bank.push({ id: 'alm_pick_halloween_01', kind: 'pick', event: 'halloween', text: 'Treat or trick?', reviewed: true });
bank.push({ id: 'alm_pick_halloween_02', kind: 'pick', event: 'halloween', text: 'Costume or couch?', reviewed: true });
bank.push({ id: 'alm_pick_any_01', kind: 'pick', text: 'Not an event Pick: never replaces the rotation.', reviewed: true });

function lean(axis: TraitAxis, l: TraitLean, strength: number): ClearLean {
  return { axis, lean: l, settled: true, strength };
}

const PROFILES: Record<string, AlmanacContext> = {
  strong: {
    userId: 'user-strong',
    ymd: '2026-11-01',
    leans: [
      lean('openness', 'high', 0.35),
      lean('conscientiousness', 'low', 0.25),
      lean('extraversion', 'high', 0.3),
      lean('steadiness', 'low', 0.15),
      lean('agreeableness', 'high', 0.12),
      lean('playfulness', 'high', 0.4),
    ],
    dataDays: 40,
    name: 'Sam',
  },
  light: {
    userId: 'user-light',
    ymd: '2026-11-01',
    leans: [lean('autonomy', 'low', 0.11), lean('growth_mindset', 'high', 0.13)],
    dataDays: 5,
  },
  starter: { userId: 'user-starter', ymd: '2026-11-01', leans: [], dataDays: 0 },
};

const START = '2026-11-01';
const SIM_DAYS = 400;
const SIM_SURFACES: AlmanacSurface[] = ['home.line', 'insights.try', 'insights.deck', 'push'];

function resultId(r: AlmanacResult | null): string | null {
  if (!r) return null;
  return r.source === 'card' ? r.card.id : `rotation:${r.pickIndex}`;
}

console.log('check:almanac');

// ---------------------------------------------------------------- dates
assert.equal(weekdayOfYmd('2026-11-01'), 0, '2026-11-01 is a Sunday');
assert.equal(weekdayOfYmd('2026-11-02'), 1);
const instant = new Date('2026-11-01T11:30:00Z');
assert.equal(almanacYmd(instant, 'Pacific/Kiritimati'), '2026-11-02', 'UTC+14 is already tomorrow');
assert.equal(almanacYmd(instant, 'Etc/GMT+12'), '2026-10-31', 'UTC-12 is still yesterday');
assert.equal(almanacYmd(instant, 'UTC'), '2026-11-01');
assert.match(almanacYmd(instant, null), /^\d{4}-\d{2}-\d{2}$/, 'no zone yet: device zone');
assert.equal(almanacYmd(instant, 'Not/AZone'), '2026-11-01', 'a bad zone falls back to UTC, never throws');
ok('day keys: me.timezone (UTC+14 / UTC-12), device zone before me loads, weekday from ymd');

// ---------------------------------------------------------------- determinism
for (const ctx of Object.values(PROFILES)) {
  for (const surface of SIM_SURFACES) {
    const a = today(surface, ctx, { bank, seen: [] });
    const b = today(surface, { ...ctx, leans: [...ctx.leans] }, { bank: [...bank], seen: [] });
    assert.deepEqual(a, b, `same input → same card (${ctx.userId}, ${surface})`);
  }
}
{
  let differs = 0;
  for (let d = 0; d < 30; d++) {
    const ymd = addDaysYmd(START, d);
    const a = today('home.line', { ...PROFILES.strong!, ymd }, { bank });
    const b = today('home.line', { ...PROFILES.strong!, userId: 'user-strong-2', ymd }, { bank });
    if (resultId(a) !== resultId(b)) differs += 1;
  }
  assert.ok(differs > 0, 'two readers with the same leans do not get the same card every day');
}
ok('determinism: same input gives the same card; the seed is personal');

// ---------------------------------------------------------------- 400-day sim
for (const [label, base] of Object.entries(PROFILES)) {
  for (const surface of SIM_SURFACES) {
    const pool = candidatesFor(surface, base, bank).length;
    assert.ok(pool > 0, `${label}/${surface}: fixture pool is not empty`);
    const need = Math.min(pool, 90);
    let seenState = emptySeen(base.userId);
    const lastShown = new Map<string, number>();
    for (let d = 0; d < SIM_DAYS; d++) {
      const ctx: AlmanacContext = { ...base, ymd: addDaysYmd(START, d) };
      const seen = seenFor(seenState, surface);
      const ranked = rankCandidates(surface, ctx, bank, seen);
      const r = today(surface, ctx, { bank, seen });
      assert.ok(r && r.source === 'card', `${label}/${surface} day ${d}: a card every day`);
      const id = r.card.id;
      assert.ok(
        ranked.slice(0, TOP_K).some((x) => x.candidate.card.id === id),
        `${label}/${surface} day ${d}: the card comes from the top ${TOP_K}`,
      );
      assert.ok(r.card.reviewed, 'only reviewed cards');
      assert.ok(!r.card.event && !r.card.arc && !r.card.minDataDays, 'no event/arc/min-data card without its condition');
      const prev = lastShown.get(id);
      if (prev !== undefined) {
        assert.ok(d - prev >= need, `${label}/${surface}: ${id} repeated after ${d - prev} days (pool ${pool}, need ${need})`);
      }
      lastShown.set(id, d);
      seenState = addSeen(seenState, surface, { id, ymd: ctx.ymd });
    }
  }
}
assert.equal(repeatWindowDays(1), 0);
assert.equal(repeatWindowDays(500), 89);
ok(`400-day sim: 3 profiles × ${SIM_SURFACES.length} surfaces, no repeat within min(pool, 90) days, always from the top ${TOP_K}`);

// ---------------------------------------------------------------- filters
{
  const sunday = '2026-11-01';
  const monday = '2026-11-02';
  const weekdayBank: AlmanacCard[] = [{ id: 'alm_reflect_sunday_01', kind: 'reflect', weekday: [0], text: 'Sunday.', reviewed: true }];
  assert.equal(candidatesFor('insights.try', { ...PROFILES.starter!, ymd: sunday }, weekdayBank).length, 1);
  assert.equal(candidatesFor('insights.try', { ...PROFILES.starter!, ymd: monday }, weekdayBank).length, 0);

  const halloween = { events: [{ event: 'halloween', phase: 'peak' as const, name: 'Halloween', daysInto: 2 }] };
  const live = candidatesFor('home.line', { ...PROFILES.starter!, calendar: halloween }, bank).map((c) => c.card.id);
  assert.ok(live.includes('alm_line_halloween_01'), 'event card shows while its event is live');
  const fading = candidatesFor('home.line', { ...PROFILES.starter!, calendar: { events: [{ event: 'halloween', phase: 'fade' }] } }, bank);
  assert.ok(!fading.some((c) => c.card.id === 'alm_line_halloween_01'), 'phase must match');
  const arc = candidatesFor('home.line', { ...PROFILES.starter!, calendar: { arcs: ['quiet'] } }, bank);
  assert.ok(arc.some((c) => c.card.id === 'alm_line_arc_quiet_01'), 'arc card shows while its arc is live');
  const veteran = candidatesFor('home.line', { ...PROFILES.starter!, dataDays: 400 }, bank);
  assert.ok(veteran.some((c) => c.card.id === 'alm_line_any_98'), 'minDataDays met → eligible');

  const strongIds = candidatesFor('home.line', PROFILES.strong!, bank).map((c) => c.card.id);
  assert.ok(strongIds.includes('alm_line_pair0_01'), 'a pair card needs both leans (has both)');
  assert.ok(!strongIds.includes('alm_line_pair2_01'), 'a pair card needs both leans (missing one)');
  assert.ok(!strongIds.some((id) => id.startsWith('alm_line_autonomy_')), 'no card for a lean the reader does not have');
  assert.ok(!strongIds.some((id) => id.startsWith('alm_try_')), 'kinds stay on their surface');
}
ok('filters: weekday, event + phase, arc, minDataDays, all axis keys, kind per surface');

// ---------------------------------------------------------------- reviewer fixes
{
  // A layer weight of 0 hides half the pool: the window is sized on drawable cards, so it never runs dry.
  const small: AlmanacCard[] = Array.from({ length: 10 }, (_, i) => ({
    id: `alm_line_small_${nn(i)}`,
    kind: 'line',
    text: `Small ${i}.`,
    reviewed: true,
    variant: i < 5 ? 'live' : 'off',
  }));
  const ctx: AlmanacContext = { ...PROFILES.starter!, layerWeight: (c) => (c.variant === 'off' ? 0 : 1) };
  let seenState = emptySeen(ctx.userId);
  const last = new Map<string, number>();
  for (let d = 0; d < 60; d++) {
    const day = { ...ctx, ymd: addDaysYmd(START, d) };
    const r = today('home.line', day, { bank: small, seen: seenFor(seenState, 'home.line') });
    assert.ok(r && r.source === 'card', `zero-weight cards never empty the pool (day ${d})`);
    assert.equal(r.card.variant, 'live', 'a zero layer weight is never drawn');
    const prev = last.get(r.card.id);
    if (prev !== undefined) assert.ok(d - prev >= 5, 'window sized on the 5 drawable cards');
    last.set(r.card.id, d);
    seenState = addSeen(seenState, 'home.line', { id: r.card.id, ymd: day.ymd });
  }

  // Equal scores are ordered by the personal seed, not alphabetically.
  const tied: AlmanacCard[] = Array.from({ length: 40 }, (_, i) => ({ id: `alm_fact_tie_${nn(i)}`, kind: 'fact', text: `Tie ${i}.`, reviewed: true }));
  const alphaTop = new Set(tied.slice(0, TOP_K).map((c) => c.id));
  let outside = 0;
  for (let d = 0; d < 30; d++) {
    const r = today('insights.deck', { ...PROFILES.starter!, ymd: addDaysYmd(START, d) }, { bank: tied, seen: [] });
    if (r && r.source === 'card' && !alphaTop.has(r.card.id)) outside += 1;
  }
  assert.ok(outside > 0, 'ties are not broken alphabetically (the first 8 ids are not the only cards ever shown)');
}
ok('reviewer fixes: zero-weight cards removed before the repeat window; ties broken by the personal seed');

// ---------------------------------------------------------------- slots
{
  const ctx: AlmanacContext = { ...PROFILES.strong!, openedYmds: ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'] };
  const card = (text: string, alt?: string): AlmanacCard => ({ id: 'alm_line_slot_01', kind: 'line', text, alt, reviewed: true, axes: ['openness:high'] });

  assert.deepEqual(fillCard(card('{axis} {axisPct}%'), ctx), { text: 'Adventurous 85%', usedAlt: false });
  assert.deepEqual(fillCard(card('Hi {name}'), ctx), { text: 'Hi Sam', usedAlt: false });
  assert.deepEqual(fillCard(card('Hi {name}', 'Hi there'), PROFILES.light!), { text: 'Hi there', usedAlt: true }, 'missing slot → alt');
  assert.equal(fillCard(card('Hi {name}'), PROFILES.light!), null, 'missing slot and no alt → dropped');
  assert.equal(fillCard(card('{nope}', 'Alt {alsoNope}'), ctx), null, 'unknown slots count as missing');
  const streak = streakWithRest(ctx.openedYmds!, ctx.ymd).streak;
  assert.ok(streak > 0);
  assert.deepEqual(fillCard(card('{streak} days'), ctx), { text: `${streak} days`, usedAlt: false }, '{streak} = streakWithRest');
  assert.deepEqual(fillCard(card('{streak} days', 'Welcome back'), PROFILES.starter!), { text: 'Welcome back', usedAlt: true });

  const long = 'x'.repeat(ALMANAC_MAX_CHARS + 1);
  assert.equal(fillCard(card(long), ctx), null, 'over 120 chars → dropped');
  assert.deepEqual(fillCard(card(long, 'Short'), ctx), { text: 'Short', usedAlt: true }, 'over 120 chars → alt');
  const fenced = 'Your MBTI type is INTJ.';
  assert.ok(matchingFrameworkTerms(fenced).length > 0, 'fixture sentence trips the framework fence');
  assert.equal(fillCard(card(fenced), ctx), null, 'framework fence runs after the fill');

  const pair = fillCard({ id: 'alm_line_pair0_01', kind: 'line', axes: PAIRS[0], text: '{axis}/{pairAxis} {pairPct}', reviewed: true }, ctx);
  assert.deepEqual(pair, { text: 'Adventurous/Flexible 75', usedAlt: false }, 'pair slots use the card keys');

  const halloween = { events: [{ event: 'halloween', phase: 'peak' as const, name: 'Halloween', daysInto: 2 }] };
  const ev = fillCard({ id: 'alm_line_halloween_01', kind: 'line', event: 'halloween', text: '{eventName}, day {daysInto}', reviewed: true }, { ...ctx, calendar: halloween });
  assert.deepEqual(ev, { text: 'Halloween, day 2', usedAlt: false });
  const extras = fillCard(card('{pickShare} of people'), { ...ctx, extras: { pickShare: '62%' } });
  assert.deepEqual(extras, { text: '62% of people', usedAlt: false });
}
ok('slots: fill, alt fallback, drop without alt, unknown slot, 120 chars, framework fence, {streak}, pair, event, extras');

// ---------------------------------------------------------------- Pick
for (let d = 0; d < 40; d++) {
  const ymd = addDaysYmd(START, d);
  const r = today('home.pick', { ...PROFILES.strong!, ymd }, { bank });
  assert.deepEqual(r, { surface: 'home.pick', source: 'rotation', pickIndex: pickIndexForYmd(ymd) }, `base Pick = global rotation (${ymd})`);
}
{
  const calendar = { events: [{ event: 'halloween', phase: 'peak' as const }] };
  const a = today('home.pick', { ...PROFILES.strong!, calendar }, { bank });
  const b = today('home.pick', { ...PROFILES.starter!, calendar }, { bank });
  assert.ok(a && a.source === 'card' && a.card.event === 'halloween', 'a live event Pick replaces the rotation');
  assert.equal(resultId(a), resultId(b), 'event Pick is shared: every reader gets the same one');
}
assert.deepEqual(today('home.pick', PROFILES.strong!), { surface: 'home.pick', source: 'rotation', pickIndex: pickIndexForYmd(START) });
ok('home.pick: the existing global rotation by ymd; event Picks shared, not personal');

// ---------------------------------------------------------------- empty shipped bank
assert.equal(ALMANAC_BANK.length, 0, 'the shipped bank stays empty until PHASE-11c');
assert.equal(today('home.line', PROFILES.strong!), null, 'nothing fits → null, never a crash');
ok('empty bank → null on every personal surface');

// ---------------------------------------------------------------- cache + seen
{
  assert.ok(cacheKey('u', '2026-11-01', 'home.line', 3).endsWith('|3'), 'cache key includes bankVersion');
  assert.notEqual(cacheKey('u', START, 'home.line', 1), cacheKey('u', START, 'home.line', 2));
  let cache = emptyTodayCache('u');
  cache = writeCached(cache, { ymd: START, surface: 'home.line', bankVersion: 1, result: { source: 'card', cardId: 'alm_line_any_01', text: 'x', usedAlt: false } });
  assert.ok(readCached(cache, START, 'home.line', 1));
  assert.equal(readCached(cache, START, 'home.line', 2), null, 'a new bankVersion misses the cache');
  assert.equal(readCached(cache, START, 'push', 1), null, 'per surface');
  assert.equal(readCached(cache, addDaysYmd(START, 1), 'home.line', 1), null, 'per day');
  for (let d = 1; d <= 5; d++) {
    cache = writeCached(cache, { ymd: addDaysYmd(START, d), surface: 'home.line', bankVersion: 1, result: { source: 'rotation', pickIndex: d } });
  }
  assert.equal(new Set(cache.entries.map((e) => e.ymd)).size, 3, 'keeps the latest 3 days');
  assert.equal(parseTodayCache(JSON.stringify(cache), 'other').entries.length, 0, 'owner-stamped');
  assert.equal(parseTodayCache('{not json', 'u').entries.length, 0, 'bad JSON → empty');

  let seen = emptySeen('u');
  for (let d = 0; d < ALMANAC_SEEN_CAP + 50; d++) seen = addSeen(seen, 'home.line', { id: `c${d}`, ymd: addDaysYmd(START, d) });
  const rows = seenFor(seen, 'home.line');
  assert.equal(rows.length, ALMANAC_SEEN_CAP, `seen caps at ${ALMANAC_SEEN_CAP}`);
  assert.equal(rows[rows.length - 1]!.id, `c${ALMANAC_SEEN_CAP + 49}`, 'keeps the newest');
  seen = addSeen(seen, 'home.line', { id: 'again', ymd: rows[rows.length - 1]!.ymd });
  assert.equal(seenFor(seen, 'home.line').length, ALMANAC_SEEN_CAP, 'one entry per day per surface');
  assert.equal(seenFor(parseSeen(JSON.stringify(seen), 'other'), 'home.line').length, 0, 'owner-stamped');
  assert.equal(seenFor(parseSeen(JSON.stringify({ ...seen, v: 0 }), 'u'), 'home.line').length, 0, 'versioned');
  assert.equal(seenFor(parseSeen(JSON.stringify(seen), 'u'), 'home.line').length, ALMANAC_SEEN_CAP, 'round-trips');

  assert.match(ALMANAC_SEEN_KEY, /^ato\.almanac\.[a-z-]+\.v1$/);
  assert.match(ALMANAC_TODAY_KEY, /^ato\.almanac\.[a-z-]+\.v1$/);
  const ladCheck = readFileSync(resolve(__dirname, 'local-account-data-check.ts'), 'utf8');
  for (const key of [ALMANAC_SEEN_KEY, ALMANAC_TODAY_KEY]) {
    assert.ok(ladCheck.includes(`'${key}'`), `${key} is in check:local-account-data's wiped list`);
  }
}
ok('cache: keyed by user/day/surface/bankVersion, 3 days kept, owner-stamped; seen: cap 400, versioned, wiped on sign-out');

// ---------------------------------------------------------------- loadToday (mid-day OTA, reopen)
async function loadTodayChecks(): Promise<void> {
  const mem = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => mem.get(k) ?? null,
    setItem: async (k, v) => {
      mem.set(k, v);
    },
  };
  const ctx = PROFILES.strong!;
  const first = await loadToday('home.line', ctx, store, { bank, bankVersion: 1 });
  const again = await loadToday('home.line', ctx, store, { bank, bankVersion: 1 });
  assert.deepEqual(again, first, 'reopening gives the same card');
  const seen = seenFor(parseSeen(mem.get(ALMANAC_SEEN_KEY) ?? null, ctx.userId), 'home.line');
  assert.deepEqual(seen, [{ id: resultId(first), ymd: ctx.ymd }] as SeenEntry[], 'today is recorded once');

  // Same bankVersion, cards re-weighted (as an OTA might): the cached card stays.
  const reweighted = bank.map((c) => (c.id === resultId(first) ? c : { ...c, weight: 40 }));
  const afterOta = await loadToday('home.line', ctx, store, { bank: reweighted, bankVersion: 1 });
  assert.equal(resultId(afterOta), resultId(first), 'a mid-day change with the same bankVersion never swaps the card');

  // Parallel loads on two surfaces keep both seen entries.
  await Promise.all([
    loadToday('insights.try', ctx, store, { bank, bankVersion: 1 }),
    loadToday('insights.deck', ctx, store, { bank, bankVersion: 1 }),
  ]);
  const state = parseSeen(mem.get(ALMANAC_SEEN_KEY) ?? null, ctx.userId);
  assert.equal(seenFor(state, 'insights.try').length, 1);
  assert.equal(seenFor(state, 'insights.deck').length, 1);
  assert.equal(seenFor(state, 'home.line').length, 1);

  const pick = await loadToday('home.pick', ctx, store, { bank, bankVersion: 1 });
  assert.deepEqual(pick, { surface: 'home.pick', source: 'rotation', pickIndex: pickIndexForYmd(ctx.ymd) });

  const broken: KeyValueStore = {
    getItem: async () => {
      throw new Error('disk');
    },
    setItem: async () => {
      throw new Error('disk');
    },
  };
  const offline = await loadToday('home.line', ctx, broken, { bank, bankVersion: 1 });
  assert.equal(resultId(offline), resultId(first), 'storage failing still gives today\'s card (no crash)');
  ok('loadToday: reopen and mid-day OTA keep the card, parallel surfaces keep both seen rows, storage errors are safe');
}

// ---------------------------------------------------------------- purity
function sourceChecks(): void {
  const dir = resolve(__dirname, '../src/lib/almanac');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const f of ['types.ts', 'seed.ts', 'select.ts', 'slots.ts', 'seen-store.ts', 'cache.ts', 'index.ts']) {
    assert.ok(files.includes(f), `src/lib/almanac/${f} exists`);
  }
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
    for (const spec of imports) {
      assert.doesNotMatch(spec, /react|expo|async-storage|supabase|sentry/i, `${f} imports ${spec}: the engine stays pure`);
      if (spec.startsWith('@/lib/')) {
        assert.ok(
          /^@\/lib\/(daily-line\/(bank|pick)|daily-pick\/bank|traits|local-date|home-path|axis-poles|voice\/framework-fence)$/.test(spec),
          `${f}: unexpected import ${spec}`,
        );
      }
    }
    assert.doesNotMatch(src, /\bfetch\s*\(|Math\.random|Date\.now\(/, `${f}: no network, no randomness, no clock`);
  }
  ok('purity: no RN / Expo / AsyncStorage / Supabase import, no fetch, no Math.random, no clock');
}

void loadTodayChecks()
  .then(() => {
    sourceChecks();
    console.log(`check:almanac passed (bank v${ALMANAC_BANK_VERSION}, fixture ${bank.length} cards)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
