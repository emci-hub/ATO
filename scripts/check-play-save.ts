/**
 * Shine Stone save ordering (v27). Run: npm run check:play-save
 *
 *   1. A reload that recorded the epoch before a commit is stale afterwards.
 *   2. Saves run in order: a later commit cannot land on disk first.
 *   3. The Stone sheet sets its result line only after `commitSaved` resolves,
 *      and a hydrate ignores a read that started before the latest commit.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { bumpSaveEpoch, enqueuePlaySave, saveEpoch, saveIsCurrent, whenPlaySavesSettled } from '../src/play/play-save';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const ROOT = path.join(__dirname, '..');
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
{
  let disk = 'old';
  const started = saveEpoch();
  const writing = enqueuePlaySave(async () => {
    await delay(20);
    disk = 'stone-on-a';
  });
  bumpSaveEpoch();
  assert.equal(saveIsCurrent(started), false, 'a commit during the read makes that read stale');
  await writing;
  assert.equal(disk, 'stone-on-a');

  const order: string[] = [];
  void enqueuePlaySave(async () => {
    await delay(20);
    order.push('a');
    disk = 'a';
  });
  void enqueuePlaySave(async () => {
    order.push('b');
    disk = 'b';
  });
  await whenPlaySavesSettled();
  assert.deepEqual(order, ['a', 'b'], 'the earlier save finishes first');
  assert.equal(disk, 'b', 'the later commit is what disk keeps');
}
ok('save epoch: a reload from before the commit is stale; saves stay in order');

{
  const sheet = fs.readFileSync(path.join(ROOT, 'src/play/stone-sheet.tsx'), 'utf8');
  const useAt = sheet.indexOf('const use =');
  const retAt = sheet.indexOf('return (', useAt);
  const body = sheet.slice(useAt, retAt);
  const waited = body.indexOf('await commitSaved');
  assert.ok(waited >= 0, 'the sheet waits for commitSaved');
  assert.ok(body.slice(0, waited).includes('setLine(null)'), 'the old line is cleared before the save');
  assert.equal(body.slice(0, waited).includes('It worked'), false, 'a hit is not written before the save');
  assert.ok(body.slice(waited).includes('It worked'), 'the result line is set only after the save resolves');
  assert.ok(body.includes('if (!saved || !result)'), 'a failed save does not show a hit');

  const hook = fs.readFileSync(path.join(ROOT, 'src/play/use-play-store.ts'), 'utf8');
  const hydrateAt = hook.indexOf('const hydrate =');
  const effectAt = hook.indexOf('useEffect(', hydrateAt);
  const hydrate = hook.slice(hydrateAt, effectAt);
  assert.ok(hydrate.indexOf('saveEpoch()') < hydrate.indexOf('loadPlayStore'), 'the epoch is recorded before the read');
  assert.ok(hydrate.includes('whenPlaySavesSettled'), 'in-flight saves finish before a reload reads');
  assert.ok(hydrate.includes('if (!saveIsCurrent(started)) return'), 'a stale reload is ignored');
  assert.ok(hook.includes('const commitSaved'), 'the Stone path can wait for the write');
  assert.ok(hook.includes('await remember(next, false)'), 'that path does not paint until the save resolves');
}
ok('Stone sheet waits for the save; a stale hydrate is dropped');

console.log(`\ncheck:play-save — ${passed} groups passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
