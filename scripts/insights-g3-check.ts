/**
 * Insights, gamified (ATO-BUILD PHASE-09).
 * Run: npm run check:insights-g3
 *
 * Pins: the spectrum maths (top 3 clear leans, poles, confidence band, spoken
 * words), the typewriter maths, the "Insights seen" store maths and its own
 * key (Home's `ato.insights.seen.v1` keeps its shape), the new motion tokens,
 * the flip card's Reduce Motion branch, the read-only token chip, the Quests
 * slot, and Home's carry-over (`markInsightsSeen` on opening Insights).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLE_NAME } from '../src/lib/axis-poles';
import { ALL_IDEAS } from '../src/lib/insight-bank';
import {
  INSIGHT_COLLECTION_KEY,
  INSIGHT_COLLECTION_TOTAL,
  addToCollection,
  collectionPercent,
  parseCollection,
} from '../src/lib/insight-collection';
import { BAND_MAX_HALF, BAND_MIN_HALF, SPECTRUM_COUNT, bandHalfWidth, spectrumRows } from '../src/lib/insights-spectrum';
import { TYPEWRITER_STEPS, keyWordRange, revealCount, splitAtKeyWord } from '../src/lib/insights-typewriter';
import type { TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(rel), 'utf8');
const now = new Date('2026-10-27T12:00:00Z');
const track = (axis: TraitAxis, value: number, stability = 0.8, answerCount = 6): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability,
  answerCount,
  lastTouched: now.toISOString(),
  lastDepthAt: null,
});

// ── Spectrum maths ───────────────────────────────────────────────────────────
assert.equal(SPECTRUM_COUNT, 3);
assert.deepEqual(spectrumRows([], now), [], 'no tracks: no sliders (the section is hidden)');
assert.deepEqual(spectrumRows([track('openness', 0.55), track('steadiness', 0.45)], now), [], 'nothing leans clearly yet');
const rows = spectrumRows(
  [
    track('openness', 0.9), // 0.40 from the middle
    track('extraversion', 0.2), // 0.30
    track('steadiness', 0.7), // 0.20
    track('agreeableness', 0.62), // 0.12
    track('playfulness', 0.5),
  ],
  now,
);
assert.deepEqual(rows.map((r) => r.axis), ['openness', 'extraversion', 'steadiness'], 'strongest first, only the top 3');
assert.equal(rows[0].lowLabel, AXIS_POLE_NAME.openness.low);
assert.equal(rows[0].highLabel, AXIS_POLE_NAME.openness.high);
assert.notEqual(rows[0].lowLabel, rows[0].highLabel);
assert.ok(rows.every((r) => r.value >= 0 && r.value <= 1 && r.bandLow >= 0 && r.bandHigh <= 1 && r.bandLow <= r.value && r.value <= r.bandHigh));
ok('top 3 clear leans, strongest first, each between its own two pole labels');

assert.equal(bandHalfWidth(1), BAND_MIN_HALF, 'a settled axis keeps a minimum band');
assert.equal(bandHalfWidth(0), BAND_MAX_HALF, 'an unsettled axis is capped');
assert.ok(bandHalfWidth(0.3) > bandHalfWidth(0.8), 'less settled = wider');
assert.equal(bandHalfWidth(Number.NaN), BAND_MAX_HALF, 'junk stability is the widest band, never a crash');
const edge = spectrumRows([track('openness', 0.99, 0.1)], now)[0];
assert.equal(edge.bandHigh, 1, 'the band is clamped at the pole');
ok('confidence band: wider when less settled, clamped to 0..1');

for (const r of rows) {
  assert.ok(!/\d/.test(r.spoken), `spoken value has no digits: ${r.spoken}`);
  assert.ok(r.spoken.includes(r.lowLabel) && r.spoken.includes(r.highLabel), 'both poles are spoken');
  assert.doesNotMatch(r.spoken, /\b(good|bad|better|worse|high score|low score)\b/i, 'neither end is good or bad');
}
ok('VoiceOver gets the position in words: no digits, both poles named, no good/bad');

// ── Typewriter maths ─────────────────────────────────────────────────────────
const line = 'You hear the room before you decide anything';
assert.equal(TYPEWRITER_STEPS, 28);
assert.equal(revealCount(0, line.length), 0);
assert.equal(revealCount(TYPEWRITER_STEPS, line.length), line.length);
assert.equal(revealCount(99, line.length), line.length, 'never past the end');
let prev = 0;
for (let s = 0; s <= TYPEWRITER_STEPS; s++) {
  const n = revealCount(s, line.length);
  assert.ok(n >= prev && Number.isInteger(n), 'monotonic whole characters');
  prev = n;
}
assert.equal(revealCount(5, 0), 0, 'empty text');
const [b, k, a] = splitAtKeyWord(line);
assert.equal(b + k + a, line, 'the three parts rebuild the line');
assert.equal(k, 'anything', 'the longest word glows (first on a tie)');
assert.equal(keyWordRange('Go on, be you'), null, 'no word of 5+ letters: no glow');
ok('typewriter: 28 whole-character steps, never past the end; the longest word is the glowing key word');

// ── Insights seen ────────────────────────────────────────────────────────────
assert.equal(INSIGHT_COLLECTION_KEY, 'ato.insights.collection.v1');
assert.notEqual(INSIGHT_COLLECTION_KEY, 'ato.insights.seen.v1', 'Home keeps its own key');
assert.ok(INSIGHT_COLLECTION_KEY.startsWith('ato.'), 'wiped by clearLocalAccountData (deny-by-default)');
assert.equal(INSIGHT_COLLECTION_TOTAL, ALL_IDEAS.length);
assert.ok(INSIGHT_COLLECTION_TOTAL > 0);
const ids = ['a', 'b'];
assert.deepEqual(parseCollection(JSON.stringify({ userId: 'u', ids }), 'u'), ids);
assert.deepEqual(parseCollection(JSON.stringify({ userId: 'someone', ids }), 'u'), [], "another account's set is never read");
for (const raw of [null, '', '{', 'null', '[]', '42', JSON.stringify({ userId: 'u', ids: 'x' })]) {
  assert.deepEqual(parseCollection(raw, 'u'), [], `corrupt: ${raw}`);
}
assert.deepEqual(parseCollection(JSON.stringify({ userId: 'u', ids: ['a', 'a', 3, 'b'] }), 'u'), ['a', 'b'], 'dedupes, drops non-strings');
assert.deepEqual(addToCollection(['a'], 'b'), { ids: ['a', 'b'], added: true });
assert.deepEqual(addToCollection(['a'], 'a'), { ids: ['a'], added: false }, 'the same idea never counts twice');
assert.equal(collectionPercent(0, 448), 0);
assert.equal(collectionPercent(224, 448), 50);
assert.equal(collectionPercent(9999, 448), 100);
assert.equal(collectionPercent(1, 0), 0, 'no total: 0, not NaN');
const homeStore = read('src/lib/home-path-store.ts');
assert.match(homeStore, /INSIGHTS_SEEN_KEY = 'ato\.insights\.seen\.v1'/);
assert.match(homeStore, /readJson<\{ userId: string; ymd: string \}>\(INSIGHTS_SEEN_KEY\)/, "Home's seen shape is unchanged");
ok('Insights seen: its own owner-tagged key, dedupes, corrupt/foreign data is empty, Home\'s key untouched');

// ── Motion tokens ────────────────────────────────────────────────────────────
const tokens = read('src/lib/motion-tokens.ts');
assert.match(tokens, /FLIP = \{[^}]*totalMs: 700[^}]*perspective: 900/s);
assert.match(tokens, /TYPEWRITER = \{[^}]*steps: 28[^}]*totalMs: 1400[^}]*delayMs: 400[^}]*glowMs: 3000/s);
assert.match(tokens, /BAR_FILL = \{[^}]*durationMs: 1000[^}]*sliderStaggerMs: 150[^}]*tileStaggerMs: 120[^}]*iconPopMs: 350/s);
const flipMs = Number(/FLIP = \{[^}]*totalMs: (\d+)/s.exec(tokens)?.[1]);
const blockMax = Number(/BLOCKING_MAX_MS = (\d+)/.exec(tokens)?.[1]);
assert.ok(flipMs > 0 && flipMs <= blockMax, 'a flip blocks input for BLOCKING_MAX_MS or less');
const tokenSteps = /TYPEWRITER = \{[^}]*steps: (\d+)/s.exec(tokens)?.[1];
assert.ok(tokenSteps, 'TYPEWRITER.steps is in the tokens');
assert.equal(Number(tokenSteps), TYPEWRITER_STEPS, 'the typewriter maths and the token agree on the step count');
ok('motion tokens: flip 700/900, typewriter 28 steps / 1400 / 400 / glow 3 s, bars 1000 with 150 and 120 staggers, icon pop 350');

// ── Flip card ────────────────────────────────────────────────────────────────
const flip = read('src/components/flip-card.tsx');
assert.match(flip, /useBreath\(forceReduceMotion\)/, 'the card breathes under Reduce Motion');
assert.match(flip, /if \(rm\) fade\.value = withTiming\(0/, 'Reduce Motion cross-fades');
assert.match(flip, /rotateY: `\$\{rotate\.value\}deg`/);
assert.match(flip, /rotate\.value = -90/, 'the second half starts edge-on, so the back is never mirrored');
assert.match(flip, /haptic\.commit\(\)/, 'Light haptic at the swap');
assert.match(flip, /minHeight: 44/, 'the flip button is 44 pt');
assert.match(flip, /accessibilityRole="button"/);
assert.match(flip, /display: 'none'/, 'both faces stay mounted');
assert.match(flip, /announceForAccessibility/, 'VoiceOver is told which face is up');
assert.match(read('src/app/(tabs)/insights.tsx'), /front=\{focusCard\}/, 'the focus card sits in one stable wrapper (no remount when Try arrives)');
ok('flip card: rotateY with the second half edge-on, Light haptic at the swap, Reduce Motion cross-fade + breathe, 44 pt button');

// ── Screen ───────────────────────────────────────────────────────────────────
const screen = read('src/app/(tabs)/insights.tsx');
assert.match(screen, /\{\/\* QUESTS_CARD_SLOT \*\/\}/, 'the slot PHASE-23 fills');
assert.match(screen, /markInsightsSeen\(userId, todayYmd\)/, 'opening Insights ticks Home\'s step');
assert.match(screen, /if \(userId && todayYmd && showsInsight\)/, 'only when a card is on screen');
assert.match(screen, /testID="insights-error"/, 'a failed load is a calm card, not a forever skeleton');
assert.match(screen, /<TokenChip \/>/, 'the token chip stays in the header');
const chip = read('src/components/token-chip.tsx');
assert.match(chip, /router\.push\('\/you\?section=tokens'\)/);
assert.match(chip, /minHeight: 44/);
assert.doesNotMatch(chip.replace(/\/\*[\s\S]*?\*\//g, ''), /claim|spend|rpc\(|supabase/i, 'the chip only reads');
assert.match(read('src/lib/you-sections.ts'), /'tokens'/, '/you?section=tokens is a real section');
ok('screen: Quests slot, opening Insights ticks Home\'s step, error card, read-only token chip → /you?section=tokens');

const typed = read('src/components/typewriter-text.tsx');
assert.match(typed, /FadeIn\.duration\(300\)/, 'Reduce Motion: the full text fades in');
assert.match(typed, /const typing = animate && !rm/);
assert.match(typed, /useMotionActive/, 'the glow pauses off-screen');
assert.match(typed, /accessibilityLabel=\{text\}/, 'VoiceOver reads the whole line at once');
const focus = read('src/components/insights/today-focus-card.tsx');
assert.match(focus, /<TypewriterText key=\{insight\.title\} text=\{insight\.title\} animate=\{typedTitle === insight\.title\}/, 'plays once, for a freshly loaded insight');
assert.match(focus, /<Sheen borderRadius=\{Spacing\.four\}>/);
const tri = read('src/components/daily-insights/try-today-card.tsx');
assert.match(tri, /haptic\.success\(\)/, '"I tried it" buzzes Success');
assert.match(tri, /withSpring\(1, SPRING_POP\)/, 'check pop');
ok('typewriter: Reduce Motion fade, whole line for VoiceOver; focus card plays it once and wears the sheen; "I tried it" pops + Success');

// ── Economy + isolation ──────────────────────────────────────────────────────
for (const rel of [
  'src/components/flip-card.tsx',
  'src/components/typewriter-text.tsx',
  'src/components/spectrum-slider.tsx',
  'src/components/insight-collection.tsx',
  'src/components/icon-pop.tsx',
  'src/lib/insights-spectrum.ts',
  'src/lib/insights-typewriter.ts',
  'src/lib/insight-collection.ts',
  'src/lib/insight-collection-store.ts',
]) {
  const src = read(rel);
  assert.doesNotMatch(src, /from '@\/play\//, `${rel} stays out of src/play`);
  assert.doesNotMatch(src, /generateText|claimAiCall|supabase|fetch\(/, `${rel} calls nothing and charges nothing`);
}
ok('no import from src/play, no network, model call, token charge or quota');

console.log(`insights-g3: ${passed} groups passed`);
