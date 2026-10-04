/**
 * Tide Pass checks (v28, Part E). Run: npm run check:tide
 *
 * Days and the day rule, the stacking cap, the Prism gift and Tide Friend
 * ribbon, re-stamp on wake, v27 → v28, the crate Power ceiling, and that
 * the pass never sells Classic or a Power.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DIVECORE_POWERS_PER_DAY, POWER_OVERFLOW_SHELLS } from '../src/play/dive-loot';
import { wakePet } from '../src/play/den';
import { EGGS_PER_DAY_MAX, PITY_HARD, PRISM_STYLES, STAR_PEARL_PITY, eggsUntilLegendary, nextEggPrice } from '../src/play/pet-eggs';
import { newPet, petDayHolds } from '../src/play/pet';
import { planPlayNotices, type NoticeInput } from '../src/play/play-notices';
import { STREAK_DAYS, STREAK_SHELLS, advanceStreak, emptyStreak, defaultSettings } from '../src/play/play-settings';
import {
  activateDenPet,
  applyPrismStone,
  chooseEggDoc,
  defaultPlayStore,
  devEndTide,
  devGrantTide,
  devPetEndStage,
  devSetStreakDay,
  localYmd,
  newEggDoc,
  parsePlayStore,
  playView,
  purchaseShopRow,
  touchPet,
  devFillDen,
  type PlayStoreDoc,
} from '../src/play/playStore';
import { TD_HELP_BAND } from '../src/play/play-buffs';
import { getTokenShopRow, paidShopRows, tideShopRows } from '../src/play/shop';
import {
  TIDE_PASS_DAYS,
  TIDE_PASS_MAX_DAYS,
  TIDE_PITY_STEP,
  TIDE_PRISM_GIFT,
  emptyTide,
  endTide,
  grantTide,
  tideActive,
  tideDaysHeld,
  openTideDay,
} from '../src/play/tide';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const D = 24 * 60 * 60 * 1000;
const ymd = (days: number) => localYmd(new Date(T0 + days * D));
const ROOT = path.join(__dirname, '..');

/* -------------------------------------------------------------- days --- */

{
  assert.equal(TIDE_PASS_DAYS, 5);
  assert.equal(TIDE_PASS_MAX_DAYS, 30);
  assert.equal(TIDE_PITY_STEP, 2);
  assert.equal(TIDE_PRISM_GIFT, 1);
  assert.equal(petDayHolds(ymd(0), ymd(1)), true, 'a stored day one ahead still holds');
  assert.equal(petDayHolds(ymd(0), ymd(2)), true, 'two ahead still holds');
  assert.equal(petDayHolds(ymd(0), ymd(3)), false, 'three ahead does not hold');

  let tide = grantTide(emptyTide(), ymd(0), TIDE_PASS_DAYS, 'dev').tide;
  tide = openTideDay(tide, ymd(0));
  assert.equal(tide.days_left, TIDE_PASS_DAYS - 1);
  assert.equal(tide.day_ymd, ymd(0));
  assert.equal(openTideDay(tide, ymd(0)), tide, 'the same day does not spend another');
  const skipped = openTideDay(tide, ymd(3));
  assert.equal(skipped.days_left, TIDE_PASS_DAYS - 2, 'a jump spends one day, not the days in between');
  assert.equal(skipped.day_ymd, ymd(3));
  assert.equal(openTideDay(skipped, ymd(2)), skipped, 'setting the clock back cannot add a day');
  const burned = openTideDay(skipped, ymd(0));
  assert.equal(burned.days_left, TIDE_PASS_DAYS - 3, 'a stored day more than two ahead spends one, and gives none back');
  assert.equal(burned.day_ymd, ymd(0));
  assert.equal(tideDaysHeld(burned, ymd(0)), burned.days_left + 1);
  assert.equal(tideActive(endTide(burned), ymd(0)), false);
  assert.equal(endTide(burned).passes_started, burned.passes_started, 'ending keeps the ribbon count');
}
ok('days: one open spends one day; a skip spends one; the clock cannot add days; a day stored too far ahead burns one');

/* --------------------------------------------------------------- cap --- */

