/**
 * Today (v22, Part B · T-B8) — the one-minute daily paths, as three short
 * lines read straight off the view (pure, no React):
 *   - TD only: clear a wave (shells + a heart), and collect the expedition —
 *     half the time a Power for your gear;
 *   - Pet only: the single most useful pet/Dive action right now (expedition,
 *     feed, dive, free dive) — shells and finds slowly make TD stronger;
 *   - Both: the loop — TD shells buy Dive gear, Dive finds Powers for TD.
 * Plus the next Dive-gear goal with its shell progress.
 */
import { DIVE_GEAR, DIVE_GEAR_COST, DIVE_GEAR_LABEL, SHELLS_PER_CLEAR } from '@/play/dive-loot';
import type { PlayView } from '@/play/playStore';

export type TodayPlan = { td: string; pet: string; both: string; goal: string };

export function todayPlan(view: PlayView): TodayPlan {
  const pv = view.pet;
  const st = pv.state;
  const expeditionReady = pv.expedition === 'ready';
  const pounce = pv.pounceBase > 0 ? ' and your pet pounces' : '';
  const heart = st.stage === 'egg' ? '' : ', +1 heart for your pet';
  const td = `TD: clear a wave — +${SHELLS_PER_CLEAR} shells${heart}${pounce}.${
    expeditionReady ? ' Send the expedition too (half the time it brings back a Power).' : ''
  }`;

  let pet: string;
  if (st.stage === 'egg') pet = 'Pet: it’s still an egg — a dive or two now fills its Logbook for later.';
  else if (expeditionReady) pet = 'Pet: send it on its expedition — one free find, back in an hour.';
  else if (!pv.away && st.hunger <= 1 && pv.pantryTotal > 0) pet = 'Pet: it’s hungry — tap Feed (pantry).';
  else if (!pv.away && st.hunger <= 1) pet = 'Pet: it’s hungry — play Catch the food.';
  else if (view.dive.current >= 1) pet = `Pet: dive together (${view.dive.current} charges) — finds, shells and +2 mood.`;
  else pet = `Pet: free dive for shells and mood (${view.freeDivesToday} today — the first 10 pay full).`;

  const both = 'Both: TD shells buy Dive gear; Dive finds Powers and food that make TD and your pet stronger.';

  const nextGear = DIVE_GEAR.find((g) => !view.diveGear[g]);
  const goal = nextGear
    ? `Next Dive gear: ${DIVE_GEAR_LABEL[nextGear]} — ${Math.min(view.shells, DIVE_GEAR_COST[nextGear])}/${DIVE_GEAR_COST[nextGear]} shells`
    : 'All Dive gear owned.';
  return { td, pet, both, goal };
}
