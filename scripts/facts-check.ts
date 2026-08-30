/**
 * You-tab facts list (read/delete). Run: npm run check:facts
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
ok('You-tab viewer is read/delete only — no fence, no new write field');

const you = read('src/app/(tabs)/you.tsx');
assert.match(you, /SageFactsCard/);
const intakeIdx = you.indexOf('<IntakeSettings');
const factsIdx = you.indexOf('<SageFactsCard');
assert.ok(intakeIdx > 0 && factsIdx > intakeIdx);
ok('facts summary sits with How you show up on You');

const chat = read('src/app/chat.tsx');
assert.match(chat, /Teach Sage this/);
assert.match(chat, /await addFact\(/);
assert.equal((chat.match(/addFact/g) ?? []).length > 0, true);
ok('Teach Sage this in Chat is unchanged');

const callers = ['src/app/chat.tsx', 'src/lib/me.ts', 'src/components/sage-facts.tsx']
  .map((file) => ({ file, src: read(file) }))
  .filter((row) => /addFact\(/.test(row.src));
assert.deepEqual(
  callers.map((row) => row.file),
  ['src/app/chat.tsx', 'src/lib/me.ts'],
);
ok('addFact is still only called from Chat');

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
