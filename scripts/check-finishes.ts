/**
 * Pet finishes (save v30, reworked 2026-10-14). Run: npm run check:finishes
 *
 *   1. The data file is the only palette: 8 single colours + 10 mixes for the
 *      prism / rim, 7 shine sweeps, 5 glints, every one valid hex; old named
 *      colours migrate to a real new colour.
 *   2. Prices match an active day of about 80–115 tokens: holo and reverse holo
 *      are 450 (~4–6 days), a mix 150, Tide Pass prices 340 / 340 / 110.
 *      Single colours are free; only mixes cost.
 *   3. Wearing a finish grants the kind and any new mix, never rolls a shiny, and
 *      refuses a short purse or an unrevealed pet.
 *   4. A v29 save loads with no finish; a worn finish round-trips; an old save with
 *      an old finish colour is migrated, not wiped; a future version does not load.
 *   5. The card keeps only a quiet foil border (glare 50–60%); tilt is on and
 *      clamped to ±15°; the border sweep pauses for Reduce Motion and Low effects.
 *   6. The holo is ON the pet (PetHolo), never over the card's art window or face;
 *      the live Defend board never draws foil and never starts the gyro.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PLAY_EVERYTHING_FREE } from '../src/lib/dev-mode';
import {
  borderOpacity,
  clampTilt,
  emptyFinishWallet,
  finishColors,
  finishConfig,
  finishConfigErrors,
  finishGlints,
  finishPrice,
  finishSweepRuns,
  finishSweeps,
  foilBandPitch,
  glareOpacity,
  migrateFinishColor,
  parseFinishWallet,
  parsePetFinish,
  petFinishOf,
  planFinishWear,
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
  assert.equal(colors.length, 18);
  assert.equal(colors.filter((c) => c.group === 'Single colour').length, 8);
  assert.equal(colors.filter((c) => c.group === 'Mix').length, 10);
  assert.deepEqual(
    colors.slice(0, 8).map((c) => c.id),
    ['opal', 'chrome', 'gold', 'ember', 'tide', 'root', 'void', 'rose'],
  );
  assert.equal(new Set(colors.map((c) => c.id)).size, colors.length);
  assert.equal(finishSweeps().length, 7);
  assert.equal(finishGlints().length, 5);
  assert.equal(cfg.defaults.prism, 'opal');
  assert.equal(cfg.currency, 'tokens');
  // Every old colour maps to a real new one, and none of the old ids is a new id.
  const oldIds = ['moonpearl', 'reefglow', 'rosedusk', 'limewake', 'scarab', 'quicksilver', 'starpearl'];
  for (const id of oldIds) {
    const mapped = migrateFinishColor(id);
    assert.ok(mapped, id);
    assert.ok(colors.some((c) => c.id === mapped), id);
  }
  assert.equal(migrateFinishColor('moonpearl'), 'opal');
  assert.equal(migrateFinishColor('scarab'), 'oil');
  assert.equal(migrateFinishColor('starpearl'), 'pearl');
  assert.equal(migrateFinishColor('nope'), null);
}
ok('18 prism / rim colours (8 single, 10 mix), 7 sweeps, 5 glints; every old colour migrates to a real one');

/* -------------------------------------------------------------- 2. prices --- */

{
  const cfg = finishConfig();
  assert.equal(cfg.earn_per_round, PET_TOKENS_PER_ROUND);
  assert.equal(cfg.earn_daily_cap, PET_TOKENS_DAILY_CAP);
  assert.equal(PET_TOKENS_PER_ROUND, 5);
  assert.equal(PET_TOKENS_DAILY_CAP, 30);
  assert.equal(cfg.prices.holo, cfg.unlock_days * cfg.active_day_tokens);
  assert.equal(cfg.prices.reverse, cfg.prices.holo);
  assert.equal(cfg.prices.extra_color * cfg.extra_color_share_den, cfg.prices.holo);
  assert.equal(finishPrice('holo', false), 450);
  assert.equal(finishPrice('reverse', false), 450);
  assert.equal(finishPrice('extra_color', false), 150);
  assert.equal(finishPrice('holo', true), 340);
  assert.equal(finishPrice('reverse', true), 340);
  assert.equal(finishPrice('extra_color', true), 110);
}
ok('holo and reverse holo are 450 tokens (~4–6 active days); a mix 150; the pass pays 340 and 110');

/* --------------------------------------------------------------- 3. plans --- */

