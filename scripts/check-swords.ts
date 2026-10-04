/**
 * Element swords (save v29, current save v30). Run: npm run check:swords
 *
 *   1. 21 elements and the 15 mix recipes. Names come from the config.
 *   2. Merge 3, merge 5, Legendary, Divine, and undo — including the cases
 *      that must refuse (equipped, already used, base Legendary, short pile).
 *   3. The same claim key cannot pay twice (bag, Defend win, mini-game).
 *   4. A v28 save loads as v30 with an empty bag; a v29 bag round-trips.
 *   5. Every sword's combat and aura numbers stay inside the config caps,
 *      and stacking auras cannot pass those caps.
 *   6. Drop sim: Rare shows up for a regular player, Relics take longer,
 *      Divine stays extremely rare. The line below is the measured median.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  defaultPlayStore,
  devPetSetStage,
  finishPetRound,
  parsePlayStore,
  recordDefendWin,
} from '../src/play/playStore';
import {
  auraOfRuntime,
  devGrantSword,
  dropChance,
  emptySwordBag,
  equipSword,
  forgeDivine,
  forgeLegendary,
  grantSwordDrop,
  mergeFive,
  mergeThree,
  mixSwords,
  parseSwordBag,
  simulateDropDays,
  stackAuras,
  swordCatalog,
  swordConfig,
  swordElements,
  swordName,
  swordRuntime,
  undoMerge,
  unequipSword,
  type SwordBag,
  type SwordTier,
} from '../src/play/swords';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const PASS = { pass: true as const, quality: 0.8, got: 16, of: 20 };

function must<T extends { ok: boolean }>(result: T, label: string): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, label);
  return result as Extract<T, { ok: true }>;
}

function give(bag: SwordBag, element: string, tier: SwordTier, n: number): SwordBag {
  let next = bag;
  for (let i = 0; i < n; i += 1) {
    const granted = must(devGrantSword(next, element, tier), `grant ${element} ${tier}`);
    next = unequipSword(granted.bag).bag;
  }
  return next;
}

const PAIRS: readonly (readonly [string, string, string])[] = [
  ['fire', 'water', 'steam'],
  ['fire', 'earth', 'magma'],
  ['fire', 'wind', 'blaze'],
  ['fire', 'light', 'solar'],
  ['fire', 'dark', 'hellfire'],
  ['water', 'earth', 'swamp'],
  ['water', 'wind', 'frost'],
  ['water', 'light', 'aurora'],
  ['water', 'dark', 'abyss'],
  ['earth', 'wind', 'sandstorm'],
  ['earth', 'light', 'crystal'],
  ['earth', 'dark', 'obsidian'],
  ['wind', 'light', 'lightning'],
  ['wind', 'dark', 'miasma'],
  ['light', 'dark', 'eclipse'],
];

/* ----------------------------------------------------------- 1. elements --- */

{
  const rows = swordElements();
  assert.equal(rows.length, 21);
  assert.equal(rows.filter((row) => row.kind === 'base').length, 6);
  assert.equal(rows.filter((row) => row.kind === 'mix').length, 15);
  assert.equal(swordCatalog().length, 105);
  const banned = /zelda|excalibur|lightsaber|muramasa|masamune|frostmourne|master sword|pokemon/i;
  for (const row of swordCatalog()) {
    assert.equal(banned.test(row.name), false, row.name);
    assert.equal(row.name, swordName(row.element, row.tier));
    assert.ok(row.label.length > 0 && row.auraLabel.length > 0, row.name);
  }
  for (const [a, b, id] of PAIRS) {
    const mixed = must(mixSwords(give(give(emptySwordBag(), a, 'common', 1), b, 'common', 1), a, b, 'common'), id);
    assert.equal(mixed.bag.swords.length, 1);
    assert.equal(mixed.bag.swords[0].element, id);
    assert.equal(mixed.bag.swords[0].tier, 'common');
  }
  const same = mixSwords(give(emptySwordBag(), 'fire', 'common', 2), 'fire', 'fire', 'common');
  assert.equal(same.ok, false);
  const high = mixSwords(give(give(emptySwordBag(), 'fire', 'legendary', 1), 'water', 'legendary', 1), 'fire', 'water', 'legendary');
  assert.equal(high.ok, false);
}
ok('21 elements, 15 mixes, 105 names, mix only at Common/Rare/Epic');

/* -------------------------------------------------------------- 2. merge --- */

