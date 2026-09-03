/**
 * Pre-launch dev-mode switch.
 *
 * Dev/testing conveniences (labs, overrides, probes, dev traces, the Legends
 * test-persona strip) are ON for everyone while the app is invite-only and OTA
 * is the actual testing environment. Once this flips off, Dev Tools Hub access
 * still works for root, a per-account grant, or the hidden password unlock
 * behind the 7-tap version number (`components/dev-unlock-gate.tsx`,
 * `lib/dev-access-unlock.ts`) — there is no dev-user sign-in path anymore.
 *
 * TODO(pre-launch): before `signup_mode` flips to `public`, set this to
 * `__DEV__` (or delete each feature). See PROJECT_CONTEXT.md "Pre-launch
 * re-gating checklist" for the full list of what this controls.
 */
export const PRE_LAUNCH_DEV = true;
