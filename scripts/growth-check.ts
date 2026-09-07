/**
 * Growth-tier checks. Run: npx tsx scripts/growth-check.ts
 *
 * Verifies: presence/depth tier boundaries, presence monotonic-by-construction,
 * depth live from facts.length (including back to 0 after a delete), the live
 * derivation from counts (no cached tier), and computeStreak's day-streak /
 * grace-period logic. The old one-time presence-milestone celebration
 * (PRESENCE_MILESTONES/shouldCelebrateMilestone) was removed — confirmed zero
 * real-account firings; day streaks (src/lib/milestones.ts's current_streak
 * metric) replace it.
 */
import assert from 'node:assert/strict';

import type { Check } from '../src/lib/checks';
import {
  computeStreak,
  DEPTH_TIERS,
  depthTier,
  growthState,
  hasDepthSparkle,
  hasPresenceGlow,
  neonGlowColors,
  presenceGlowLayersForTier,
  PRESENCE_GLOW_ALPHA,
  PRESENCE_TIERS,
  presenceTier,
  STREAK_GRACE_HOURS,
} from '../src/lib/growth';
import { addDaysYmd, localYmd } from '../src/lib/local-date';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// Presence tiers: 0 (<3), 1 (3-6), 2 (7-20), 3 (>=21).
assert.equal(presenceTier(0), 0);
assert.equal(presenceTier(2), 0);
assert.equal(presenceTier(3), 1);
assert.equal(presenceTier(6), 1);
assert.equal(presenceTier(7), 2);
assert.equal(presenceTier(20), 2);
assert.equal(presenceTier(21), 3);
assert.equal(presenceTier(40), 3);
ok('presence tier boundaries (0/3/7/21)');

// Tier 0 has NO glow (matches Home's plain look); higher tiers increase.
assert.equal(hasPresenceGlow(0), false);
assert.equal(hasPresenceGlow(1), true);
assert.equal(PRESENCE_GLOW_ALPHA[0], 0);
assert.ok(PRESENCE_GLOW_ALPHA[1] < PRESENCE_GLOW_ALPHA[2]);
assert.ok(PRESENCE_GLOW_ALPHA[2] < PRESENCE_GLOW_ALPHA[3]);
ok('presence glow: none at tier 0, increasing 1→3');

// Depth tiers: 0 (0 facts), 1 (3-7), 2 (>=8).
assert.equal(depthTier(0), 0);
assert.equal(depthTier(2), 0);
assert.equal(depthTier(3), 1);
assert.equal(depthTier(7), 1);
assert.equal(depthTier(8), 2);
assert.equal(hasDepthSparkle(0), false);
assert.equal(hasDepthSparkle(1), true);
ok('depth tier boundaries (0/3/8)');

// Live derivation from counts — no cached tier.
const me = { facts: ['a', 'b', 'c'] } as const;
const state = growthState(me, 7);
assert.equal(state.presence, 2);
assert.equal(state.depth, 1);
assert.equal(state.checkCount, 7);
assert.equal(state.factCount, 3);
ok('growthState derives both axes live from counts');

const afterDelete = growthState({ facts: [] }, 7);
assert.equal(afterDelete.depth, 0);
assert.equal(afterDelete.factCount, 0);
assert.equal(hasDepthSparkle(afterDelete.depth), false);
ok('deleting the last fact drops depth to 0 — no sticky sparkle');

// Monotonic by construction: a higher count can never lower a tier.
for (let count = 0; count < 50; count += 1) {
  assert.ok(presenceTier(count + 1) >= presenceTier(count));
  assert.ok(depthTier(count + 1) >= depthTier(count));
}
ok('tiers are monotonic (higher count never demotes)');

// Neon glow: layers derive from the character's own color; core is near-white
// tint of the same hue, halo/outer are the accent boosted.
const blue = neonGlowColors('#3c87f7');
assert.match(blue.core, /^hsla\(215\.\d, (?:100|[9]\d)\.\d%, 9\d\.\d%, 0\.95\)$/, 'core is near-white in the character hue');
assert.ok(blue.halo !== blue.outer, 'halo and outer differ');
assert.ok(blue.core !== blue.halo, 'core differs from halo');
const red = neonGlowColors('hsl(0, 70%, 45%)');
assert.ok(red.core.startsWith('hsla(0.'), 'hue preserved from hsl input');
assert.ok(red.halo.startsWith('hsla(0.'), 'halo keeps the character hue');
ok('neon glow layers use the character own color (core near-white + accent halo/outer)');

