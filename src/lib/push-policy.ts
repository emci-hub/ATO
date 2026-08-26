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