{
  const empty = emptyFinishWallet();
  const first = planFinishWear({ wallet: empty, tokens: 450, pass: false, free: false, kind: 'holo', color: 'opal' });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.cost, 450, 'a single colour is free');
    assert.equal(first.wallet.holo, true);
    assert.deepEqual(first.wallet.colors, []);
    assert.equal(first.sweep, 'white');
    assert.equal(first.glint, 'white');
    const mix = planFinishWear({
      wallet: first.wallet,
      tokens: 750,
      pass: false,
      free: false,
      kind: 'reverse',
      color: 'spectrum',
      sweep: 'iris',
      glint: 'gold',
    });
    assert.equal(mix.ok, true);
    if (mix.ok) {
      assert.equal(mix.cost, 450 + 150 + 150, 'new kind + a mix colour + a mix sweep');
      assert.equal(mix.wallet.reverse, true);
      assert.deepEqual(mix.wallet.colors, ['spectrum', 'sweep:iris']);
      const again = planFinishWear({
        wallet: mix.wallet,
        tokens: 0,
        pass: false,
        free: false,
        kind: 'reverse',
        color: 'spectrum',
        sweep: 'iris',
      });
      assert.equal(again.ok && again.cost, 0, 'an owned mix is free again');
      const off = planFinishWear({ wallet: mix.wallet, tokens: 0, pass: false, free: false, kind: 'none', color: 'opal' });
      assert.equal(off.ok, true);
      if (off.ok) {
        assert.equal(off.cost, 0);
        assert.equal(off.kind, 'none');
        assert.equal(off.color, null);
        assert.equal(off.wallet, mix.wallet);
      }
    }
  }

  const passKind = planFinishWear({ wallet: emptyFinishWallet(), tokens: 340, pass: true, free: false, kind: 'holo', color: 'tide' });
  assert.equal(passKind.ok && passKind.cost, 340);
  const owned: FinishWallet = { holo: true, reverse: true, colors: ['opal'] };
  const passMix = planFinishWear({ wallet: owned, tokens: 110, pass: true, free: false, kind: 'reverse', color: 'aurora' });
  assert.equal(passMix.ok && passMix.cost, 110);

  assert.deepEqual(planFinishWear({ wallet: owned, tokens: 5, pass: false, free: false, kind: 'holo', color: 'neon' }), {
    ok: false,
    reason: 'tokens',
  });
  assert.deepEqual(planFinishWear({ wallet: owned, tokens: 999, pass: false, free: false, kind: 'holo', color: 'nope' }), {
    ok: false,
    reason: 'color',
  });
  assert.deepEqual(planFinishWear({ wallet: owned, tokens: 999, pass: false, free: false, kind: 'holo', color: 'opal', sweep: 'nope' }), {
    ok: false,
    reason: 'color',
  });
  const purse = emptyFinishWallet();
  assert.deepEqual(planFinishWear({ wallet: purse, tokens: 10, pass: false, free: false, kind: 'holo', color: 'opal' }), {
    ok: false,
    reason: 'tokens',
  });
  assert.deepEqual(purse, emptyFinishWallet());

  const free = planFinishWear({ wallet: emptyFinishWallet(), tokens: 0, pass: false, free: true, kind: 'reverse', color: 'galaxy', sweep: 'neon' });
  assert.equal(free.ok, true);
  if (free.ok) {
    assert.equal(free.cost, 0);
    assert.deepEqual(free.wallet.colors, ['galaxy', 'sweep:neon']);
  }
}
ok('single colours are free; a mix (prism, rim or sweep) costs once; the pass discounts; bad ids refuse');

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
  const worn = applyPetFinish(before, T0, before.pet.uid, 'holo', 'opal', 'gold', 'ice');
  assert.equal(worn.result.ok, true);
  if (worn.result.ok) assert.equal(worn.result.cost, PLAY_EVERYTHING_FREE ? 0 : 450);
  assert.equal(worn.doc.pet.shiny, true);
  assert.equal(worn.doc.pet.shiny_style, 'classic');
  assert.equal(worn.doc.pet.grade, 'rare');
  assert.equal(worn.doc.eggs_since_legendary, 4);
  assert.equal(worn.doc.pet.finish_kind, 'holo');
  assert.equal(worn.doc.pet.finish_color, 'opal');
  assert.equal(worn.doc.pet.finish_sweep, 'gold');
  assert.equal(worn.doc.pet.finish_glint, 'ice');
  assert.equal(worn.doc.tokens, PLAY_EVERYTHING_FREE ? 500 : 50);
  assert.deepEqual(petFinishOf(worn.doc.pet), { kind: 'holo', color: 'opal', sweep: 'gold', glint: 'ice' });
  assert.equal(petFinishOf({ finish_kind: 'none', finish_color: null }), null);

  const egg = chooseEggDoc(defaultPlayStore(T0), T0, 'village', null, () => 0.2);
  assert.ok(egg && egg.pet.hero == null);
  const hidden = applyPetFinish(egg, T0, egg.pet.uid, 'holo', 'opal');
  assert.deepEqual(hidden.result, { ok: false, reason: 'not_revealed' });
  assert.equal(hidden.doc.pet.finish_kind, 'none');
  assert.equal(hidden.doc.tokens, egg.tokens);

  const poked = devSetPetFinish(before, T0, before.pet.uid, 'reverse', 'oil', 'iris', 'rose');
  assert.ok(poked);
  assert.equal(poked.pet.finish_kind, 'reverse');
  assert.equal(poked.pet.finish_sweep, 'iris');
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
  assert.equal(loaded.version, 33);
  assert.equal(loaded.tokens, 77);
  assert.deepEqual(loaded.finish_wallet, emptyFinishWallet());
  assert.equal(loaded.pet.finish_kind, 'none');
  assert.equal(loaded.pet.finish_color, null);
  assert.equal(loaded.pet.finish_sweep, 'white');
  assert.equal(loaded.pet.finish_glint, 'white');

  const worn = applyPetFinish(
    {
      ...fresh,
      tokens: 900,
      pet: { ...fresh.pet, stage: 'adult', hero: 'elowen', grade: 'epic', uid: fresh.pet.uid || 1 },
    },
    T0,
    fresh.pet.uid || 1,
    'reverse',
    'sunset',
    'neon',
    'match',
  );
  assert.equal(worn.result.ok, true);
  const round = parsePlayStore(JSON.stringify(worn.doc), T0);
  assert.ok(round);
  assert.equal(round.pet.finish_kind, 'reverse');
  assert.equal(round.pet.finish_color, 'sunset');
  assert.equal(round.pet.finish_sweep, 'neon');
  assert.equal(round.pet.finish_glint, 'match');
  assert.equal(round.finish_wallet.reverse, true);
  assert.deepEqual(round.finish_wallet.colors, PLAY_EVERYTHING_FREE ? ['sunset', 'sweep:neon'] : ['sunset', 'sweep:neon']);

  // An old save with an old finish colour: migrated to the nearest new colour, never wiped.
  const grownDoc = { ...fresh, pet: { ...fresh.pet, stage: 'adult' as const, hero: 'elowen', grade: 'epic' as const, uid: fresh.pet.uid || 1 } };
  const old = JSON.parse(JSON.stringify(grownDoc)) as {
    version: number;
    pet: Record<string, unknown>;
    finish_wallet: { holo: boolean; reverse: boolean; colors: string[] };
  };
  old.version = 32;
  old.pet.finish_kind = 'holo';
  old.pet.finish_color = 'reefglow';
  old.finish_wallet = { holo: true, reverse: false, colors: ['moonpearl', 'scarab', 'starpearl', 'nope'] };
  const migrated = parsePlayStore(JSON.stringify(old), T0);
  assert.ok(migrated);
  assert.equal(migrated.pet.finish_kind, 'holo');
  assert.equal(migrated.pet.finish_color, 'tide', 'reefglow → tide');
  assert.deepEqual(migrated.finish_wallet.colors, ['oil', 'pearl'], 'scarab → oil and starpearl → pearl stay owned; singles are free');
  assert.equal(migrated.finish_wallet.holo, true);

  const bogus = JSON.parse(JSON.stringify(fresh)) as { version: number; pet: Record<string, unknown> };
  bogus.version = 30;
  bogus.pet.finish_kind = 'holo';
  bogus.pet.finish_color = 'not-a-color';
  const dropped = parsePlayStore(JSON.stringify(bogus), T0);
  assert.ok(dropped);
  assert.equal(dropped.pet.finish_kind, 'none');
  assert.equal(dropped.pet.finish_color, null);
  assert.deepEqual(parsePetFinish({ finish_kind: 'reverse', finish_color: 'rosedusk', finish_sweep: 'bad' }), {
    finish_kind: 'reverse',
    finish_color: 'rose',
    finish_sweep: 'white',
    finish_glint: 'white',
  });
  assert.deepEqual(parseFinishWallet({ holo: true, colors: ['oil', 'oil', 'sweep:white', 'sweep:iris', 5] }).colors, ['oil', 'sweep:iris']);
  assert.equal(parsePlayStore(JSON.stringify({ ...fresh, version: 34 }), T0), null);
}
ok('a v29 save has no finish; a finish round-trips; an old finish is migrated, not wiped; version 34 does not load');

