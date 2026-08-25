/**
 * Growth-tier checks. Run: npx tsx scripts/growth-check.ts
 *
 * Verifies: presence/depth tier boundaries, monotonic-by-construction (no
 * demotion possible), milestone once-only gating, and the live derivation from
 * counts (no cached tier).
 */
import assert from 'node:assert/strict';

import {
  DEPTH_TIERS,
  depthTier,
  growthState,
  hasDepthSparkle,
  hasPresenceGlow,
  neonGlowColors,
  presenceGlowLayersForTier,
  PRESENCE_GLOW_ALPHA,
  PRESENCE_MILESTONES,
  PRESENCE_TIERS,
  presenceTier,
  shouldCelebrateMilestone,
} from '../src/lib/growth';

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
const me = { facts: ['a', 'b', 'c'], milestones_celebrated: {} } as const;
const state = growthState(me, 7);
assert.equal(state.presence, 2);
assert.equal(state.depth, 1);
assert.equal(state.checkCount, 7);
assert.equal(state.factCount, 3);
ok('growthState derives both axes live from counts');

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

// Milestone once-only: uncelebrated at threshold → true; celebrated → false.
assert.equal(shouldCelebrateMilestone(state, 7, {}), true, '7 not yet celebrated');
assert.equal(
  shouldCelebrateMilestone(state, 7, { '7': '2026-08-24T00:00:00.000Z' }),
  false,
  '7 already celebrated',
);
assert.equal(shouldCelebrateMilestone(state, 21, {}), false, '21 not reached yet');
assert.equal(shouldCelebrateMilestone(growthState(me, 21), 21, {}), true, '21 reached, not celebrated');
ok('milestones gate on reach + not-yet-celebrated');

// Thresholds list matches the tier boundaries they celebrate.
assert.deepEqual([...PRESENCE_MILESTONES], [7, 21]);
assert.ok(PRESENCE_TIERS.length >= 4);
assert.ok(DEPTH_TIERS.length >= 3);
ok('milestone thresholds (7, 21) match presence tier boundaries');

console.log(`\nAll ${passed} growth-tier checks passed.`);
