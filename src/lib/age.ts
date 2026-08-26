/** App floor. Under this, account creation is blocked with a clear error. */
export const MIN_APP_AGE_YEARS = 16;

/**
 * Wave 2 "going" on an 18+ night. Not enforced in UI yet — the stored
 * `born_on` date is what that gate will recompute from.
 */
export const NIGHT_GOING_AGE_YEARS = 18;

export const UNDER_16_MESSAGE = 'ATO is for people 16 and older.';
export const AGE_REQUIRED_MESSAGE = 'When were you born?';
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

/** Calendar date as `YYYY-MM-DD`, or an inline error. */
export function bornOnFromParts(yearRaw: string, monthRaw: string, dayRaw: string): BornOnParse {
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
  const [ty, tm, td] = todayParts();
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

export function isAtLeastAge(
  bornOn: string,
  years: number,
  today: Date = new Date(),
): boolean {
  return ageYearsOn(bornOn, today) >= years;
}

/** Inline onboarding error, or null if this date may create an account. */
export function signupAgeMessage(bornOn: string, today: Date = new Date()): string | null {
  if (ageYearsOn(bornOn, today) < MIN_APP_AGE_YEARS) return UNDER_16_MESSAGE;
  return null;
}

export function errorMessageForAge(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  if (code === 'P0005' || message.includes('age_under_16')) return UNDER_16_MESSAGE;
  if (code === 'P0003' || message.includes('age_required')) return AGE_REQUIRED_MESSAGE;
  if (code === 'P0004' || message.includes('age_invalid')) return AGE_INVALID_MESSAGE;
  return null;
}
