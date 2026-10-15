/**
 * Multi-room Hideout Phase 2. Run: npm run check:hideout-rooms
 *
 * Pins: unlock permanence across rebirth, speed-up cap, clock-guard use,
 * veteran migration stagger, presence priority, placeholder art catalog.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  HIDEOUT_ART_PLACEHOLDER,
  HIDEOUT_ROOM_IDS,
  HIDEOUT_SAVE_VERSION,
  HIDEOUT_SPEEDUP_CAP,
  HIDEOUT_SPEEDUP_MS,
  HIDEOUT_TOKEN_BONUS_CAP,
  HIDEOUT_TOKEN_PRICES_PLACEHOLDER,
  applySpeedup,
  buildRemainingMs,
  canStartBuild,
  careTokenBonus,
  countedGap,
  countDeepSurface,
  countTendDay,
  emptyHideout,
  hideoutProgressOf,
  markEverChild,
  migrateHideout,
  parseHideout,
  roomGateMet,
  roomStage,
  roomTokenPrice,
  speedupCapMs,
  startBuild,
  tickBuild,
  tickHideoutBuilds,
} from '../src/play/hideout-progress';
import { resolvePresence, startCall, tapSleep, tapWake } from '../src/play/hideout-presence';
import { HIDEOUT_LOG_KINDS, hideoutLogLine } from '../src/play/hideout-log';
import {
  HIDEOUT_HERO_RENDER_SCALE,
  HIDEOUT_TILE,
  assertRoomReachable,
  isoSleepPoint,
  parseIsoGeom,
  planHideoutStep,
} from '../src/play/hideout-iso';
import { PET_DEEP_MIN_DEPTH, PET_MAX_GAP_MS, newPet, rebirthPet } from '../src/play/pet';
import {
  defaultPlayStore,
  parsePlayStore,
  rebirthPetDoc,
  recordDefendWin,
  startHideoutBuild,
  surfaceDive,
  startDive,
  deeperDive,
} from '../src/play/playStore';
import hideoutMap from '../assets/art/rooms/hideout/hideout-td.map.json';
import loftMap from '../assets/art/rooms/loft/loft-td.map.json';
import undergroundMap from '../assets/art/rooms/underground/underground-td.map.json';
import teaseLayout from '../assets/art/rooms/hideout/hideout-tease.json';

let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const ROOT = path.join(__dirname, '..');
const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

{
  assert.equal(HIDEOUT_SAVE_VERSION, 33);
  assert.equal(HIDEOUT_TOKEN_PRICES_PLACEHOLDER, true);
  assert.equal(HIDEOUT_ART_PLACEHOLDER, true);
  assert.equal(roomTokenPrice('loft'), 600);
  assert.equal(roomTokenPrice('garage'), 1200);
  assert.equal(roomTokenPrice('rooftop'), 2000);
  assert.equal(HIDEOUT_SPEEDUP_CAP, 0.5);
  assert.equal(HIDEOUT_SPEEDUP_MS, HOUR);
  assert.equal(HIDEOUT_TOKEN_BONUS_CAP, 0.1);
  assert.equal(PET_DEEP_MIN_DEPTH, 3);
  const rooms = JSON.parse(readFileSync(path.join(ROOT, 'src/play/data/hideout-rooms.json'), 'utf8')) as {
    zzzFps: number;
    zzzFrames: number;
    dissolveMs: number;
  };
  assert.equal(rooms.zzzFps, 4);
  assert.equal(rooms.zzzFrames, 3);
  assert.equal(rooms.dissolveMs, 150);
  ok('placeholder token prices live in one config; save v33');
}

{
  const src = readFileSync(path.join(ROOT, 'src/play/hideout-progress.ts'), 'utf8');
  assert.ok(src.includes('countedGap'), 'builds use countedGap');
  assert.ok(src.includes('PET_MAX_GAP_MS'), 'clock guard cap is the pet one');
  assert.ok(!src.includes('Date.now()') || src.indexOf('tickBuild') < src.indexOf('countedGap'), 'tick is not wall-clock remaining');
  const { gap, seenAt } = countedGap(T0, T0 + 3 * HOUR);
  assert.equal(gap, 3 * HOUR);
  assert.equal(seenAt, T0 + 3 * HOUR);
  const capped = countedGap(T0, T0 + PET_MAX_GAP_MS + HOUR);
  assert.equal(capped.gap, PET_MAX_GAP_MS, 'one gap is at most 48h');
  const back = countedGap(T0, T0 - 1000);
  assert.equal(back.gap, 0, 'clock back: no time');
  ok('clock guard: high-water + 48h cap, same as the pet');
}

{
  const pet = { ...newPet(T0), stage: 'god' as const, hero: 'raven', egg: 'knight' as const, grade: 'common' as const };
  const hall = rebirthPet(pet, [], 0, T0)!;
  let h = emptyHideout();
  h = { ...h, rooms_unlocked: { ...h.rooms_unlocked, loft: true } };
  h = startBuild(h, 'garage', T0);
  const after = markEverChild(h, hall.pet, hall.hall, hall.rebirths);
  assert.equal(after.rooms_unlocked.loft, true, 'loft stays unlocked');
  assert.ok(after.builds.garage, 'build in progress carries over');
  assert.equal(after.ever_child, true);
  const doc = defaultPlayStore(T0);
  doc.hideout = after;
  doc.pet = pet;
  const reborn = rebirthPetDoc(doc, T0)!;
  assert.equal(reborn.hideout.rooms_unlocked.loft, true);
  assert.ok(reborn.hideout.builds.garage);
  assert.equal(reborn.pet.stage, 'egg');
  ok('unlocks and in-progress builds survive rebirth');
}

{
  let h = emptyHideout();
  h = { ...h, ever_child: true, loft_veteran_half: true };
  const p = hideoutProgressOf({ hideout: h, campaign: { phase: 'trial' }, conquered_cycles: 0 });
  assert.equal(roomGateMet('loft', p), true);
  assert.equal(canStartBuild('loft', h, p, 600).ok, true);
  h = startBuild(h, 'loft', T0);
  assert.equal(h.builds.loft?.veteran_half, true);
  assert.equal(h.builds.loft?.duration_ms, HOUR, 'veteran loft is 1h not 2h');
  let b = h.builds.loft!;
  for (let i = 0; i < 10; i += 1) {
    const r = applySpeedup({ ...h, builds: { loft: b } }, T0 + i);
    if (!r.applied) break;
    b = r.hideout.builds.loft ?? b;
    h = r.hideout;
  }
  assert.ok((h.builds.loft?.speedup_ms ?? 0) <= speedupCapMs({ duration_ms: HOUR }) + 1);
  assert.equal(h.builds.loft?.speedup_ms, Math.floor(HOUR * 0.5), 'speed-up cap is 50%');
  ok('speed-up is −1h, capped at 50% of that build');
}

{
  const src = readFileSync(path.join(ROOT, 'src/play/playStore.ts'), 'utf8');
  const surf = src.slice(src.indexOf('export function surfaceDive'), src.indexOf('export function deeperDive'));
  assert.ok(surf.includes('PET_DEEP_MIN_DEPTH'), 'surfaces only speed up at depth 3+');
  assert.ok(surf.includes('countDeepSurface'), 'lifetime deep surfaces counted');
  const def = src.slice(src.indexOf('export function recordDefendWin'), src.indexOf('export function claimMilestoneLook'));
  assert.ok(def.includes('applySpeedup'), 'defend campaign can speed up');
  assert.ok(def.includes('if (!isReplay)'), 'replays do not speed up');
  assert.ok(!def.includes('careTokenBonus'), 'defend never gets the care bonus');
  const tend = src.slice(src.indexOf('export function claimResearch'), src.indexOf('export function startDive'));
  assert.ok(tend.includes('careTokenBonus'), 'loft token bonus on tend');
  assert.ok(!surf.includes('careTokenBonus'), 'dive surface never gets the care bonus');
  ok('play-only speed-ups; loft bonus never touches Defend/Dive');
}

{
  const v32 = { ...defaultPlayStore(T0), version: 32 } as { version: number; hideout?: unknown };
  delete v32.hideout;
  v32.version = 32;
  const raw = JSON.parse(JSON.stringify(v32)) as Record<string, unknown>;
  raw.version = 32;
  delete raw.hideout;
  const pet = { ...newPet(T0), stage: 'adult' as const, hero: 'raven', egg: 'knight' as const, grade: 'rare' as const, deep_surfaces: 4 };
  const h = migrateHideout({
    version: 32,
    raw: undefined,
    pet,
    hall: [],
    rebirths: 0,
    lastTendYmd: '2026-10-01',
    daysPlayed: 9,
    lifetimeWaves: 12,
    campaignPhase: 'main',
    conqueredCycles: 1,
    now: T0,
  });
  assert.equal(h.rooms_unlocked.loft, false, 'veterans do not get Loft for free');
  assert.equal(h.loft_veteran_half, true);
  assert.equal(roomStage('loft', h), 'tease');
  assert.equal(roomStage('garage', h), 'hidden', 'Garage tease waits until Loft is done');
  assert.equal(h.ever_child, true);
  assert.equal(h.lifetime_deep_surfaces, 4);
  const parsed = parsePlayStore(JSON.stringify({ ...raw, pet, version: 32 }), T0);
  assert.ok(parsed);
  assert.equal(parsed.version, 33);
  assert.equal(parsed.hideout.rooms_unlocked.hideout, true);
  ok('migration: Loft eligible/tease only; Garage hidden; schema 33');
}

{
  const h = emptyHideout();
  const pet = { ...newPet(T0), stage: 'teen' as const, hunger: 4, mood: 4, total_age_ms: 1000 };
  const bed = { from: 23 * 60, to: 7 * 60 };
  const base = {
    pet,
    hideout: h,
    interaction: false,
    expeditionAway: false,
    bedtime: bed,
    now: new Date(2026, 9, 12, 12, 0, 0),
    todayYmd: '2026-10-12',
  };
  assert.equal(resolvePresence({ ...base, interaction: true }).reason, 'interaction');
  assert.equal(resolvePresence({ ...base, expeditionAway: true }).reason, 'expedition');
  assert.equal(resolvePresence({ ...base, pet: { ...pet, hunger: 1 } }).reason, 'hungry');
  assert.equal(resolvePresence({ ...base, pet: { ...pet, hunger: 1 } }).room, 'hideout');
  const lofted = { ...h, rooms_unlocked: { ...h.rooms_unlocked, loft: true } };
  assert.equal(resolvePresence({ ...base, hideout: lofted, pet: { ...pet, mood: 1 } }).reason, 'tired');
  assert.equal(resolvePresence({ ...base, hideout: lofted, pet: { ...pet, mood: 1 } }).room, 'loft');
  const called = startCall(h, pet, 'hideout');
  assert.equal(resolvePresence({ ...base, hideout: called }).reason, 'call');
  assert.equal(resolvePresence({ ...base, pet: { ...pet, stage: 'baby' } }).room, 'hideout');
  const woken = tapWake(h, pet);
  assert.ok(woken.wake_until_age_ms != null);
  // Sleep rail action: in the Loft's bed by choice at noon, only if the Loft is built; a wake tap or the timer ends it.
  const slept = tapSleep(lofted, pet);
  const sleepP = resolvePresence({ ...base, hideout: slept });
  assert.equal(sleepP.asleep, true);
  assert.equal(sleepP.room, 'loft');
  assert.equal(resolvePresence({ ...base, hideout: tapSleep(h, pet) }).asleep, false, 'no Loft, no bed');
  assert.equal(resolvePresence({ ...base, hideout: slept, pet: { ...pet, hunger: 1 } }).reason, 'hungry', 'hunger still wins');
  assert.equal(resolvePresence({ ...base, hideout: tapWake(slept, pet) }).asleep, false, 'wake tap ends it');
  assert.equal(tapWake(slept, pet).sleep_until_age_ms, null);
  assert.equal(resolvePresence({ ...base, hideout: slept, pet: { ...pet, total_age_ms: slept.sleep_until_age_ms! } }).asleep, false, 'timer ends it');
  assert.equal(emptyHideout().sleep_until_age_ms, null);
  ok('sleep action: Loft bed by choice, cleared by wake / timer, hunger wins, no Loft = no bed');
  ok('presence priority: interaction > expedition > needs > call > schedule; egg/baby stay home');
}

{
  const geom = parseIsoGeom(loftMap, { sleepOnBed: true });
  const bed = isoSleepPoint(geom);
  assert.ok(geom.sleepOnBed);
  assert.ok(geom.props.some((p) => p.id === 'bed'));
  assert.ok(geom.props.filter((p) => p.occluder).every((p) => p.crop[2] > 0 && p.sortY > 0), 'occluders carry crop + sortY');
  const kit = { idle: 4, walk: 4, attack: 4, skill: 4 };
  const step = planHideoutStep({
    kit,
    mood: 'asleep',
    branch: 'standard',
    stage: 'teen',
    x: bed[0],
    y: bed[1],
    rng: () => 0.5,
    geom,
  });
  assert.equal(step.act, 'sleep');
  assert.ok(Math.hypot(step.toX - bed[0], step.toY - bed[1]) < 2, 'sleep stays on the bed top');
  ok('Loft map: sleep target is on top of the bed');
}

{
  assert.equal(HIDEOUT_TILE, 16);
  assert.equal(HIDEOUT_HERO_RENDER_SCALE, 1);
  for (const [name, raw, sleep] of [
    ['hideout', hideoutMap, false],
    ['loft', loftMap, true],
    ['underground', undergroundMap, false],
  ] as const) {
    const geom = parseIsoGeom(raw, { sleepOnBed: sleep });
    assert.equal(geom.tile, 16, `${name} tile`);
    assert.equal(geom.grid.cols, 22, `${name} cols`);
    assert.equal(geom.grid.rows, 36, `${name} rows`);
    assert.deepEqual([...geom.canvas], [352, 576], `${name} canvas (option A, widened 2026-10-13)`);
    const layers = geom.layers.occluder;
    assert.ok(layers && typeof layers === 'object', `${name} has combined occluder layers`);
    const occ = layers as Record<string, string>;
    for (const key of ['day-a', 'day-b', 'night-a', 'night-b']) {
      assert.ok(typeof occ[key] === 'string' && occ[key].includes('occlude'), `${name} occluder ${key}`);
    }
    for (const stage of ['baby', 'adult', 'god'] as const) {
      const r = assertRoomReachable(geom, stage);
      assert.equal(r.ok, true, r.ok ? `${name}/${stage}` : `${name}/${stage}: ${r.reason}`);
    }
  }
  ok('option A: 352×576, 16px walk grid; occluder states; every room reachable at baby/adult/god clearance');
}

{
  // Occluder crops are cut from ONE combined layer, so two that overlap would paint a neighbour's
  // pixels over the pet (Hideout PixelLab art, 2026-10-12).
  const occ = parseIsoGeom(hideoutMap, { sleepOnBed: false }).props.filter((p) => p.occluder);
  for (const [i, a] of occ.entries()) {
    for (const b of occ.slice(i + 1)) {
      const [ax, ay, aw, ah] = a.crop;
      const [bx, by, bw, bh] = b.crop;
      const hit = ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
      assert.ok(!hit, `hideout occluder crops overlap: ${a.id} and ${b.id}`);
    }
  }
  ok(`hideout: ${occ.length} occluder crops, none overlapping`);
}

{
  const boardedY = teaseLayout.boarded.pos[1];
  assert.ok(boardedY < 180, `boarded door is on the wall (y=${boardedY}), not the floor`);
  assert.ok(teaseLayout.scaffold.pos[0] > teaseLayout.boarded.pos[0], 'scaffold leans outside to the right');
  assert.ok(teaseLayout.sign.pos[1] > teaseLayout.boarded.pos[1], 'sign sits in front of the boarded door');
  const art = readFileSync(path.join(ROOT, 'src/play/hideout-art.ts'), 'utf8');
  assert.ok(art.includes('ROOM.loft.back'), 'loft back layer is wired through the ROOM skeleton');
  assert.ok(art.includes('occludeDayA'));
  assert.ok(art.includes('HIDEOUT_ART_SWAP'));
  assert.ok(art.includes('sprite-smith-out'));
  for (const [dir, f] of [
    ['loft', 'loft-td-back.png'],
    ['loft', 'loft-td-floor.png'],
    ['loft', 'loft-td-props.png'],
    ['loft', 'loft-td-occlude-day-a.png'],
    ['loft', 'loft-td-window-day.png'],
    ['loft', 'loft-td-window-night.png'],
    ['loft', 'loft-td-glow.png'],
    ['hideout', 'boarded.png'],
    ['hideout', 'tarp.png'],
    ['hideout', 'scaffold.png'],
    ['hideout', 'build-sign.png'],
    ['hideout', 'zzz-0.png'],
    ['hideout', 'zzz-1.png'],
    ['hideout', 'zzz-2.png'],
  ] as const) {
    assert.ok(existsSync(path.join(ROOT, 'assets/art/rooms', dir, f)), `${dir}/${f}`);
  }
  ok('tease is wall-mounted; placeholders are swappable in hideout-art.ts');
}

{
  const zzz = readFileSync(path.join(ROOT, 'src/play/hideout-zzz.tsx'), 'utf8');
  assert.ok(zzz.includes('HIDEOUT_ZZZ_FPS'));
  assert.ok(zzz.includes('vestibularSafe'));
  assert.ok(zzz.includes('cosmeticsStill'));
  assert.ok(zzz.includes('ReduceMotion.Never'), 'Zzz fade/frames keep running under Reduced');
  const stage = readFileSync(path.join(ROOT, 'src/play/hideout-stage.tsx'), 'utf8');
  assert.ok(stage.includes('HIDEOUT_DISSOLVE_MS'));
  assert.ok(stage.includes('windowNight'));
  assert.ok(stage.includes('lampOn'));
  const street = readFileSync(path.join(ROOT, 'src/play/street-room.tsx'), 'utf8');
  assert.ok(street.includes('art.glow'), 'lamp uses the baked glow overlay');
  assert.ok(street.includes('occludeDayA'));
  assert.ok(!stage.includes('RadialGradient') && !stage.includes('expo-linear-gradient'));
  ok('Zzz 3-frame/4fps; Reduced dissolve; lamp uses baked glow');
}

{
  let h = emptyHideout();
  h = { ...h, ever_child: true };
  const p = hideoutProgressOf({ hideout: h, campaign: { phase: 'trial' }, conquered_cycles: 0 });
  h = startBuild(h, 'loft', T0);
  const later = tickHideoutBuilds(h, T0 + 2 * HOUR);
  assert.equal(later.rooms_unlocked.loft, true);
  assert.equal(later.builds.loft, undefined);
  assert.ok(later.log.some((e) => e.kind === 'build_done'));
  const bonus = careTokenBonus(40, 'tend', later);
  assert.equal(bonus, 4);
  assert.equal(careTokenBonus(50, 'defend', later), 0);
  ok('build completes on counted time; loft bonus is care-side +10% only');
}

{
  const doc = defaultPlayStore(T0);
  doc.hideout = { ...doc.hideout, ever_child: true, tend_days: 3 };
  doc.tokens = 600;
  const started = startHideoutBuild(doc, T0, 'loft');
  assert.ok(started);
  assert.equal(started.tokens, 0);
  assert.ok(started.hideout.builds.loft);
  assert.equal(startHideoutBuild(started, T0, 'loft'), null, 'cannot double-start');
  ok('start build spends placeholder tokens');
}

{
  const src = readFileSync(path.join(ROOT, 'src/play/playStore.ts'), 'utf8');
  assert.ok(src.includes('version: 33'));
  assert.ok(src.includes('hideout:'));
  const settings = readFileSync(path.join(ROOT, 'src/play/play-settings.ts'), 'utf8');
  assert.ok(settings.includes("'build'"));
  const remind = readFileSync(path.join(ROOT, 'src/play/pet-reminder.ts'), 'utf8');
  assert.ok(remind.includes('ato.play.pet.build'));
  assert.ok(HIDEOUT_LOG_KINDS.includes('build_done'));
  assert.equal(hideoutLogLine({ t: T0, kind: 'build_done', room: 'loft' }), 'build_done loft');
  ok('save field, NotifKind build, per-room notice id');
}

void countDeepSurface;
void countTendDay;
void parseHideout;
void tickBuild;
void buildRemainingMs;
void HIDEOUT_ROOM_IDS;
void surfaceDive;
void startDive;
void deeperDive;
void recordDefendWin;

console.log(`\ncheck:hideout-rooms — ${passed} groups passed.`);
