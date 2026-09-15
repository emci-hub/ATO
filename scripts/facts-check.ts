/**
 * Sage-tab facts list (read/delete). Run: npm run check:facts
 *
 * Display is unfenced stored text. Create stays Chat "Teach Sage this".
 * Deleting the last fact is a real empty array, not a sticky once-true.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FACTS_EMPTY_COPY,
  FACTS_FORGET_CONFIRM,
  FACTS_SCREEN_TITLE,
  FACTS_SUMMARY_EMPTY,
  asFactsArray,
  factsSummaryLabel,
  withoutFactAt,
} from '../src/lib/facts';
import { depthTier, growthState, hasDepthSparkle } from '../src/lib/growth';
import { hasFirstFact, resolveBadges } from '../src/lib/badges';
import { findNudgeSignal } from '../src/lib/voice/nudge';
import { findRevealSignal } from '../src/lib/reveal';
import { pickQuestionGrounding } from '../src/lib/questions/context';
import { emptySageKnowsState } from '../src/lib/sage-knows';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(factsSummaryLabel(0), FACTS_SUMMARY_EMPTY);
assert.equal(factsSummaryLabel(1), 'Sage remembers 1 thing');
assert.equal(factsSummaryLabel(3), 'Sage remembers 3 things');
assert.equal(FACTS_SCREEN_TITLE, 'What Sage remembers');
assert.equal(
  FACTS_EMPTY_COPY,
  'Nothing here yet. Teach Sage something from a message in Talk.',
);
assert.equal(FACTS_FORGET_CONFIRM, 'Forget this?');
ok('summary, screen, empty, and forget copy match the box');

assert.deepEqual(asFactsArray(undefined), []);
assert.deepEqual(asFactsArray(['I finish work at four']), ['I finish work at four']);
assert.deepEqual(withoutFactAt(['keep', 'drop', 'keep'], 1), ['keep', 'keep']);
assert.deepEqual(withoutFactAt(['only'], 0), []);
assert.deepEqual(withoutFactAt(['only'], 4), ['only']);
ok('withoutFactAt removes one entry and can return []');

const meSrc = read('src/lib/me.ts');
const removeStart = meSrc.indexOf('export async function removeFact');
const addStart = meSrc.indexOf('export async function addFact');
assert.ok(removeStart > 0);
assert.ok(addStart > 0);
assert.match(meSrc.slice(removeStart), /withoutFactAt/);
assert.match(meSrc.slice(removeStart), /update\(\{ facts \}\)/);
assert.doesNotMatch(meSrc.slice(removeStart), /containsFrameworkTerm/);
assert.match(meSrc.slice(addStart, removeStart), /containsFrameworkTerm/);
ok('removeFact uses the existing update path and does not fence');

const ui = read('src/components/sage-facts.tsx');
assert.match(ui, /SageFactsCard/);
assert.match(ui, /removeFact/);
assert.match(ui, /FACTS_SCREEN_TITLE/);
assert.match(ui, /FACTS_EMPTY_COPY/);
assert.match(ui, /FACTS_FORGET_CONFIRM/);
assert.doesNotMatch(ui, /addFact/);
assert.doesNotMatch(ui, /framework-fence/);
assert.doesNotMatch(ui, /containsFrameworkTerm/);
assert.doesNotMatch(ui, /TextInput/);
assert.doesNotMatch(ui, /onChangeText/);
ok('Sage-tab viewer is read/delete only — no fence, no new write field');

const explore = read('src/app/(tabs)/explore.tsx');
assert.doesNotMatch(explore, /SageFactsCard/);
// Talk's backend was deleted 2026-09-14 and the Sage tab is an inert
// placeholder; these assertions should be re-earned when Talk is rebuilt.
// The facts summary lived on the Sage tab, below the 8-ball.
// Relocated to You 2026-09-14 when the Sage tab became a placeholder. This is
// the only surface that lists stored facts and the only path to delete one, so
// it has to live somewhere reachable — facts stay addable from chat either way.
const youTabFacts = read('src/app/(tabs)/you.tsx');
// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): You is parked down to sign
// out, delete account and AI consent. The component's own behaviour is still
// covered in this file; only its You mount site is gone.
assert.doesNotMatch(youTabFacts, /<SageFactsCard/);
assert.match(read('src/components/sage-facts.tsx'), /removeFact/);
ok('the facts list and its delete path still exist; their You mount site is parked');

// PARKED (ISOLATION_PLAN §7 Card F, 2026-09-15): /chat is parked with Circle,
// so the "Teach Sage this" create path has no screen behind it. `addFact` and
// the facts store are untouched — asserted directly below.
const chat = read('src/app/chat.tsx');
assert.doesNotMatch(chat, /Teach Sage this/);
assert.doesNotMatch(chat, /addFact/);
ok('the parked Chat screen carries no fact-create path');

// With Chat parked, `addFact` has exactly one definition and no UI caller.
// The assertion is inverted rather than dropped so that wiring a NEW create
// path anywhere still trips it — the rule was never "Chat may call it", it was
// "only one surface may".
const callers = ['src/app/chat.tsx', 'src/lib/me.ts', 'src/components/sage-facts.tsx']
  .map((file) => ({ file, src: read(file) }))
  .filter((row) => /addFact\(/.test(row.src));
assert.deepEqual(callers.map((row) => row.file), ['src/lib/me.ts']);
ok('addFact has no caller while Chat is parked — only its definition remains');

const grown = growthState({ facts: ['a', 'b', 'c'] }, 7);
assert.equal(grown.depth, 1);
assert.equal(depthTier(0), 0);
assert.equal(hasDepthSparkle(growthState({ facts: [] }, 7).depth), false);
assert.equal(hasFirstFact(0), false);
assert.equal(
  resolveBadges({ checkCount: 2, factCount: 0, checks: [] }).find((badge) => badge.id === 'first-fact')
    ?.unlocked,
  false,
);
assert.equal(
  findNudgeSignal({
    knocksYouOff: '',
    facts: [],
    history: [{ day: 1, status: 'done', read: 'One day.', do: 'After coffee, sit.' }],
  }),
  null,
);
assert.equal(
  findRevealSignal({
    checks: [],
    facts: [],
    checkCount: 0,
    factCount: 0,
    timeZone: 'UTC',
    now: new Date('2026-08-28T18:00:00Z'),
  }),
  null,
);
assert.equal(
  pickQuestionGrounding({ sage_knows: emptySageKnowsState(), facts: [] }, []).kind,
  'none',
);
ok('depth / first-fact / Nudge / Reveal / questions handle facts.length = 0 after a delete');

console.log(`\nAll ${passed} facts-list checks passed.`);
