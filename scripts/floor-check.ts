/**
 * Floor-requirements checks (Stage 8 handoff #4).
 * Run: npx tsx scripts/floor-check.ts
 *
 * Verifies privacy labels agree with PrivacyInfo.xcprivacy, Sage is labeled
 * coach on the surfaces that speak, Sentry is wired for JS + native, and the
 * quota empty copy is the honest-empty string.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  \u2713 ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function collectedTypesFromPlist(plist: string): string[] {
  const types: string[] = [];
  const re =
    /<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)<\/string>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(plist))) types.push(match[1]);
  return types;
}

function apiReasonsFromPlist(plist: string): Record<string, string[]> {
  const blocks = plist.split('<key>NSPrivacyAccessedAPIType</key>').slice(1);
  const out: Record<string, string[]> = {};
  for (const block of blocks) {
    const type = /<string>(NSPrivacyAccessedAPICategory[^<]+)<\/string>/.exec(block)?.[1];
    if (!type) continue;
    const reasons = [...block.matchAll(/<string>([A-Z0-9]{4}\.\d)<\/string>/g)].map((m) => m[1]);
    out[type] = reasons;
  }
  return out;
}

const appJson = JSON.parse(read('app.json')) as {
  expo: {
    ios: {
      privacyManifests: {
        NSPrivacyTracking: boolean;
        NSPrivacyCollectedDataTypes: Array<{
          NSPrivacyCollectedDataType: string;
          NSPrivacyCollectedDataTypeLinked: boolean;
          NSPrivacyCollectedDataTypeTracking: boolean;
        }>;
        NSPrivacyAccessedAPITypes: Array<{
          NSPrivacyAccessedAPIType: string;
          NSPrivacyAccessedAPITypeReasons: string[];
        }>;
      };
    };
    plugins: unknown[];
  };
};
const manifests = appJson.expo.ios.privacyManifests;
const privacyPlist = read('PrivacyInfo.xcprivacy');
const labels = read('src/app/legal/app-privacy-labels.md');
const policy = read('src/app/legal/privacy.md');
const widgetPlist = read('targets/widget/PrivacyInfo.xcprivacy');

assert.equal(manifests.NSPrivacyTracking, false);
assert.match(privacyPlist, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
assert.match(widgetPlist, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
ok('NSPrivacyTracking is false in app.json, app PrivacyInfo, and widget PrivacyInfo');

const EXPECTED_TYPES = [
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypeCustomerSupport',
  'NSPrivacyCollectedDataTypeProductInteraction',
  'NSPrivacyCollectedDataTypeOtherUsageData',
  'NSPrivacyCollectedDataTypeCrashData',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
  'NSPrivacyCollectedDataTypeDeviceID',
];
const jsonTypes = manifests.NSPrivacyCollectedDataTypes.map((t) => t.NSPrivacyCollectedDataType);
const plistTypes = collectedTypesFromPlist(privacyPlist);
assert.deepEqual(jsonTypes, EXPECTED_TYPES);
assert.deepEqual(plistTypes, jsonTypes);
assert.equal(collectedTypesFromPlist(widgetPlist).length, 0);
for (const type of jsonTypes) {
  assert.match(labels, new RegExp(type.replace('NSPrivacyCollectedDataType', '')));
}
ok('collected data types match across PrivacyInfo.xcprivacy, app.json, and nutrition-label doc');

assert.match(policy, /Supabase/);
assert.match(policy, /Gemini/);
assert.match(policy, /Resend/);
assert.match(policy, /not end-to-end encrypted/i);
assert.match(labels, /Supabase/);
assert.match(labels, /Gemini/);
assert.match(labels, /Resend/);
assert.match(labels, /Apple/);
assert.match(labels, /Sentry/);
ok('privacy.md and nutrition labels name the third parties');

assert.equal(
  manifests.NSPrivacyCollectedDataTypes.every((t) => t.NSPrivacyCollectedDataTypeTracking === false),
  true,
);
ok('no collected type is marked for tracking');

const plistApis = apiReasonsFromPlist(privacyPlist);
for (const api of manifests.NSPrivacyAccessedAPITypes) {
  assert.deepEqual(plistApis[api.NSPrivacyAccessedAPIType], api.NSPrivacyAccessedAPITypeReasons);
}
assert.ok(plistApis.NSPrivacyAccessedAPICategoryUserDefaults?.includes('CA92.1'));
assert.ok(plistApis.NSPrivacyAccessedAPICategoryUserDefaults?.includes('C56D.1'));
assert.ok(plistApis.NSPrivacyAccessedAPICategoryFileTimestamp?.includes('3B52.1'));
assert.ok(plistApis.NSPrivacyAccessedAPICategorySystemBootTime?.includes('35F9.1'));
assert.deepEqual(plistApis.NSPrivacyAccessedAPICategoryFileTimestamp, ['3B52.1', 'C617.1']);
ok('required-reason API codes match, including App Group UserDefaults C56D.1');

assert.match(widgetPlist, /C56D\.1/);
ok('widget PrivacyInfo declares App Group UserDefaults C56D.1');

const sage = read('src/app/(tabs)/sage.tsx');
const home = read('src/app/(tabs)/index.tsx');
const push = read('src/lib/push-copy.ts');
const widget = read('targets/widget/widgets.swift');
const copy = read('src/lib/sage-copy.ts');
assert.match(copy, /Sage is a coach, not a person/);
assert.match(sage, /TALK_LEDE/);
assert.match(home, /HOME_SAGE_LEDE/);
assert.match(home, /SAGE_COACH_LABEL/);
assert.match(push, /Sage · coach/);
assert.match(widget, /SAGE · COACH/);
assert.doesNotMatch(sage, /Sage listens/);
ok('Talk, Home, push, and widget label Sage as a coach and do not say Sage listens');

const sentryLib = read('src/lib/sentry.ts');
assert.match(sentryLib, /enableNative:\s*Platform\.OS !== 'web'/);
assert.match(sentryLib, /enableNativeCrashHandling:\s*Platform\.OS !== 'web'/);
assert.match(sentryLib, /nativeCrash/);
const plugins = JSON.stringify(appJson.expo.plugins);
assert.match(plugins, /@sentry\/react-native\/expo/);
assert.match(plugins, /ato-app/);
assert.match(read('src/app/_layout.tsx'), /Sentry\.wrap/);
ok('Sentry JS init + native crash handling + Expo plugin + wrap are wired');

const quota = read('src/lib/voice/quota.ts');
assert.match(quota, /Sage's out of things to say for today, back tomorrow/);
assert.match(sage, /QUOTA_EMPTY_MESSAGE/);
assert.match(sage, /kind === 'quota'/);
ok('quota honest-empty copy is wired to Talk, not a raw error');

console.log(`\n${passed} checks passed`);
