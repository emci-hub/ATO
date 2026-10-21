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
 * Launch flip (master-plan Step 12, emci 2026-10-20): off. Local dev builds
 * still get the dev tools through `__DEV__` in DEV_TOOLS_AVAILABLE.
 */
export const PRE_LAUNCH_DEV = false;

/**
 * Whether dev tools exist in this build at all. False in a release build
 * (`PRE_LAUNCH_DEV` off, not a local dev build): the Hub's testing groups, the
 * DEV bubble and the AI lab then render nothing, whatever lock is opened.
 * `typeof` guard: Node check scripts import this file and have no `__DEV__`.
 */
export const DEV_TOOLS_AVAILABLE = PRE_LAUNCH_DEV || (typeof __DEV__ !== 'undefined' && __DEV__);

/**
 * Airport build — the Play loop shipped with every hero FREE (owned on Play load)
 * while the app was invite-only. Mirrors `PRE_LAUNCH_DEV`, so it is off since the
 * launch flip; `launchCleanSlate` (playStore.ts) takes the free roster back once.
 */
export const PLAY_EVERYTHING_FREE = PRE_LAUNCH_DEV;
