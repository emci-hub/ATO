/**
 * Pet finishes (save v30). Run: npm run check:finishes
 *
 *   1. The config is the only palette: seven named colours, hex stops, Starpearl
 *      is the only Tide Pass colour, Moonpearl is wide and soft, Quicksilver is
 *      hard and narrower.
 *   2. Prices match an active day of about 80–115 tokens (pets, one Defend clear,
 *      tending): holo and reverse holo are 450 (~4–6 days), extra colour 150,
 *      Tide Pass prices 340 / 340 / 110 from the config.
 *   3. Wearing a finish grants the kind and one new shop colour, never rolls a
 *      shiny, and refuses Starpearl, a short purse, or an unrevealed pet.
 *   4. A v29 save loads as v30 with no finish; a worn finish round-trips; a
 *      future version does not load.
 *   5. The sprite sheen on a shiny stays in the 30–35% cap. The sheen is
 *      overlay, never color-dodge. Glare stays 50–60%. Tilt is on and clamped
 *      to ±15°. Drift, tilt and the sweep all pause for Reduce Motion, the OS
 *      setting, and Low effects.
 *   6. The live Defend board never draws foil and never starts the gyro.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PLAY_EVERYTHING_FREE } from '../src/lib/dev-mode';
import {
  emptyFinishWallet,
  finishColors,
  finishConfig,
  finishConfigErrors,
  finishPrice,
  clampTilt,
  finishSweepRuns,
  foilBandPitch,
  glareOpacity,
  planFinishWear,
  reverseOpacity,
  sheenOpacity,
  type FinishWallet,
} from '../src/play/finishes';
import { PET_TOKENS_DAILY_CAP, PET_TOKENS_PER_ROUND } from '../src/play/pet';
import { applyPetFinish, chooseEggDoc, defaultPlayStore, devSetPetFinish, parsePlayStore } from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = Date.UTC(2026, 9, 3, 12, 0, 0);

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  });
}

/* -------------------------------------------------------------- 1. config --- */

{
  const errors = finishConfigErrors();
  assert.deepEqual(errors, [], errors.join(', '));
  const cfg = finishConfig();
  const colors = finishColors();
  assert.equal(colors.length, 7);
  assert.deepEqual(
    colors.map((color) => color.id),
    ['moonpearl', 'reefglow', 'rosedusk', 'limewake', 'scarab', 'quicksilver', 'starpearl'],
  );
  const ids = new Set(colors.map((color) => color.id));
  assert.equal(ids.size, colors.length);
  const moon = colors.find((color) => color.id === 'moonpearl')!;
  const silver = colors.find((color) => color.id === 'quicksilver')!;
  assert.equal(moon.hard, false);
  assert.ok(moon.repeats <= 2);
  assert.equal(silver.hard, true);
  assert.ok(silver.repeats > moon.repeats);
  assert.deepEqual(
    colors.filter((color) => color.pass_only).map((color) => color.id),
    ['starpearl'],
  );
  assert.equal(cfg.currency, 'tokens');
}
ok('seven named colours, Starpearl is the only pass colour, Moonpearl is soft and Quicksilver is hard');

/* -------------------------------------------------------------- 2. prices --- */

{
  const cfg = finishConfig();
  assert.equal(cfg.earn_per_round, PET_TOKENS_PER_ROUND);
  assert.equal(cfg.earn_daily_cap, PET_TOKENS_DAILY_CAP);
  assert.equal(PET_TOKENS_PER_ROUND, 5);
  assert.equal(PET_TOKENS_DAILY_CAP, 30);
  assert.ok(cfg.unlock_days >= cfg.unlock_days_min && cfg.unlock_days <= cfg.unlock_days_max);
  assert.equal(cfg.active_day_tokens_min, 80);
  assert.equal(cfg.active_day_tokens_max, 115);
  assert.equal(cfg.active_day_tokens, 90);
  assert.ok(cfg.active_day_tokens >= cfg.active_day_tokens_min && cfg.active_day_tokens <= cfg.active_day_tokens_max);
  assert.equal(cfg.prices.holo, cfg.unlock_days * cfg.active_day_tokens);
  assert.ok(cfg.prices.holo >= cfg.unlock_days_min * cfg.active_day_tokens_min);
  assert.ok(cfg.prices.holo <= cfg.unlock_days_max * cfg.active_day_tokens_max);
  assert.equal(cfg.prices.reverse, cfg.prices.holo);
  assert.equal(cfg.prices.extra_color * cfg.extra_color_share_den, cfg.prices.holo);
  assert.equal(cfg.prices.holo, 450);
  assert.equal(cfg.prices.reverse, 450);
  assert.equal(cfg.prices.extra_color, 150);
  assert.equal(finishPrice('holo', false), 450);
  assert.equal(finishPrice('reverse', false), 450);
  assert.equal(finishPrice('extra_color', false), 150);
  assert.equal(finishPrice('holo', true), 340);
  assert.equal(finishPrice('reverse', true), 340);
  assert.equal(finishPrice('extra_color', true), 110);
}
ok('holo and reverse holo are 450 tokens (~4–6 active days); extra colour 150; pass pays 340 and 110');

