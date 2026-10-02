/**
 * Pre-launch dev-mode switch.
 *
 * Dev/testing conveniences (labs, overrides, probes, dev traces, the Legends
 * test-persona strip) are ON for everyone while the app is invite-only and OTA
 * is the actual testing environment. Once this flips off, every dev tool is
 * gone for everyone — no PIN, password unlock or per-account grant opens one
 * (`DEV_TOOLS_AVAILABLE` below, `hubAccess` in lib/dev-access.ts). The only
 * thing left is the root-only Admin group, which the server enforces anyway.
 *
 * TODO(pre-launch): before `signup_mode` flips to `public`, set this to
 * `__DEV__` (or delete each feature). See PROJECT_CONTEXT.md "Pre-launch
 * re-gating checklist" for the full list of what this controls.
 */
export const PRE_LAUNCH_DEV = true;

/**
 * Whether dev tools exist in this build at all. False in a release build
 * (`PRE_LAUNCH_DEV` off, not a local dev build): the Hub's testing groups, the
 * DEV bubble and the AI lab then render nothing, whatever lock is opened.
 * `typeof` guard: Node check scripts import this file and have no `__DEV__`.
 */
export const DEV_TOOLS_AVAILABLE = PRE_LAUNCH_DEV || (typeof __DEV__ !== 'undefined' && __DEV__);

/**
 * Airport build — the Play loop ships with every hero FREE (owned on Play load,
 * no Premium gate) while the app is invite-only. Mirrors `PRE_LAUNCH_DEV`, so
 * it flips off at the same public-launch re-gate; a public build should never
 * hand out the whole hero roster for free.
 */
export const PLAY_EVERYTHING_FREE = PRE_LAUNCH_DEV;
