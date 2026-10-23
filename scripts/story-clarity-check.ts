/**
 * Story v3 clarity (writer bible §2b).
 * Run: npm run check:story-clarity
 *
 * Lines over 14 words, comma-chains and two-sentence narrator lines are
 * listed for human review and do not fail the gate. A narrator line over
 * 25 words (bible §2) does fail.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkClarity, lineText, lineWords, renderEveryCompatibleCombo } from '../src/lib/story-v3';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:story-clarity'], 'tsx ./scripts/story-clarity-check.ts');
ok('wired as check:story-clarity');

const combos = renderEveryCompatibleCombo();
const reviews: string[] = [];
const hard: string[] = [];
for (const script of combos) {
  for (const flag of checkClarity(script)) {
    const line = `${script.id} ${flag.code}: ${flag.message}`;
    if (flag.review) reviews.push(line);
    else hard.push(line);
  }
  for (const beat of ['hook', 'twist', 'move', 'punchline'] as const) {
    for (const row of script[beat]) {
      if (row.kind !== 'narrator') continue;
      if (lineWords(lineText(row)) > 25) {
        hard.push(`${script.id} over-25: ${row.text}`);
      }
    }
  }
}
if (reviews.length) {
  console.log(`  · ${reviews.length} clarity flags for human review (not a fail)`);
}
assert.equal(hard.length, 0, hard.slice(0, 8).join('\n'));
ok(`${combos.length} scripts: no narrator line over 25 words`);

console.log(`\n${passed} story-clarity checks passed`);