/* --------------------------------------------------------------- 3. plans --- */

{
  const empty = emptyFinishWallet();
  const first = planFinishWear({
    wallet: empty,
    tokens: 450,
    pass: false,
    free: false,
    kind: 'holo',
    color: 'moonpearl',
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.cost, 450);
    assert.equal(first.wallet.holo, true);
    assert.deepEqual(first.wallet.colors, ['moonpearl']);
    const second = planFinishWear({
      wallet: first.wallet,
      tokens: 450,
      pass: false,
      free: false,
      kind: 'reverse',
      color: 'reefglow',
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.cost, 450);
      assert.equal(second.wallet.reverse, true);
      assert.deepEqual(second.wallet.colors, ['moonpearl', 'reefglow']);
      const extra = planFinishWear({
        wallet: second.wallet,
        tokens: 150,
        pass: false,
        free: false,
        kind: 'holo',
        color: 'scarab',
      });
      assert.equal(extra.ok, true);
      if (extra.ok) {
        assert.equal(extra.cost, 150);
        assert.ok(extra.wallet.colors.includes('scarab'));
        const off = planFinishWear({
          wallet: extra.wallet,
          tokens: 0,
          pass: false,
          free: false,
          kind: 'none',
          color: 'moonpearl',
        });
        assert.equal(off.ok, true);
        if (off.ok) {
          assert.equal(off.cost, 0);
          assert.equal(off.kind, 'none');
          assert.equal(off.color, null);
          assert.equal(off.wallet, extra.wallet);
        }
      }
    }
  }

  const passKind = planFinishWear({
    wallet: emptyFinishWallet(),
    tokens: 340,
    pass: true,
    free: false,
    kind: 'holo',
    color: 'limewake',
  });
  assert.equal(passKind.ok, true);
  if (passKind.ok) assert.equal(passKind.cost, 340);
  const owned: FinishWallet = { holo: true, reverse: true, colors: ['moonpearl'] };
  const passColor = planFinishWear({
    wallet: owned,
    tokens: 110,
    pass: true,
    free: false,
    kind: 'reverse',
    color: 'rosedusk',
  });
  assert.equal(passColor.ok, true);
  if (passColor.ok) assert.equal(passColor.cost, 110);

  const locked = planFinishWear({
    wallet: owned,
    tokens: 999,
    pass: false,
    free: false,
    kind: 'holo',
    color: 'starpearl',
  });
  assert.deepEqual(locked, { ok: false, reason: 'pass' });
  const star = planFinishWear({
    wallet: owned,
    tokens: 0,
    pass: true,
    free: false,
    kind: 'holo',
    color: 'starpearl',
  });
  assert.equal(star.ok, true);
  if (star.ok) {
    assert.equal(star.cost, 0);
    assert.equal(star.color, 'starpearl');
    assert.deepEqual(star.wallet.colors, owned.colors);
    assert.ok(!star.wallet.colors.includes('starpearl'));
  }

  const purse = emptyFinishWallet();
  const short = planFinishWear({
    wallet: purse,
    tokens: 10,
    pass: false,
    free: false,
    kind: 'holo',
    color: 'moonpearl',
  });
  assert.deepEqual(short, { ok: false, reason: 'tokens' });
  assert.deepEqual(purse, emptyFinishWallet());

  const free = planFinishWear({
    wallet: emptyFinishWallet(),
    tokens: 0,
    pass: false,
    free: true,
    kind: 'reverse',
    color: 'quicksilver',
  });
  assert.equal(free.ok, true);
  if (free.ok) {
    assert.equal(free.cost, 0);
    assert.equal(free.wallet.reverse, true);
    assert.deepEqual(free.wallet.colors, ['quicksilver']);
  }
}
ok('a kind includes one new colour; the pass discounts; Starpearl stays out of the wallet');

/* --------------------------------------------------------------- 4. apply --- */