/* ------------------------------------------------------------- 6. paint ---- */

{
  const cfg = finishConfig();
  assert.equal(cfg.tilt, true);
  assert.equal(cfg.tilt_max_deg, 15);
  assert.ok(cfg.drift_ms >= 8000 && cfg.drift_ms <= 20000);
  assert.equal(cfg.paint.blend, 'overlay');
  assert.ok(glareOpacity() >= 0.5 && glareOpacity() <= 0.6);
  assert.ok(borderOpacity() > 0 && borderOpacity() <= 0.8, 'the card border stays quiet');
  assert.equal(clampTilt(0, 15), 0);
  assert.ok(Math.abs(clampTilt((10 * Math.PI) / 180, 15) - 10 / 15) < 1e-9);
  assert.equal(clampTilt(Math.PI, 15), 1);
  assert.equal(clampTilt(-Math.PI, 15), -1);
  const chrome = finishColors().find((color) => color.id === 'chrome')!;
  const spectrum = finishColors().find((color) => color.id === 'spectrum')!;
  assert.ok(foilBandPitch(spectrum) >= foilBandPitch(chrome), 'a long mix lays out wider bands');
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: false, fxFull: true }), true);
  assert.equal(finishSweepRuns({ motion: 'still', reduceMotion: false, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'off', reduceMotion: false, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: true, osReduceMotion: false, fxFull: true }), false);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: true, fxFull: true }), true);
  assert.equal(finishSweepRuns({ motion: 'sweep', reduceMotion: false, osReduceMotion: false, fxFull: false }), false);

  const foil = read('src/play/finish-foil.tsx');
  for (const needle of ['finishSweepRuns', 'useFxQuality', 'isReduceMotionEnabled', 'borderFoilOpacity']) {
    assert.ok(foil.includes(needle), needle);
  }
  assert.ok(!foil.includes('FinishSheen'), 'sprite sheen');
  assert.ok(!foil.includes('maskType'), 'the card foil is not a sprite mask');
  assert.ok(!foil.includes('color-dodge'), 'color-dodge');
  assert.ok(!/offset=\{withTiming/.test(foil));
  const motion = read('src/play/finish-motion.tsx');
  for (const needle of ['useAnimatedSensor', 'AppState', 'SENSOR_DEAD_MS', 'withRepeat', 'SensorRunner', 'leaseFinishSensor']) {
    assert.ok(motion.includes(needle), needle);
  }
  assert.ok(motion.includes('tilt_max_deg'));
}
ok('the card border stays quiet, tilt clamps to ±15°, and the border sweep pauses for Reduce Motion and Low effects');

