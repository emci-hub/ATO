/**
 * Appearance-mode contrast + wiring. Run: npm run check:appearance
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { APPEARANCE_IDS, APPEARANCES } from '../src/constants/appearance';
import { contrastRatio, meetsAa } from '../src/lib/theme/contrast';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.deepEqual([...APPEARANCE_IDS], ['soft', 'zen', 'quest', 'neon', 'anime']);
ok('picker order is Soft / Zen / Quest / Neon / Anime');

for (const id of APPEARANCE_IDS) {
  const t = APPEARANCES[id];
  const pairs: [string, string, string][] = [
    ['text on background', t.text, t.background],
    ['text on surface', t.text, t.backgroundElement.startsWith('#') ? t.backgroundElement : t.background],
    ['secondary on background', t.textSecondary, t.background],
    [
      'secondary on selected',
      t.textSecondary,
      t.backgroundSelected.startsWith('#') ? t.backgroundSelected : t.background,
    ],
    ['onAccent on accentFill', t.onAccent, t.accentFill],
  ];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(meetsAa(fg, bg), `${id} ${label} ${fg} on ${bg} = ${ratio?.toFixed(2)}`);
  }
  ok(`${id}: body, surface, secondary, and filled-accent pairs meet WCAG AA 4.5:1`);
}

const zen = APPEARANCES.zen;
const zenSecondaryOnSurface = contrastRatio(zen.textSecondary, zen.backgroundElement);
assert.ok(zenSecondaryOnSurface != null && zenSecondaryOnSurface >= 4.5, `Zen secondary on surface ${zenSecondaryOnSurface}`);
assert.equal(zen.textSecondary, '#6B6356');
assert.notEqual(zen.textSecondary, '#7A7062');
ok(`Zen corrected secondary #6B6356 on #EDE9E1 is ${zenSecondaryOnSurface?.toFixed(2)}:1`);

assert.equal(zen.accentFill, zen.text);
ok('Zen moss/sand are not used as a fill behind text');

const neonFill = contrastRatio(APPEARANCES.neon.onAccent, APPEARANCES.neon.accentFill);
assert.ok(neonFill != null && neonFill >= 4.5);
ok(`Neon filled button uses a darker cyan fill (${neonFill?.toFixed(2)}:1), not raw #00FFFF under white`);

const root = path.resolve(__dirname, '..');
const picker = fs.readFileSync(path.join(root, 'src/components/appearance-picker.tsx'), 'utf8');
const you = fs.readFileSync(path.join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'docs/ATO_PLAN_v2.md'), 'utf8');
const now = fs.readFileSync(path.join(root, 'docs/NOW.md'), 'utf8');

assert.match(you, /AppearancePicker/);
assert.match(picker, /Soft is the default/);
assert.match(layout, /AppearanceProvider/);
assert.match(plan, /Soft \/ Zen \/ Quest \/ Neon \/ Anime/);
assert.doesNotMatch(plan, /Colors: Ink \/ Paper \/ Steel \/ Bloom/);
assert.match(now, /intentional deviation/i);
ok('You picker, launch provider, and docs are wired');

console.log(`\nappearance-check: ${passed}/${passed} passed`);
