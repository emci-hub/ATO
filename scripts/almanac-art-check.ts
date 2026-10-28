/**
 * Almanac theming art (ATO-BUILD PHASE-11h).
 * Run: npm run check:almanac-art
 *
 * Pins: every art accessor the Home theming names resolves through the registry
 * (the same data `findArt` reads) and every theming key has one; the loop table
 * matches the sheets (frames, columns, rows, ms); the Almanac art total is logged and
 * at most 3 MB; nothing Almanac is unused except the three sets built for other
 * surfaces (listed); ONE frame callback, ONE animated decor node (cap 12) and Home
 * inside 60 nodes; Reduce Motion is half / quarter speed / every 3rd frame; the look
 * maths (ring count, sprigs at 0.1-0.4, accent lerp) on fixtures and a real year.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { EVENT_IDS, MICRO_IDS } from '../src/lib/almanac/events';
import {
  EVENT_LOOK,
  LOOPS,
  MAX_DECOR,
  MICRO_STICKER_KEYS,
  REDUCE_MOTION_FRAME_STEP,
  REDUCE_MOTION_SPEED,
  SEASON_COLOR,
  SPRIG_MAX,
  SPRIG_MIN,
  lerpColor,
  lookOf,
  particleOpacity,
  reducedDecorCount,
  type DecorKey,
  type LoopKey,
  type SprigKey,
} from '../src/lib/almanac/look';
import { createCalendar, type DayTheme } from '../src/lib/almanac/resolve';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const ok = (msg: string) => console.log(`  ok  ${msg}`);

interface RegistryAsset {
  id: string;
  tags?: string[];
  status?: string;
  diskBytes?: number;
  size?: { w: number; h: number };
  clips?: { loop?: { frames: number; ms: number } };
}
const registry = JSON.parse(read('assets/art/registry.json')) as { assets: RegistryAsset[] };
const byId = new Map(registry.assets.map((a) => [a.id, a]));

/** `ART.a.b.c` literal → id, read from the generated tree (indentation = nesting). */
function artTree(): Map<string, string> {
  const lines = read('src/art/generated-art.ts').split('\n');
  const start = lines.findIndex((l) => l.startsWith('export const ART = {'));
  assert.ok(start >= 0, 'generated-art.ts has the ART tree');
  const out = new Map<string, string>();
  const stack: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\}/.test(line)) break;
    const open = line.match(/^\s*([A-Za-z0-9_]+): \{$/);
    if (open) {
      stack.push(open[1]);
      continue;
    }
    if (/^\s*\},?$/.test(line)) {
      stack.pop();
      continue;
    }
    const leaf = line.match(/^\s*([A-Za-z0-9_]+): '([^']+)',?$/);
    if (leaf) out.set([...stack, leaf[1]].join('.'), leaf[2]);
  }
  return out;
}
const tree = artTree();

const FILES = ['src/components/almanac/decor-layer.tsx', 'src/components/almanac/edge-sprigs.tsx', 'src/components/almanac/season-theme.tsx'];
const sources = Object.fromEntries(FILES.map((f) => [f, read(f)]));

// ── 1. Every named accessor resolves; every theming key has one ──────────────
const used = new Set<string>();
for (const f of FILES) {
  for (const m of sources[f].matchAll(/\bART\.([A-Za-z0-9_.]+)/g)) {
    const id = tree.get(m[1]);
    assert.ok(id, `${f}: ART.${m[1]} is in the generated art tree`);
    const asset = byId.get(id);
    assert.ok(asset, `${f}: ${id} is in the registry`);
    assert.ok(asset.status !== 'archived' && asset.status !== 'deprecated', `${id} is not archived`);
    assert.ok(asset.tags?.includes('almanac'), `${id} is Almanac art`);
    used.add(id);
  }
}
ok(`${used.size} art accessors in the theming files resolve through the registry`);

