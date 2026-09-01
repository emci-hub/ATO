/**
 * Notification permission is asked exactly once, and only after the first
 * real Check exists (check_count >= 1). Not at onboarding. Not before the
 * first card has been logged. A "no" is final from the app's side — we never
 * prompt again and never degrade the rest of the app.
 */
export function shouldAskNotificationPermission(input: {
  checkCount: number;
  alreadyAsked: boolean;
}): boolean {
  if (input.alreadyAsked) return false;
  return input.checkCount >= 1;
}

export interface PushWindow {
  morningHour: number;
  eveningHour: number;
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
