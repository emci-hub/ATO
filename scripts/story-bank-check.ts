/**
 * Hand-written Story bank (emci 2026-10-13).
 * Run: npm run check:story-bank
 *
 * Every bank row must pass the same parser as a model card, cover each
 * category × friends/work/home (both leans), and stay distinct on hooks.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATEGORY_DEFS } from '../src/lib/categories';
import {
  STORY_BANK,
  STORY_BANK_COPY_REVIEWED,
  bankEntryToCard,
  fillStoryPlaceholders,
  pickStoryBankCard,
  rawStoryBank,
} from '../src/lib/story-bank';
import {
  BANK_SKIP_RECENT,
  bankIdsToSkip,
  nextBankSeenIds,
} from '../src/lib/story-bank/history';
import {
  STORY_FEW_SHOTS,
  STORY_HOOK_VARIETY_LIMIT,
  parseStoryCardAnswer,
  storyOverlap,
} from '../src/lib/story-card';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:story-bank'], 'tsx ./scripts/story-bank-check.ts');
ok('wired as check:story-bank');

assert.equal(STORY_BANK_COPY_REVIEWED, false, 'bank copy stays unreviewed until emci reads it');
assert.ok(STORY_BANK.length >= 60, `bank has ${STORY_BANK.length} stories, needs 60+`);
ok(`${STORY_BANK.length} stories loaded`);

const raw = rawStoryBank();
assert.ok(Array.isArray(raw) && raw.length === STORY_BANK.length, 'every JSON row parsed');

const ids = new Set<string>();
const titles = new Set<string>();
for (const row of STORY_BANK) {
  assert.ok(!ids.has(row.id), `duplicate id ${row.id}`);
  ids.add(row.id);
  assert.match(row.id, /^stbank_[a-z]+_[a-z]+_(high|low)$/);
  assert.ok(!titles.has(row.title), `duplicate title ${row.title}`);
  titles.add(row.title);
  const card = bankEntryToCard(row);
  assert.ok(card, `${row.id} failed the story parser`);
  assert.equal(card!.source, 'bank');
  assert.equal(card!.v, 2);
  assert.equal(fillStoryPlaceholders('{friend}'), 'your friend');
  assert.equal(fillStoryPlaceholders('{nope}'), '{nope}');
}
ok('every row is unique and passes parseStoryCardAnswer');

const settings = ['friends', 'work', 'home'] as const;
for (const def of CATEGORY_DEFS) {
  for (const setting of settings) {
    const rows = STORY_BANK.filter((row) => row.categoryId === def.id && row.setting === setting);
    assert.ok(rows.length >= 2, `${def.id} × ${setting} has ${rows.length}, needs both leans`);
    assert.ok(rows.some((row) => row.lean === 'high') && rows.some((row) => row.lean === 'low'));
  }
}
ok('each category × friends/work/home has a high and a low');

for (let i = 0; i < STORY_BANK.length; i += 1) {
  for (let j = i + 1; j < STORY_BANK.length; j += 1) {
    const overlap = storyOverlap(STORY_BANK[i]!.hook, STORY_BANK[j]!.hook);
    assert.ok(
      overlap < STORY_HOOK_VARIETY_LIMIT,
      `hooks too similar: ${STORY_BANK[i]!.id} vs ${STORY_BANK[j]!.id} (${overlap.toFixed(2)})`,
    );
  }
}
ok('hooks stay under the variety limit with each other');

for (const shot of STORY_FEW_SHOTS) {
  const parsed = parseStoryCardAnswer(JSON.stringify(shot), { allowExampleHooks: true });
  assert.ok(parsed.card, `few-shot "${shot.title}" fails: ${parsed.reason}`);
}
ok('the three few-shots pass the parser');

const picked = pickStoryBankCard({
  categoryId: 'cat_steadiness',
  setting: 'friends',
  lean: 'high',
  seed: 'check',
});
assert.ok(picked && picked.source === 'bank' && picked.title);
const again = pickStoryBankCard({
  categoryId: 'cat_steadiness',
  setting: 'friends',
  lean: 'high',
  seed: 'check',
});
assert.equal(again?.title, picked!.title, 'same seed → same pick');
const skipped = pickStoryBankCard({
  categoryId: 'cat_steadiness',
  setting: 'friends',
  lean: 'high',
  seed: 'check',
  seenIds: picked?.bankId ? [picked.bankId] : ['missing'],
});
assert.ok(skipped && skipped.bankId !== picked!.bankId, 'picker skips a recently seen bank id');
assert.deepEqual(nextBankSeenIds(['a'], 'b').slice(-1), ['b']);
assert.equal(bankIdsToSkip(['a', 'b'], 2).length, Math.min(BANK_SKIP_RECENT, 1));
ok('picker is stable, skips seen ids, and recycles after the pool is exhausted');

// The Story moved to Insights (2026-10-14): template-only, the bank as
// fallback, and no AI rewrite of old cards on open any more.
const fold = readFileSync(resolve(root, 'src/components/insights/insights-story-card.tsx'), 'utf8');
assert.match(fold, /pickStoryBankCard\(/);
assert.match(fold, /StoryV2View/);
assert.doesNotMatch(fold, /rewriteOldStory|markStoryRewriteTried/);
assert.match(fold, /loadStoryBankHistory/);
ok('the Story card uses the bank as fallback and remembers seen cards; no AI rewrite on open');

const review = readFileSync(resolve(root, 'docs/story-review.md'), 'utf8');
assert.match(review, /STORY_COPY_REVIEWED = false/);
assert.match(review, /STORY_BANK_COPY_REVIEWED = false/);
assert.match(review, /Captain Table for Three/);
ok('review doc names the flags and the screenshot story');

const hub = readFileSync(resolve(root, 'src/components/dev-hub-panels.tsx'), 'utf8');
assert.match(hub, /STORY_BANK_COPY_REVIEWED/);
ok('the bank is on the Hub copy list');

const gate = readFileSync(resolve(root, 'scripts/ota-gate.ts'), 'utf8');
assert.doesNotMatch(gate, /story-bank/, 'ota-gate runs every check:* except its exclude list; story-bank must not be excluded');
ok('story-bank is not excluded from the OTA gate');

console.log(`\n${passed} story-bank checks passed`);
