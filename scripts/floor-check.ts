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
  'NSPrivacyCollectedDataTypeDateOfBirth',
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
const dawn = read('src/app/dawn.tsx');
const push = read('src/lib/push-copy.ts');
const widget = read('targets/widget/widgets.swift');
const copy = read('src/lib/sage-copy.ts');
const consent = read('src/components/ai-consent-card.tsx');
const crisis = read('src/lib/crisis/copy.ts');
assert.match(copy, /Sage is a coach, not a person/);
assert.match(copy, /DAWN_SAGE_LEDE/);
assert.match(copy, /SAGE_NPC_LABEL/);
assert.match(copy, /Sage · npc/);
assert.match(sage, /TALK_LEDE/);
assert.match(sage, /SAGE_COACH_LABEL/);
assert.match(sage, /TALK_COMPOSER_PLACEHOLDER/);
assert.match(sage, /useTodayCard/);
assert.doesNotMatch(sage, /from '@\/lib\/voice\/router'/);
assert.doesNotMatch(sage, /routeVoiceCard/);
assert.doesNotMatch(sage, /Ask Sage anything/);
assert.doesNotMatch(sage, /Sage is writing/);
assert.doesNotMatch(sage, /Sage · npc/);
assert.match(home, /homeSageLede/);
assert.match(home, /SAGE_COACH_LABEL/);
assert.match(home, /homeSageLabel/);
assert.match(dawn, /DAWN_SAGE_LEDE/);
assert.doesNotMatch(dawn, /Sage · npc/);
assert.match(push, /Sage · coach/);
assert.match(widget, /SAGE · COACH/);
assert.match(consent, /Sage is a coach in the app, not a person/);
assert.match(crisis, /Sage is a coach, not emergency support/);
assert.doesNotMatch(sage, /Sage listens/);
assert.doesNotMatch(dawn, /Sage listens/);
assert.match(read('src/app/chat.tsx'), /Sage is a coach/);
ok('Talk, Home, Dawn, consent, crisis, push, widget, and Teach Sage label Sage as a coach; Quest Home may use npc');

assert.match(home, /No card yet/);
assert.doesNotMatch(home, /fake poster|Fake Person|open box|fake card media|fake ·/i);
assert.doesNotMatch(home, /<PixelFace/);
ok('Home has an honest empty card state and no Stage 1 fake fixtures');

const tabsLayout = read('src/app/(tabs)/_layout.tsx');
const navPixel = read('src/components/nav-pixel.tsx');
const poster = read('src/components/share-poster.tsx');
assert.match(tabsLayout, /<NavPixel/);
assert.match(navPixel, /position: 'absolute'/);
assert.match(navPixel, /insets\.top/);
assert.match(navPixel, /pickTapMood/);
assert.match(navPixel, /onPress=\{onTap\}/);
assert.doesNotMatch(navPixel, /pointerEvents="none"/);
assert.match(read('src/lib/kenney/tap-moods.ts'), /happyBounce/);
assert.match(read('src/lib/kenney/use-kenney-animation.ts'), /playTapMood/);
assert.doesNotMatch(poster, /PixelFace/);
assert.match(poster, /const STEEL/);
assert.match(poster, /const BLOOM/);
ok('nav companion is shell-mounted top-right; You poster has no large pixel');

const chrome = read('src/lib/theme/chrome.ts');
const crisisSrc = read('src/components/crisis-card.tsx');
assert.match(chrome, /controlBorderColor/);
assert.match(crisisSrc, /borderColor: theme\.accent/);
assert.match(sage, /NO_PINCH_ZOOM/);
assert.match(read('src/components/app-tabs.tsx'), /disableTransparentOnScrollEdge/);
assert.match(read('src/components/app-tabs.tsx'), /blurEffect="none"/);
assert.match(read('src/app/_layout.tsx'), /navigationTheme/);
assert.match(read('src/lib/theme/context.tsx'), /typeof Appearance\.setColorScheme === 'function'/);
assert.match(read('src/lib/theme/context.tsx'), /ready: boolean/);
assert.match(read('src/components/themed-tab-bar.tsx'), /backgroundColor: theme\.background/);
assert.doesNotMatch(read('src/components/themed-tab-bar.tsx'), /backgroundElement/);
assert.match(read('src/components/app-tabs.web.tsx'), /ThemedTabBar/);
ok('crisis dismiss uses accent border; outline controls share a visible hairline; Sage pinch-zoom is off; tab bar is opaque and appearance-themed');

