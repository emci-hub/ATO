/**
 * Economy guard + sinks (Divecore finish step 3, emci 2026-10-18).
 * Run: npm run check:economy-guard
 *
 * - The daily half-pay cap holds when the phone clock is set back a little (`petDayHolds`, like every pet-day
 *   cap); a stored day far ahead starts fresh.
 * - A clock moved FORWARD cannot be told from being away, so it is NOT guarded (accepted risk, recorded in the
 *   roadmap): what bounds it is pinned here — research banks at most one 10 h bag, dive charges refill to the cap,
 *   a clock moved back gives nothing, and a claim empties the bag.
 * - A duplicate that joins a hero already at 5★ pays 2 shards of its grade (Legendary → Epic); below 5★ nothing;
 *   the "joined up" line says it; an older saved note without shards still reads.
 * - The Store is open to players with the Token shop only (Dive refresh 3 a day, Big crate 300 tokens a week);
 *   the Big crate rides the merge-crate path (the daily Power ceiling still applies).
 * - The save stays v33.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HIDEOUT_SAVE_VERSION } from '../src/play/hideout-progress';
import type { PetState } from '../src/play/pet';
import { mergeLine, parseMergeNote } from '../src/play/pet-merge';
import {
  claimResearch,
  DIVE_CHARGE_CAP,
  defaultPlayStore,
  diveChargeAt,
  dupShardGrade,
  foldDuplicatePets,
  localYmd,
  purchaseShopRow,
  recordDefendWin,
  researchAt,
  type PlayStoreDoc,
} from '../src/play/playStore';
import { getTokenShopRow, storeTabsFor, storeTokenRows } from '../src/play/shop';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 18, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const base: PlayStoreDoc = defaultPlayStore(T);
const ymdAt = (offsetDays: number) => localYmd(new Date(T + offsetDays * DAY));

// --- the half-pay cap holds when the clock is set back -------------------------------------------------
{
  const win = (clearsYmd: string | null, clearsToday: number) =>
    recordDefendWin({ ...base, clears_today: clearsToday, clears_ymd: clearsYmd }, { phase: 'trial', wave: 1, mode: 'campaign' }, T, () => 0.99);
  const same = win(ymdAt(0), 5);
  assert.equal(same.result.halved, true, 'today, 5 clears: half pay');
  const back = win(ymdAt(1), 5);
  assert.equal(back.result.halved, true, 'the clock set back 1 day: the count still holds (half pay)');
  assert.equal(back.doc.clears_ymd, ymdAt(1), 'the stored day is kept, so it cannot reset early');
  assert.equal(back.doc.clears_today, 6);
  assert.equal(win(ymdAt(2), 5).result.halved, true, 'set back 2 days: still holds');
  assert.equal(win(ymdAt(3), 5).result.halved, false, 'a stored day 3+ ahead starts fresh (never locks the cap)');
  const yesterday = win(ymdAt(-1), 5);
  assert.equal(yesterday.result.halved, false, 'a real new day: full pay');
  assert.equal(yesterday.doc.clears_today, 1);
  assert.equal(yesterday.doc.clears_ymd, ymdAt(0));
  assert.equal(win(null, 0).result.halved, false, 'a fresh save: full pay');
  ok('the 5-clears half-pay cap holds when the clock is set back up to 2 days, resets on a real new day');
}

// --- forward clock jumps: accepted risk, bounded by caps ------------------------------------------------
{
  const jump = T + 100 * HOUR;
  assert.equal(researchAt(base, jump).readyFinds, 20, 'a 100 h jump pays one capped bag, not 200 cycles');
  assert.equal(researchAt(base, T + 10 * HOUR).readyFinds, 20, '10 h is the cap');
  assert.equal(researchAt(base, T - 5 * HOUR).readyFinds, 0, 'a clock moved back gives nothing');
  const empty: PlayStoreDoc = { ...base, dive_charge: 0, dive_charge_at: T };
  assert.equal(diveChargeAt(empty, jump).current, DIVE_CHARGE_CAP, 'charges refill to the cap, no further');
  assert.equal(diveChargeAt(empty, T - 5 * HOUR).current, 0, 'a clock moved back gives no charge');
  const first = claimResearch(base, jump, () => 0.5)!;
  assert.equal(first.result.cyclesClaimed, 20);
  assert.equal(claimResearch(first.doc, jump, () => 0.5), null, 'a claim empties the bag: a second claim at once pays nothing');
  const roadmap = read('docs/divecore-finish-roadmap.md');
  assert.ok(/Forward clock jumps/i.test(roadmap) && /accepted risk/i.test(roadmap), 'the decision is recorded in the roadmap');
  ok('forward clock jumps: not guarded (accepted risk, recorded); bounded by the 10 h research cap and the 10-charge cap; back-jumps give nothing');
}

// --- 5-star duplicates pay shards ------------------------------------------------------------------------
{
  const pet = (over: Partial<PetState>): PetState => ({ ...base.pet, seen_at: T, stage: 'child', grade: 'common', reveals: [], ...over });
  const docWith = (active: PetState, den: PetState[]): PlayStoreDoc => ({ ...base, pet: active, pet_den: den, den_slots: 20, pet_uid_next: 40 });
  const grown = pet({ uid: 2, hero: 'kael', stage: 'adult' });

  // Six Kaels: stars already max at five, so the sixth copy adds nothing and pays 2 shards (its grade).
  const dens = [10, 11, 12, 13, 14].map((uid) => pet({ uid, hero: 'kael', grade: uid === 14 ? 'rare' : 'common' }));
  const six = foldDuplicatePets(docWith(grown, dens), T);
  const paid = Object.values(six.doc.pet_shards).reduce((a, b) => a + b, 0) - Object.values(base.pet_shards).reduce((a, b) => a + b, 0);
  assert.equal(paid, 2, 'one wasted duplicate pays 2 shards');
  assert.equal(six.doc.pet_shards.rare, base.pet_shards.rare + 2, "in the wasted duplicate's own grade");
  assert.equal(six.note?.shards, 2);
  assert.equal(six.note?.shard_grade, 'rare');

  // Five Kaels: the fifth star is the last one it adds, so nothing is wasted.
  const five = foldDuplicatePets(docWith(grown, dens.slice(0, 3).concat(pet({ uid: 15, hero: 'kael' }))), T);
  assert.deepEqual(five.doc.pet_shards, base.pet_shards, 'a duplicate that still adds a star pays no shards');
  assert.equal(five.note?.shards, 0);

  // Seven: two wasted → 4 shards. A Legendary duplicate pays Epic shards (Legendary shards trade up to nothing).
  const seven = foldDuplicatePets(
    docWith(grown, [10, 11, 12, 13, 14, 15].map((uid) => pet({ uid, hero: 'kael', grade: uid >= 14 ? 'legendary' : 'common' }))),
    T,
  );
  assert.equal(seven.doc.pet_shards.epic, base.pet_shards.epic + 4, 'two Legendary duplicates → 4 Epic shards');
  assert.equal(seven.doc.pet_shards.legendary, base.pet_shards.legendary, 'never Legendary shards');
  assert.equal(dupShardGrade('legendary'), 'epic');
  assert.equal(dupShardGrade('rare'), 'rare');
  assert.equal(dupShardGrade(null), 'common');

  // The line + an older saved note (no shard fields) still reads.
  assert.equal(
    mergeLine({ hero: 'kael', stars_from: 5, stars_to: 5, grade_up: null, shiny_up: false, shards: 2, shard_grade: 'epic' }, 'Kael'),
    'Kael joined up! +2 Epic shards',
  );
  assert.equal(
    mergeLine({ hero: 'kael', stars_from: 2, stars_to: 3, grade_up: null, shiny_up: false, shards: 0, shard_grade: null }, 'Kael'),
    'Kael joined up! ★★ → ★★★',
  );
  const oldNote = parseMergeNote({ hero: 'kael', stars_from: 2, stars_to: 3, grade_up: null, shiny_up: false }, () => true);
  assert.deepEqual(oldNote, { hero: 'kael', stars_from: 2, stars_to: 3, grade_up: null, shiny_up: false, shards: 0, shard_grade: null });
  const newNote = parseMergeNote({ hero: 'kael', stars_from: 5, stars_to: 5, grade_up: null, shiny_up: false, shards: 2, shard_grade: 'epic' }, () => true);
  assert.equal(newNote?.shards, 2);
  assert.equal(parseMergeNote({ hero: 'kael', stars_from: 5, stars_to: 5, grade_up: null, shiny_up: false, shards: 2, shard_grade: 'bogus' }, () => true)?.shards, 0, 'shards without a valid grade read as none');
  ok('5★ duplicates: 2 shards of their grade (Legendary → Epic), none below 5★, the line says it, an older note still reads');
}

// --- the Store: rows and limits -----------------------------------------------------------------------------
{
  const refresh = getTokenShopRow('shop_dive_refresh')!;
  assert.equal(refresh.daily_limit, 3);
  const spent: PlayStoreDoc = { ...base, tokens: 1000, dive_charge: 0, dive_charge_at: T };
  let doc = spent;
  for (let i = 0; i < 3; i += 1) {
    const out = purchaseShopRow(doc, refresh, T, () => 0.5);
    assert.equal(out.result.ok, true, `refresh ${i + 1} of 3`);
    doc = out.doc;
    doc = { ...doc, dive_charge: 0, dive_charge_at: T };
  }
  const fourth = purchaseShopRow(doc, refresh, T, () => 0.5);
  assert.deepEqual(fourth.result, { ok: false, reason: 'daily_cap' }, 'the 4th refresh in a day is refused');

  const big = getTokenShopRow('shop_big_crate')!;
  assert.equal(big.kind, 'merge_crate');
  assert.equal(big.price, 300);
  assert.equal(big.amount, 3);
  assert.equal(big.weekly_limit, 1);
  const rich: PlayStoreDoc = { ...base, tokens: 1000 };
  const bought = purchaseShopRow(rich, big, T, () => 0.5);
  assert.equal(bought.result.ok, true);
  assert.equal(bought.doc.tokens, 700, 'costs 300');
  const bagBefore = rich.inventory.reduce((n, s) => n + s.count, 0);
  const bagAfter = bought.doc.inventory.reduce((n, s) => n + s.count, 0);
  assert.equal(bagAfter - bagBefore, 3, 'three Powers');
  assert.deepEqual(purchaseShopRow(bought.doc, big, T, () => 0.5).result, { ok: false, reason: 'weekly_cap' }, 'one a week');
  // Past the daily Power ceiling the crate pays shells instead (the merge-crate path).
  const capped = purchaseShopRow({ ...rich, powers_today: { ymd: localYmd(new Date(T)), n: 6 } }, big, T, () => 0.5);
  assert.equal(capped.result.ok, true);
  assert.ok(capped.result.ok && capped.result.shellsInstead > 0, 'past the daily Power ceiling the Powers become shells');
  ok('Store rows: Dive refresh 3 a day; Big crate 300 tokens, 3 Powers, 1 a week, daily Power ceiling still applies');
}

// --- who sees what -----------------------------------------------------------------------------------------
{
  assert.deepEqual(storeTabsFor(false), ['token']);
  const player = storeTokenRows(false);
  assert.ok(player.some((r) => r.id === 'shop_big_crate') && player.some((r) => r.id === 'shop_dive_refresh'));
  assert.ok(player.every((r) => r.kind !== 'stub' && !r.pass_only && r.price != null));
  const help = read('src/play/help/help-content.ts');
  assert.ok(!/Paid rows are not for sale/.test(help), 'the Store help card no longer talks about paid rows');
  ok('a player sees the Token shop only: no stubs, no pass rows, no paid tab, no price labels');
}

// --- save -------------------------------------------------------------------------------------------------
{
  assert.equal(HIDEOUT_SAVE_VERSION, 33);
  assert.equal(base.version, 33);
  const src = read('src/play/playStore.ts');
  assert.ok(/pet_merge_note:\s*PetMergeNote \| null/.test(src), 'the merge note is the only saved shape that grew (two optional fields)');
  ok('save stays v33 (the merge note gained two optional fields; older bundles ignore them)');
}

console.log(`\ncheck:economy-guard — ${passed} groups passed.`);