{
  const three = must(mergeThree(give(emptySwordBag(), 'fire', 'common', 3), 'fire', 'common'), '3');
  assert.equal(three.bag.swords.length, 1);
  assert.equal(three.bag.swords[0].tier, 'rare');
  const back = must(undoMerge(three.bag), 'undo 3');
  assert.equal(back.bag.swords.length, 3);
  assert.ok(back.bag.swords.every((sword) => sword.tier === 'common' && sword.element === 'fire'));
  assert.equal(undoMerge(back.bag).ok, false);

  const held = give(emptySwordBag(), 'fire', 'common', 3);
  const equipped = equipSword(held, held.swords[0].uid).bag;
  assert.equal(mergeThree(equipped, 'fire', 'common').ok, false);
  assert.equal(equipped.swords.length, 3);

  const five = must(mergeFive(give(emptySwordBag(), 'water', 'rare', 5), 'water', 'rare'), '5');
  const tiers = five.bag.swords.map((sword) => sword.tier).sort();
  assert.deepEqual(tiers, ['common', 'epic']);
  const fiveBack = must(undoMerge(five.bag), 'undo 5');
  assert.equal(fiveBack.bag.swords.length, 5);
  assert.ok(fiveBack.bag.swords.every((sword) => sword.tier === 'rare'));

  const rare = must(mergeThree(give(emptySwordBag(), 'earth', 'common', 3), 'earth', 'common'), 'rare');
  const worn = equipSword(rare.bag, rare.bag.swords[0].uid).bag;
  assert.equal(undoMerge(worn).ok, false);
  assert.equal(worn.swords.length, 1);
  assert.equal(worn.swords[0].tier, 'rare');

  const first = must(mergeThree(give(emptySwordBag(), 'wind', 'common', 6), 'wind', 'common'), 'first');
  const second = must(mergeThree(first.bag, 'wind', 'common'), 'second');
  assert.equal(second.bag.swords.filter((sword) => sword.tier === 'rare').length, 2);
  const undone = must(undoMerge(second.bag), 'undo latest only');
  assert.equal(undone.bag.swords.filter((sword) => sword.tier === 'rare').length, 1);
  assert.equal(undone.bag.swords.filter((sword) => sword.tier === 'common').length, 3);

  assert.equal(mergeThree(give(emptySwordBag(), 'fire', 'epic', 3), 'fire', 'epic').ok, false);
  assert.equal(forgeLegendary(give(emptySwordBag(), 'fire', 'epic', 1), 'fire').ok, false);

  let legendBag = emptySwordBag();
  legendBag = {
    ...legendBag,
    swords: [{ uid: 1, element: 'steam', tier: 'epic' }],
    relics: [{ uid: 2, element: 'steam' }],
    nextUid: 3,
  };
  const legend = must(forgeLegendary(legendBag, 'steam'), 'legendary');
  assert.equal(legend.bag.swords.length, 1);
  assert.equal(legend.bag.swords[0].tier, 'legendary');
  assert.equal(legend.bag.relics.length, 0);
  const legendBack = must(undoMerge(legend.bag), 'undo legendary');
  assert.equal(legendBack.bag.swords[0].tier, 'epic');
  assert.equal(legendBack.bag.relics.length, 1);

  let divineBag = emptySwordBag();
  divineBag = {
    ...divineBag,
    swords: [{ uid: 1, element: 'steam', tier: 'legendary' }],
    relics: [
      { uid: 2, element: 'steam' },
      { uid: 3, element: 'steam' },
      { uid: 4, element: 'steam' },
    ],
    nextUid: 5,
  };
  assert.equal(forgeDivine({ ...divineBag, relics: divineBag.relics.slice(0, 2) }, 'steam').ok, false);
  const divine = must(forgeDivine(divineBag, 'steam'), 'divine');
  assert.equal(divine.bag.swords[0].tier, 'divine');
  assert.equal(divine.bag.relics.length, 0);
  const wornDivine = equipSword(divine.bag, divine.bag.swords[0].uid).bag;
  assert.equal(undoMerge(wornDivine).ok, false);
  assert.equal(wornDivine.swords[0].tier, 'divine');
}
ok('merge 3, merge 5, Legendary, Divine, undo; equipped and used results stay put');

/* ------------------------------------------------------------ 3. no dupe --- */

