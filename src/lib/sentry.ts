import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/** Public DSN (ingest-only). Keep the auth token out of the client bundle. */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const FLOOR_TEST_ERROR_MESSAGE = 'ATO floor-requirements Sentry test';

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN || undefined,
    enabled: SENTRY_DSN.length > 0,
    enableNative: Platform.OS !== 'web',
    enableNativeCrashHandling: Platform.OS !== 'web',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    attachStacktrace: true,
  });
}

/** JS-level test event. Returns the Sentry event id after flush. */
export async function sendFloorTestError(): Promise<string> {
  if (!SENTRY_DSN) {
    throw new Error('Sentry DSN is not set (EXPO_PUBLIC_SENTRY_DSN)');
  }
  const eventId = Sentry.captureException(new Error(FLOOR_TEST_ERROR_MESSAGE));
  await Sentry.flush(8000);
  if (!eventId) {
    throw new Error('Sentry did not assign an event id');
  }
  return eventId;
}

/** Native crash. __DEV__ only — release/TestFlight builds no-op. */
export function triggerNativeTestCrash(): void {
  if (!__DEV__) return;
  Sentry.nativeCrash();
}

export { Sentry };
