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

// --- 2. consent gates GENERATION, and only generation ---------------------
// Re-inverted 2026-09-15 (emci correction) after a same-day window in which
// these asserted the gate's absence. With no dedicated Sage-talk screen built
// yet, the daily insight is a real AI touchpoint and needs consent before it
// calls a model -- but nothing else on Home may depend on the answer.
const CONSENT_OFF_EMPTY =
  'AI is off, so there’s no insight today. Turn on AI in Home — the switch is just below.';

assert.ok(home.includes(CONSENT_OFF_EMPTY), 'Home must show the exact consent-off empty line');
// Declined and not-yet-asked are DIFFERENT states. Collapsing them is what
// left a fresh account (ai_consent null) with no insight and no prompt.
assert.match(home, /const consentGranted = consent === 'granted';/);
assert.match(home, /const consentOffEmpty = consent === 'denied';/);
ok('Home distinguishes declined from not-yet-asked and shows the honest empty line');

// The generation effect must bail BEFORE any fetch, generation, cache write
// or widget write. This is the assertion that would catch a refactor quietly
// moving the guard below the call.
const effectStart = home.indexOf('const existing = await withTimeout(fetchTodayInsight');
assert.ok(effectStart > 0, 'the insight effect must exist');
const guardWindow = home.slice(home.indexOf('if (!me || !userId || !window) return;'), effectStart);
assert.match(guardWindow, /if \(!consentGranted\) return;/);
ok('no consent, no model call: the guard sits above every fetch and generation');

// TIMING, CHANGED by emci 2026-09-15 (ISOLATION_PLAN §7 Card C): the ask is
// now part of the FIRST thing on Home, not something held back until the
// intake finishes. Under the tap-gated flow the pre-profile screen IS the
// consent approvals plus a button into Questions, so gating the ask on
// `fullProfileDone` would leave a brand-new account looking at an empty Home.
// It is still inline, and it still blocks nothing.
assert.match(home, /const offerConsent = me != null && consent === 'pending';/);
assert.doesNotMatch(
  home,
  /const offerConsent = [^;]*fullProfileDone/,
  'the consent ask must not wait for the profile to be finished',
);
ok('the consent ask is offered as soon as it is unanswered, in both Home states');

// The ask is additive: it must never be the branch that decides whether the
// day's content renders. REPINNED for Card C's two-state Home — the ask now
// lives in one shared `consentBlock` rendered in BOTH states, so the old
// "content appears above the ask in the file" ordering no longer applies. What
// still must hold: the ask is its own ternary, and the unlocked state's
// content ternary is separate from it.
assert.match(home, /\{offerConsent \? \([\s\S]{0,200}<AiConsentCard/);
assert.match(home, /\{consentOffEmpty \? \(/);
assert.ok(
  home.indexOf('const consentBlock = (') > 0,
  'the disclosure + ask must be one shared block, so both Home states show them identically',
);
ok('the consent ask is its own additive block, never the branch that decides the content');

// Nothing that is not a model call may be gated. The Check in particular:
// an AI permission question standing between a user and the core loop is the
// exact failure this pass existed to remove, and it stays removed.
assert.ok(
  !home.includes('Answer Sage&apos;s AI question above to continue'),
  'Check logging must not be gated on the consent answer',
);
// The question-bank row (the one navigation control Home owns) must not be
// conditioned on the consent ANSWER -- it is local and never calls a model.
// REPINNED (Card C): the pre-profile arm renders the shared consent block
// above the row, so a bare /consent/i would now match that block's own name;
// the assertion is against the consent *states* instead.
const bankRow = home.slice(home.indexOf('{!fullProfileDone ? ('), home.indexOf("router.push('/intake-sweep')"));
assert.doesNotMatch(bankRow, /consentGranted|consentOffEmpty/);
ok('the question-bank route stays open whatever the consent answer is');

// Apple 5.1.2: disclosure is UNCONDITIONAL. It must be rendered outside the
// consent card (which disappears once answered) and outside every consent
// branch, so a yes, a no and an unanswered account all see it.
assert.match(home, /AI_USE_DISCLOSURE/);
const disclosureIdx = home.indexOf('{AI_USE_DISCLOSURE}');
assert.ok(disclosureIdx > 0, 'Home must render the disclosure line itself');
// REPINNED (Card C): the disclosure now sits at the top of the shared
// `consentBlock`, which renders unconditionally in both Home states — so what
// is checked is that it is NOT inside a consent arm, rather than where it
// falls relative to one.
assert.ok(
  home.indexOf('const consentBlock = (') < disclosureIdx,
  'the disclosure must be part of the shared consent block, not inside a consent arm',
);
assert.doesNotMatch(
  home.slice(disclosureIdx - 200, disclosureIdx),
  /consentGranted|consentOffEmpty|offerConsent/,
);
ok('the AI-use disclosure renders unconditionally, independent of the answer');

// Revoking consent must wipe the cached insight the widget renders -- but a
// null `me` is a failed profile refresh, not a revocation, and must NOT wipe
// a granted user's widget. Both halves of that condition are pinned.
assert.match(home, /if \(!me \|\| consentGranted \|\| !insight\) return;/);
ok('a revoke clears the widget cache; a failed profile refresh does not');

// `fullProfileDone` must wait for home_bootstrap, or someone who HAS finished
// the intake is told to finish it for a beat on every cold open. The derivation
// itself now lives in the one shared gate (`lib/full-profile-gate.ts`,
// ISOLATION_PLAN §7 Card A); what Home still owns is passing its own
// tracks-loaded flag in, so that is what is pinned here.
assert.match(home, /const fullProfileDone = isFullProfileDone\(tracks, bootstrapReady\);/);
ok('intake completion is not judged before home_bootstrap lands');

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
