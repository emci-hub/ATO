/**
 * Dev Lab screen sections. Run: npm run check:dev-lab-sections
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

const homeHeading = hub.indexOf('<ThemedText type="smallBold">Home</ThemedText>');
const sageHeading = hub.indexOf('<ThemedText type="smallBold">Sage</ThemedText>');
const youHeading = hub.indexOf('<ThemedText type="smallBold">You</ThemedText>');
const systemHeading = hub.indexOf('<ThemedText type="smallBold">System</ThemedText>');
assert.ok(homeHeading >= 0, 'Home heading');
assert.ok(sageHeading >= 0, 'Sage heading');
assert.ok(youHeading >= 0, 'You heading');
assert.ok(systemHeading >= 0, 'System heading');
assert.ok(
  homeHeading < sageHeading && sageHeading < youHeading && youHeading < systemHeading,
  'section order is Home, Sage, You, System',
);
ok('all four section headings exist');

const homeBlock = hub.slice(homeHeading, sageHeading);
const afterHome = hub.slice(sageHeading);
assert.match(homeBlock, /<HomeOverrides \/>/);
assert.match(homeBlock, /<CardSimulator \/>/);
assert.match(hub, /Today slot override/);
assert.match(hub, /Ask kind override/);
assert.match(hub, /Today slot inputs/);
assert.match(hub, /crisisActive:/);
assert.match(hub, /noteOpenedToday:/);
assert.match(hub, /resolveTodaySlot/);
assert.doesNotMatch(afterHome, /<HomeOverrides \/>/);
assert.doesNotMatch(hub, /label: 'Card'/);
assert.doesNotMatch(hub, /section === 'card'/);
ok('Today slot and Ask kind overrides render under Home, not a Card section');

const youBlock = hub.slice(youHeading, systemHeading);
assert.match(youBlock, /<TraitViewer \/>/);
assert.match(youBlock, /<GrowthPreview \/>/);
assert.match(youBlock, /<BandDetailStepper \/>/);
assert.match(hub, /Growth preview/);
assert.match(hub, /check_count/);
assert.match(hub, /fact count/);
assert.match(hub, /Band detail/);
assert.doesNotMatch(youBlock, /recordCheck|addFact/);
assert.doesNotMatch(
  hub.slice(hub.indexOf('function BandDetailStepper'), hub.indexOf('function QuotaDashboard')),
  /mergeTraitWrite|updateIntake|traitPatch/,
);
ok('Growth preview and band detail stepper sit under You; neither writes Checks, facts, or traits');

assert.equal((hub.match(/<ForceTestError /g) ?? []).length, 4);
assert.match(hub, /Force test error/);
assert.match(hub, /Dev Lab test error — Home/);
assert.match(hub, /Dev Lab test error — Sage/);
assert.match(hub, /Dev Lab test error — You/);
assert.match(hub, /Dev Lab test error — System/);
ok('four Force test error triggers, one distinct message per section');

const sageBlock = hub.slice(sageHeading, youHeading);
const systemBlock = hub.slice(systemHeading);
assert.match(systemBlock, /<ResetAiConsent \/>/);
assert.match(hub, /reset to null/);
assert.match(hub, /\.update\(\{ ai_consent: null \}\)/);
assert.doesNotMatch(homeBlock, /ResetAiConsent/);
assert.doesNotMatch(sageBlock, /ResetAiConsent/);
assert.doesNotMatch(youBlock, /ResetAiConsent/);
ok('Reset AI consent lives under System and writes ai_consent back to null');

assert.match(systemBlock, /__DEV__ \? <CrisisCardPreview \/>/);
assert.match(systemBlock, /Preview crisis card\./);
assert.match(hub, /function CrisisCardPreview/);
assert.match(hub, /<CrisisCard onDismiss=/);
assert.doesNotMatch(homeBlock, /CrisisCardPreview/);
assert.doesNotMatch(sageBlock, /CrisisCardPreview/);
assert.doesNotMatch(youBlock, /CrisisCardPreview/);
const previewFn = hub.slice(
  hub.indexOf('function CrisisCardPreview'),
  hub.indexOf('function QuotaDashboard'),
);
assert.doesNotMatch(previewFn, /detectCrisis/);
assert.doesNotMatch(previewFn, /logCrisisFlag/);
assert.doesNotMatch(previewFn, /crisis_flags/);
assert.doesNotMatch(previewFn, /routeTalkReply|from '@\/lib\/voice\/talk'/);
assert.doesNotMatch(previewFn, /from '@\/lib\/crisis\/detect'/);
assert.doesNotMatch(previewFn, /from '@\/lib\/crisis\/log'/);
const dawn = read('src/app/dawn.tsx');
const sage = read('src/app/(tabs)/sage.tsx');
assert.doesNotMatch(dawn, /CrisisCardPreview/);
assert.doesNotMatch(dawn, /Preview crisis card/);
assert.doesNotMatch(sage, /CrisisCardPreview/);
assert.doesNotMatch(sage, /Preview crisis card/);
ok('System crisis-card preview is fenced to /dev-lab and absent from Dawn and Sage');

assert.match(
  hub,
  /!canSeeDevLab\(\{\s*isDev: __DEV__,\s*isRoot: devAccess\.isRoot,\s*capabilities: devAccess\.capabilities,\s*\}\)/,
);
assert.match(hub, /Redirect href="\/"/);
ok('existing access guard is unchanged');

console.log(`\nAll ${passed} dev-lab-sections checks passed.`);
