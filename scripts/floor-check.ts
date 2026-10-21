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
  'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
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
assert.match(policy, /DeepSeek/);
assert.match(policy, /Resend/);
assert.match(labels, /Supabase/);
assert.match(labels, /Gemini/);
assert.match(labels, /DeepSeek/);
assert.match(labels, /Resend/);
assert.match(labels, /Apple/);
assert.match(labels, /Sentry/);
ok('privacy.md and nutrition labels name the third parties (Gemini first, DeepSeek fallback: ai-vendors.ts)');

// Step 10 (2026-10-20): the policy describes what is built; "mute" is not built. Step 14 (2026-10-21):
// chat is built (app 1.1+, wave108), so the policy must describe it as built: end-to-end encrypted,
// 30-day retention, reports send the message + up to 5 before; the old "no direct messages" line is stale.
export function policyRuleProblems(text: string): string[] {
  const out: string[] = [];
  if (/no direct messages between people/i.test(text)) out.push('still says there are no direct messages (chat is built)');
  if (!/end-to-end encrypted[\s\S]{0,200}ATO cannot read them/i.test(text)) out.push('missing: chat is end-to-end encrypted');
  if (!/for 30 days, then deletes it/i.test(text)) out.push('missing: 30-day chat retention');
  if (!/that message and up to 5 before it/i.test(text)) out.push('missing: what a chat report sends');
  if (/\bmute\b/i.test(text)) out.push('mentions mute (not built)');
  // Every sentence that names a push token must deny collecting one (local notifications only).
  for (const s of text.split(/(?<=[.!?])\s+|\n/)) {
    if (/push (notification )?token/i.test(s) && !/\b(?:does not|doesn't|do not|never|no)\b/i.test(s)) {
      out.push('claims a push token');
      break;
    }
  }
  for (const [need, why] of [
    [/friend request|accept their request/i, 'friend requests with accept'],
    [/\bBlock\b[\s\S]{0,200}silent/i, 'silent block'],
    [/Report[\s\S]{0,200}six fixed reasons/i, 'report with fixed reasons'],
    [/(?:keep|kept)[\s\S]{0,120}(?:if either account is later deleted|without your account ID)/i, 'reports survive deletion'],
    [/Compare strengths[\s\S]{0,200}both/i, 'compare needs both switches'],
    [/visits? (?:are )?switched on|visits and compare/i, 'per-friend visits switch'],
    [/slurs/i, 'name / handle filter'],
    [/Divecore game save/i, 'Divecore save'],
    [/Legends cards and category deep dives/i, 'the two AI uses'],
    [/asks once, after your first insight/i, 'the notification ask'],
  ] as const) {
    if (!need.test(text)) out.push(`missing: ${why}`);
  }
  return out;
}
assert.deepEqual(policyRuleProblems(policy), [], `privacy.md: ${policyRuleProblems(policy).join('; ')}`);
for (const f of ['landing/privacy.html']) {
  const html = read(f).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
  assert.deepEqual(policyRuleProblems(html), [], `${f}: ${policyRuleProblems(html).join('; ')}`);
}
for (const f of ['src/app/legal/terms.md', 'landing/terms.html']) {
  const t = read(f);
  assert.doesNotMatch(t, /\bmute\b/i, `${f} mentions mute`);
  assert.doesNotMatch(t, /\bin Chat\b|chat history/i, `${f} describes Chat as live`);
}
// pass/fail pairs
assert.ok(policyRuleProblems('Block, mute, report on any Chat conversation.').length > 0, 'fail: the old chat line');
assert.ok(policyRuleProblems(policy.replace(/six fixed reasons/g, 'a reason')).includes('missing: report with fixed reasons'), 'fail: report reasons dropped');
assert.ok(policyRuleProblems(policy + '\nPush notification token, if you enable notifications.').includes('claims a push token'), 'fail: a stray claim next to the denial is still caught');
assert.ok(!policyRuleProblems(policy).includes('claims a push token'), 'pass: the denial sentence alone');
assert.ok(policyRuleProblems('We collect your push token.').includes('claims a push token'), 'fail: a push-token claim without the denial');
assert.ok(policyRuleProblems(policy + '\nATO has no direct messages between people.').some((p) => p.startsWith('still says')), 'fail: the stale no-chat line');
assert.ok(policyRuleProblems(policy.replace(/for 30 days, then deletes it/g, 'for a while')).includes('missing: 30-day chat retention'), 'fail: retention dropped');
assert.ok(policyRuleProblems(policy.replace(/up to 5 before it/g, 'some context')).includes('missing: what a chat report sends'), 'fail: report scope dropped');
ok('privacy policy (app + landing) describes Circle, chat (E2E, 30 days, reports), AI, Divecore and notifications as built; no mute; pass/fail pairs');

// The Linked column of the label table matches app.json for every type.
export function labelLinked(doc: string, type: string): boolean | null {
  const row = doc.split('\n').find((l) => l.startsWith(`| ${type} |`));
  if (!row) return null;
  const cells = row.split('|').map((c) => c.trim());
  return cells[3] === 'Linked' ? true : cells[3] === 'Not linked' ? false : null;
}
const APPLE_NAME: Record<string, string> = {
  EmailAddress: 'Email Address', Name: 'Name', DateOfBirth: 'Date of Birth', UserID: 'User ID',
  OtherUserContent: 'Other User Content', EmailsOrTextMessages: 'Emails or Text Messages', CustomerSupport: 'Customer Support', ProductInteraction: 'Product Interaction',
  OtherUsageData: 'Other Usage Data', CrashData: 'Crash Data', OtherDiagnosticData: 'Other Diagnostic Data', DeviceID: 'Device ID',
};
for (const t of manifests.NSPrivacyCollectedDataTypes) {
  const name = APPLE_NAME[t.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '')]!;
  assert.equal(labelLinked(labels, name), t.NSPrivacyCollectedDataTypeLinked, `labels table Linked column for ${name}`);
}
assert.equal(labelLinked('| Crash Data | Yes | Linked | No |', 'Crash Data'), true, 'pair: Linked');
assert.equal(labelLinked('| Crash Data | Yes | Not linked | No |', 'Crash Data'), false, 'pair: Not linked');
assert.equal(labelLinked('| Crash Data | Yes |', 'Device ID'), null, 'pair: missing row');
ok('label table Linked column matches app.json for all 12 types');

