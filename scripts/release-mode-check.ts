/**
 * check:release-mode — refuses a PRODUCTION build while PRE_LAUNCH_DEV is on.
 *
 * PRE_LAUNCH_DEV (src/lib/dev-mode.ts) deliberately un-gates dev/testing
 * conveniences so they work over OTA while the app is invite-only. Before a
 * public release it must be `false`. This is the one automated assertion that
 * replaces the 11-item manual "Pre-launch re-gating checklist".
 *
 * When it enforces:
 *   - EAS production builds: wired via the `eas-build-post-install` hook in
 *     package.json (EAS sets EAS_BUILD_PROFILE). Non-production profiles skip.
 *   - Manually: RELEASE_MODE=1 npm run check:release-mode
 *
 * Otherwise (local dev, the OTA gate) it only verifies the flag still exists
 * and prints its value, so it stays green in check:ota-gate today.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const devMode = readFileSync(resolve(__dirname, '../src/lib/dev-mode.ts'), 'utf8');
const match = devMode.match(/export const PRE_LAUNCH_DEV\s*=\s*(true|false)\s*;/);
assert.ok(match, 'PRE_LAUNCH_DEV must be a literal true/false in src/lib/dev-mode.ts');
const value = match[1] === 'true';

/**
 * The flag is only worth anything if every dev surface actually obeys it.
 * These run ALWAYS (not only on a production profile), so a new dev panel
 * that forgets the gate fails the OTA gate long before a release build.
 *
 * Rule (2026-10-01): with the flag off, the Hub's three testing groups, the
 * DEV bubble and the AI lab do not render for ANYONE — no PIN, password unlock
 * or per-account grant opens them. Root keeps the Admin group, which the
 * server enforces on its own.
 */
function src(rel: string): string {
  return readFileSync(resolve(__dirname, '..', rel), 'utf8');
}
let surfaceChecks = 0;
function pin(label: string, cond: boolean): void {
  assert.ok(cond, `release-mode: ${label}`);
  surfaceChecks += 1;
}

pin(
  'DEV_TOOLS_AVAILABLE is PRE_LAUNCH_DEV or a local dev build, nothing else',
  /export const DEV_TOOLS_AVAILABLE = PRE_LAUNCH_DEV \|\| \(typeof __DEV__ !== 'undefined' && __DEV__\);/.test(devMode),
);

const access = src('src/lib/dev-access.ts');
pin(
  'hubAccess answers admin for root and none for everyone else when tools are unavailable',
  access.includes("if (!input.toolsAvailable) return input.isRoot ? 'admin' : 'none';"),
);

