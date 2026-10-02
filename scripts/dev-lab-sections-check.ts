/**
 * Dev Tools Hub layout. Run: npm run check:dev-lab-sections
 *
 * The Hub is four groups, in the order they get used (2026-10-01, emci):
 * Where this account is / Jump this account / Test one thing / Admin. This
 * pins which tool sits in which group, that the dead tools stay removed, and
 * that nothing here writes on a single tap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const hub = read('src/app/dev-lab.tsx');
const heading = (name: string) => hub.indexOf(`<ThemedText type="smallBold">${name}</ThemedText>`);

const whereAt = heading('Where this account is');
const jumpAt = heading('Jump this account');
const testAt = heading('Test one thing');
const adminAt = heading('Admin');
for (const [name, at] of [['Where this account is', whereAt], ['Jump this account', jumpAt], ['Test one thing', testAt], ['Admin', adminAt]] as const) {
  assert.ok(at >= 0, `${name} heading`);
}
assert.ok(whereAt < jumpAt && jumpAt < testAt && testAt < adminAt, 'group order');
for (const old of ['Home', 'Sage', 'You', 'System']) {
  assert.equal(heading(old), -1, `the per-screen "${old}" section is gone`);
}
ok('four groups, in order: Where this account is, Jump this account, Test one thing, Admin');

const layoutEnd = hub.indexOf('function useTwoTap()');
const whereBlock = hub.slice(whereAt, jumpAt);
const jumpBlock = hub.slice(jumpAt, testAt);
const testBlock = hub.slice(testAt, adminAt);
const adminBlock = hub.slice(adminAt, layoutEnd);

// 1. Read-only.
assert.match(whereBlock, /<DevInspector \/>/);
assert.match(whereBlock, /canSeeHubSection\('traits', gate\) \? <TraitViewer \/>/);
assert.match(whereBlock, /canSeeHubSection\('quota', gate\) \? <QuotaDashboard \/>/);
for (const fn of ['TraitViewer', 'QuotaDashboard']) {
  const body = hub.slice(hub.indexOf(`function ${fn}() {`), hub.indexOf('\nfunction ', hub.indexOf(`function ${fn}() {`) + 10));
  assert.doesNotMatch(body, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(/, `${fn} must stay read-only`);
}
ok('Where this account is: inspector, raw traits, AI usage — read-only');

// 2. One menu, one reset.
assert.match(jumpBlock, /<JumpThisAccount \/>/);
assert.match(jumpBlock, /<StartOver \/>/);
assert.equal((jumpBlock.match(/<[A-Z][A-Za-z]+ \/>/g) ?? []).length, 2, 'nothing else lives in the jump group');
ok('Jump this account: the jump menu and Start over, nothing else');

// 3. Single-purpose probes, and exactly one Force test error.
for (const panel of ['ExploreRegen', 'BandDetailStepper', 'CrisisCardPreview', 'CrisisLocalFlagTest', 'ResetAiConsent', 'LocalAccountData']) {
  assert.match(testBlock, new RegExp(`<${panel} />`), `${panel} sits under Test one thing`);
}
assert.match(testBlock, /canSeeHubSection\('fence', gate\) \? <FenceTester \/>/);
assert.match(testBlock, /canSeeHubSection\('trace', gate\) \? <TraceCapture \/>/);
assert.match(testBlock, /<YouDevTools timeZone=/);
assert.equal((hub.match(/<ForceTestError /g) ?? []).length, 1, 'one Force test error, not one per section');
assert.match(testBlock, /<ForceTestError message="Dev Lab test error" \/>/);
assert.doesNotMatch(
  hub.slice(hub.indexOf('function BandDetailStepper'), hub.indexOf('function JumpThisAccount')),
  /mergeTraitWrite|updateIntake|traitPatch|\.update\(/,
  'the band stepper is read-only',
);
ok('Test one thing: the probes, the fence and trace behind their capability, one Force test error');

// 4. Admin is root-only panels and nothing else.
assert.match(adminBlock, /\{canSeeHubSection\('access', gate\) \? <AccessReview \/> : null\}/);
assert.match(adminBlock, /\{canSeeHubSection\('grants', gate\) \? <GrantsPanel \/> : null\}/);
assert.match(adminBlock, /\{canSeeHubSection\('profiles', gate\) \? <ProfilesPanel \/> : null\}/);
assert.match(adminBlock, /\{tools \? <ResetToFreshSignup \/> : null\}/);
for (const panel of ['ResetAiConsent', 'LocalAccountData', 'JumpThisAccount', 'StartOver', 'ExploreRegen']) {
  assert.doesNotMatch(adminBlock, new RegExp(`<${panel}`), `${panel} is not an admin tool`);
}
ok('Admin: access requests, grants, pause / delete and the dev-test sign-up reset');

// Dead tools stay removed: nothing read what they wrote.
for (const gone of [
  'HomeOverrides',
  'SlotReadout',
  'GrowthPreview',
  'HandleCollisionCheck',
  'Today slot override',
  'Ask kind override',
  'Growth preview',
  'Handle collision',
  'dev-overrides',
  'dev-growth-preview',
  'resolveTodaySlot',
]) {
  assert.ok(!hub.includes(gone), `${gone} is gone from the Hub`);
}
assert.doesNotMatch(hub, /Read \/ Do \/ Bump|Teach-Sage/, 'the fence tester no longer names parked features');
assert.match(hub, /sections=\{TRACE_SECTIONS\.filter\(\(row\) => row\.id !== 'talk'\)\}/, 'no Talk tab in Trace: Talk is a placeholder');
ok('slot / ask overrides, growth preview, handle-collision check and the Talk trace tab are removed');

// Nothing writes on one tap. Each writer asks useTwoTap first; the two
// irreversible deletes ask for the handle to be typed instead.
const twoTap = hub.slice(hub.indexOf('function useTwoTap()'), hub.indexOf('function ForceTestError('));
assert.match(twoTap, /if \(armed === id\) \{\s*setArmed\(null\);\s*return true;\s*\}/);
assert.match(twoTap, /setTimeout\(\(\) => setArmed\(\(cur\) => \(cur === id \? null : cur\)\), 5000\)/, 'the confirm disarms itself');
const fnBody = (name: string) => {
  const start = hub.indexOf(`function ${name}() {`);
  assert.ok(start >= 0, `${name} not found`);
  const next = hub.indexOf('\nfunction ', start + 10);
  return hub.slice(start, next > 0 ? next : undefined);
};
const guarded: [string, string, RegExp][] = [
  ['JumpThisAccount', 'applyDevIntakeStagePreset(stage', /if \(!twoTap\.confirm\(stage\)\) return;/],
  ['StartOver', 'startOverMyTestData()', /if \(!twoTap\.confirm\('start-over'\)\) return;/],
  ['ResetAiConsent', '.update({ ai_consent: null })', /if \(!twoTap\.confirm\('consent'\)\) return;/],
  ['LocalAccountData', 'clearLocalAccountData()', /if \(!twoTap\.confirm\('wipe'\)\) return;/],
  ['GrantsPanel', 'saveDevAccessGrants(', /if \(!twoTap\.confirm\(grantsKey\)\) return;/],
  ['ProfilesPanel', 'pauseProfile(', /if \(!twoTap\.confirm\(`pause:\$\{selected\.handle\}`\)\) return;/],
  ['ProfilesPanel', 'unpauseProfile(', /if \(!twoTap\.confirm\(`unpause:\$\{selected\.handle\}`\)\) return;/],
  ['AccessReview', 'approveAccessRequest(id)', /if \(!twoTap\.confirm\(`\$\{action\}:\$\{id\}`\)\) return;/],
];
for (const [panel, write, confirm] of guarded) {
  const body = fnBody(panel);
  const writeAt = body.indexOf(write);
  const confirmMatch = confirm.exec(body);
  assert.ok(writeAt >= 0, `${panel}: ${write} not found`);
  assert.ok(confirmMatch, `${panel}: no second-tap confirm`);
  assert.ok(confirmMatch.index < writeAt, `${panel}: the confirm must come before ${write}`);
}
assert.match(fnBody('ProfilesPanel'), /disabled=\{busy \|\| confirm !== selected\.handle\}/, 'delete still needs the handle typed');
assert.match(fnBody('ResetToFreshSignup'), /if \(busy \|\| confirm !== DEV_TEST_HANDLE\) return;/, 'the sign-up reset still needs the handle typed');
ok('every write takes two taps (jump, start over, AI consent, local wipe, grants, pause, unpause, approve, deny); deletes need the handle typed');

assert.match(hub, /function CrisisCardPreview/);
assert.match(hub, /<CrisisCard onDismiss=/);
const previewFn = fnBody('CrisisCardPreview');
assert.doesNotMatch(previewFn, /detectCrisis|logCrisisFlag|crisis_flags|from '@\/lib\/crisis\/detect'|from '@\/lib\/crisis\/log'/);
const sage = read('src/app/(tabs)/sage.tsx');
const home = read('src/app/(tabs)/index.tsx');
assert.doesNotMatch(home, /CrisisCardPreview|Preview crisis card/);
assert.doesNotMatch(sage, /CrisisCardPreview|Preview crisis card/);
ok('the crisis-card preview is fenced to /dev-lab and absent from Home and Sage');

// Entry: the dev PIN, the session unlock, root or a grant — and never in a
// release build (hubAccess; pinned in full by check:release-mode).
assert.match(
  hub,
  /const access = hubAccess\(\{\s*toolsAvailable: DEV_TOOLS_AVAILABLE,\s*isDev: __DEV__ \|\| devUnlocked \|\| pinUnlocked,\s*isRoot: devAccess\.isRoot,\s*capabilities: devAccess\.capabilities,\s*\}\);/,
);
assert.match(hub, /if \(access === 'none'\) \{\s*return <Redirect href="\/" \/>;/);
ok('access guard: dev PIN / session unlock / root / grant while dev tools exist; the pre-launch flag alone does not open the Hub');

console.log(`\nAll ${passed} dev-lab-sections checks passed.`);
