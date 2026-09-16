/**
 * No AI call fires without a user tap.
 * Run: npm run check:no-auto-ai
 *
 * emci's hard rule (2026-09-15, ISOLATION_PLAN §7.0 item 5): every model call
 * in the shipped spine is behind a press. Not a UX preference — an auto-firing
 * effect on the screen every user lands on is the most expensive bug this app
 * can have, and it had two of them: Home's daily insight generated from a
 * `useEffect` as soon as consent existed, and the Story fold generated on
 * mount as soon as the profile looked ready (with no consent check at all).
 *
 * A name-only scan would not have caught either: the Story fold's effect just
 * called `void run()`, and `run` did the spending. So this check follows calls.
 * For every kept file it builds a map of the functions declared inside it,
 * marks the ones that reach a generator (directly or through another local
 * function, to a fixpoint), and then asserts that no `useEffect` body mentions
 * any of them.
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

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

/**
 * The kept spine: the three live screens plus every still-active component of
 * theirs that can reach a model. A screen parked behind RebuiltNotice cannot
 * reach one at all (that is `check:rebuilt`'s job), so parked files are not
 * listed here.
 */
const KEPT: string[] = [
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/explore.tsx',
  'src/app/(tabs)/intake-sweep.tsx',
  'src/components/sage-story-fold.tsx',
  'src/components/categories-fold.tsx',
  'src/components/questions-fold.tsx',
  'src/components/full-profile-fold.tsx',
];

/**
 * Components that generate on mount and are therefore NOT allowed back into
 * the spine. `sage-title-card.tsx` is the case that made this list: it
 * generated an axis title from a `useEffect`, and rode into Explore inside
 * FullProfileFold long after Explore's own call site was parked. It has zero
 * importers now and is deleted in Card F; until then, nothing may mount it.
 */
const BANNED_IN_SPINE = ['SageTitleCard'];

/** Every function that ends in a model call. Named at their call sites, not by module. */
const GENERATORS = [
  'generateText',
  'generateDailyInsight',
  'generateStoryBody',
  'generateExploreBody',
  'generateQuestionBatch',
  'generateOngoingRoundBatch',
  'generateCategoryStatements',
  'claimAiCall',
  // Composers that end in one of the above. `runOngoingRound` is why this list
  // is not just the four `generate*` names: the ongoing round auto-started
  // itself from its own load effect, several chunked AI calls deep, and a
  // scan for `generate*` alone walked straight past it (found in Card D).
  'runOngoingRound',
  'composeOngoingRound',
  'prewarmBankPool',
];

/**
 * Bodies of every `useEffect(...)` / `useFocusEffect(...)` call in a file,
 * found by matching parens from the opening one so nested calls are included.
 */
function effectBodies(code: string): string[] {
  const bodies: string[] = [];
  const hook = /\b(useEffect|useFocusEffect|useLayoutEffect)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = hook.exec(code)) != null) {
    let depth = 0;
    let i = match.index + match[0].length - 1;
    const start = i;
    for (; i < code.length; i += 1) {
      if (code[i] === '(') depth += 1;
      else if (code[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(code.slice(start, i + 1));
  }
  return bodies;
}

/**
 * Names of functions declared in the file, mapped to their source text.
 * Covers `function foo`, `const foo = () =>`, `const foo = async () =>` and
 * `const foo = useCallback(...)` — every shape the spine actually uses. The
 * body is taken as everything up to the next declaration at the same or lower
 * indentation, which over-captures rather than under-captures: a false
 * "this spends" is a failing check someone reads, a missed one is a silent bill.
 */
function localFunctions(code: string): Map<string, string> {
  const out = new Map<string, string>();
  const decl =
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:^|\n)\s*const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\(|useCallback\()/g;
  const starts: { name: string; at: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = decl.exec(code)) != null) {
    starts.push({ name: match[1] ?? match[2], at: match.index });
  }
  starts.forEach((entry, index) => {
    const end = starts[index + 1]?.at ?? code.length;
    out.set(entry.name, code.slice(entry.at, end));
  });
  return out;
}

for (const rel of KEPT) {
  const code = codeOnly(read(rel));
  const functions = localFunctions(code);

  // Fixpoint: a function spends if it names a generator, or names another
  // function that spends.
  const spenders = new Set<string>();
  for (const [name, body] of functions) {
    if (GENERATORS.some((gen) => body.includes(gen))) spenders.add(name);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, body] of functions) {
      if (spenders.has(name)) continue;
      for (const spender of spenders) {
        if (name !== spender && new RegExp(`\\b${spender}\\b`).test(body)) {
          spenders.add(name);
          grew = true;
          break;
        }
      }
    }
  }

  for (const body of effectBodies(code)) {
    for (const gen of GENERATORS) {
      assert.ok(
        !body.includes(gen),
        `${rel}: a useEffect calls ${gen} directly. Every model call must be behind a user tap (ISOLATION_PLAN §7.0 item 5).`,
      );
    }
    for (const spender of spenders) {
      assert.ok(
        !new RegExp(`\\b${spender}\\b`).test(body),
        `${rel}: a useEffect reaches '${spender}', which ends in a model call. Move it behind a press — this is exactly how the Story fold used to spend a call on every cold open.`,
      );
    }
  }
  ok(`${rel}: no model call reachable from an effect`);
}

for (const rel of KEPT) {
  const code = codeOnly(read(rel));
  for (const banned of BANNED_IN_SPINE) {
    assert.doesNotMatch(
      code,
      new RegExp(String.raw`${banned}`),
      `${rel} mounts ${banned}, which generates on mount. It may not be part of the shipped spine.`,
    );
  }
}
ok('no mount-time generator component is mounted anywhere in the spine');

// ---------------------------------------------------------------------------
// The two specific regressions this check was written for.
// ---------------------------------------------------------------------------

const home = codeOnly(read('src/app/(tabs)/index.tsx'));
assert.match(home, /const loadInsight = useCallback/, 'Home must load the insight from a tap handler');
assert.match(home, /onPress=\{\(\) => \{\s*void loadInsight\(\);/, 'the insight handler must be wired to a press');
ok('Home generates the daily insight only from "Load insight"');

const story = codeOnly(read('src/components/sage-story-fold.tsx'));
assert.match(story, /const loadStory = useCallback/, 'the Story fold must load from a tap handler');
assert.match(story, /onPress=\{\(\) => \{\s*void loadStory\(\);/, 'the story handler must be wired to a press');
// Readiness is reported, not paid for.
assert.match(
  story,
  /if \(!storyReady\(tracks\)\) \{[\s\S]{0,120}setState\('not_ready'\);/,
  'an unready profile must get the not-ready message with no model call behind it',
);
ok('Story generates only from "Load story", and says "not ready" without calling a model');

console.log(`\n${passed} no-auto-ai checks passed`);
