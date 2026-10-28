/**
 * Legends, gamified (ATO-BUILD PHASE-10).
 * Run: npm run check:legends-g4
 *
 * Pins: the ring and match maths (0 met, partial, all met), the reveal lock
 * (a second tap while a story is written OR while the holo card turns is
 * ignored, R07), the new motion tokens, Reduce Motion in every new animated
 * file, the one mini constellation (inside the holo card), and that price,
 * reward and quota logic in Legends is untouched (§1.6).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  HOLO_GUARD_MS,
  frameState,
  matchPercent,
  matchedAxes,
  matchedTracks,
  overallPercent,
  ringFraction,
  ringOffset,
} from '../src/lib/legend-figures/view-math';
import { LEGEND_ROSTER } from '../src/lib/legend-figures/roster';
import type { LegendFigure } from '../src/lib/legend-figures/types';
import type { TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(rel), 'utf8');
const track = (axis: TraitAxis, value: number): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability: 0.8,
  answerCount: 6,
  lastTouched: new Date('2026-10-27T12:00:00Z').toISOString(),
  lastDepthAt: null,
});

// ── Ring maths: works with 0 met and with all met ────────────────────────────
assert.equal(ringFraction(0, 12), 0, '0 met is an empty ring');
assert.equal(ringFraction(12, 12), 1, 'all met is a full ring');
assert.equal(ringFraction(3, 12), 0.25);
assert.equal(ringFraction(20, 12), 1, 'never above a full ring');
assert.equal(ringFraction(-2, 12), 0);
assert.equal(ringFraction(5, 0), 0, 'an empty hall is an empty ring, not NaN');
assert.equal(overallPercent(0, LEGEND_ROSTER.length), 0);
assert.equal(overallPercent(LEGEND_ROSTER.length, LEGEND_ROSTER.length), 100);
assert.equal(overallPercent(1, 3), 33);
assert.equal(overallPercent(2, 3), 67);
assert.equal(ringOffset(100, 0), 100, 'empty: the whole dash is hidden');
assert.equal(ringOffset(100, 1), 0, 'full: nothing hidden');
assert.equal(ringOffset(100, 0.25), 75);
assert.equal(ringOffset(100, 7), 0, 'clamped');
ok('ring maths: 0 met, partial, all met, over-count and an empty hall');

// ── Match % and the overlay's tracks ─────────────────────────────────────────
const legend = {
  id: 'fixture',
  tags: [
    { axis: 'openness', lean: 'high', them: '', why: '' },
    { axis: 'steadiness', lean: 'low', them: '', why: '' },
    { axis: 'playfulness', lean: 'high', them: '', why: '' },
  ],
} as unknown as LegendFigure;
assert.equal(matchPercent(legend, []), 0, 'no tracks: no match');
assert.deepEqual(matchedTracks(legend, []), []);
const mine = [track('openness', 0.9), track('steadiness', 0.2), track('playfulness', 0.3), track('agreeableness', 0.9)];
assert.equal(matchPercent(legend, mine), 67, 'two of three tags on the reader’s clear side');
assert.deepEqual(matchedAxes(legend, mine), ['openness', 'steadiness']);
assert.deepEqual(
  matchedTracks(legend, mine).map((t) => t.axis),
  ['openness', 'steadiness'],
  'the overlay shows only the matched axes',
);
assert.equal(matchPercent(legend, [track('openness', 0.55)]), 0, 'a weak lean is not a match');
assert.equal(matchPercent({ ...legend, tags: [] } as unknown as LegendFigure, mine), 0, 'no tags: 0, never NaN');
assert.equal(
  matchPercent(
    legend,
    [track('openness', 0.9), track('steadiness', 0.1), track('playfulness', 0.9)],
  ),
  100,
);
ok('match %: none, partial, weak lean, no tags, full; the overlay holds only matched axes');

// ── R07: a second tap is ignored while writing OR while the holo card turns ──
assert.equal(frameState({ key: 'a', busyKey: null, canReveal: true, holoActive: false }), 'ready');
assert.equal(frameState({ key: 'a', busyKey: 'a', canReveal: true, holoActive: false }), 'loading');
assert.equal(frameState({ key: 'b', busyKey: 'a', canReveal: true, holoActive: false }), 'spent', 'another frame while one is written');
assert.equal(frameState({ key: 'a', busyKey: null, canReveal: true, holoActive: true }), 'spent', 'the card is still turning');
assert.equal(frameState({ key: 'a', busyKey: null, canReveal: false, holoActive: false }), 'spent', 'no reveals left');
assert.ok(HOLO_GUARD_MS > 1000, 'the failsafe outlasts the animation');
assert.ok(HOLO_GUARD_MS <= 3000, 'but a stuck lock clears itself quickly');
ok('reveal lock: ready, loading, another frame, holo turning, spent, failsafe');

const screen = read('src/app/(tabs)/legends.tsx');
assert.match(screen, /busyKey \|\| holoRef\.current \|\| meetingRef\.current\) return;/, 'reveal() ignores a tap while the holo card turns');
assert.match(screen, /holoRef\.current = freshId != null;/);
assert.match(screen, /setOpenChapter\(chapter\);\s*setFreshId\(legend\.id\);/, 'the lock starts with the reveal');
assert.match(screen, /state=\{frameState\(\{ key, busyKey, canReveal, holoActive: freshId != null \}\)\}/);
assert.match(screen, /setTimeout\(\(\) => setFreshId\(null\), HOLO_GUARD_MS\)/, 'the lock cannot get stuck');
assert.equal((screen.match(/revealLegendStory\(/g) ?? []).length, 1, 'still one call site');
ok('legends.tsx: reveal guard, lock start, failsafe, frame state');

// ── §1.6: no price, reward or quota change in the new files ──────────────────
for (const rel of [
  'src/components/hall-rings.tsx',
  'src/components/holo-card.tsx',
  'src/lib/legend-figures/view-math.ts',
]) {
  const src = read(rel);
  assert.doesNotMatch(src, /AI_TOKEN_PRICE|claimLegendStory|refundAiTokens|claim_|saveServerEntry|fetch\(|supabase/, `${rel} touches no price, claim or network`);
}
assert.match(screen, /claimLegendStory\(\)/);
assert.match(screen, /refundAiTokens\('legend'\)/);
ok('no price, claim, refund or network call in the new files; the claim path is still in the screen');

// ── Tokens (read as source: motion-tokens pulls in native modules) ───────────
const tokens = read('src/lib/motion-tokens.ts');
const block = (name: string) => {
  const start = tokens.indexOf(`export const ${name} = {`);
  return start < 0 ? '' : tokens.slice(start, tokens.indexOf('} as const', start));
};
const num = (name: string, key: string) => Number(block(name).match(new RegExp(`${key}: (-?[0-9.]+)`))?.[1]);
assert.equal(num('HALL_RING', 'drawMs'), 1200);
assert.equal(num('HALL_RING', 'staggerMs'), 120);
assert.equal(num('SHIMMER', 'durationMs'), 2200);
assert.equal(num('HOLO', 'totalMs'), 1000);
assert.equal(num('HOLO', 'scaleTo'), 1.04);
assert.ok(num('HOLO', 'reducedFadeMs') <= 300, 'Reduce Motion cross-fades are 300 ms or less');
assert.equal(num('STAMP', 'durationMs'), 450);
assert.equal(num('STAMP', 'delayMs'), 1000);
assert.equal(num('STAMP', 'scaleFrom'), 2.2);
assert.equal(num('STAMP', 'rotateFrom'), -14);
assert.equal(num('STAMP', 'rotateTo'), -8);
assert.equal(num('STAMP', 'reducedFadeMs'), 200);
ok('tokens: rings 1200/120, shimmer 2200, holo 1000 → 1.04, stamp 2.2 → 1, −14° → −8°, 450 ms, delay 1000');

// ── Reduce Motion + haptics + one constellation ──────────────────────────────
const READS_RM = /useMotionReduced|useReducedMotion|useBreath/;
for (const rel of ['src/components/hall-rings.tsx', 'src/components/holo-card.tsx']) {
  const src = read(rel);
  assert.match(src, READS_RM, `${rel} reads Reduce Motion`);
  assert.match(src, /forceReduceMotion/, `${rel} takes forceReduceMotion for the theme lab`);
}
const frame = read('src/components/legend-figure-card.tsx');
assert.match(frame, /useMotionReduced\(\)/, 'the binder frames read Reduce Motion');
assert.match(frame, /FadeIn\.duration\(HOLO\.reducedFadeMs\)/, 'Reduce Motion: a cross-fade, not a rise');
assert.match(frame, /FadeInDown\.delay\(index \* ENTER\.staggerMs\)/, 'cards rise 80 ms apart');
assert.match(frame, /<Sheen durationMs=\{SHIMMER\.durationMs\}/, 'locked frames shimmer (Sheen breathes under Reduce Motion)');
assert.match(frame, /state === 'ready' \?/, 'only a ready frame shimmers');
const holo = read('src/components/holo-card.tsx');
assert.match(holo, /haptic\.reveal\(\)/, 'Medium haptic at the swap');
assert.match(holo, /haptic\.stamp/, 'Heavy haptic on the stamp');
assert.match(holo, /rotateY/);
assert.match(holo, /<Sheen /, 'auto-sheen');
assert.doesNotMatch(holo, /Gesture|PanResponder|onPanResponder/, 'no gesture tilt');
assert.equal((holo.match(/<TraitConstellation\b/g) ?? []).length, 1, 'exactly one overlay constellation');
assert.match(holo, /variant="mini"/, 'the overlay is the still mini variant');
assert.equal((screen.match(/<TraitConstellation\b/g) ?? []).length, 0, 'the screen itself adds none');
assert.match(holo, /accessibilityElementsHidden/, 'the stamp is decoration');
ok('Reduce Motion in rings, holo and binder; Medium and Heavy haptics; auto-sheen only; one mini constellation');

// ── 44pt and the older rows ──────────────────────────────────────────────────
assert.match(screen, /router\.push\('\/roll'\)/, 'Your reveals › is kept');
assert.match(screen, /<TokenChip \/>/, 'the token chip is kept');
assert.match(read('src/components/hall-rings.tsx'), /minHeight: 44/, 'the overall row is 44pt');
ok('token chip and "Your reveals ›" kept; overall row is 44pt');

console.log(`\nlegends-g4: ${passed} groups passed`);
