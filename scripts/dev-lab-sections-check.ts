/**
 * Dev Tools Hub layout. Run: npm run check:dev-lab-sections
 *
 * The Hub is grouped by what you are trying to do (2026-10-03, emci: "rearrange
 * dev properly"): a build strip, then My account / Move my account / Content /
 * This phone / AI / Labs / Admin, each a folding <HubSection>. This pins which
 * tool sits in which group, that the dead tools stay removed, and that nothing
 * here writes on a single tap.
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
const section = (title: string) => hub.indexOf(`<HubSection title="${title}"`) >= 0
  ? hub.indexOf(`<HubSection title="${title}"`)
  : hub.indexOf(`<HubSection\n                title="${title}"`) >= 0
    ? hub.indexOf(`<HubSection\n                title="${title}"`)
    : hub.indexOf(`<HubSection\n            title="${title}"`);

const ORDER = ['My account', 'Move my account', 'Content', 'This phone', 'AI', 'Labs', 'Admin'] as const;
const at = ORDER.map((title) => section(title));
ORDER.forEach((title, i) => assert.ok(at[i]! >= 0, `${title} section`));
for (let i = 1; i < at.length; i += 1) assert.ok(at[i - 1]! < at[i]!, `group order: ${ORDER[i - 1]} before ${ORDER[i]}`);
assert.ok(hub.indexOf('<BuildStrip />') > hub.indexOf('{tools ? (') && hub.indexOf('<BuildStrip />') < at[0]!, 'the build strip comes first');
ok('groups by intent (2026-10-03): build strip, My account, Move my account, Content, This phone, AI, Labs, Admin');

const layoutEnd = hub.indexOf('function useTwoTap()');
const block = (i: number) => hub.slice(at[i]!, i + 1 < at.length ? at[i + 1]! : layoutEnd);
const [mine, move, content, phone, ai, labs, admin] = ORDER.map((_, i) => block(i));

// My account: read-only.
for (const p of ['<DevInspector />', '<IntakeStatus />', '<NextRoundPreview />', '<TokensToday />', '<BandDetailStepper />']) {
  assert.ok(mine!.includes(p), `${p} under My account`);
}
assert.match(mine!, /canSeeHubSection\('traits', gate\) \? <TraitViewer \/>/);
for (const fn of ['TraitViewer', 'QuotaDashboard']) {
  const body = hub.slice(hub.indexOf(`function ${fn}() {`), hub.indexOf('\nfunction ', hub.indexOf(`function ${fn}() {`) + 10));
  assert.doesNotMatch(body, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(/, `${fn} must stay read-only`);
}
const panels = read('src/components/dev-hub-panels.tsx');
for (const fn of ['IntakeStatus', 'NextRoundPreview', 'TokensToday', 'DraftCopyList', 'BuildStrip']) {
  const start = panels.indexOf(`export function ${fn}(`);
  const body = panels.slice(start, panels.indexOf('\nexport function ', start + 10));
  assert.doesNotMatch(body, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(|forgetCelebratedMilestone/, `${fn} must stay read-only`);
}
assert.doesNotMatch(
  hub.slice(hub.indexOf('function BandDetailStepper'), hub.indexOf('function JumpThisAccount')),
  /mergeTraitWrite|updateIntake|traitPatch|\.update\(|\.rpc\(/,
  'the band stepper is read-only',
);
ok('My account: inspector, intake set, next-round preview, tokens today, raw traits, bands — read-only');

// Move my account: the three account writers, nothing else.
assert.equal((move!.match(/<[A-Z][A-Za-z]+ \/>/g) ?? []).join(' '), '<JumpThisAccount /> <StartOver /> <ResetToFreshSignup />');
ok('Move my account: jump, Start over, delete-profile-and-re-run-sign-up, nothing else');

for (const p of ['<MiniGuyPanel />', '<MilestonesPanel />', '<CrisisTools />', '<DraftCopyList />']) assert.ok(content!.includes(p), `${p} under Content`);
assert.match(content!, /<DailyLineDev userId=/);
assert.match(content!, /canSeeHubSection\('fence', gate\) \? <FenceTester \/>/);
for (const p of ['<PushStatus />', '<AppReloadPanel />', '<LocalAccountData />', '<ResetAiConsent />']) assert.ok(phone!.includes(p), `${p} under This phone`);
assert.match(phone!, /<YouDevTools timeZone=/);
assert.match(phone!, /canSeeHubSection\('trace', gate\) \? <TraceCapture \/>/);
assert.match(ai!, /canSeeHubSection\('quota', gate\) \? <QuotaDashboard \/>/);
assert.ok(ai!.includes('<QuestionLabPanel />'), 'Question lab under AI (forever loop testing, 2026-10-05)');
assert.ok(labs!.includes('<LabsList />'));
ok('Content, This phone, AI and Labs hold their tools, each behind its capability where it has one');

assert.match(admin!, /\{canSeeHubSection\('access', gate\) \? <AccessReview \/> : null\}/);
assert.match(admin!, /\{canSeeHubSection\('grants', gate\) \? <GrantsPanel \/> : null\}/);
assert.match(admin!, /\{canSeeHubSection\('profiles', gate\) \? <ProfilesPanel \/> : null\}/);
for (const panel of ['ResetAiConsent', 'LocalAccountData', 'JumpThisAccount', 'StartOver', 'ResetToFreshSignup']) {
  assert.doesNotMatch(admin!, new RegExp(`<${panel}`), `${panel} is not an admin tool`);
}
ok('Admin: access requests, grants, pause / delete — root only');

// Removed 2026-10-03: Explore regenerate spent real AI quota on a feature the
// app no longer uses; Force test error duplicated the crash test in You tools.
for (const gone of ['ExploreRegen', 'ForceTestError', 'routeExplore', 'generateExploreBody']) {
  assert.ok(!hub.includes(gone), `${gone} is gone from the Hub`);
}
assert.ok(!read('src/components/app-dev-fab.tsx').includes('ExploreRegen'), 'and from the DEV bubble');
ok('Explore regenerate and the duplicate Force test error are removed');

// The one write in the new panels: forgetting a milestone takes two taps and
// is pre-launch only on the client.
{
  const start = panels.indexOf('export function MilestonesPanel(');
  const body = panels.slice(start, panels.indexOf('const COPY_FLAGS', start));
  const confirmAt = body.indexOf('if (!me || !twoTap.confirm(id)) return;');
  assert.ok(confirmAt >= 0 && confirmAt < body.indexOf('await forgetCelebratedMilestone('), 'forget a milestone: two taps first');
  const me = read('src/lib/me.ts');
  const fn = me.slice(me.indexOf('export async function forgetCelebratedMilestone('));
  assert.match(fn.slice(0, 400), /if \(!PRE_LAUNCH_DEV\) throw new Error/, 'forgetCelebratedMilestone is pre-launch only');
  ok('forgetting a milestone takes two taps and is pre-launch only');
}

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
const twoTap = hub.slice(hub.indexOf('function useTwoTap()'), hub.indexOf('function TraitViewer('));
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
