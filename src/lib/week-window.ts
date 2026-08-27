import { addDaysYmd, localYmd, weekdayInZone } from '@/lib/local-date';

export interface WeekWindow {
  /** Inclusive YYYY-MM-DD in the user's timezone. */
  startYmd: string;
  /** Exclusive YYYY-MM-DD in the user's timezone. */
  endYmdExclusive: string;
}

/**
 * The week Sunday recap talks about.
 *
 * Sunday morning is a recap of the week that just ended (previous Sun–Sat).
 * Any other day is the current week so far (this Sunday through today).
 */
export function recapWeekRange(now: Date, timeZone: string): WeekWindow {
  const today = localYmd(now, timeZone);
  const weekday = weekdayInZone(now, timeZone);
  if (weekday === 0) {
    return {
      startYmd: addDaysYmd(today, -7),
      endYmdExclusive: today,
    };
  }
  return {
    startYmd: addDaysYmd(today, -weekday),
    endYmdExclusive: addDaysYmd(today, 1),
  };
}

export function ymdInWindow(ymd: string, window: WeekWindow): boolean {
  return ymd >= window.startYmd && ymd < window.endYmdExclusive;
}

export interface WeekCheck {
  created_at: string;
  /** Calendar date the Check is for. Preferred over created_at. */
  logged_on?: string | null;
  read_text?: string | null;
  do_text?: string | null;
}

function checkYmd(check: WeekCheck, timeZone: string): string {
  if (check.logged_on) return check.logged_on;
  return localYmd(new Date(check.created_at), timeZone);
}

/** Checks whose logged-on calendar date falls in the recap window. */
export function checksInRecapWeek<T extends WeekCheck>(
  checks: T[],
  now: Date,
  timeZone: string,
): T[] {
  const window = recapWeekRange(now, timeZone);
  return checks.filter((check) => ymdInWindow(checkYmd(check, timeZone), window));
}