{
  const first = grantTide(emptyTide(), ymd(0), 40, 'dev');
  assert.equal(first.added, TIDE_PASS_MAX_DAYS);
  assert.equal(first.prismGift, TIDE_PRISM_GIFT);
  assert.equal(first.started, true);
  assert.equal(first.tide.passes_started, 1);
  const stacked = grantTide(first.tide, ymd(0), 5, 'dev');
  assert.equal(stacked.added, 0);
  assert.equal(stacked.prismGift, 0, 'stacking onto a full pass gifts nothing');
  assert.equal(stacked.tide.passes_started, 1);
  const open = openTideDay(grantTide(emptyTide(), ymd(0), 5, 'dev').tide, ymd(0));
  const more = grantTide(open, ymd(0), 3, 'dev');
  assert.equal(more.added, 3);
  assert.equal(more.prismGift, 0, 'a second grant while a pass is held does not start another');
  assert.equal(more.tide.passes_started, 1);
  assert.equal(tideDaysHeld(more.tide, ymd(0)), 8);
}
ok('stacking stops at 30 play-days; a Prism Stone is gifted only when a pass starts');

/* ---------------------------------------------------- gift + ribbon --- */

{
  const doc = devGrantTide(defaultPlayStore(T0), T0);
  assert.equal(doc.prism_stones, TIDE_PRISM_GIFT);
  assert.ok(doc.ribbons.includes('tide'), 'the first pass adds Tide Friend');
  assert.equal(tideActive(doc.tide, ymd(0)), true);
  assert.equal(tideDaysHeld(doc.tide, ymd(0)), TIDE_PASS_DAYS);
  const again = devGrantTide(doc, T0);
  assert.equal(again.prism_stones, TIDE_PRISM_GIFT, 'stacking does not gift another Stone');
  assert.equal(again.ribbons.filter((r) => r === 'tide').length, 1);
  const ended = devEndTide(again, T0);
  assert.equal(tideActive(ended.tide, ymd(0)), false);
  assert.equal(ended.tide.days_left, 0);
  assert.ok(ended.ribbons.includes('tide'), 'the ribbon stays after the pass ends');
  assert.equal(ended.pet.shiny_style, null, 'the gift is not a Classic shiny');
}
ok('grant: one Prism Stone and the Tide Friend ribbon when a pass starts; ending clears the days only');

/* ------------------------------------------------------- re-stamp --- */

{
  let doc = devGrantTide(defaultPlayStore(T0), T0);
  doc = chooseEggDoc(doc, T0, 'knight', null, () => 0.2)!;
  assert.equal(doc.pet.pity_step, TIDE_PITY_STEP, 'picked while the pass is on');
  const uid = doc.pet.uid;
  doc = devEndTide(doc, T0);
  assert.equal(doc.pet.pity_step, TIDE_PITY_STEP, 'an incubating egg keeps the stamp');
  const rested = newEggDoc(doc, T0);
  assert.equal(rested.result.ok, true);
  const sleeping = rested.doc.pet_den.find((p) => p.uid === uid)!;
  assert.equal(sleeping.pity_step, TIDE_PITY_STEP);
  const woken = activateDenPet(rested.doc, T0, uid);
  assert.equal(woken.result.ok, true);
  assert.equal(woken.doc.pet.pity_step, 1, 'woken after the pass ends, it is stamped at 1');
  assert.equal(wakePet(sleeping, T0, 0, 1).pity_step, 1);

  const blank = newEggDoc(woken.doc, T0);
  const next = chooseEggDoc(blank.doc, T0, 'village', null, () => 0.2)!;
  assert.equal(next.pet.pity_step, 1, 'a new egg after the pass ends is step 1');
}
ok('an egg incubating when the pass ends keeps its step; one woken after the pass ends is re-stamped at 1');

/* ------------------------------------------------------------ saves --- */