// M8 (Step 10): Privacy + Terms links on sign-up and on You, opening the landing pages.
{
  const links = read('src/components/legal-links.tsx');
  assert.match(links, /PRIVACY_URL = 'https:\/\/ato\.emgens\.com\/privacy\.html'/);
  assert.match(links, /TERMS_URL = 'https:\/\/ato\.emgens\.com\/terms\.html'/);
  assert.equal((links.match(/accessibilityRole="link"/g) ?? []).length, 2, 'both links are labelled links');
  assert.match(read('src/app/auth/index.tsx'), /<LegalLinks \/>/, 'sign-up shows the links');
  assert.match(read('src/app/(tabs)/you.tsx'), /<LegalLinks \/>/, 'You shows the links');
  ok('Privacy + Terms links on sign-up and You open ato.emgens.com/{privacy,terms}.html');
}

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

const sage = read('src/app/(tabs)/insights.tsx');
const home = read('src/app/(tabs)/index.tsx');
const push = read('src/lib/push-copy.ts');
const widget = read('targets/widget/widgets.swift');
const copy = read('src/lib/sage-copy.ts');
const consent = read('src/components/ai-consent-card.tsx');
const focusCard = read('src/components/insights/today-focus-card.tsx');
// Sage was replaced by Insights (2026-10-14). Nothing a user sees says Sage
// (check:no-sage-copy); Insights says plainly that nothing there is AI-written.
assert.doesNotMatch(copy, /Sage is a coach/);
assert.match(copy, /SAGE_COACH_LABEL = 'Insights'/);
assert.match(copy, /SAGE_NOT_A_PERSON = 'Picked from your answers\. No AI writes anything here\.'/);
assert.match(copy, /SAGE_NPC_LABEL = 'Focus · try · watch'/);
assert.match(sage, /SAGE_COACH_LABEL/);
assert.match(sage, /SAGE_NOT_A_PERSON/);
assert.doesNotMatch(sage, /from '@\/lib\/voice\/router'/);
assert.doesNotMatch(sage, /routeVoiceCard/);
assert.doesNotMatch(sage, /SAGE_NPC_LABEL|Focus · try · watch/);
assert.match(home, /homeSageLede/);
assert.doesNotMatch(home, /SAGE_COACH_LABEL/);
// The focus card (and its kicker) moved from Home to Insights.
assert.match(focusCard, /homeSageLabel/);
assert.doesNotMatch(home, /homeSageLabel/);
assert.match(push, /MORNING_PUSH_TITLE = 'ATO'/);
// The widget's native header (next native build) no longer says Sage.
assert.doesNotMatch(widget, /SAGE · COACH/);
assert.match(widget, /Text\("ATO"\)/);
assert.doesNotMatch(consent, /'[^'\n]*\bSage\b[^'\n]*'/, 'no consent string says Sage');
// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): /chat is a whole-screen park
// (it was Circle's per-peer chat, and Circle is parked). The copy rule itself
// is unchanged and still asserted against every live surface above; this line
// asserts the parked screen carries none of it.
assert.doesNotMatch(read('src/app/chat.tsx'), /Sage is a coach/);
ok('no Sage on Insights, Home, consent or push; the focus kicker is Focus · try · watch (on Insights)');

