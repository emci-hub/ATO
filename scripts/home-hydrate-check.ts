/**
 * Home paints today's insight without waiting on a fetch or a generation, and
 * writes nothing at all when AI consent is off.
 * Run: npm run check:home-hydrate
 *
 * Rewritten 2026-09-14 (T-H2). This file used to prove the same two promises
 * against the Read/Do card: hydrate from the Check row, and show an honest
 * empty state instead of inventing a card. The card is gone, but both promises
 * survive in a new form:
 *
 *   1. No flash of empty state. The card hydrated from `checks.read_text`;
 *      the insight paints from an AsyncStorage cache and reconciles against
 *      `daily_insights` behind it. Different source, same user-visible promise.
 *   2. Consent off means nothing is generated, cached, or written to the
 *      widget. This is the privacy invariant and it is unchanged — only the
 *      condition got simpler, because the insight has no starter bank to fall
 *      back on for days 1-3 the way the card did.
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

// --- 1. paint-before-fetch -------------------------------------------------
const cache = read('src/lib/insight/today-insight.ts');
assert.match(cache, /export async function loadCachedInsight/);
assert.match(cache, /export async function saveCachedInsight/);
assert.match(cache, /AsyncStorage\.getItem\(TODAY_INSIGHT_KEY\)/);
// A malformed or half-written cache entry must read as "no insight", never as
// a card with undefined fields rendered into the UI.
assert.match(cache, /typeof parsed\.title !== 'string' \|\| typeof parsed\.tryToday !== 'string'/);
ok('the insight cache is a plain AsyncStorage read that rejects a malformed entry');

const hook = read('src/hooks/use-daily-insight.ts');
assert.match(hook, /loadCachedInsight/);
assert.match(hook, /onDailyInsightChanged/);
// The hook must not fetch or generate: Sage mounts it too, and a mount can
// never trigger a paid call.
assert.doesNotMatch(hook, /fetchTodayInsight|generateDailyInsight|supabase/);
ok('useDailyInsight is a cache read and an event subscription, never a fetch or a generation');

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /useDailyInsight/);
assert.match(home, /fetchTodayInsight/);
assert.match(home, /generateDailyInsight/);
// Existing insight is preferred over generating a new one — otherwise every
// cold mount would spend a model call.
const effectBody = home.slice(home.indexOf('if (!me || !userId || !window) return;'));
assert.ok(
  effectBody.indexOf('fetchTodayInsight') < effectBody.indexOf('generateDailyInsight'),
  'Home must read an existing insight before generating one',
);
assert.match(home, /if \(insight\?\.ymd === todayYmd\) return;/);
// Keyed on the window's own today, not openLogDays' entry — the latter
// disappears once the Check is logged, which would strand the rest of the day.
assert.match(home, /const \{ todayDay, todayYmd \} = window;/);
// One generation in flight per day, so a bootstrap reload cannot re-trigger a
// second paid call for the same ymd.
assert.match(home, /if \(generatingForYmd\.current === todayYmd\) return;/);
ok('Home reads the stored insight first and only generates when the day has none');

// --- 2. consent gates NOTHING on Home -------------------------------------
// INVERTED 2026-09-15 (emci explicit), not deleted. This block used to assert
// the opposite: that a declined account saw an exact "No insight today" line,
// that `consentOffEmpty`/`needsConsentPrompt` existed, and that the generation
// effect bailed on both before any fetch. AI consent now gates ONE thing --
// the conversational exchange with Sage -- and nothing on Home. These
// assertions now pin the removal so it cannot quietly come back.
assert.doesNotMatch(home, /consentOffEmpty|needsConsentPrompt/);
assert.ok(
  !home.includes('No insight today. Sage only writes these with your say-so'),
  'the consent-off empty branch must be gone, not just unreachable',
);
ok('Home has no consent-off empty branch and no consent-derived gate flags');

// The generation effect must NOT consult consent at all. Pinning the guard
// window keeps a future refactor from reintroducing a bail there.
const effectStart = home.indexOf('const existing = await fetchTodayInsight');
assert.ok(effectStart > 0, 'the insight effect must exist');
const guardWindow = home.slice(home.indexOf('if (!me || !userId || !window) return;'), effectStart);
assert.doesNotMatch(guardWindow, /consent/i);
ok('the insight generation effect runs regardless of ai_consent');

// The ask survives as an opt-in, but additively: it must not be an
// either/or with the insight card. If `offerConsent` ever becomes a branch
// that replaces the day's content, this fails.
assert.match(home, /const offerConsent = me != null && consent === 'pending';/);
assert.match(home, /\{offerConsent \? \([\s\S]{0,200}<AiConsentCard/);
// The insight card must be its OWN top-level branch, not a fallback arm of
// a consent ternary -- that shape is exactly what made the ask a gate.
assert.match(home, /\{insight \? \(/);
assert.ok(
  home.indexOf('{insight ? (') < home.indexOf('{offerConsent ? ('),
  "the day's content must render above the consent ask, not behind it",
);
ok('the consent ask renders alongside the day\'s content, never instead of it');

// Logging a Check must never be blocked on consent -- an AI permission
// question standing between a user and the core loop is the exact failure
// this pass existed to remove.
assert.ok(
  !home.includes('Answer Sage&apos;s AI question above to continue'),
  'Check logging must not be gated on the consent answer',
);
ok('the Check is loggable with consent granted, denied or unanswered');

// --- 3. the widget keeps rendering ----------------------------------------
// The shipped widget binary reads the card-era keys and cannot be updated over
// OTA, so the client must keep writing them from insight fields until the
// native build lands.
assert.match(cache, /storage\.set\('read', insight\.title\)/);
assert.match(cache, /storage\.set\('do', insight\.tryToday\)/);
assert.match(cache, /storage\.set\('hasCard', '1'\)/);
assert.match(cache, /WIDGET_KIND = 'AtoCard'/);
ok('the widget still receives read/do/hasCard, sourced from the insight');

console.log(`\nhome-hydrate-check: ${passed}/${passed} passed`);
