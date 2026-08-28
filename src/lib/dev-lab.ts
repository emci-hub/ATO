/**
 * Pure helpers for the Dev Tools Hub. The screen is __DEV__-only; these
 * stay free of React Native so check:dev-lab can pin a calendar.
 */

import { BACKDATE_DAYS, journeyDay, openLogDays, type OpenLogDay } from '@/lib/check-window';
import { addDaysYmd } from '@/lib/local-date';
import type { CheckHistory, CheckStatus } from '@/lib/voice/types';
import type { TraitAxis, TraitSource, TraitState } from '@/lib/traits';
import { TRAIT_AXES, emptyTraitState } from '@/lib/traits';

export const DEV_LAB_STREAKS = [0, 1, 2, 3, 4, 7] as const;
export const DEV_LAB_GAPS = [1, 2, 3, 7] as const;

export const DEV_LAB_PATTERNS: {
  id: string;
  label: string;
  cells: readonly CheckStatus[];
}[] = [
  { id: 'all-did', label: 'all logged', cells: ['done', 'done', 'done', 'done'] },
  { id: 'skip-yesterday', label: 'skip yesterday', cells: ['done', 'done', 'done', 'skipped'] },
  { id: 'two-skips', label: 'two skips', cells: ['done', 'skipped', 'done', 'skipped'] },
  { id: 'break', label: 'streak break', cells: ['done', 'done', 'skipped'] },
];

export type ClosedMissedDay = {
  day: number;
  ymd: string;
  offset: number;
};

export function buildSimHistory(
  streak: number,
  pattern: readonly CheckStatus[],
): CheckHistory[] {
  const cells: CheckStatus[] = [...pattern];
  while (cells.length < streak) cells.unshift('done');
  return cells.map((status, index) => {
    const day = index + 1;
    return {
      day,
      status,
      read:
        status === 'done'
          ? `Day ${day} shown up. Sleep stayed in its lane.`
          : `Day ${day} skipped. Name sleep as the habit — not you.`,
      do: `After you make coffee, write one line about day ${day}.`,
    };
  });
}

/**
 * Last Check was `gapDays` ago. Offsets 0–2 that are empty stay loggable.
 * Offsets 3+ that were never logged are closed (beyond BACKDATE_DAYS).
 */
export function simulateGapWindow(opts: {
  checkCount: number;
  gapDays: number;
  todayYmd: string;
}): {
  epochYmd: string;
  todayDay: number;
  lastLoggedYmd: string | null;
  open: OpenLogDay[];
  closedMissed: ClosedMissedDay[];
} {
  const { checkCount, gapDays, todayYmd } = opts;
  const lastLoggedYmd = checkCount > 0 ? addDaysYmd(todayYmd, -gapDays) : null;
  const epochYmd =
    checkCount > 0 && lastLoggedYmd
      ? addDaysYmd(lastLoggedYmd, -(checkCount - 1))
      : addDaysYmd(todayYmd, -Math.max(0, gapDays));
  const loggedDays = Array.from({ length: checkCount }, (_, i) => i + 1);
  const todayDay = journeyDay(epochYmd, todayYmd);
  const open = openLogDays({ epochYmd, todayYmd, loggedDays });
  const closedMissed: ClosedMissedDay[] = [];
  for (let offset = BACKDATE_DAYS + 1; offset < gapDays; offset += 1) {
    const ymd = addDaysYmd(todayYmd, -offset);
    if (ymd < epochYmd) continue;
    const day = journeyDay(epochYmd, ymd);
    if (loggedDays.includes(day)) continue;
    closedMissed.push({ day, ymd, offset });
  }
  return { epochYmd, todayDay, lastLoggedYmd, open, closedMissed };
}

/** Fixture that makes slider-sticky vs later grid obvious at a glance. */
export function demoTraitState(): TraitState {
  const state = emptyTraitState();
  const values = { ...state.values };
  const sources: Partial<Record<TraitAxis, TraitSource>> = {};
  const write = (axis: TraitAxis, value: number, source: TraitSource) => {
    values[axis] = value;
    sources[axis] = source;
  };
  write('openness', 0.75, 'self_slider');
  write('conscientiousness', 0.25, 'self_slider');
  write('extraversion', 0.87, 'self_grid');
  write('agreeableness', 0.72, 'self_grid');
  write('steadiness', 0.5, 'self_slider');
  write('attachment_anxiety', 0.8, 'self_situation');
  write('attachment_avoidance', 0.2, 'self_situation');
  write('conflict_assertiveness', 0.8, 'self_situation');
  write('conflict_cooperativeness', 0.8, 'self_situation');
  return { values, sources, touched: {} };
}

export const DEV_LAB_AXIS_ORDER: readonly TraitAxis[] = TRAIT_AXES;