// The empty state is the sealed card with its one honest note (stored bank, 2026-10-07).
assert.match(focusCard, /\{INSIGHT_STORED_NOTE\}/);
assert.match(focusCard, /SEALED_READ_LINE/);
assert.doesNotMatch(home, /fake poster|Fake Person|open box|fake card media|fake ·/i);
assert.doesNotMatch(home, /<PixelFace/);
ok('the focus card has an honest empty state; Home has no Stage 1 fake fixtures');

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
assert.match(chrome, /controlBorderColor/);
assert.match(read('src/components/helpline-row.tsx'), /borderColor: controlBorderColor\(theme\)/);
assert.match(sage, /NO_PINCH_ZOOM/);
assert.match(read('src/components/app-tabs.tsx'), /backgroundColor: theme\.background/);
assert.match(read('src/components/app-tabs.tsx'), /useSafeAreaInsets/);
assert.match(read('src/app/_layout.tsx'), /navigationTheme/);
assert.match(read('src/lib/theme/context.tsx'), /typeof Appearance\.setColorScheme === 'function'/);
assert.match(read('src/lib/theme/context.tsx'), /ready: boolean/);
assert.match(read('src/components/themed-tab-bar.tsx'), /backgroundColor: theme\.background/);
assert.doesNotMatch(read('src/components/themed-tab-bar.tsx'), /backgroundElement/);
ok('the helpline row uses the shared hairline; Insights pinch-zoom is off; tab bar is opaque and appearance-themed');

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
assert.match(home, /const consent = me \? aiConsentFor\(me\) : 'pending';/);
assert.match(home, /\{AI_USE_DISCLOSURE\}/);
// 2026-10-14: the Story is template-only, so the real AI uses are Legends
// cards and category deep dives — the disclosure names exactly those two.
assert.match(
  consent,
  /AI_USE_DISCLOSURE =\s*'ATO uses AI only to write your Legends cards and your category deep dives\. These cards are shared between people with similar leanings and never include your name or your answers\.'/,
);
// The AI mark (emci 2026-10-07): a small icon you tap to read what it means,
// on every mounted surface that shows model output (today: the Story fold).
const aiBadge = read('src/components/ai-badge.tsx');
assert.match(aiBadge, /<Pressable[\s\S]*accessibilityRole="button"[\s\S]*onPress=\{\(\) => setOpen\(\(v\) => !v\)\}/);
assert.match(aiBadge, /MaterialCommunityIcons name="creation"/);
assert.match(aiBadge, /\{open \? \([\s\S]*\{AI_BADGE_DESCRIPTION\}/);
// The Story on Insights is template-only, so it carries no AI badge at all.
assert.doesNotMatch(read('src/components/insights/insights-story-card.tsx'), /AiBadge/);
// The consent copy names only what still uses AI, never the stored focus,
// questions, categories or the Story (emci 2026-10-07, 2026-10-14).
assert.doesNotMatch(consent, /writes your daily insight|written insights|personalize your insights/);
assert.match(home, /setAiConsent/);
assert.doesNotMatch(sage, /setAiConsent/);
// REPINNED (ISOLATION_PLAN §7 Card F, 2026-09-15): You is parked, but AI
// consent is one of the three controls deliberately kept alive there (with
// sign out and delete account). It moved out of the now-gone Account fold into
// its own "Sage's AI" fold, and the three-state row collapsed to a toggle plus
// the full consent card while the answer is still pending — so "Not set yet"
// is no longer a label, the card itself is that state.
assert.match(youTab, /ATO(&apos;|')s AI/);
assert.match(youTab, /'On'/);
assert.match(youTab, /'Off'/);
assert.match(youTab, /<AiConsentCard/);
assert.match(youTab, /setAiConsent/);
// The Account fold is back (2026-10-04) but holds only the birthday row: AI
// consent stays in its own "ATO's AI" fold, never inside Account.
{
  const at = youTab.indexOf('<SettingsFold title="Account">');
  const accountFold = youTab.slice(at, youTab.indexOf('</SettingsFold>', at));
  assert.ok(at >= 0 && !/AiConsentCard|setAiConsent|saveAiConsent/.test(accountFold), 'consent is not in the Account fold');
}
ok('AiConsentCard is inline on Home and still reachable on You; the AI-use disclosure is unconditional on both');

// The crisis system was removed 2026-10-14 (it existed only because Sage read
// what people typed). One static helpline row on You replaced it
// (check:helpline-row pins it).
assert.ok(youTab.indexOf('<CrisisRegionPicker') === -1, 'no region picker');
assert.match(youTab, /<HelplineRow \/>/);
ok('no crisis region picker; the static helpline row is on You');

// Same no-flash promise, new home (2026-10-14): the focus card on Insights
// paints from the cached insight and reconciles against daily_insights.
assert.match(focusCard, /useDailyInsight/);
assert.match(focusCard, /fetchTodayInsight/);
assert.match(read('src/lib/insight/today-insight.ts'), /export async function loadCachedInsight/);
ok('the focus card paints today\'s insight from cache before any fetch');

// Talk's quota/crisis-ordering assertions went with its backend (2026-09-14).
// The user-facing quota copy still exists and is still the only thing shown
// when the cap is hit, so that stays pinned; the surfaces that actually claim
// are asserted where they live.
const quota = read('src/lib/voice/quota.ts');
assert.match(quota, /That's all for today, back tomorrow/);
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