const decorKeys = new Set<DecorKey>();
const sprigKeys = new Set<SprigKey>();
const loopKeys = new Set<LoopKey>();
for (const [id, look] of Object.entries(EVENT_LOOK)) {
  look.decor.forEach((d) => decorKeys.add(d));
  if (look.sprig) sprigKeys.add(look.sprig);
  if (look.loop) loopKeys.add(look.loop);
  assert.ok(look.decor.length > 0, `${id} has decor`);
  assert.match(look.color, /^#[0-9a-f]{6}$/i, `${id} colour is #rrggbb`);
}
const decorLayer = sources['src/components/almanac/decor-layer.tsx'];
const edgeSprigs = sources['src/components/almanac/edge-sprigs.tsx'];
const mapHas = (src: string, key: string) => new RegExp(`['"]?${key}['"]?\\s*:\\s*ART\\.`).test(src);
for (const k of decorKeys) assert.ok(mapHas(decorLayer, k), `decor-layer maps decor "${k}"`);
for (const k of sprigKeys) assert.ok(mapHas(edgeSprigs, k), `edge-sprigs maps sprig "${k}"`);
for (const k of Object.keys(LOOPS)) assert.ok(mapHas(decorLayer, k), `decor-layer maps loop "${k}"`);
for (const k of MICRO_STICKER_KEYS) assert.ok(mapHas(decorLayer, k), `decor-layer maps sticker "${k}"`);
for (let m = 1; m <= 12; m++) assert.ok(mapHas(decorLayer, `month${String(m).padStart(2, '0')}`), `decor-layer maps month${m}`);
for (const id of EVENT_IDS) assert.ok(EVENT_LOOK[id], `event ${id} has a look`);
assert.equal(MICRO_STICKER_KEYS.length, MICRO_IDS.length, 'every micro-event has a sticker');
for (const id of Object.keys(EVENT_LOOK)) assert.ok((EVENT_IDS as readonly string[]).includes(id), `${id} is a real event id`);
ok('every event, micro-event, decor, sprig and loop key is mapped to art');

// ── 2. Loop table = the sheets ───────────────────────────────────────────────
for (const [key, sheet] of Object.entries(LOOPS)) {
  const asset = byId.get(`fx.almanac-${key}.${key}-64`);
  assert.ok(asset, `loop ${key} has a sheet`);
  assert.equal(asset.size?.w, sheet.cols * 64, `${key}: width = cols × 64`);
  assert.equal(asset.size?.h, sheet.rows * 64, `${key}: height = rows × 64`);
  assert.equal(asset.clips?.loop?.frames, sheet.frames, `${key}: frame count`);
  assert.equal(asset.clips?.loop?.ms, sheet.ms, `${key}: frame ms`);
  assert.ok(sheet.frames <= sheet.cols * sheet.rows, `${key}: frames fit the grid`);
}
ok('the 6 loop sheets match LOOPS (frames, columns, rows, ms)');

// ── 3. Size budget + nothing unused ──────────────────────────────────────────
const almanac = registry.assets.filter((a) => a.tags?.includes('almanac'));
const bytes = almanac.reduce((n, a) => n + (a.diskBytes ?? 0), 0);
console.log(`  Almanac art: ${almanac.length} assets, ${(bytes / 1024).toFixed(1)} KB on disk (cap 3072 KB)`);
assert.ok(bytes <= 3 * 1024 * 1024, 'Almanac art is at most 3 MB');
const RESERVED = ['icon.almanac-badges.', 'icon.almanac-emblems.', 'ui.almanac-frames.'];
const unused = almanac.filter((a) => !used.has(a.id));
const stray = unused.filter((a) => !RESERVED.some((p) => a.id.startsWith(p)));
assert.deepEqual(
  stray.map((a) => a.id),
  [],
  'every Almanac asset is used by the theming, except badges / emblems / frames',
);
console.log(`  Reserved for the You / Insights surfaces (not PHASE-11h): ${unused.length} assets (badges, emblems, frames)`);
ok('no Almanac asset is unused beyond the three surface sets');

// ── 4. Perf budget: one clock, one animated decor node, Home inside 60 ───────
const all = FILES.map((f) => sources[f]).join('\n');
assert.equal((all.match(/useFrameCallback\(/g) ?? []).length, 1, 'ONE frame callback for every particle');
const animatedNodes = (all.match(/<Animated\.[A-Za-z]+/g) ?? []).length;
assert.ok(animatedNodes <= 12, `at most 12 animated decor nodes (found ${animatedNodes})`);
assert.equal(animatedNodes, 1, 'the particle sheet is the one animated node');
assert.ok(!/\.map\([^)]*=>\s*<Animated/.test(all), 'no per-particle animated nodes');
const constellation = read('src/components/trait-constellation.tsx');
const constellationNodes =
  (constellation.match(/<AnimatedCircle\b/g) ?? []).length * 16 + (constellation.match(/<AnimatedPath\b/g) ?? []).length + 3;
assert.ok(constellationNodes + animatedNodes <= 60, `Home stays within 60 nodes (${constellationNodes} + ${animatedNodes})`);
assert.ok(MAX_DECOR <= 12, 'the ring is at most 12');
assert.match(decorLayer, /useMotionActive\(\)/, 'the clock pauses when unfocused or backgrounded');
assert.match(decorLayer, /REDUCE_MOTION_SPEED/, 'Reduce Motion: quarter speed');
assert.match(decorLayer, /REDUCE_MOTION_FRAME_STEP/, 'Reduce Motion: every 3rd frame');
assert.match(decorLayer, /reducedDecorCount\(/, 'Reduce Motion: half the ring');
assert.match(read('src/components/home-hero.tsx'), /<Appear breathe>/, 'Reduce Motion: the hero still breathes');
assert.equal(REDUCE_MOTION_SPEED, 0.25);
assert.equal(REDUCE_MOTION_FRAME_STEP, 3);
assert.ok(!/localStorage|AsyncStorage/.test(all), 'theming stores nothing (no new local key)');
ok('one clock, one animated node, Home within 60, Reduce Motion gentle and never still');

// ── 5. Look maths on fixtures ────────────────────────────────────────────────
assert.equal(lerpColor('#000000', '#ffffff', 0), '#000000');
assert.equal(lerpColor('#000000', '#ffffff', 1), '#ffffff');
assert.equal(lerpColor('#000000', '#ffffff', 0.5), '#808080');
assert.equal(lerpColor('#102030', '#102030', 0.7), '#102030');
assert.equal(reducedDecorCount(0), 0);
assert.equal(reducedDecorCount(1), 1);
assert.equal(reducedDecorCount(4), 2);
assert.equal(reducedDecorCount(12), 6);
assert.equal(particleOpacity(1, true), particleOpacity(1, false) / 2);

function fake(event: string | null, intensity: number, extra?: Partial<DayTheme>): DayTheme {
  return {
    ymd: '2026-12-10',
    season: { id: 'embers', name: 'Season of Embers', leans: '' },
    active: [],
    display: { event, intensity },
    ...extra,
  } as unknown as DayTheme;
}
const off = lookOf(fake(null, 0));
assert.equal(off.event, null, 'off-season: no event art');
assert.equal(off.decorCount, 0, 'off-season: no ring');
assert.equal(off.sprigOn, false, 'off-season: no sprigs');
assert.equal(off.accent, SEASON_COLOR.embers, 'off-season: the season colour');
const lead = lookOf(fake('christmas', 0.3));
assert.equal(lead.decorCount, 4, 'Christmas lead-in 0.3: round(12 × 0.3) = 4');
assert.equal(lead.sprigOn, true, 'lead-in: sprigs on');
const peak = lookOf(fake('christmas', 1));
assert.equal(peak.decorCount, 12, 'peak: a full ring');
assert.equal(peak.sprigOn, false, 'peak: sprigs off');
assert.equal(peak.accent, EVENT_LOOK.christmas.color.toLowerCase(), 'peak: the event colour');
const fade = lookOf(fake('christmas', 0.35));
assert.equal(fade.sprigOn, true, 'fade (0.35): sprigs on');
assert.equal(lookOf(fake('christmas', SPRIG_MIN)).sprigOn, true);
assert.equal(lookOf(fake('christmas', SPRIG_MAX)).sprigOn, true);
assert.equal(lookOf(fake('christmas', 0.05)).sprigOn, false, 'under 0.1: no sprigs');
assert.equal(lookOf(fake('christmas', 0.5)).sprigOn, false, 'over 0.4: no sprigs');
const micro = lookOf(fake(null, 0, { active: [{ id: 'full_moon', kind: 'micro' }] as DayTheme['active'] }));
assert.equal(micro.sticker, 'fullMoon');
assert.equal(micro.stickerIsMicro, true);
assert.equal(off.sticker, 'month12', 'no micro-event: the quiet month glyph');
assert.equal(lookOf(fake('thanksgiving_us', 0.4, { ymd: '2026-11-26' })).event?.loop, 'leaf');
ok('look fixtures: Embers off-season, lead-in 0.3, peak, fade, sprig band, micro sticker');

// ── 6. A real year (US, north): the maths holds on the real calendar ─────────
const calendar = createCalendar({ tz: 'UTC', region: 'US', hemisphere: 'north', bornOn: null, joinedYmd: null });
const year = calendar.series('2026-01-01', 365);
let maxDecor = 0;
let sprigDays = 0;
const samples: string[] = [];
for (const t of year) {
  const l = lookOf(t);
  maxDecor = Math.max(maxDecor, l.decorCount);
  if (l.sprigOn) sprigDays++;
  assert.ok(l.decorCount <= MAX_DECOR, `${t.ymd}: ring at most ${MAX_DECOR}`);
  assert.match(l.accent, /^#[0-9a-f]{6}$/i);
  assert.ok(l.event || l.decorCount === 0, `${t.ymd}: no ring without an event`);
}
assert.ok(maxDecor >= 6, 'some real day has a big ring');
assert.ok(sprigDays > 0, 'some real day shows sprigs');
for (const ymd of ['2026-12-18', '2026-12-25', '2026-12-28', '2026-07-10']) {
  const t = year.find((d) => d.ymd === ymd);
  if (t) {
    const l = lookOf(t);
    samples.push(`${ymd} ${t.display.event ?? t.season.id} i=${l.intensity.toFixed(2)} ring=${l.decorCount} sprigs=${l.sprigOn} loop=${l.event?.loop ?? '-'}`);
  }
}
samples.forEach((s) => console.log(`  sample ${s}`));
ok('real 2026 calendar: ring ≤ 12, accent valid, no ring without an event');

console.log('\ncheck:almanac-art passed');