const hub = src('src/app/dev-lab.tsx');
const hubEntry = hub.slice(hub.indexOf('export default function DevLabScreen()'), hub.indexOf('function DevLab('));
pin('the Hub route decides entry with hubAccess', hubEntry.includes('toolsAvailable: DEV_TOOLS_AVAILABLE,'));
pin('the Hub route redirects when access is none', /if \(access === 'none'\) \{\s*return <Redirect href="\/" \/>;/.test(hubEntry));
pin("the Hub renders its testing groups only for 'full' access", hub.includes("const tools = access === 'full';"));

// The Hub's render tree, cut into the three places a component can sit:
// before the `tools ?` branch, inside it, and the Admin section after it.
// A panel anywhere but inside the branch must be a root-only one.
const LAYOUT = ['ThemedView', 'SafeAreaView', 'ScrollView', 'View', 'ThemedText', 'RunningUpdateLine', 'HubSection'];
const components = (text: string) => [...text.matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)].map((m) => m[1]);
const renderAt = hub.indexOf('<ThemedView style={styles.container}>', hub.indexOf('function DevLab('));
const toolsAt = hub.indexOf('{tools ? (');
// 2026-10-03 reorganisation: groups are <HubSection title="…">.
const adminAt = hub.indexOf('<HubSection\n            title="Admin"');
const layoutEnd = hub.indexOf('function useTwoTap()');
pin('the Hub render tree was found', renderAt > 0 && toolsAt > renderAt && adminAt > toolsAt && layoutEnd > adminAt);
// The branch must close and the Admin section open with nothing in between.
const branchClose = "          ) : null}\n\n          <HubSection\n            title=\"Admin\"";
const closeAt = hub.indexOf(branchClose, toolsAt);
pin('the testing branch closes immediately before the Admin section', closeAt > toolsAt && closeAt < adminAt);
const headBlock = hub.slice(renderAt, toolsAt);
const testingBlock = hub.slice(toolsAt, closeAt);
const adminBlock = hub.slice(adminAt, layoutEnd);
const strays = components(headBlock).filter((name) => !LAYOUT.includes(name));
pin(`nothing but layout renders before the testing branch (found: ${strays.join(', ') || 'none'})`, strays.length === 0);
const adminPanels = components(adminBlock).filter((name) => !LAYOUT.includes(name));
pin(
  `the Admin group holds only root-gated panels (found: ${adminPanels.join(', ')})`,
  adminPanels.length > 0 &&
    adminPanels.every((name) => ['AccessReview', 'GrantsPanel', 'ProfilesPanel'].includes(name)),
);
for (const [panel, section] of [['AccessReview', 'access'], ['GrantsPanel', 'grants'], ['ProfilesPanel', 'profiles']] as const) {
  pin(`${panel} is gated on root`, adminBlock.includes(`{canSeeHubSection('${section}', gate) ? <${panel} /> : null}`));
}
pin(
  'the dev-test sign-up reset is not offered in a release build (it lives inside the testing branch)',
  testingBlock.includes('<ResetToFreshSignup />') && !adminBlock.includes('<ResetToFreshSignup'),
);
pin(
  'root-only sections need isRoot, not a capability',
  /if \(section === 'access' \|\| section === 'grants' \|\| section === 'profiles'\) \{\s*return input\.isRoot;/.test(access),
);
for (const panel of [
  'DevInspector', 'JumpThisAccount', 'StartOver', 'ResetAiConsent', 'LocalAccountData', 'ResetToFreshSignup',
  'BuildStrip', 'IntakeStatus', 'NextRoundPreview', 'TokensToday', 'MiniGuyPanel', 'MilestonesPanel',
  'CrisisTools', 'DraftCopyList', 'PushStatus', 'AppReloadPanel', 'LabsList',
]) {
  pin(`${panel} renders only inside the testing groups`, testingBlock.includes(`<${panel}`) && !adminBlock.includes(`<${panel}`));
}

const fab = src('src/components/app-dev-fab.tsx');
pin(
  'the DEV bubble needs full Hub access',
  fab.includes("canSeeHub: hubAccess({ toolsAvailable: DEV_TOOLS_AVAILABLE, ...gate }) === 'full',"),
);

for (const rel of ['src/app/ai-lab.tsx', 'src/components/running-update-line.tsx']) {
  const file = src(rel);
  pin(
    `${rel} uses the same gate as the Hub's testing groups`,
    file.includes('toolsAvailable: DEV_TOOLS_AVAILABLE,') && (file.includes("=== 'full'") || file.includes("!== 'full'")),
  );
  pin(`${rel} no longer opens on the pre-launch flag alone`, !file.includes('isDev: PRE_LAUNCH_DEV'));
}

for (const [fn, file] of [
  ['applyDevIntakeStagePreset', 'src/lib/dev-test-user.ts'],
  ['startOverMyTestData', 'src/lib/dev-test-user.ts'],
  ['resetDevTestUserToFreshSignup', 'src/lib/dev-test-user.ts'],
] as const) {
  const text = src(file);
  const body = text.slice(text.indexOf(`export async function ${fn}`));
  pin(`${fn} refuses to run when the flag is off`, body.slice(0, 400).includes('if (!PRE_LAUNCH_DEV) throw new Error'));
}
pin('the dev PIN is dead when the flag is off', src('src/lib/dev-pin.ts').includes('return PRE_LAUNCH_DEV && unlocked;'));
console.log(`release-mode: ${surfaceChecks} dev-surface gates verified`);

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const enforce = profile === 'production' || process.env.RELEASE_MODE === '1';

if (!enforce) {
  console.log(
    `release-mode: PRE_LAUNCH_DEV = ${value} (not enforced — profile "${profile || 'none'}", RELEASE_MODE unset)`,
  );
  console.log(`\n${surfaceChecks + 1} release-mode checks passed`);
  process.exit(0);
}

if (value) {
  console.error(
    'release-mode: FAIL — PRE_LAUNCH_DEV is true in src/lib/dev-mode.ts.\n' +
      'A production build would ship the dev labs, Home dev links, You-tab probes, ' +
      'Legends test-persona strip and Home slot/ask overrides to every user.\n' +
      'Set PRE_LAUNCH_DEV = false (see PROJECT_CONTEXT.md "Pre-launch re-gating checklist").',
  );
  process.exit(1);
}

console.log('release-mode: PRE_LAUNCH_DEV = false — production build allowed.');
console.log(`\n${surfaceChecks + 1} release-mode checks passed`);