{
  let seeded = chooseEggDoc({ ...defaultPlayStore(T0), eggs_since_legendary: 15 }, T0, 'knight', null, () => 0.2)!;
  seeded = devFillDen(seeded, T0, () => 0.5);
  const denLen = seeded.pet_den.length;
  assert.ok(denLen > 0);
  const raw = JSON.parse(JSON.stringify(seeded)) as Record<string, unknown>;
  raw.version = 27;
  raw.tokens = 77;
  raw.prism_stones = 5;
  raw.tide = { days_left: 4, day_ymd: ymd(0), passes_started: 2, source_last: 'dev' };
  const old = parsePlayStore(JSON.stringify(raw), T0)!;
  assert.equal(old.version, 32);
  assert.equal(old.tokens, 77, 'nothing else is lost');
  assert.equal(old.eggs_since_legendary, 15, 'the pity counter survives');
  assert.equal(old.pet_den.length, denLen, 'Den pets survive');
  assert.equal(old.prism_stones, 0);
  assert.deepEqual(old.tide, emptyTide());
  assert.equal(old.streak.next, 1);
  assert.ok(!old.ribbons.includes('tide'));

  raw.version = 28;
  raw.ribbons = ['tide'];
  const kept = parsePlayStore(JSON.stringify(raw), T0)!;
  assert.equal(kept.prism_stones, 5);
  assert.equal(kept.tide.days_left, 4);
  assert.equal(kept.tide.passes_started, 2);
  assert.ok(kept.ribbons.includes('tide'));
}
ok('v27 → v30: no pass and no Prism Stones, nothing else lost; a v28 save keeps both');

/* ---------------------------------------------------- crate ceiling --- */

{
  const row = getTokenShopRow('shop_merge_crate')!;
  const y = ymd(0);
  let doc: PlayStoreDoc = {
    ...defaultPlayStore(T0),
    tokens: 500,
    shells: 0,
    powers_today: { ymd: y, n: DIVECORE_POWERS_PER_DAY },
  };
  const full = purchaseShopRow(doc, row, T0, () => 0.5);
  assert.equal(full.result.ok, true);
  if (full.result.ok) {
    assert.equal(full.result.grantedItemId, null);
    assert.equal(full.result.shellsInstead, POWER_OVERFLOW_SHELLS);
  }
  assert.equal(full.doc.powers_today.n, DIVECORE_POWERS_PER_DAY);
  assert.equal(full.doc.shells, POWER_OVERFLOW_SHELLS);
  doc = { ...doc, powers_today: { ymd: y, n: DIVECORE_POWERS_PER_DAY - 1 }, shells: 0 };
  const room = purchaseShopRow(doc, row, T0, () => 0.5);
  assert.equal(room.result.ok && room.result.shellsInstead, 0);
  assert.equal(room.doc.powers_today.n, DIVECORE_POWERS_PER_DAY);
  assert.ok(room.result.ok && room.result.grantedItemId);
}
ok('a merge-crate Power counts toward Powers today; past the ceiling it is shells');

/* --------------------------------------- no power, no Classic for sale --- */

