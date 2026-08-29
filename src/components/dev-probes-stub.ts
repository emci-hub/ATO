/**
 * Production stand-in for You-tab crash/push probes.
 * Metro resolves the real probe modules here when NODE_ENV=production.
 */
export function YouDevTools(_props: { timeZone: string }): null {
  return null;
}

export function SentryTestCard(): null {
  return null;
}

export function PushTestCard(_props: { timeZone: string }): null {
  return null;
}