const sentryLib = read('src/lib/sentry.ts');
assert.match(sentryLib, /enableNative:\s*Platform\.OS !== 'web'/);
assert.match(sentryLib, /enableNativeCrashHandling:\s*Platform\.OS !== 'web'/);
assert.match(sentryLib, /nativeCrash/);
const plugins = JSON.stringify(appJson.expo.plugins);
assert.match(plugins, /@sentry\/react-native\/expo/);
assert.match(plugins, /ato-app/);
assert.match(read('src/app/_layout.tsx'), /Sentry\.wrap/);
ok('Sentry JS init + native crash handling + Expo plugin + wrap are wired');

const youTab = read('src/app/(tabs)/you.tsx');
assert.doesNotMatch(youTab, /from '@\/components\/sentry-test-card'/);
assert.doesNotMatch(youTab, /from '@\/components\/push-test-card'/);
assert.match(youTab, /if \(__DEV__\) \{/);
assert.match(youTab, /require\('@\/components\/you-dev-tools'\)/);
assert.match(read('metro.config.js'), /NODE_ENV === 'production'/);
assert.match(sentryLib, /if \(!__DEV__\) return;/);
ok('You-tab crash/push probes are compile-time __DEV__ + Metro production stub, not a runtime hide');

assert.match(
  dawn,
  /<Modal[\s\S]*visible=\{needsConsentPrompt\}[\s\S]*<AiConsentCard[\s\S]*context="dawn"/,
);
assert.match(
  sage,
  /<Modal[\s\S]*visible=\{Boolean\(me\) && consent === 'pending'\}[\s\S]*<AiConsentCard[\s\S]*context="talk"/,
);
assert.doesNotMatch(dawn, /needsConsentPrompt \?\s*\([\s\S]*<AiConsentCard/);
assert.doesNotMatch(sage, /consent === 'pending' \?\s*\([\s\S]*<AiConsentCard/);
assert.match(sage, /Talk is off/);
assert.match(dawn, /setAiConsent/);
assert.match(sage, /setAiConsent/);
assert.match(youTab, /Sage's AI/);
assert.match(youTab, /'On'/);
assert.match(youTab, /'Off'/);
assert.match(youTab, /'Not set yet'/);
assert.match(youTab, /SettingsFold title="Account"/);
ok('AiConsentCard is a Modal interstitial on Dawn and Sage; You Account row is Sage\'s AI On/Off/Not set yet');

const weeksIdx = youTab.indexOf('<ThemedText type="smallBold">Weeks</ThemedText>');
const crisisPickerIdx = youTab.indexOf('<CrisisRegionPicker');
const bandsIdx = youTab.indexOf('<TraitBandsFold');
assert.ok(weeksIdx >= 0, 'Weeks row is present');
assert.ok(
  crisisPickerIdx > weeksIdx && bandsIdx > crisisPickerIdx,
  'CrisisRegionPicker sits directly after Weeks and before TraitBandsFold',
);
ok('CrisisRegionPicker sits directly after Weeks and before TraitBandsFold');

assert.match(home, /todayCardFromCheck/);
assert.match(read('src/lib/today-card.ts'), /export function todayCardFromCheck/);
ok('Home hydrates today\'s card from the Check row when on-device storage is empty');

const quota = read('src/lib/voice/quota.ts');
assert.match(quota, /Sage's out of things to say for today, back tomorrow/);
assert.match(sage, /QUOTA_EMPTY_MESSAGE/);
assert.match(sage, /kind === 'quota'/);
assert.match(sage, /kind === 'empty'/);
assert.match(sage, /claimAiCall/);
assert.match(read('src/lib/voice/talk.ts'), /const claim = deps\.claimAiCall/);
assert.match(read('src/lib/voice/talk.ts'), /containsFrameworkTerm/);
assert.match(read('src/lib/voice/talk.ts'), /TALK_FENCE_ATTEMPTS = 2/);
assert.match(read('src/lib/voice/quota-server.ts'), /claim_ai_call/);
assert.match(
  read('supabase/migrations/stage8_ai_quota.sql'),
  /ai_daily_cap int not null default 20/,
);
assert.match(
  read('supabase/migrations/stage8_ai_quota.sql'),
  /ai_monthly_cap int not null default 200/,
);
ok('Talk router is rate-limited per user via claim_ai_call (20/day, 200/month)');

assert.match(read('src/lib/voice/quota.ts'), /formatSageUsage/);
assert.match(read('src/lib/voice/quota-server.ts'), /fetchSageUsage/);
assert.match(sage, /SageUsageLine/);
ok('Talk usage is readable as a count of the cap, without claiming extra calls');

console.log(`\n${passed} checks passed`);