{
  const picked = chooseEggDoc({ ...defaultPlayStore(T0), tokens: 500, eggs_since_legendary: 4 }, T0, 'village', null, () => 0.2);
  assert.ok(picked);
  const before = {
    ...picked,
    pet: {
      ...picked.pet,
      stage: 'child' as const,
      hero: 'elowen',
      grade: 'rare' as const,
      shiny: true,
      shiny_style: 'classic' as const,
    },
  };
  const worn = applyPetFinish(before, T0, before.pet.uid, 'holo', 'moonpearl');
  assert.equal(worn.result.ok, true);
  if (worn.result.ok) assert.equal(worn.result.cost, PLAY_EVERYTHING_FREE ? 0 : 450);
  assert.equal(worn.doc.pet.shiny, true);
  assert.equal(worn.doc.pet.shiny_style, 'classic');
  assert.equal(worn.doc.pet.grade, 'rare');
  assert.equal(worn.doc.eggs_since_legendary, 4);
  assert.equal(worn.doc.pet.finish_kind, 'holo');
  assert.equal(worn.doc.pet.finish_color, 'moonpearl');
  assert.equal(worn.doc.tokens, PLAY_EVERYTHING_FREE ? 500 : 50);

  const egg = chooseEggDoc(defaultPlayStore(T0), T0, 'village', null, () => 0.2);
  assert.ok(egg && egg.pet.hero == null);
  const hidden = applyPetFinish(egg, T0, egg.pet.uid, 'holo', 'moonpearl');
  assert.deepEqual(hidden.result, { ok: false, reason: 'not_revealed' });
  assert.equal(hidden.doc.pet.finish_kind, 'none');
  assert.equal(hidden.doc.tokens, egg.tokens);

  const poked = devSetPetFinish(before, T0, before.pet.uid, 'reverse', 'scarab');
  assert.ok(poked);
  assert.equal(poked.pet.finish_kind, 'reverse');
  assert.equal(poked.tokens, before.tokens);
  assert.deepEqual(poked.finish_wallet, before.finish_wallet);

  const eggs = read('src/play/pet-eggs.ts');
  assert.ok(!eggs.includes('finish_kind') && !eggs.includes('finish_color'));
  const store = read('src/play/playStore.ts');
  const applyAt = store.indexOf('export function applyPetFinish');
  const applyBody = store.slice(applyAt, store.indexOf('export function devSetPetFinish'));
  assert.ok(applyBody.includes('PLAY_EVERYTHING_FREE'));
  assert.ok(!applyBody.includes('shiny_style'));
}
ok('wearing a finish does not roll a shiny; an egg refuses; the dev kit does not mint an unlock');

/* ---------------------------------------------------------------- 5. save --- */

{
  const fresh = defaultPlayStore(T0);
  const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  legacy.version = 29;
  delete legacy.finish_wallet;
  legacy.tokens = 77;
  const loaded = parsePlayStore(JSON.stringify(legacy), T0);
  assert.ok(loaded);
  assert.equal(loaded.version, 32);
  assert.equal(loaded.tokens, 77);
  assert.deepEqual(loaded.finish_wallet, emptyFinishWallet());
  assert.equal(loaded.pet.finish_kind, 'none');
  assert.equal(loaded.pet.finish_color, null);

  const worn = applyPetFinish(
    {
      ...fresh,
      tokens: 500,
      pet: { ...fresh.pet, stage: 'adult', hero: 'elowen', grade: 'epic', uid: fresh.pet.uid || 1 },
    },
    T0,
    fresh.pet.uid || 1,
    'reverse',
    'limewake',
  );
  assert.equal(worn.result.ok, true);
  const round = parsePlayStore(JSON.stringify(worn.doc), T0);
  assert.ok(round);
  assert.equal(round.version, 32);
  assert.equal(round.pet.finish_kind, 'reverse');
  assert.equal(round.pet.finish_color, 'limewake');
  assert.equal(round.finish_wallet.reverse, true);
  assert.ok(round.finish_wallet.colors.includes('limewake'));
  assert.ok(!round.finish_wallet.colors.includes('starpearl'));

  const bogus = JSON.parse(JSON.stringify(fresh)) as {
    version: number;
    pet: Record<string, unknown>;
    finish_wallet: { holo: boolean; reverse: boolean; colors: string[] };
  };
  bogus.version = 30;
  bogus.pet.finish_kind = 'holo';
  bogus.pet.finish_color = 'not-a-color';
  bogus.finish_wallet = { holo: true, reverse: false, colors: ['moonpearl', 'starpearl', 'nope'] };
  const dropped = parsePlayStore(JSON.stringify(bogus), T0);
  assert.ok(dropped);
  assert.equal(dropped.pet.finish_kind, 'none');
  assert.equal(dropped.pet.finish_color, null);
  assert.deepEqual(dropped.finish_wallet.colors, ['moonpearl']);
  assert.equal(parsePlayStore(JSON.stringify({ ...fresh, version: 33 }), T0), null);
}
ok('a v29 save becomes v32 with no finish; a real finish round-trips; version 33 does not load');

