/** App floor. Under this, account creation is blocked with a clear error. */
export const MIN_APP_AGE_YEARS = 18;

/**
 * Wave 2 "going" on an 18+ night. Enforced in Around + set_going from
 * `born_on`, never a stored 18+ boolean.
 */
export const NIGHT_GOING_AGE_YEARS = 18;

export const UNDER_18_MESSAGE = 'ATO is for people 18 and older.';
export const AGE_REQUIRED_MESSAGE = 'When were you born?';
export const CONFIRM_AGE_MESSAGE = 'Confirm your age first: add your birthday to join a night.';
export const AGE_INVALID_MESSAGE = "That doesn't look like a real date.";

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month] ?? 0;
}

export type BornOnParse =
  | { ok: true; bornOn: string }
  | { ok: false; message: string };

/** Calendar date as `YYYY-MM-DD`, or an inline error. `today` (device local date)
 *  only decides what counts as "in the future"; tests and the dev preview pass a fake one. */
export function bornOnFromParts(
  yearRaw: string,
  monthRaw: string,
  dayRaw: string,
  today: Date = new Date(),
): BornOnParse {
  const yearText = yearRaw.trim();
  const monthText = monthRaw.trim();
  const dayText = dayRaw.trim();
  if (!yearText || !monthText || !dayText) {
    return { ok: false, message: AGE_REQUIRED_MESSAGE };
  }
  if (!/^\d{4}$/.test(yearText) || !/^\d{1,2}$/.test(monthText) || !/^\d{1,2}$/.test(dayText)) {
    return { ok: false, message: AGE_INVALID_MESSAGE };
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, message: AGE_INVALID_MESSAGE };
  }
  const bornOn = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const [ty, tm, td] = todayParts(today);
  if (year > ty || (year === ty && (month > tm || (month === tm && day > td)))) {
    return { ok: false, message: AGE_INVALID_MESSAGE };
  }
  return { ok: true, bornOn };
}

function todayParts(today: Date = new Date()): [number, number, number] {
  return [today.getFullYear(), today.getMonth() + 1, today.getDate()];
}

/** Whole years of age on `today`, from a `YYYY-MM-DD` born_on. */
export function ageYearsOn(bornOn: string, today: Date = new Date()): number {
  const [year, month, day] = bornOn.split('-').map(Number);
  const [ty, tm, td] = todayParts(today);
  let age = ty - year;
  if (tm < month || (tm === month && td < day)) age -= 1;
  return age;
}

/** Fails closed: a missing, blank, malformed or future birthday is never "old enough". */
export function isAtLeastAge(
  bornOn: string | null | undefined,
  years: number,
  today: Date = new Date(),
): boolean {
  if (!isReadableBornOn(bornOn)) return false;
  const [year, month, day] = bornOn.split('-').map(Number);
  const [ty, tm, td] = todayParts(today);
  if (year > ty || (year === ty && (month > tm || (month === tm && day > td)))) return false;
  return ageYearsOn(bornOn, today) >= years;
}

