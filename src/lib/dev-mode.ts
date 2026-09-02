/**
 * Pre-launch dev-mode switch.
 *
 * Dev/testing conveniences (labs, overrides, probes, dev traces, the Legends
 * test-persona strip) are ON for everyone while the app is invite-only and OTA
 * is the actual testing environment. Dev-test-user cold-start auto-login stays
 * `__DEV__`-only on purpose (see `src/hooks/use-session.ts`); a manual
 * "Sign in as dev user" button covers OTA.
 *
 * TODO(pre-launch): before `signup_mode` flips to `public`, set this to
 * `__DEV__` (or delete each feature). See PROJECT_CONTEXT.md "Pre-launch
 * re-gating checklist" for the full list of what this controls.
 */
export const PRE_LAUNCH_DEV = true;
