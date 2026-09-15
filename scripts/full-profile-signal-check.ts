/**
 * One "full profile is done" signal, and only one.
 * Run: npm run check:full-profile-signal
 *
 * emci's call (2026-09-15, ISOLATION_PLAN §7.1 decision 8): every unlock in the
 * tap-gated flow — Home "Load insight", Home "Load story", Questions "next 25
 * questions", Explore "Load categories" — gates on the SAME thing: every
 * question in the local bank answered. Before this there were two signals
 * (Home's bank progress, everyone else's axis-settledness) and they disagreed,
 * which is how you ship an enabled button that has nothing to say.
 *
 * This check exists because that kind of split re-grows quietly: the next
 * person to add an unlock re-derives `answered >= total` inline, or gates on
 * `storyReady`, and nothing fails. So: exactly one module may derive the gate.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

const GATE = 'src/lib/full-profile-gate.ts';

// ---------------------------------------------------------------------------
// The module itself.
// ---------------------------------------------------------------------------

assert.ok(existsSync(resolve(root, GATE)), `${GATE} must exist — it is the one place the unlock gate is derived`);
const gate = read(GATE);

assert.match(gate, /export function isFullProfileDone/);
assert.match(gate, /export function fullProfileProgress/);
assert.match(gate, /export const FULL_PROFILE_LOCKED_COPY/);
ok('full-profile-gate exports the gate, the progress figure and the locked copy');

// The gate is bank progress, per emci's Q2 answer — not settledness.
assert.match(codeOnly(gate), /bankTotalProgress/);
assert.doesNotMatch(
  codeOnly(gate),
  /storyReady|settledCount|settledAxisLabel|isProfileSettled/,
  'the gate must be bank progress only — axis settledness is content readiness, judged inside each generator, never the unlock gate',
);
ok('the gate is bank progress, with no settledness gate mixed in');

// `tracksReady` is part of the contract: without it a finished user sees the
// locked state flash before tracks land.
assert.match(gate, /tracksReady: boolean/);
ok('isFullProfileDone takes an explicit tracksReady flag');

// ---------------------------------------------------------------------------
// Nobody else derives it.
// ---------------------------------------------------------------------------

/**
 * `bankTotalProgress` itself stays public — progress *copy* ("12 of 50") is a
 * legitimate read, and Questions' milestone metrics count raw answers. What may
 * not be re-derived anywhere else is the COMPARISON that decides an unlock.
 */
const DONE_COMPARISON = /answered\s*>=\s*[\w.]*total|answered\s*===\s*[\w.]*total|\.answered\s*>=\s*\d+/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const offenders = walk('src')
  .filter((rel) => rel !== GATE)
  .filter((rel) => DONE_COMPARISON.test(codeOnly(read(rel))));

assert.deepEqual(
  offenders,
  [],
  `these files re-derive the full-profile gate inline instead of importing isFullProfileDone from ${GATE}: ${offenders.join(', ')}`,
);
ok('no file outside the gate module re-derives "every bank question answered"');

// ---------------------------------------------------------------------------
// The kept screens read the one signal.
// ---------------------------------------------------------------------------

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /from '@\/lib\/full-profile-gate'/, 'Home must read the shared gate, not its own derivation');
assert.doesNotMatch(
  codeOnly(home),
  /bankTotalProgress/,
  'Home must not import bankTotalProgress directly — that is what produced the second, divergent signal',
);
ok('Home reads the shared gate');

const explore = codeOnly(read('src/app/(tabs)/explore.tsx'));
assert.match(explore, /isFullProfileDone/, 'Explore must gate Load categories on the shared signal');
const fold = codeOnly(read('src/components/questions-fold.tsx'));
assert.match(fold, /isFullProfileDone/, 'Questions must gate the round on the shared signal');
const story = codeOnly(read('src/components/sage-story-fold.tsx'));
assert.match(story, /unlocked: boolean/, 'the Story fold must take the shared gate as a prop');

/**
 * The paid question batch is the one gate that is not a visible button, and it
 * was the last place the two signals disagreed: `routeQuestions` allowed a
 * model call once `isProfileComplete` passed (one answer on each of the 16
 * axes, reached ~20 questions in) while every visible unlock still needed the
 * full bank. Expanding the Questions fold at that point spent a call. Both
 * must hold.
 */
const route = codeOnly(read('src/lib/questions/route.ts'));
assert.match(
  route,
  /isProfileComplete\(input\.tracks \?\? \[\]\) && isFullProfileDone\(input\.tracks \?\? \[\], true\)/,
  'the paid question batch must require the shared unlock gate as well as per-axis completeness',
);
ok('Explore, Questions, Story and the paid question batch all read the one signal');

console.log(`\n${passed} full-profile-signal checks passed`);
