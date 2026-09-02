import { PushTestCard } from '@/components/push-test-card';
import { SentryTestCard } from '@/components/sentry-test-card';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

/**
 * Crash + push probes. Required only from a `__DEV__` require() so Metro
 * drops this module from production / TestFlight bundles.
 */
export function YouDevTools({ timeZone }: { timeZone: string }) {
  if (!PRE_LAUNCH_DEV) return null;
  return (
    <>
      <PushTestCard timeZone={timeZone} />
      <SentryTestCard />
    </>
  );
}
