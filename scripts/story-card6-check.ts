/**
 * Story v3 card 6 (writer bible §3b).
 * Run: npm run check:story-card6
 *
 * categoryName matches CATEGORY_DEFS, evidence echoes the scene, tip starts
 * with Tip: or Watch out:, no clinical / horoscope wording, word caps hold.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATEGORY_DEFS } from '../src/lib/categories';
import { STORY_LEAN_PHRASES, STORY_MAP_CATEGORY_LEAN_TODO, checkCard6, renderEveryCompatibleCombo } from '../src/lib/story-v3';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:story-card6'], 'tsx ./scripts/story-card6-check.ts');
ok('wired as check:story-card6');

for (const def of CATEGORY_DEFS) {
  assert.ok(STORY_LEAN_PHRASES[def.id], def.id);
  assert.equal(STORY_LEAN_PHRASES[def.id].high.length > 0, true);
  assert.equal(STORY_LEAN_PHRASES[def.id].low.length > 0, true);
}
assert.ok(STORY_MAP_CATEGORY_LEAN_TODO.includes('cat_love'));
ok('every category has a provisional leanPhrase; map high/low is flagged');

const combos = renderEveryCompatibleCombo();
const hard: string[] = [];
for (const script of combos) {
  for (const flag of checkCard6(script)) {
    hard.push(`${script.id} ${flag.code}: ${flag.message}`);
  }
}
assert.equal(hard.length, 0, hard.slice(0, 8).join('\n'));
ok(`${combos.length} card-6 blocks pass`);

console.log(`\n${passed} story-card6 checks passed`);
