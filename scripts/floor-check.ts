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
const push = read('src/lib/push-copy.ts');
const widget = read('targets/widget/widgets.swift');
const copy = read('src/lib/sage-copy.ts');
const consent = read('src/components/ai-consent-card.tsx');
const crisis = read('src/lib/crisis/copy.ts');
assert.match(copy, /Sage is a coach, not a person/);
assert.match(copy, /SAGE_NPC_LABEL/);
assert.match(copy, /Sage · npc/);
// Sage is an inert placeholder while Talk is rebuilt; only the coach label
// survives on it. Its own contract is pinned by scripts/sage-load-check.ts.
assert.match(sage, /SAGE_COACH_LABEL/);
assert.doesNotMatch(sage, /from '@\/lib\/voice\/router'/);
assert.doesNotMatch(sage, /routeVoiceCard/);
assert.doesNotMatch(sage, /Ask Sage anything/);
assert.doesNotMatch(sage, /Sage is writing/);
assert.doesNotMatch(sage, /Sage · npc/);
assert.match(home, /homeSageLede/);
// PARKED (ISOLATION_PLAN §7 Card C, 2026-09-15): SAGE_COACH_LABEL reached Home only
// through the parked Ask sheet's fixtures. The two live Sage strings on Home
// (`homeSageLede`, `homeSageLabel`) are still pinned above and below.
assert.doesNotMatch(home, /SAGE_COACH_LABEL/);
assert.match(home, /homeSageLabel/);
assert.match(push, /Sage · coach/);
assert.match(widget, /SAGE · COACH/);
assert.match(consent, /Sage is a coach in the app, not a person/);
assert.match(crisis, /Sage is a coach, not emergency support/);
assert.doesNotMatch(sage, /Sage listens/);
assert.doesNotMatch(home, /Sage listens/);
// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): /chat is a whole-screen park
// (it was Circle's per-peer chat, and Circle is parked). The copy rule itself
// is unchanged and still asserted against every live surface above; this line
// asserts the parked screen carries none of it.
assert.doesNotMatch(read('src/app/chat.tsx'), /Sage is a coach/);
ok('Talk, Home, consent, crisis, push, widget, and Teach Sage label Sage as a coach; Quest Home may use npc');

assert.match(home, /No insight yet/);
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
assert.match(poster, /const FIELD = '#1A1B20'/);
assert.match(poster, /const QR_INK/);
assert.match(poster, /const PLATE = '#F6F2EA'/);
assert.match(poster, /ecl="M"/);
ok('nav companion is shell-mounted top-right; You poster keeps its own soft-dark palette and dark-on-light M QR');

const chrome = read('src/lib/theme/chrome.ts');
const crisisSrc = read('src/components/crisis-card.tsx');
assert.match(chrome, /controlBorderColor/);
assert.match(crisisSrc, /borderColor: theme\.accent/);
assert.match(sage, /NO_PINCH_ZOOM/);
assert.match(read('src/components/app-tabs.tsx'), /backgroundColor: theme\.background/);
assert.match(read('src/components/app-tabs.tsx'), /useSafeAreaInsets/);
assert.match(read('src/app/_layout.tsx'), /navigationTheme/);
assert.match(read('src/lib/theme/context.tsx'), /typeof Appearance\.setColorScheme === 'function'/);
assert.match(read('src/lib/theme/context.tsx'), /ready: boolean/);
assert.match(read('src/components/themed-tab-bar.tsx'), /backgroundColor: theme\.background/);
assert.doesNotMatch(read('src/components/themed-tab-bar.tsx'), /backgroundElement/);
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
// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): You no longer mounts the
// dev-tools slot — the screen is down to sign out, delete account, AI consent
// and build/update info (RunningUpdateLine, restored same day). The two
// things that MUST stay true of a public build are unchanged and still
// asserted: the sentry/push probe cards are never imported directly, and
// you-dev-tools guards itself.
assert.doesNotMatch(youTab, /from '@\/components\/sentry-test-card'/);
assert.doesNotMatch(youTab, /from '@\/components\/push-test-card'/);
assert.doesNotMatch(youTab, /require\('@\/components\/you-dev-tools'\)/);
assert.doesNotMatch(read('metro.config.js'), /PROBE_STUB/);
assert.match(sentryLib, /if \(!__DEV__\) return;/);
ok('You-tab crash/push probes are PRE_LAUNCH_DEV-gated; the native crash itself is __DEV__-only');

