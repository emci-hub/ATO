/**
 * Daily insights cards — static source assertions (accessibility, Reduce
 * Motion, tokens only, no AI imports, placement).
 * Run: npm run check:daily-insights-ui
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
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:daily-insights-ui'], 'tsx ./scripts/daily-insights-ui-check.ts');
ok('wired as check:daily-insights-ui');

const dir = 'src/components/daily-insights';
const cards = {
  tryToday: read(`${dir}/try-today-card.tsx`),
  superpower: read(`${dir}/superpower-card.tsx`),
  conflict: read(`${dir}/conflict-style-card.tsx`),
};
const parts = read(`${dir}/script-parts.tsx`);
const all = { ...cards, parts };

for (const [name, src] of Object.entries(cards)) {
  assert.match(src, /accessibilityLabel=/, `${name} needs an accessibilityLabel`);
  assert.match(src, /\baccessible\b/, `${name} is one accessible group`);
}
ok('every card is an accessible group with a full label');

const t = cards.tryToday;
assert.match(t, /accessibilityRole="button"/);
assert.match(t, /accessibilityState=\{\{ disabled: done, checked: done \}\}/);
assert.match(t, /accessibilityHint=/);
assert.match(t, /minHeight: 44/);
assert.match(t, /minWidth: 44/);
assert.match(t, /announceForAccessibility/);
assert.ok(t.includes("'Did it ✓'") && t.includes("'Done today ✓'"));
ok('Try today button: role, state, hint, 44×44, announces, "Did it ✓" / "Done today ✓"');

assert.match(t, /import \{ useAppearance \} from '@\/lib\/theme\/context';/);
assert.match(t, /if \(!reduceMotion\)/);
assert.match(t, /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/);
assert.ok(!/confetti/i.test(t), 'no confetti');
ok('Reduce Motion from useAppearance: no scale/fade when on; haptics still fire');

for (const [name, src] of Object.entries(all)) {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${name} has a hard-coded hex colour`);
  assert.ok(!/rgba?\(/.test(src), `${name} has a hard-coded rgb colour`);
  assert.ok(!/@\/lib\/ai-library|@\/lib\/insight\/generate-insight|@\/lib\/supabase/.test(src), `${name} imports AI/supabase`);
  // `minHeight` is fine (tap targets); a fixed `height:` would clip Dynamic Type.
  assert.ok(!/\bheight: \d/.test(src), `${name} sets a fixed height`);
}
ok('existing tokens only (no hex / rgb), no AI or Supabase imports, no fixed heights');

assert.match(cards.tryToday, /emoji="🎯" label="Try this today"/);
assert.match(cards.superpower, /emoji="⚡" heading="Your superpower"/);
assert.match(cards.superpower, /emoji="🪫" heading="Your kryptonite"/);
assert.match(cards.superpower, /tipLabel="Tip"/);
assert.match(cards.superpower, /tipLabel="Watch out →"/);
assert.match(cards.conflict, /emoji="🗣️" label="How you argue"/);
assert.match(cards.conflict, /label="Strength"/);
assert.match(cards.conflict, /label="Watch out"/);
assert.match(cards.conflict, /label="Try"/);
assert.match(parts, /accessible=\{false\}/);
assert.match(parts, /splitSentences/);
ok('script style: emoji context line (decorative), one sentence per line, bold mini-labels');

const explore = read('src/app/(tabs)/explore.tsx');
assert.match(explore, /shouldShowTryToday\(/);
assert.match(explore, /dailyInsightsVisible\(/);
assert.match(explore, /<TryTodayCard/);
assert.match(explore, /<SuperpowerCard/);
assert.match(explore, /<ConflictStyleCard/);
assert.match(explore, /const unlocked = tracksOwner === userId && isFullProfileDone\(tracks, tracksReady\);/);
assert.match(explore, /const insightsVisible = unlocked && /);
assert.match(explore, /unlocked && shouldShowTryToday\(/);
const home = read('src/app/(tabs)/index.tsx');
assert.ok(!home.includes('TryTodayCard'), 'Home keeps the insight try line only (emci 2026-10-13)');
ok('all three cards on Explore behind the full-profile unlock + crisis gate; none on Home');

console.log(`\n${passed} daily-insights-ui checks passed`);
