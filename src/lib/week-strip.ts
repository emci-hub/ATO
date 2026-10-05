/**
 * The Home week strip and the You "your week" card (polish pass, emci
 * 2026-10-05). Pure: built from the days the line was opened (lib/daily-line
 * state, already on the phone). A missed day is just an empty dot — no broken
 * counter, no "you lost your streak".
 */
import type { LineDay } from '@/lib/daily-line/pick';
import { addDaysYmd } from '@/lib/local-date';

export interface WeekDot {
  ymd: string;
  /** M T W T F S S */
  letter: string;
  opened: boolean;
  isToday: boolean;
  /** After today: drawn faint, never empty-and-blamed. */
  future: boolean;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Monday-first index (0 = Monday) of a YYYY-MM-DD. */
export function mondayIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function weekDots(todayYmd: string, days: readonly LineDay[]): WeekDot[] {
  const opened = new Set(days.map((day) => day.ymd));
  const start = addDaysYmd(todayYmd, -mondayIndex(todayYmd));
  return LETTERS.map((letter, i) => {
    const ymd = addDaysYmd(start, i);
    return {
      ymd,
      letter,
      opened: opened.has(ymd),
      isToday: ymd === todayYmd,
      future: ymd > todayYmd,
    };
  });
}

export interface WeekSummary {
  daysOpened: number;
  thatsMe: number;
}

/** The last seven days, today included. */
export function lastSevenDays(todayYmd: string, days: readonly LineDay[]): WeekSummary {
  const from = addDaysYmd(todayYmd, -6);
  const inWeek = days.filter((day) => day.ymd >= from && day.ymd <= todayYmd);
  return {
    daysOpened: new Set(inWeek.map((day) => day.ymd)).size,
    thatsMe: inWeek.filter((day) => day.reaction === 'me').length,
  };
}