/* -------------------------------------------------------------- 6. paint --- */

{
  const cfg = finishConfig();
  assert.equal(cfg.tilt, true);
  assert.equal(cfg.tilt_max_deg, 15);
  assert.ok(cfg.drift_ms >= 8000 && cfg.drift_ms <= 20000);
  assert.equal(cfg.paint.sheen_blend, 'overlay');
  assert.ok(sheenOpacity(true, true) >= 0.3 && sheenOpacity(true, true) <= 0.35);
  assert.ok(sheenOpacity(true, false) <= 0.2);
  assert.ok(sheenOpacity(false, true) >= 0.28 && sheenOpacity(false, true) <= 0.4);
  assert.ok(glareOpacity() >= 0.5 && glareOpacity() <= 0.6);
  assert.ok(reverseOpacity() >= 0.8 && reverseOpacity() <= 1);
  assert.equal(clampTilt(0, 15), 0);
  assert.ok(Math.abs(clampTilt((10 * Math.PI) / 180, 15) - 10 / 15) < 1e-9);
  assert.equal(clampTilt(Math.PI, 15), 1);
  assert.equal(clampTilt(-Math.PI, 15), -1);
  const moon = finishConfig().colors.find((color) => color.id === 'moonpearl')!;
  const silver = finishConfig().colors.find((color) => color.id === 'quicksilver')!;
  assert.ok(foilBandPitch(moon) > foilBandPitch(silver));
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: false, fxFull: true }), true);
  assert.equal(finishSweepRuns({ motion: 'still', reduceMotion: false, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'off', reduceMotion: false, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: true, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: true, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: false, fxFull: false }), false);

  const foil = read('src/play/finish-foil.tsx');
  for (const needle of ['finishSweepRuns', 'useFxQuality', 'isReduceMotionEnabled']) {
    assert.ok(foil.includes(needle), needle);
  }
  assert.ok(!foil.includes('FinishSheen'), 'sprite sheen');
  assert.ok(!foil.includes('maskType'), 'sprite mask');
  assert.ok(!read('src/play/pet-figure.tsx').includes('FinishSheen'));
  assert.ok(!foil.includes('color-dodge'), 'color-dodge');
  assert.ok(!/offset=\{withTiming/.test(foil));
  const motion = read('src/play/finish-motion.tsx');
  for (const needle of ['useAnimatedSensor', 'AppState', 'SENSOR_DEAD_MS', 'withRepeat', 'SensorRunner', 'leaseFinishSensor']) {
    assert.ok(motion.includes(needle), needle);
  }
  assert.ok(motion.includes('tilt_max_deg'));
}
ok('shiny sheen stays capped, tilt clamps to ±15°, and motion pauses for Reduce Motion and Low effects');

/* ------------------------------------------------------------- 7. surfaces --- */

{
  const defend = read('src/play/defend-screen.tsx');
  for (const needle of ['finish-foil', 'finish-motion', 'FinishPaint', 'FinishPlate', 'useAnimatedSensor', 'foilMotion', 'finish_kind']) {
    assert.ok(!defend.includes(needle), needle);
  }
  const picker = read('src/play/finish-picker.tsx');
  assert.ok(picker.includes('art window'));
  assert.ok(picker.includes('pet stays plain'));
  const sweeps = walk('src')
    .filter((file) => read(file).includes('foilMotion="sweep"'))
    .map((file) => file.replace(/\\/g, '/'))
    .sort();
  assert.deepEqual(sweeps, [
    'src/play/den-sheet.tsx',
    'src/play/finish-picker.tsx',
    'src/play/pet-room.tsx',
    'src/play/pet-screen.tsx',
  ]);
  const panel = read('src/play/pet-dev-panel.tsx');
  assert.ok(panel.includes('devSetPetFinish'));
  assert.ok(panel.includes('PRE_LAUNCH_DEV'));
}
ok('foil sweeps only on the card, Dress, the room and the reveal; Defend has none');

console.log(`\ncheck:finishes — ${passed} groups passed.`);