{
  const once = grantSwordDrop(emptySwordBag(), 'win-1', {
    source: 'defend',
    boss: false,
    highWave: false,
    deep: false,
    ymd: '2026-10-01',
  });
  assert.equal(once.duplicate, false);
  assert.equal(once.bag.swords.length, 1);
  const twice = grantSwordDrop(once.bag, 'win-1', {
    source: 'defend',
    boss: true,
    highWave: true,
    deep: false,
    ymd: '2026-10-01',
  });
  assert.equal(twice.duplicate, true);
  assert.equal(twice.bag, once.bag);
  assert.equal(grantSwordDrop(once.bag, '', { source: 'defend', boss: false, highWave: false, deep: false, ymd: '2026-10-01' }).duplicate, true);

  let stuffed = emptySwordBag();
  const cap = swordConfig().drops.bag.swords;
  for (let i = 0; i < cap; i += 1) stuffed = give(stuffed, 'fire', 'common', 1);
  const full = grantSwordDrop(stuffed, 'overflow', {
    source: 'defend',
    boss: false,
    highWave: false,
    deep: false,
    ymd: '2026-10-01',
  });
  assert.equal(full.bag.swords.length, cap);
  assert.equal(full.grant?.bagFull, true);
  const retry = grantSwordDrop({ ...full.bag, swords: full.bag.swords.slice(0, cap - 1) }, 'overflow', {
    source: 'defend',
    boss: false,
    highWave: false,
    deep: false,
    ymd: '2026-10-01',
  });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.bag.swords.length, cap - 1);

  const doc = defaultPlayStore(T0);
  const win = recordDefendWin(doc, { phase: 'trial', wave: 1, mode: 'campaign', claimKey: 'defend-1' }, T0, () => 0);
  const replay = recordDefendWin(win.doc, { phase: 'trial', wave: 1, mode: 'campaign', claimKey: 'defend-1' }, T0, () => 0);
  assert.equal(replay.result.duplicate, true);
  assert.equal(replay.result.tokensGranted, 0);
  assert.equal(replay.doc.tokens, win.doc.tokens);
  assert.equal(replay.doc.sword_bag.swords.length, win.doc.sword_bag.swords.length);

  const baby = devPetSetStage(defaultPlayStore(T0), T0, 'baby');
  const round = finishPetRound(baby, T0, 'catch', PASS, { level: 'normal', score: 40, daily: false }, 'pet-1');
  assert.equal(round.result.counted, true);
  const again = finishPetRound(round.doc, T0 + 1000, 'catch', PASS, { level: 'normal', score: 40, daily: false }, 'pet-1');
  assert.equal(again.result.counted, false);
  assert.equal(again.result.tokensGranted, 0);
  assert.equal(again.doc.tokens, round.doc.tokens);
  assert.equal(again.doc.sword_bag.swords.length + again.doc.sword_bag.relics.length, round.doc.sword_bag.swords.length + round.doc.sword_bag.relics.length);
}
ok('one claim key pays once — bag, Defend, and a mini-game; a full bag still consumes the key');

/* --------------------------------------------------------------- 4. save --- */

{
  const fresh = defaultPlayStore(T0);
  const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  legacy.version = 28;
  delete legacy.sword_bag;
  legacy.tokens = 77;
  const loaded = parsePlayStore(JSON.stringify(legacy), T0);
  assert.ok(loaded);
  assert.equal(loaded.version, 31);
  assert.equal(loaded.tokens, 77);
  assert.equal(loaded.sword_bag.swords.length, 0);
  assert.equal(loaded.sword_bag.relics.length, 0);
  assert.equal(loaded.shells, fresh.shells);

  const v1 = parsePlayStore(JSON.stringify({
    version: 1,
    tokens: 3,
    dive_charge: 1,
    dive_charge_at: T0,
    research_started_at: T0,
    inventory: [],
  }), T0);
  assert.ok(v1);
  assert.equal(v1.version, 31);
  assert.equal(v1.tokens, 3);
  assert.equal(v1.sword_bag.swords.length, 0);

  const merged = must(mergeThree(give(emptySwordBag(), 'light', 'common', 3), 'light', 'common'), 'save');
  const roundTrip = parsePlayStore(JSON.stringify({ ...fresh, sword_bag: merged.bag }), T0);
  assert.ok(roundTrip);
  assert.equal(roundTrip.sword_bag.swords.length, 1);
  assert.equal(roundTrip.sword_bag.swords[0].tier, 'rare');
  assert.equal(roundTrip.sword_bag.undo?.added.length, 1);
  const broken = parseSwordBag({
    swords: [{ uid: 9, element: 'nope', tier: 'divine' }, { uid: 4, element: 'dark', tier: 'common' }],
    undo: { added: [9], swordsBack: [{ uid: 1, element: 'dark', tier: 'common' }], relicsBack: [] },
    nextUid: 10,
  });
  assert.equal(broken.swords.length, 1);
  assert.equal(broken.undo, null);
  assert.equal(parsePlayStore(JSON.stringify({ ...fresh, version: 32 }), T0), null);
}
ok('v1 and v28 saves become v30 with an empty bag; a real bag round-trips; junk rows drop');

/* --------------------------------------------------------------- 5. caps --- */