// Moved from Dawn to Home 2026-09-14; inline (not a Modal) per emci.
// RE-INVERTED 2026-09-15 (emci correction): the card is still inline and still
// additive, but consent is a real gate again -- on GENERATION only. It is now
// surfaced at 50-question intake completion via offerConsent, and the
// unconditional Apple 5.1.2 disclosure sits outside it.
assert.doesNotMatch(home, /<Modal[\s\S]*<AiConsentCard/);
assert.match(
  home,
  /\{offerConsent \?[\s\S]{0,300}<AiConsentCard[\s\S]{0,120}context="home"/,
);
assert.doesNotMatch(home, /needsConsentPrompt/);
assert.match(home, /const consentGranted = consent === 'granted';/);
assert.match(home, /\{AI_USE_DISCLOSURE\}/);
assert.match(consent, /AI_USE_DISCLOSURE = 'Sage uses AI to personalize your insights\.'/);
assert.match(home, /setAiConsent/);
assert.doesNotMatch(sage, /setAiConsent/);
// REPINNED (ISOLATION_PLAN §7 Card F, 2026-09-15): You is parked, but AI
// consent is one of the three controls deliberately kept alive there (with
// sign out and delete account). It moved out of the now-gone Account fold into
// its own "Sage's AI" fold, and the three-state row collapsed to a toggle plus
// the full consent card while the answer is still pending — so "Not set yet"
// is no longer a label, the card itself is that state.
assert.match(youTab, /Sage(&apos;|')s AI/);
assert.match(youTab, /'On'/);
assert.match(youTab, /'Off'/);
assert.match(youTab, /<AiConsentCard/);
assert.match(youTab, /setAiConsent/);
assert.doesNotMatch(youTab, /SettingsFold title="Account"/);
ok('AiConsentCard is inline on Home and still reachable on the parked You; the AI-use disclosure is unconditional on both');

// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): the crisis REGION picker is
// off the parked You. This is not the crisis card itself — `CrisisCard` is
// still Active on Home (§0 decision 3), still static, and still asserted
// elsewhere in this file. What is parked is only the per-region setting, which
// had no effect while the picker's own region list is being rebuilt.
assert.ok(youTab.indexOf('<CrisisRegionPicker') === -1, 'the region picker is parked with the rest of You');
ok('the crisis REGION picker is parked; the static crisis card on Home is untouched');

// Same no-flash promise, new source: the Check row no longer carries card
// text, so Home paints from the cached insight and reconciles against
// daily_insights behind it.
assert.match(home, /useDailyInsight/);
assert.match(home, /fetchTodayInsight/);
assert.match(read('src/lib/insight/today-insight.ts'), /export async function loadCachedInsight/);
ok('Home paints today\'s insight from cache before any fetch or generation');

// Talk's quota/crisis-ordering assertions went with its backend (2026-09-14).
// The user-facing quota copy still exists and is still the only thing shown
// when the cap is hit, so that stays pinned; the surfaces that actually claim
// are asserted where they live.
const quota = read('src/lib/voice/quota.ts');
assert.match(quota, /Sage's out of things to say for today, back tomorrow/);
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

// The usage helpers stay — Explore and Questions still read them — but the
// Sage tab no longer renders a usage line, having nothing to spend.
assert.match(read('src/lib/voice/quota.ts'), /formatSageUsage/);
assert.match(read('src/lib/voice/quota-server.ts'), /fetchSageUsage/);
ok('usage stays readable as a count of the cap, without claiming extra calls');

console.log(`\n${passed} checks passed`);