{
  const powerish = new Set(['dive_charge', 'merge_crate']);
  assert.ok(tideShopRows().every((r) => !powerish.has(r.kind) && r.kind !== 'shine_stone'));
  assert.ok(paidShopRows().every((r) => r.available === false && !powerish.has(r.kind)));
  assert.equal(nextEggPrice(EGGS_PER_DAY_MAX, true), null);
  assert.deepEqual(TD_HELP_BAND, { min: 0.03, max: 0.08 });
  const src = fs.readFileSync(path.join(ROOT, 'src/play/tide.ts'), 'utf8');
  assert.ok(!/wave_power|cycle_power|DIVE_CHARGE|stage_age/.test(src));

  const doc = devGrantTide({ ...defaultPlayStore(T0), tokens: 500, eggs_since_legendary: 10 }, T0);
  const before = {
    charge: doc.dive_charge,
    powers: doc.powers_today.n,
    stage: doc.pet.stage,
    age: doc.pet.stage_age_ms,
    eggs: doc.eggs_today,
  };
  const pearl = tideShopRows().find((r) => r.kind === 'star_pearl')!;
  const prism = tideShopRows().find((r) => r.kind === 'prism_stone')!;
  let incubating = chooseEggDoc(
    { ...defaultPlayStore(T0), tokens: 500, eggs_since_legendary: 2 },
    T0,
    'knight',
    null,
    () => 0.2,
  )!;
  incubating = devGrantTide(incubating, T0);
  const stampBefore = incubating.pet.pity_from;
  const bought = purchaseShopRow(incubating, pearl, T0);
  assert.equal(bought.result.ok, true);
  assert.equal(bought.doc.eggs_since_legendary, 2 + STAR_PEARL_PITY);
  assert.equal(bought.doc.pet.pity_from, bought.doc.eggs_since_legendary, 'Star Pearl re-stamps the egg in hand');
  assert.notEqual(bought.doc.pet.pity_from, stampBefore);
  const viewPearl = playView(bought.doc, T0).pet.pity;
  assert.equal(viewPearl.since, bought.doc.pet.pity_from);
  assert.equal(viewPearl.untilLegendary, eggsUntilLegendary(bought.doc.pet.pity_from, bought.doc.pet.pity_step));

  const passEgg = chooseEggDoc(defaultPlayStore(T0), T0, 'village', null, () => 0.3)!;
  assert.equal(passEgg.pet.pity_step, 1);
  const passStart = devGrantTide(passEgg, T0);
  assert.equal(passStart.pet.pity_step, TIDE_PITY_STEP);
  assert.equal(passStart.pet.pity_from, passStart.eggs_since_legendary, 'pass start re-stamps like a Den wake');
  const ended = devEndTide(passStart, T0);
  assert.equal(ended.pet.pity_step, TIDE_PITY_STEP, 'mid-incubation pass end keeps the stamp');
  const viewEnd = playView(ended, T0).pet.pity;
  assert.equal(viewEnd.step, ended.pet.pity_step);
  assert.equal(viewEnd.since, ended.pet.pity_from);

  const boughtDoc = purchaseShopRow(doc, pearl, T0);
  assert.equal(boughtDoc.result.ok, true);
  assert.equal(boughtDoc.doc.eggs_since_legendary, 10 + STAR_PEARL_PITY);
  assert.equal(boughtDoc.doc.dive_charge, before.charge);
  assert.equal(boughtDoc.doc.powers_today.n, before.powers);
  assert.equal(boughtDoc.doc.pet.stage, before.stage);
  assert.equal(boughtDoc.doc.pet.stage_age_ms, before.age);
  assert.equal(boughtDoc.doc.eggs_today, before.eggs);
  const clamped = purchaseShopRow({ ...doc, eggs_since_legendary: PITY_HARD - 2 }, pearl, T0);
  assert.equal(clamped.doc.eggs_since_legendary, PITY_HARD - 1, 'a Star Pearl never skips the guarantee');
  const capped = purchaseShopRow(boughtDoc.doc, pearl, T0);
  assert.equal(capped.result.ok, false);
  if (!capped.result.ok) assert.equal(capped.result.reason, 'pass_cap');
  const stones = purchaseShopRow(boughtDoc.doc, prism, T0);
  assert.equal(stones.result.ok, true);
  assert.equal(stones.doc.prism_stones, boughtDoc.doc.prism_stones + prism.amount);
  const cappedStone = purchaseShopRow(stones.doc, prism, T0);
  assert.equal(cappedStone.result.ok, false);
  if (!cappedStone.result.ok) assert.equal(cappedStone.result.reason, 'pass_cap');
  const locked = purchaseShopRow({ ...defaultPlayStore(T0), tokens: 500 }, prism, T0);
  assert.equal(locked.result.ok, false);
  if (!locked.result.ok) assert.equal(locked.result.reason, 'tide_only');
  assert.equal(locked.doc.tokens, 500);

  let revealed = chooseEggDoc(devGrantTide(defaultPlayStore(T0), T0), T0, 'knight', null, () => 0.4)!;
  revealed = devPetEndStage(devPetEndStage(revealed, T0, 'egg'), T0, 'baby');
  assert.equal(revealed.pet.stage, 'child');
  for (const style of PRISM_STYLES) {
    const applied = applyPrismStone({ ...revealed, prism_stones: 2 }, T0, revealed.pet.uid, style);
    assert.equal(applied.result.ok, true, style);
    if (applied.result.ok) assert.notEqual(applied.doc.pet.shiny_style, 'classic');
  }
  const shiny = applyPrismStone(
    { ...revealed, pet: { ...revealed.pet, shiny: true, shiny_style: 'aurora' }, prism_stones: 2 },
    T0,
    revealed.pet.uid,
    'ember',
  );
  assert.equal(shiny.result.ok, false);
  if (!shiny.result.ok) assert.equal(shiny.result.reason, 'shiny');
  assert.equal(shiny.doc.prism_stones, 2);
}
ok('the pass, the Tide shelf and paid rows never touch Powers, charges, growth or the egg cap; Classic is never what they produce');