{
  const caps = swordConfig().caps;
  for (const row of swordCatalog()) {
    const rt = swordRuntime(row.element, row.tier);
    assert.ok(rt, row.name);
    assert.ok(rt.cooldownMult >= caps.cooldownMultMin && rt.cooldownMult <= 1);
    assert.ok(rt.strikeMult <= caps.strikeMultMax);
    assert.ok(rt.bossMult <= caps.bossMultMax);
    assert.ok(rt.burnDpsShare <= caps.burnDpsShareMax);
    assert.ok(rt.burnMs <= caps.burnMsMax);
    assert.ok(rt.slowFactor >= caps.slowFactorMin && rt.slowFactor <= 1);
    assert.ok(rt.slowMs <= caps.slowMsMax);
    assert.ok(rt.knockFrac <= caps.knockFracMax);
    assert.ok(rt.scrapOnHit <= caps.scrapOnHitMax);
    assert.ok(rt.chain <= caps.chainMax);
    assert.ok(rt.chainShare <= caps.chainShareMax);
    assert.ok(rt.splashRadius <= caps.splashRadiusMax);
    assert.ok(rt.splashShare <= caps.splashShareMax);
    assert.ok(rt.shredMs <= caps.shredMsMax);
    assert.ok(rt.auraSpeed <= caps.auraSpeedMax);
    assert.ok(rt.auraDamage <= caps.auraDamageMax);
    assert.ok(rt.auraBoss <= caps.auraBossMax);
    assert.ok(rt.auraSlow >= caps.auraSlowMin);
    assert.ok(rt.auraBurn <= caps.auraBurnMax);
    assert.ok(rt.auraKnock <= caps.auraKnockMax);
    assert.ok(rt.auraChain <= caps.auraChainMax);
    assert.equal(rt.divine, row.tier === 'divine');
    assert.equal(rt.superMult > 0, row.tier === 'divine');
  }
  const hot = swordRuntime('frost', 'divine');
  assert.ok(hot);
  const stacked = stackAuras(Array.from({ length: 8 }, () => auraOfRuntime(hot)));
  assert.ok(stacked.speed <= caps.auraSpeedMax);
  assert.ok(stacked.damage <= caps.auraDamageMax);
  assert.ok(stacked.slow >= caps.auraSlowMin);
  assert.ok(stacked.burn <= caps.auraBurnMax);
  assert.ok(stacked.chain <= caps.auraChainMax);
  assert.ok(stacked.scrap <= caps.auraScrapMax);
  const one = stackAuras([auraOfRuntime(hot)]);
  assert.ok(stacked.speed <= one.speed * 1.001 || stacked.speed === caps.auraSpeedMax);
}
ok('every sword stays inside the caps; eight auras still cannot pass them');

/* ---------------------------------------------------------------- 6. sim --- */

{
  const plain = dropChance({ source: 'defend', boss: false, highWave: false, deep: false, streak: 1 });
  const boss = dropChance({ source: 'defend', boss: true, highWave: false, deep: false, streak: 1 });
  assert.equal(plain.relic, 0);
  assert.equal(plain.divine, 0);
  assert.ok(plain.rare > 0 && plain.rare < 0.2);
  assert.ok(boss.divine > 0 && boss.divine < 0.01);
  const sim = simulateDropDays();
  console.log(
    `  drop sim (${sim.trials} regular players): median days to Rare ${sim.rareMedianDays}, Relic ${sim.relicMedianDays}, Divine ${sim.divineMedianDays}; Divine within a year ${sim.divineWithinYear}/${sim.trials}`,
  );
  assert.ok(sim.rareMedianDays >= 1 && sim.rareMedianDays <= 21, `Rare median ${sim.rareMedianDays}`);
  assert.ok(sim.relicMedianDays > sim.rareMedianDays, `Relic median ${sim.relicMedianDays}`);
  assert.ok(sim.relicMedianDays <= 180, `Relic median ${sim.relicMedianDays}`);
  assert.ok(sim.divineMedianDays >= 4000, `Divine median ${sim.divineMedianDays}`);
  assert.ok(sim.divineWithinYear / sim.trials < 0.08, `Divine within a year ${sim.divineWithinYear}`);
}
ok('Rare is common, Relics are a long chase, Divine is extremely rare');

/* --------------------------------------------------------------- 7. files --- */

{
  const root = path.join(__dirname, '..');
  const sql = fs.readFileSync(path.join(root, 'src/play/data/sword-ledger.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /play_sword_claim/);
  assert.match(sql, /play_sword_merge/);
  assert.equal(/for update/i.test(sql), false);
  const shell = fs.readFileSync(path.join(root, 'src/app/play.tsx'), 'utf8');
  assert.match(shell, /mode === 'swordlab' && PRE_LAUNCH_DEV && devUnlocked/);
  const lab = fs.readFileSync(path.join(root, 'src/play/sword-lab-screen.tsx'), 'utf8');
  assert.match(lab, /if \(!PRE_LAUNCH_DEV\) return null/);
}
ok('SQL stays unapplied with RLS and no direct update; the sword lab is dev-only');

console.log(`\ncheck:swords — ${passed} groups passed.`);
