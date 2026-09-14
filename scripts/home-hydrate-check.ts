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

// --- 2. consent off writes nothing ----------------------------------------
const CONSENT_OFF_EMPTY =
  'No insight today. Sage only writes these with your say-so — you can turn that on any time in You.';

assert.ok(home.includes(CONSENT_OFF_EMPTY), 'Home must show the exact consent-off empty line');
assert.match(home, /me\.ai_consent !== true/);
assert.match(home, /consentOffEmpty/);
ok('Home shows the exact consent-off empty line in place of the insight');

// The generation effect must bail on consent-off BEFORE any fetch, generation,
// cache write or widget write. This is the assertion that would catch a
// refactor quietly moving the guard below the call.
const effectStart = home.indexOf('const existing = await fetchTodayInsight');
assert.ok(effectStart > 0, 'the insight effect must exist');
const guardWindow = home.slice(home.indexOf('if (!me || !userId || !window) return;'), effectStart);
assert.match(guardWindow, /if \(consentOffEmpty \|\| needsConsentPrompt\) return;/);
ok('consent-off and the unanswered consent prompt both short-circuit before any fetch or generation');

// Nothing on the consent-off render branch may write the widget or the cache.
assert.doesNotMatch(
  home.slice(home.indexOf('consentOffEmpty ?'), home.indexOf('No insight yet')),
  /saveCachedInsight|saveInsight|writeWidget/,
);
ok('the consent-off branch performs no cache or widget write');

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
