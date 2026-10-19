/**
 * Today (Divecore finish step 4, emci 2026-10-18).
 * Run: npm run check:today-chip
 *
 * - The list shows each thing only in the right state, in a fixed order.
 * - Dive counts only when the charges are FULL (and never during a dive); the Store, the daily check-in, the
 *   Tide calendar and room builds are deliberately NOT here.
 * - Calm copy: no urgency words, no "!", no countdown digits, no streak, no "starving", no red anywhere.
 * - The free-egg count uses the same rule as the "free eggs ready" reminder.
 * - The sheet and the dock button are wired, add no timer, and the save is still v33.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HIDEOUT_SAVE_VERSION } from '../src/play/hideout-progress';
import { PET_STATUSES, type PetStatus } from '../src/play/pet-status';
import { freeEggsWaiting, todayItems, TODAY_CAUGHT_UP, TODAY_FOOT, type TodayInput } from '../src/play/today';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const calm: TodayInput = {
  name: 'Kael',
  researchFinds: 0,
  status: 'okay',
  freeEggs: 0,
  expedition: 'locked',
  tripBack: false,
  visitorHere: false,
  diveFull: false,
  diveActive: false,
};
const ids = (over: Partial<TodayInput>) => todayItems({ ...calm, ...over }).map((i) => i.id);

// --- each row only in its state ------------------------------------------------------------------------
{
  assert.deepEqual(todayItems(calm), [], 'nothing ready → an empty list (the sheet says "All caught up")');
  assert.deepEqual(ids({ researchFinds: 3 }), ['research']);
  assert.equal(todayItems({ ...calm, researchFinds: 1 })[0].text, 'Research: 1 find ready');
  assert.equal(todayItems({ ...calm, researchFinds: 6 })[0].text, 'Research: 6 finds ready');
  assert.deepEqual(ids({ status: 'hungry' }), ['care_feed']);
  assert.deepEqual(ids({ status: 'starving' }), ['care_feed']);
  assert.deepEqual(ids({ status: 'sad' }), ['care_play']);
  assert.deepEqual(ids({ status: 'very_sad' }), ['care_play']);
  for (const s of PET_STATUSES) {
    if (['hungry', 'starving', 'sad', 'very_sad'].includes(s)) continue;
    assert.deepEqual(ids({ status: s as PetStatus }), [], `status ${s} adds no care row`);
  }
  assert.equal(todayItems({ ...calm, freeEggs: 1 })[0].text, 'A free egg is waiting');
  assert.equal(todayItems({ ...calm, freeEggs: 3 })[0].text, 'Free eggs: 3 waiting');
  assert.deepEqual(ids({ expedition: 'ready' }), ['trip_ready']);
  assert.deepEqual(ids({ expedition: 'away' }), [], 'out on a trip: nothing to do');
  assert.deepEqual(ids({ expedition: 'done_today' }), []);
  assert.deepEqual(ids({ expedition: 'locked' }), []);
  assert.deepEqual(ids({ tripBack: true }), ['trip_back']);
  assert.deepEqual(ids({ tripBack: true, expedition: 'ready' }), ['trip_back', 'trip_ready'], 'a fresh return and "send again" are both listed');
  assert.deepEqual(ids({ visitorHere: true }), ['visitor']);
  ok('each row shows only in its own state; away / done / too young show nothing');
}

// --- dive: only at the cap -----------------------------------------------------------------------------
{
  assert.deepEqual(ids({ diveFull: true }), ['dive_full']);
  assert.deepEqual(ids({ diveFull: false }), [], 'charges below the cap never count (they refill all day)');
  assert.deepEqual(ids({ diveFull: true, diveActive: true }), [], 'no Dive row during a dive');
  ok('Dive counts only when the charges are full, and never mid-dive');
}

// --- fixed order ---------------------------------------------------------------------------------------
{
  const all = todayItems({
    ...calm,
    researchFinds: 2,
    status: 'hungry',
    freeEggs: 2,
    expedition: 'ready',
    visitorHere: true,
    diveFull: true,
  });
  assert.deepEqual(
    all.map((i) => i.id),
    ['research', 'care_feed', 'eggs', 'trip_ready', 'visitor', 'dive_full'],
    'a fixed order, never reshuffled',
  );
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
  assert.deepEqual(all.map((i) => i.action), ['claim', 'feed', 'eggs', 'expedition', 'visitor', 'dive']);
  ok('a fixed order and one action per row');
}

// --- left out on purpose + calm copy ---------------------------------------------------------------------
{
  const every = todayItems({ ...calm, researchFinds: 2, status: 'sad', freeEggs: 2, expedition: 'ready', tripBack: true, visitorHere: true, diveFull: true });
  const words = every.flatMap((i) => [i.text, i.button]).concat([TODAY_CAUGHT_UP, TODAY_FOOT]).join(' ');
  assert.ok(!/[!]/.test(words), 'no exclamation marks');
  assert.ok(!/\d{1,2}:\d{2}|\b\d+\s?(s|m|h|min|sec|hours?|minutes?)\b/i.test(words), 'no countdown');
  assert.ok(!/urgent|hurry|last chance|don.t miss|streak|expires?|running out|starving|dying|lonely|abandon|neglect|only \d/i.test(words.replace(TODAY_FOOT, '')), 'no pressure or guilt words');
  assert.ok(/nothing here is urgent/i.test(TODAY_FOOT), 'the footer says nothing is urgent');
  const src = read('src/play/today.ts') + read('src/play/today-sheet.tsx');
  assert.ok(!/store|shop|check-?in|tide|build/i.test(every.map((i) => `${i.text} ${i.button}`).join(' ')), 'no Store / check-in / Tide / build row text');
  assert.ok(
    read('src/play/pet-screen.tsx').includes('tripBack: pv.expeditionNote != null && pv.expeditionNoteFresh'),
    'an old, never-dismissed trip note must not keep the count lit (only a fresh return counts)',
  );
  assert.ok(!/#e5484d|STREET\.red|NEON\.pink|danger/i.test(read('src/play/today-sheet.tsx')), 'the sheet uses no red');
  assert.ok(!/setInterval|setTimeout|useEffect|Animated|withTiming|withRepeat/.test(src), 'no timer, effect or animation');
  ok('calm copy: no "!", no countdown, no pressure words, no red, no Store / check-in / Tide / build row, no timer');
}

// --- the egg rule ------------------------------------------------------------------------------------------
{
  assert.equal(freeEggsWaiting('egg', null, 0, 2, 0), 2, 'egg picker open, next egg free: the free eggs left');
  assert.equal(freeEggsWaiting('egg', null, 0, 2, 1), 1);
  assert.equal(freeEggsWaiting('egg', null, 10, 2, 2), 0, 'the next egg costs something: none free');
  assert.equal(freeEggsWaiting('egg', 'village', 0, 2, 0), 0, 'an egg is already chosen');
  assert.equal(freeEggsWaiting('baby', null, 0, 2, 0), 0, 'past the egg stage');
  assert.equal(freeEggsWaiting('egg', null, null, 2, 0), 0, 'no next price (maxed today)');
  const pet = read('src/play/pet-screen.tsx');
  assert.ok(/stage === 'egg' && v\.pet\.state\.egg == null && v\.pet\.eggDay\.nextPrice === 0/.test(pet), 'the reminder rule is unchanged (this mirrors it)');
  ok('free eggs: the same rule as the "free eggs ready" reminder');
}

// --- wired -------------------------------------------------------------------------------------------------
{
  const pet = read('src/play/pet-screen.tsx');
  assert.ok(pet.includes("<PlaySheet open={sheet === 'today'}") && pet.includes('<TodaySheetBody items={todayList} onAction={onTodayAction} />'), 'the sheet shows the list');
  assert.ok(pet.includes('label="Today"') && pet.includes('badgeCount={todayList.length}'), 'the dock button carries the count');
  assert.ok(pet.includes("badgeNoun={todayList.length === 1 ? 'thing ready' : 'things ready'}"), 'the screen reader hears "n things ready"');
  assert.ok(/onClaimResearch\?\.\(\)/.test(pet) && read('src/app/play.tsx').includes('onClaimResearch={handleClaim}'), 'the Claim row makes the same claim as the top bar');
  assert.ok(pet.includes('canClaimResearch(view) ? view.research.readyFinds : 0'), 'research counts only when a claim is possible');
  const sheet = read('src/play/today-sheet.tsx');
  assert.ok(sheet.includes('TODAY_CAUGHT_UP') && sheet.includes('TODAY_FOOT'), 'the empty and footer lines are shown');
  assert.equal(HIDEOUT_SAVE_VERSION, 33);
  ok('wired: dock button + count, the existing sheet, the same Claim as the top bar; save stays v33 (nothing stored)');
}

console.log(`\ncheck:today-chip — ${passed} groups passed.`);
