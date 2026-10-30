/**
 * Quests content model + validator (ATO-BUILD PHASE-12).
 * Run: npm run check:quests
 *
 * Pins: every campaign in content/index.ts validates clean (references incl. both
 * d20 branches, paths <= 12 scenes, axis coverage, both poles, excluded axes,
 * beat/label limits, banned copy, frozen/retired ids, art keys); each broken
 * fixture in scripts/fixtures/quests-broken.ts fails with its clear message; the
 * copy fence catches jargon and passes ordinary words; content files never build
 * sentences by concatenation.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { questCopyHits } from '../src/lib/quests/banned';
import { QUEST_CAMPAIGNS } from '../src/lib/quests/content';
import { fmt, MSG } from '../src/lib/quests/strings';
import { EXCLUDED_QUEST_AXES, QUEST_AXES } from '../src/lib/quests/types';
import { validateCampaign } from '../src/lib/quests/validate';
import { TRAIT_AXES } from '../src/lib/traits';
import { BROKEN, withCheck } from './fixtures/quests-broken';

const root = resolve(__dirname, '..');
const ok = (msg: string) => console.log(`  ok  ${msg}`);

// 1. Real content is clean.
for (const c of QUEST_CAMPAIGNS) {
  const report = validateCampaign(c);
  assert.deepEqual(report.errors, [], `campaign ${c.id}:\n${report.errors.join('\n')}`);
  assert.ok(report.paths > 0, `${c.id} has no paths`);
  ok(fmt(MSG.ok, { id: c.id, scenes: c.scenes.length, paths: report.paths, longest: report.longest }));
}

// 1b. A valid d20 check (success AND fail both lead on) passes.
{
  const { errors } = validateCampaign(withCheck('lantern_s4b_shore', 'lantern_s5_way'));
  assert.deepEqual(errors, [], errors.join('\n'));
  ok('a d20 check whose fail branch leads on validates');
}

// 2. Axis lists: allowed + excluded cover only real axes and never overlap.
for (const a of [...QUEST_AXES, ...EXCLUDED_QUEST_AXES]) assert.ok((TRAIT_AXES as readonly string[]).includes(a), a);
assert.equal(QUEST_AXES.filter((a) => (EXCLUDED_QUEST_AXES as readonly string[]).includes(a)).length, 0);
ok('allowed and excluded axes are real and disjoint');

// 3. Broken fixtures fail with their message.
for (const fx of BROKEN) {
  const { errors } = validateCampaign(fx.build());
  assert.ok(errors.length > 0, `fixture "${fx.name}" passed but must fail`);
  for (const piece of fx.expect) {
    assert.ok(
      errors.some((e) => e.includes(piece)),
      `fixture "${fx.name}": expected a message with ${JSON.stringify(piece)}, got:\n${errors.join('\n')}`,
    );
  }
}
ok(`${BROKEN.length} broken fixtures each fail with a clear message`);
const [first] = BROKEN;
console.log(`      e.g. "${first.name}": ${validateCampaign(first.build()).errors[0]}`);

// 4. The fence: jargon and the three words fail, ordinary words pass.
for (const bad of ['Your personality shows.', 'A quick test of nerve.', 'Keep score.', 'Your autonomy grows.', 'A diagnosis.', 'You are an INFJ.']) {
  assert.ok(questCopyHits(bad).length > 0, `should fail: ${bad}`);
}
for (const good of ['Wade past the marked posts.', 'The lake is testing the stones.', 'A contest of nerve.', 'Rook carries a lantern.', 'The ocean hums.']) {
  assert.deepEqual(questCopyHits(good), [], `should pass: ${good}`);
}
ok('copy fence catches jargon, "test", "diagnosis", "score"; ordinary words pass');

// 5. Copy lives in content/strings only and is never concatenated.
const contentDir = resolve(root, 'src/lib/quests/content');
for (const file of readdirSync(contentDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
  const src = readFileSync(resolve(contentDir, file), 'utf8');
  assert.ok(!/\$\{/.test(src), `${file}: template interpolation builds sentences`);
  assert.ok(!/(['"`])\s*\+\s*(['"`])/.test(src), `${file}: string concatenation builds sentences`);
}
ok('content files hold whole sentences (no interpolation or concatenation)');

console.log('quests-check: all passed');
