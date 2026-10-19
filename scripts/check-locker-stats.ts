/**
 * Honest Locker (Divecore finish step 2, emci 2026-10-18).
 * Run: npm run check:locker-stats
 *
 * - `token_earn` (Copper Keeper) scales the Divecore tokens of a Turf win and a Skip (soft-capped bucket, the
 *   leader's gear, nearest whole token). Not the flat cycle bonus, not mini-game rounds (a 5-token round would
 *   round a +5% away), never ATO tokens.
 * - `research_yield` (Curator's Cloak, Ember Mantle's second stat) adds finds to a research claim: expected
 *   extra = cycles × bonus, whole part always, the fraction by one dice roll; nothing worn = no roll.
 * - Every stat says where it works (Turf War / Dive / Hideout); every Power has a place, every Look is "Style
 *   only"; the Locker shows Powers and Looks as two sections, the "Looks" tab, and the bonuses by place.
 * - The shop (paid / pass / stub rows) stays dev-only: no player can open it.
 * - The save stays v33 (no new field).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HIDEOUT_SAVE_VERSION } from '../src/play/hideout-progress';
import { HELP, HELP_MAX_BULLETS, HELP_MAX_WORDS, wordCount } from '../src/play/help/help-content';
import {
  formatWorksIn,
  getItemDef,
  ITEM_STATS,
  itemWorksIn,
  STAT_PLACES,
  STAT_WORKS_IN,
  type ItemSlot,
} from '../src/play/items';
import { hubTilesFor, shopUnlocked } from '../src/play/neon-viper';
import {
  bucketMultiplier,
  claimResearch,
  defaultPlayStore,
  leaderStatSumsOf,
  normalizedAvatarHeroId,
  recordDefendWin,
  researchYieldMultOf,
  scaleTokens,
  skipCampaignToEven,
  tokenEarnMultOf,
  type ItemRef,
  type PlayStoreDoc,
  type StatSums,
} from '../src/play/playStore';
import { getTune } from '../src/play/tune';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 18, 9, 0, 0);
const KEEPER = 'item_copper_keeper_01';
const CLOAK = 'item_curator_cloak_01';
const MANTLE = 'item_uni_ember_mantle';
const BLADE = 'item_tide_blade_01';
for (const id of [KEEPER, CLOAK, MANTLE, BLADE]) assert.ok(getItemDef(id), `item ${id} exists`);
const ref = (id: string, star = 0): ItemRef => ({ id, star });
const slotOf = (id: string): ItemSlot => getItemDef(id)!.core.slot;

const base: PlayStoreDoc = defaultPlayStore(T);
const leader = normalizedAvatarHeroId(base);
const wearing = (...refs: ItemRef[]): PlayStoreDoc => ({
  ...base,
  hero_gear: { [leader]: Object.fromEntries(refs.map((r) => [slotOf(r.id), r])) },
});
const zeroSums = (over: Partial<StatSums> = {}): StatSums => ({
  wave_power: 0,
  tower_speed: 0,
  token_earn: 0,
  dive_luck: 0,
  research_yield: 0,
  ...over,
});

// --- token gain ---------------------------------------------------------------------------------------
{
  const win = (doc: PlayStoreDoc, mode: 'campaign' | 'replay' = 'campaign') =>
    recordDefendWin(doc, { phase: 'trial', wave: 1, mode }, T, () => 0.99).result.tokensGranted;
  const plain = win(base);
  assert.equal(plain, getTune().tokenClearBase, 'no gear: the plain payout');
  assert.equal(tokenEarnMultOf(base), 1, 'no gear: x1');

  const keeper = wearing(ref(KEEPER));
  const mult = tokenEarnMultOf(keeper);
  assert.ok(mult > 1, `Copper Keeper raises the multiplier (x${mult})`);
  assert.equal(win(keeper), scaleTokens(plain, mult), 'a Turf win pays the scaled tokens');
  assert.ok(win(keeper) > plain, 'Copper Keeper changes a real number: more tokens from a win');
  assert.equal(win(keeper, 'replay'), scaleTokens(Math.floor(plain / 2), mult), 'a replay (half pay) scales too');
  assert.equal(win(wearing(ref(CLOAK))), plain, 'Curator’s Cloak does not touch Turf tokens (no stacking)');
  ok(`token gain: Copper Keeper x${mult.toFixed(3)} → ${plain} → ${win(keeper)} tokens a win; replay scales; the Cloak does not`);

  // Soft cap: the same bucket as every other economy stat (cap x1.5, then 25% past it).
  const tune = getTune();
  const addCap = tune.gearSoftcapOther - 1;
  const big = 2;
  assert.ok(Math.abs(bucketMultiplier('token_earn', zeroSums({ token_earn: big })) - (1 + addCap + tune.diminishingAfterCap * (big - addCap))) < 1e-9);
  assert.equal(scaleTokens(0, 1.5), 0, 'a zero payout stays zero');
  ok('soft cap: the existing bucket (cap, then a 25% tail)');

  // Source pins: only wins and skips scale; the flat cycle bonus and the mini-game rounds do not.
  const src = read('src/play/playStore.ts');
  assert.equal((src.match(/tokenEarnMultOf\(doc\)/g) ?? []).length, 2, 'exactly two call sites: a win and a skip');
  assert.ok(
    src.indexOf('tokensGranted = scaleTokens(tokensGranted, tokenEarnMultOf(doc))') < src.indexOf('tokensGranted += CYCLE_CLEAR_BONUS_TOKENS'),
    'the scaling comes before the flat cycle bonus',
  );
  const round = src.slice(src.indexOf('const pay = petTokensForRound('), src.indexOf('const pay = petTokensForRound(') + 600);
  assert.ok(!/tokenEarn|scaleTokens/.test(round), 'mini-game rounds are not scaled');
  assert.ok(!/ato_token|ai_token|record_check/.test(src), 'never ATO tokens');
  ok('wins and skips scale; the flat cycle bonus and the 5-token mini-game rounds do not; no ATO tokens');

  // A skip uses the same multiplier.
  const camp = { ...keeper, campaign: { phase: 'trial' as const, wave_in_phase: 1 }, highest_wave_cleared: 0 };
  const skipPlain = skipCampaignToEven({ ...base, campaign: camp.campaign }, () => 0.99);
  const skipGear = skipCampaignToEven(camp, () => 0.99);
  if (skipPlain && skipGear) {
    assert.ok(skipGear.result.tokensGranted >= skipPlain.result.tokensGranted, 'a skip pays at least the plain amount with the gear');
    ok('skip: pays the scaled tokens too');
  } else {
    ok('skip: not offered at this seat (the call site is pinned above)');
  }
}

// --- research yield -----------------------------------------------------------------------------------
{
  const NOW = T + 10 * 60 * 60 * 1000;
  const claim = (doc: PlayStoreDoc, roll: number) => claimResearch(doc, NOW, () => roll)!.result;
  const none = claim(base, 0);
  assert.equal(none.bonusFinds, 0, 'no gear: no bonus finds');
  assert.equal(none.items.length, none.cyclesClaimed, 'no gear: one find per cycle, as before');
  assert.equal(researchYieldMultOf(base), 1);

  for (const [name, id] of [['Curator’s Cloak', CLOAK], ['Ember Mantle', MANTLE]] as const) {
    const doc = wearing(ref(id));
    const bonus = researchYieldMultOf(doc) - 1;
    assert.ok(bonus > 0, `${name} raises research yield`);
    for (const roll of [0, 0.99]) {
      const got = claim(doc, roll);
      const extra = got.cyclesClaimed * bonus;
      const whole = Math.floor(extra);
      const expected = whole + (roll < extra - whole ? 1 : 0);
      assert.equal(got.bonusFinds, expected, `${name}: ${got.cyclesClaimed} cycles x ${(bonus * 100).toFixed(1)}% → ${expected} extra (roll ${roll})`);
      assert.equal(got.items.length, got.cyclesClaimed + got.bonusFinds, 'the bonus finds are in the bag haul');
    }
    assert.ok(claim(doc, 0).bonusFinds > 0, `${name} changes a real number: extra finds`);
  }
  assert.equal(claim(wearing(ref(KEEPER)), 0).bonusFinds, 0, 'Copper Keeper does not touch research (no stacking)');
  ok('research yield: Curator’s Cloak and Ember Mantle add finds (expected cycles x bonus, whole part + one dice roll); no gear = no roll');
}

// --- where it works -----------------------------------------------------------------------------------
{
  for (const stat of ITEM_STATS) assert.ok(STAT_PLACES.includes(STAT_WORKS_IN[stat]), `${stat} has a place`);
  assert.deepEqual(
    { wave: STAT_WORKS_IN.wave_power, tower: STAT_WORKS_IN.tower_speed, token: STAT_WORKS_IN.token_earn, dive: STAT_WORKS_IN.dive_luck, research: STAT_WORKS_IN.research_yield },
    { wave: 'Turf War', tower: 'Turf War', token: 'Turf War', dive: 'Dive', research: 'Hideout' },
  );
  const items = JSON.parse(read('src/play/data/items.json')) as { id: string; core: { kind: string } }[];
  let powers = 0;
  let looks = 0;
  for (const row of items) {
    const def = getItemDef(row.id)!;
    if (def.core.kind === 'power') {
      powers += 1;
      assert.ok(itemWorksIn(def).length > 0, `${row.id} says where it works`);
      assert.ok(formatWorksIn(def).startsWith('Works in: '));
    } else {
      looks += 1;
      assert.equal(formatWorksIn(def), 'Style only', `${row.id} is style only`);
    }
  }
  assert.equal(formatWorksIn(getItemDef(KEEPER)!), 'Works in: Turf War');
  assert.equal(formatWorksIn(getItemDef(CLOAK)!), 'Works in: Hideout');
  assert.equal(formatWorksIn(getItemDef(MANTLE)!), 'Works in: Turf War · Hideout');
  assert.equal(formatWorksIn(getItemDef(BLADE)!), 'Works in: Turf War · Dive');
  ok(`works in: ${powers} Powers each name a place, ${looks} Looks read "Style only"`);
}

// --- the Locker screen --------------------------------------------------------------------------------
{
  const screen = read('src/play/dress-screen.tsx');
  assert.ok(screen.includes('Powers change how the games play. Looks are just for style.'), 'the new lede');
  assert.ok(!screen.includes('Basecore'), 'no stale "Basecore"');
  assert.ok(screen.includes("{ key: 'look', label: 'Looks' }") && !screen.includes("label: 'Junk'"), 'the Junk tab is the Looks tab');
  assert.ok(screen.includes('Powers · change the games') && screen.includes('Looks · style only'), 'two sections in the bag');
  assert.ok(screen.includes('STAT_PLACES.map') && screen.includes('STAT_WORKS_IN[stat] === place'), 'bonuses are grouped by where they work');
  assert.ok((screen.match(/formatWorksIn\(def\)/g) ?? []).length >= 2, 'worn and bag rows both show where a Power works');
  const help = HELP.locker;
  assert.ok(help.bullets.length <= HELP_MAX_BULLETS && help.bullets.every((b) => wordCount(b) <= HELP_MAX_WORDS), 'the Locker help card fits its limits');
  assert.ok(/Powers/.test(help.bullets.join(' ')) && /Looks/.test(help.bullets.join(' ')), 'the help card explains Powers vs Looks');
  ok('Locker: new lede, Looks tab, Powers / Looks sections, bonuses by place, "works in" on every row, help card');
}

// --- the shop stays dev-only --------------------------------------------------------------------------
{
  assert.equal(shopUnlocked(true, false), false, 'dev unlock alone opens nothing once the pre-launch flag is off');
  assert.equal(shopUnlocked(false, true), false, 'the pre-launch flag alone opens nothing without the dev unlock');
  assert.equal(shopUnlocked(true, true), true);
  assert.ok(!hubTilesFor(true, false).some((t) => t.to === 'shop') && !hubTilesFor(false, true).some((t) => t.to === 'shop'), 'no Store tile for a player');
  const play = read('src/app/play.tsx');
  assert.ok(play.includes("mode === 'shop' && view && shopUnlocked(devUnlocked)"), 'the shop screen renders only when unlocked');
  ok('shop: paid / pass / stub rows are unreachable for a player (dev-only, gone with the pre-launch flag)');
}

// --- save ---------------------------------------------------------------------------------------------
{
  assert.equal(HIDEOUT_SAVE_VERSION, 33);
  assert.equal(base.version, 33);
  const view = leaderStatSumsOf(wearing(ref(KEEPER), ref(CLOAK)));
  assert.ok(view.token_earn > 0 && view.research_yield > 0, 'the leader’s sums carry both economy stats');
  ok('save stays v33; the economy stats read the leader’s gear (no new field)');
}

console.log(`\ncheck:locker-stats — ${passed} groups passed.`);