/* ------------------------------------------------------------ 7. surfaces --- */

{
  const defend = read('src/play/defend-screen.tsx');
  for (const needle of ['finish-foil', 'finish-motion', 'FinishPaint', 'FinishPlate', 'useAnimatedSensor', 'foilMotion', 'finish_kind', 'PetHolo']) {
    assert.ok(!defend.includes(needle), needle);
  }
  const card = read('src/play/pet-card.tsx');
  assert.ok(card.includes('borderFoilOpacity'), 'card keeps a border foil');
  assert.ok(!card.includes('windowFoilOpacity') && !card.includes('cardFoilOpacity'), 'no art-window / face foil on the card');
  const figure = read('src/play/pet-figure.tsx');
  assert.ok(figure.includes('PetHolo') && figure.includes('petFinishOf'), 'the holo is drawn on the pet');
  const room = read('src/play/pet-room.tsx');
  assert.ok(!room.includes('FinishPlate'), 'no foil mat in the room');
  const picker = read('src/play/finish-picker.tsx');
  assert.ok(picker.includes('Shine sweep') && picker.includes('Glint') && picker.includes('Single colour'), 'picker has every colour group');
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
ok('the holo is on the pet; the card keeps a border only; Defend has none');

console.log(`\ncheck:finishes — ${passed} groups passed.`);
