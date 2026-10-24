/**
 * Notification permission is asked exactly once, and only after the person has
 * loaded their first insight (insightCount >= 1), through a small sheet that
 * explains why. Not at onboarding. Not silently. A "no" is final from the
 * app's side — we never prompt again and never degrade the rest of the app.
 */
export function shouldAskNotificationPermission(input: {
  insightCount: number;
  alreadyAsked: boolean;
}): boolean {
  if (input.alreadyAsked) return false;
  return input.insightCount >= 1;
}

/** Copy for the ask sheet. No urgency, no guilt. */
export const NOTIFICATION_ASK_TITLE = 'Allow a reminder?';
export const NOTIFICATION_ASK_BODY =
  'ATO can send a short note when your daily insight is ready. You can turn this off later.';
export const NOTIFICATION_ASK_YES = 'Turn on';
export const NOTIFICATION_ASK_NO = 'Not now';

export interface PushWindow {
  morningHour: number;
  eveningHour: number;
}

/**
 * Expo/iOS calendar weekday numbering: 1 = Sunday ... 7 = Saturday (matches
 * the existing Sunday-recap trigger's `weekday: 1`).
 */
export const EVENING_WEEKDAYS = [3, 5, 1] as const; // Tue, Thu, Sun
export const INSIGHT_WEEKDAYS = [2, 6] as const; // Mon, Fri

export function isScheduledWeekday(weekdays: readonly number[], date: Date): boolean {
  return weekdays.includes(date.getDay() + 1);
}

/**
 * Daily push windows keyed off the self-report `energy_pattern` chip.
 * Earlier energy → earlier window; later energy → later window. A null or
 * unknown value keeps today's fixed default so existing rows never shift
 * until they answer the chip. Sunday stays fixed (weekly recap, not a
 * daily-rhythm nudge).
 */
export function pushWindowForEnergy(
  energyPattern: string | null | undefined,
): PushWindow {
  switch (energyPattern) {
    case 'morning':
      return { morningHour: 6, eveningHour: 19 };
    case 'afternoon':
      return { morningHour: 8, eveningHour: 20 };
    case 'evening':
      return { morningHour: 9, eveningHour: 21 };
    case 'night_owl':
      return { morningHour: 10, eveningHour: 22 };
    default:
      return { morningHour: 7, eveningHour: 20 };
  }
}
