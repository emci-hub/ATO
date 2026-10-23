/**
 * Player-facing voice. Run: npm run check:player-copy
 *
 * Banned phrases, slang outside the casual tier, the sentence-shape cap,
 * and cross-trait scene reuse. The same review gates a Story Library draft
 * before it can be approved. Flip test and both-poles stay in docs/voice-guide.md.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildStoryLibraryDraftPrompt } from '../src/lib/story-library/draft-prompt';
import { sceneReuse, SHAPE_CAP, shapeStats, textIssues } from '../src/lib/voice/player-copy';
import { playerCopyIssues } from '../src/lib/voice/player-copy-scan';

const bad = textIssues('The untried option gets the first look. You tend to embrace the journey.');
assert.ok(bad.some((issue) => issue.label === 'The untried option'));
assert.ok(bad.some((issue) => issue.label === 'Gets the first look'));
assert.ok(bad.some((issue) => issue.label === 'You tend to'));
assert.ok(textIssues('People tend to call first.').some((issue) => issue.label === 'tend to'));
assert.ok(bad.some((issue) => issue.label === 'Embrace'));
assert.ok(bad.some((issue) => issue.label === 'Journey'));

const good = textIssues('The specials board wins, and a new ticket is already open.');
assert.equal(good.length, 0, good.map((issue) => issue.detail).join('; '));

assert.ok(textIssues('That was lowkey the whole plan.').some((issue) => issue.detail.includes('casual')));
assert.equal(textIssues('That was lowkey the whole plan.', { casual: true }).length, 0);
assert.ok(textIssues('That was lowkey a slay.', { casual: true }).some((issue) => issue.detail.includes('more than one slang')));
assert.ok(textIssues('Still learning you on snacks.').some((issue) => issue.label === 'still learning'));
assert.equal(textIssues('Early read: you might be the snack-planner. Still learning you.').length, 0);
assert.equal(textIssues('The real journey took years.', { allowJourney: true }).length, 0);

const capped = shapeStats(['One?', 'Two?', 'Three?', 'Four.']);
assert.ok(capped.share > SHAPE_CAP);

const reused = sceneReuse({ openness: 'the kettle boiled', conscientiousness: 'the checkbox held' });
assert.ok(reused.some((issue) => issue.detail.includes('specials board')));
assert.ok(reused.some((issue) => issue.detail.includes('kettle')));

const guide = readFileSync(resolve(__dirname, '../docs/voice-guide.md'), 'utf8');
const prompt = buildStoryLibraryDraftPrompt(guide);
assert.match(prompt, /Player-facing voice/);
assert.match(prompt, /Flip test/);
assert.match(prompt, /specials board/);
assert.throws(() => buildStoryLibraryDraftPrompt('not the guide'));

const issues = playerCopyIssues();
assert.equal(
  issues.length,
  0,
  issues
    .slice(0, 12)
    .map((issue) => `${issue.where}: ${issue.detail}`)
    .join('\n'),
);

console.log('player-copy: ok');