// Halo saturation is capped ~92 so vivid bases don't wash to near-white pastel
// (the Kenney blue/pink edge case).
const kenneyBlue = neonGlowColors('#738ee9');
const kenneyPink = neonGlowColors('#ff82c3');
assert.match(kenneyBlue.halo, /^hsla\(226\.\d, 9[0-2]\.\d%/, `blue halo sat capped ≤92 (${kenneyBlue.halo})`);
assert.match(kenneyPink.halo, /^hsla\(328\.\d, 9[0-2]\.\d%/, `pink halo sat capped ≤92 (${kenneyPink.halo})`);
ok('halo saturation clamp keeps vivid variant halos from washing out');

// Layers per tier: 0 → none, 1 → core, 2 → core+halo, 3 → all three.
assert.equal(presenceGlowLayersForTier(0), 0);
assert.equal(presenceGlowLayersForTier(1), 1);
assert.equal(presenceGlowLayersForTier(2), 2);
assert.equal(presenceGlowLayersForTier(3), 3);
ok('tiers add glow layers (1/2/3), not just opacity');

assert.ok(PRESENCE_TIERS.length >= 4);
assert.ok(DEPTH_TIERS.length >= 3);
ok('presence/depth tier catalogs have the expected shape');

// --- computeStreak ---------------------------------------------------------

const TZ = 'America/Denver';
const NOW = new Date('2026-09-06T15:00:00.000Z'); // well past local midnight in TZ

function checkOn(ymd: string): Check {
  return {
    id: ymd,
    user_id: 'u',
    day: 0,
    logged_on: ymd,
    read_text: null,
    do_text: null,
    nudge_text: null,
    source: 'bank',
    status: 'done',
    created_at: `${ymd}T12:00:00.000Z`,
  };
}

const today = localYmd(NOW, TZ);
const yesterday = addDaysYmd(today, -1);
const dayBefore = addDaysYmd(today, -2);

assert.equal(computeStreak([], TZ, NOW), 0);
ok('no checks at all -> streak 0');

// me.timezone can be blank in practice (same defensive fallback used
// elsewhere in this codebase, e.g. me.ts's `me.timezone || 'UTC'`) —
// Intl.DateTimeFormat throws a RangeError on an empty string, so
// computeStreak must not pass a blank zone straight through.
assert.doesNotThrow(() => computeStreak([checkOn(today)], '', NOW));
assert.equal(computeStreak([checkOn(today)], '', NOW), computeStreak([checkOn(today)], 'UTC', NOW));
ok('a blank timezone falls back to UTC instead of throwing');

assert.equal(computeStreak([checkOn(today), checkOn(yesterday), checkOn(dayBefore)], TZ, NOW), 3);
ok('3 consecutive days ending today -> streak 3');

assert.equal(computeStreak([checkOn(yesterday), checkOn(dayBefore)], TZ, NOW), 0);
ok('no check today, past the grace window -> streak 0 (broken, not "still yesterday\'s streak")');

assert.equal(computeStreak([checkOn(today), checkOn(addDaysYmd(today, -3))], TZ, NOW), 1);
ok('a gap right after today stops the walk there, even with an older check further back');

// Grace period: no check yet today, but still within STREAK_GRACE_HOURS of
// local midnight -> anchor on yesterday instead of breaking the streak.
// Using 'UTC' as the timezone keeps the wall-clock math trivial to verify:
// the Date's own UTC hour IS the local hour.
const graceTz = 'UTC';
const graceToday = localYmd(NOW, graceTz);
const graceYesterday = addDaysYmd(graceToday, -1);
const graceDayBefore = addDaysYmd(graceToday, -2);
const graceProbeHour = 1;
assert.ok(graceProbeHour < STREAK_GRACE_HOURS, 'test assumes a 1-hour-past-midnight probe fits inside the grace window');
const withinGraceNow = new Date(`${graceToday}T0${graceProbeHour}:00:00.000Z`);
const pastGraceNow = new Date(`${graceToday}T12:00:00.000Z`);
assert.equal(
  computeStreak([checkOn(graceYesterday), checkOn(graceDayBefore)], graceTz, withinGraceNow),
  2,
  'no check yet today, but within grace -> still counts yesterday\'s run',
);
assert.equal(
  computeStreak([checkOn(graceYesterday), checkOn(graceDayBefore)], graceTz, pastGraceNow),
  0,
  'same missing-today state, but past the grace window -> broken',
);
ok('grace period lets a not-yet-logged today continue yesterday\'s streak, but only within STREAK_GRACE_HOURS');

// Backdated check heals a gap: recomputed fresh each call, not an
// incremental counter, so inserting a late row for a skipped day
// immediately reconnects the streak on the next computeStreak call.
const withGap = [checkOn(today), checkOn(dayBefore)]; // yesterday missing
assert.equal(computeStreak(withGap, TZ, NOW), 1, 'gap before backdating: only today counts');
const healed = [...withGap, checkOn(yesterday)]; // backdated check for yesterday lands
assert.equal(computeStreak(healed, TZ, NOW), 3, 'backdated check heals the gap on the very next call');
ok('a backdated check (record_check allows up to 2 days late) heals a gap on recompute, not incrementally');

console.log(`\nAll ${passed} growth-tier checks passed.`);
