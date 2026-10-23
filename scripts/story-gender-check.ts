/**
 * Story v3 gender (writer bible §2c).
 * Run: npm run check:story-gender
 *
 * Romantic roles stay unnamed and ungendered. Named people come from the
 * approved 26-name list (family roles like Aunt Rosa allowed). No two names
 * share a first letter.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { STORY_APPROVED_NAMES, checkGender, renderEveryCompatibleCombo } from '../src/lib/story-v3';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:story-gender'], 'tsx ./scripts/story-gender-check.ts');
ok('wired as check:story-gender');

assert.equal(STORY_APPROVED_NAMES.length, 26);
assert.ok(STORY_APPROVED_NAMES.includes('Rory'));
assert.ok(STORY_APPROVED_NAMES.includes('Riley'));
ok('approved name list is 26');

const combos = renderEveryCompatibleCombo();
const hard: string[] = [];
for (const script of combos) {
  for (const flag of checkGender(script)) {
    if (!flag.review) hard.push(`${script.id} ${flag.code}: ${flag.message}`);
  }
}
assert.equal(hard.length, 0, hard.slice(0, 8).join('\n'));
ok(`${combos.length} scripts pass romance / name / same-letter rules`);

console.log(`\n${passed} story-gender checks passed`);