/** A stored born_on that is a real calendar date (`YYYY-MM-DD`, month 1-12, day in month). */
export function isReadableBornOn(bornOn: string | null | undefined): bornOn is string {
  if (typeof bornOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(bornOn)) return false;
  const [year, month, day] = bornOn.split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * The age gate's three states (emci 2026-10-20, docs/under18-access.md):
 * - 'confirm': no usable birthday (null, empty, malformed, or a date after today).
 *   The app stays closed until they confirm their age once.
 * - 'blocked': a real birthday that makes them under 18 today (device local date).
 * - 'open':    18 or older today.
 * Worked out each time from born_on, never stored, so the same account opens
 * again by itself on the 18th birthday.
 */
export type AgeGateState = 'confirm' | 'blocked' | 'open';

export function ageGateFor(
  bornOn: string | null | undefined,
  today: Date = new Date(),
): AgeGateState {
  if (!isReadableBornOn(bornOn)) return 'confirm';
  const [year, month, day] = bornOn.split('-').map(Number);
  const [ty, tm, td] = todayParts(today);
  // A birthday after today cannot be real (sign-up and the server refuse one):
  // ask again instead of guessing.
  if (year > ty || (year === ty && (month > tm || (month === tm && day > td)))) return 'confirm';
  return ageYearsOn(bornOn, today) < MIN_APP_AGE_YEARS ? 'blocked' : 'open';
}

/**
 * The gate the app uses. A readable stored born_on always decides. When there
 * is none, `localEntry` is a date this person typed on the confirm screen in
 * this app session that was under 18 (it is never written to the server: the
 * client and the server guard both refuse an under-18 birthday). It only ever
 * turns 'confirm' into 'blocked'; it can never open the app.
 */
export function resolveAgeGate(
  bornOn: string | null | undefined,
  localEntry: string | null | undefined,
  today: Date = new Date(),
): { state: AgeGateState; bornOn: string | null } {
  const stored = ageGateFor(bornOn, today);
  if (stored !== 'confirm') return { state: stored, bornOn: bornOn ?? null };
  if (ageGateFor(localEntry, today) === 'blocked') return { state: 'blocked', bornOn: localEntry ?? null };
  return { state: 'confirm', bornOn: null };
}

/** True only for a readable birthday that is under 18 today. Missing dates are 'confirm', not blocked. */
export function isBlockedForAge(
  bornOn: string | null | undefined,
  today: Date = new Date(),
): boolean {
  return ageGateFor(bornOn, today) === 'blocked';
}

/**
 * This app session's under-18 entry from the confirm screen, in memory only
 * (gone on relaunch or sign-out; never sent anywhere). Keyed by user id so it
 * can never follow another account on this phone.
 */
type LocalAgeEntry = { userId: string; bornOn: string } | null;
let localAgeEntry: LocalAgeEntry = null;
const localAgeListeners = new Set<() => void>();

export function getLocalAgeEntry(): LocalAgeEntry {
  return localAgeEntry;
}

export function setLocalAgeEntry(next: LocalAgeEntry): void {
  localAgeEntry = next;
  for (const listener of localAgeListeners) listener();
}

export function subscribeLocalAgeEntry(listener: () => void): () => void {
  localAgeListeners.add(listener);
  return () => {
    localAgeListeners.delete(listener);
  };
}

/** The entered date for this user only. */
export function localAgeEntryFor(userId: string | null | undefined): string | null {
  return userId && localAgeEntry?.userId === userId ? localAgeEntry.bornOn : null;
}

/**
 * The day a blocked person gets back in: their 18th birthday as `YYYY-MM-DD`.
 * A 29 Feb birthday opens on 1 Mar in a non-leap year, the same day
 * `ageYearsOn` (and the server's is_at_least_age) first counts them as 18.
 */
export function accessDateFor(bornOn: string): string {
  const [year, month, day] = bornOn.split('-').map(Number);
  const y = year + MIN_APP_AGE_YEARS;
  let m = month;
  let d = day;
  if (d > daysInMonth(y, m)) {
    d = 1;
    m += 1;
    if (m > 12) return `${y + 1}-01-01`;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** A stored `YYYY-MM-DD` as a long date in the phone's locale ("20 October 2027"). */
export function formatDateForLocale(iso: string, locale?: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  try {
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return formatBornOnDisplay(iso);
  }
}

/** Inline onboarding error, or null if this date may create an account. */
export function signupAgeMessage(
  bornOn: string | null | undefined,
  today: Date = new Date(),
): string | null {
  if (!isReadableBornOn(bornOn)) return bornOn ? AGE_INVALID_MESSAGE : AGE_REQUIRED_MESSAGE;
  if (!isAtLeastAge(bornOn, MIN_APP_AGE_YEARS, today)) return UNDER_18_MESSAGE;
  return null;
}

export function errorMessageForAge(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  // 'age_under_16' = the server before wave99b; 'age_under_18' = after.
  if (code === 'P0005' || message.includes('age_under_16') || message.includes('age_under_18')) {
    return UNDER_18_MESSAGE;
  }
  if (code === 'P0003' || message.includes('age_required')) return AGE_REQUIRED_MESSAGE;
  if (code === 'P0004' || message.includes('age_invalid')) return AGE_INVALID_MESSAGE;
  return null;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Human display for a stored `YYYY-MM-DD`. Falls back to the raw string. */
export function formatBornOnDisplay(bornOn: string): string {
  const [year, month, day] = bornOn.split('-').map(Number);
  const label = MONTH_SHORT[(month ?? 0) - 1];
  if (!year || !label || !day) return bornOn;
  return `${day} ${label} ${year}`;
}

export function partsFromBornOn(bornOn: string): { year: string; month: string; day: string } {
  const [year = '', month = '', day = ''] = bornOn.split('-');
  return { year, month, day };
}