/* ------------------------------------------------------------- streak --- */

{
  let doc = touchPet(defaultPlayStore(T0), T0);
  assert.equal(doc.streak.last, 1);
  assert.equal(doc.streak.next, 2);
  assert.equal(doc.shells, defaultPlayStore(T0).shells + STREAK_SHELLS);
  const skipped = touchPet(doc, T0 + 3 * D);
  assert.equal(skipped.streak.last, 2, 'a missed day pauses on the next day');
  assert.equal(skipped.streak.next, 3);
  assert.equal(touchPet(skipped, T0 + 2 * D).streak.last, 2, 'the clock set back cannot claim the day twice');

  let streak = emptyStreak();
  const jumped = advanceStreak(streak, ymd(5));
  assert.ok(jumped);
  streak = jumped!.streak;
  assert.equal(advanceStreak(streak, ymd(0)), null, 'oscillating the clock back cannot advance again');
  const later = advanceStreak(streak, ymd(6));
  assert.ok(later);
  assert.equal(later!.day, 2, 'a later calendar day still advances once');

  const day7 = devSetStreakDay(defaultPlayStore(T0), T0, STREAK_DAYS);
  assert.equal(day7.streak.last, STREAK_DAYS);
  assert.equal(day7.streak.next, 1, 'day 7 loops');
  assert.equal(tideActive(day7.tide, ymd(0)), true);
  assert.equal(day7.prism_stones, TIDE_PRISM_GIFT, 'the Tide day starts a pass, so it gifts a Stone');
  assert.ok(day7.ribbons.includes('tide'));
  const day3 = devSetStreakDay(defaultPlayStore(T0), T0, 3);
  assert.equal(day3.shine_stones, defaultPlayStore(T0).shine_stones + 1);
  const day5 = devSetStreakDay(defaultPlayStore(T0), T0, 5);
  assert.equal(day5.pet_tickets.rare, defaultPlayStore(T0).pet_tickets.rare + 1);
}
ok('the Tide calendar pauses on a missed day, and day 7 gives a Tide day');

/* ---------------------------------------------------------- reminders --- */

{
  const pet = { ...newPet(T0), stage: 'child' as const, hero: 'raven', egg: 'knight' as const, grade: 'common' as const };
  const base: NoticeInput = {
    settings: defaultSettings(),
    pet,
    name: 'Kiki',
    expeditionBackInMs: null,
    expeditionTripMs: null,
    chargesFullAt: null,
    chargesArmed: false,
    hungerLastFiredAt: null,
    chargesLastFiredAt: null,
    now: T0,
    tideActive: true,
    tideDaysHeld: 1,
    freeEggsReady: true,
  };
  const plan = planPlayNotices(base);
  assert.ok(plan.some((n) => n.kind === 'tide' && n.title === 'Tide Pass: last day'));
  assert.ok(plan.some((n) => n.kind === 'eggs_ready'));
  const off = planPlayNotices({
    ...base,
    settings: { ...defaultSettings(), notif: { ...defaultSettings().notif, tide: false, eggs_ready: false } },
  });
  assert.ok(!off.some((n) => n.kind === 'tide' || n.kind === 'eggs_ready'));
  const quiet = planPlayNotices({ ...base, now: new Date(2026, 9, 1, 23, 0, 0).getTime() });
  for (const n of quiet.filter((x) => x.kind === 'tide' || x.kind === 'eggs_ready')) {
    const h = new Date(n.at).getHours();
    assert.ok(h >= 7 && h < 22, `${n.kind} waits out quiet hours`);
  }
  const guide = fs.readFileSync(path.join(ROOT, 'src/play/guide-content.ts'), 'utf8');
  const paid = fs.readFileSync(path.join(ROOT, 'src/play/data/shops/paid.json'), 'utf8');
  assert.ok(!/\bluck\b/i.test(guide + paid), 'the pass is progress, not luck');
}
ok('last-day and free-eggs reminders schedule when on, respect quiet hours, and the pass copy does not say luck');

console.log(`\ncheck:tide — ${passed} groups passed.`);
