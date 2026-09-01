/**
 * Sage tab load path. Run: npm run check:sage-load
 *
 * Locks the findings from the load-time investigation: history is the
 * paint-critical fetch, Talk context is a small query, the 8-ball stays
 * local, and framework-echo / Stage 11 traits are not on the mount path.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { filterCard } from '../src/lib/voice/filters';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

async function main() {
  const sage = read('src/app/(tabs)/sage.tsx');
  const eightBall = read('src/components/sage-eight-ball.tsx');
  const messages = read('src/lib/sage-messages.ts');
  const todayCardHook = read('src/hooks/use-today-card.ts');
  const todayCardLib = read('src/lib/today-card.ts');
  const checksLib = read('src/lib/checks.ts');
  const prompt = read('src/lib/voice/providers/prompt.ts');
  const filters = read('src/lib/voice/filters.ts');

  assert.doesNotMatch(sage, /from '@\/lib\/voice\/router'/);
  assert.doesNotMatch(sage, /routeVoiceCard/);
  assert.doesNotMatch(sage, /filterCard/);
  assert.doesNotMatch(sage, /containsFrameworkTerm/);
  assert.doesNotMatch(sage, /traitPromptLines/);
  assert.doesNotMatch(sage, /from '@\/lib\/traits'/);
  ok('Sage mount does not run the card router, framework-echo fence, or a trait query');

  assert.match(sage, /useMeContext/);
  assert.doesNotMatch(sage, /useMe\(/);
  assert.doesNotMatch(sage, /fetchMe\(/);
  ok('Stage 11 columns arrive on the shared ME row — Sage does not re-fetch traits');

  assert.match(sage, /useTodayCard/);
  assert.match(todayCardHook, /loadTodayCard/);
  assert.match(todayCardLib, /AsyncStorage\.getItem\(TODAY_CARD_KEY\)/);
  assert.doesNotMatch(todayCardHook, /routeVoiceCard/);
  ok('useTodayCard is an AsyncStorage read, not a generate');

  assert.match(sage, /fetchTalkHistory/);
  assert.match(sage, /history: checksToHistory\(talk\.checks\)/);
  const exploreScreen = read('src/app/(tabs)/explore.tsx');
  assert.match(exploreScreen, /fetchChecks\(/);
  assert.match(exploreScreen, /checksToHistory\(exploreChecks\)/);
  assert.match(checksLib, /export const TALK_RECENT_CHECKS = 5/);
  assert.match(prompt, /export const TALK_PROMPT_HISTORY = 5/);
  ok('Talk context is last 5 Checks; Explore uses full fetchChecks history');

  assert.match(sage, /historyReady/);
  assert.match(sage, /peekSageMessages/);
  assert.match(messages, /peekSageMessages/);
  assert.match(messages, /\.eq\('user_id', userId\)/);
  ok('History has a loading state and an in-memory remount cache');

  assert.doesNotMatch(sage, /from '@\/lib\/voice\/talk'/);
  assert.match(sage, /import\('@\/lib\/voice\/talk'\)/);
  ok('Talk router is loaded on send, not on first Sage paint');

  assert.match(sage, /SageEightBall/);
  assert.doesNotMatch(eightBall, /from 'react-native-svg'/);
  assert.match(eightBall, /SageOrb/);
  ok('8-ball is local Views — no SVG parse on Sage open');

  assert.match(filters, /framework-echo/);
  const card = {
    read: 'Day 4. Mixed run — some did, some skip.',
    do: 'After you make coffee, write one line about today.',
  };
  const t0 = performance.now();
  for (let i = 0; i < 2000; i += 1) {
    filterCard(card, { shownCards: [], crisisToday: false, previousHadCut: false });
    containsFrameworkTerm('They tend to get energy from quieter time.');
  }
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 50, `framework-echo fence took ${elapsed.toFixed(1)}ms for 2000 runs`);
  ok(`framework-echo fence is cheap (${elapsed.toFixed(1)}ms / 2000 runs) — not a Sage load cost`);

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
