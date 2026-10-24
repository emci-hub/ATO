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
import { TRAIT_AXES, TRAIT_POLE_LINES } from '../src/lib/traits';
import { metaphorSymbolIssues, openerKey, openerOveruse, sceneReuse, SHAPE_CAP, shapeStats, textIssues } from '../src/lib/voice/player-copy';
import { playerCopyIssues } from '../src/lib/voice/player-copy-scan';

const bad = textIssues('The untried option gets the first look. You embrace the journey.');
assert.ok(bad.some((issue) => issue.label === 'The untried option'));
assert.ok(bad.some((issue) => issue.label === 'Gets the first look'));
assert.equal(textIssues('Your answers suggest you tend to like a familiar option.').length, 0);
assert.ok(bad.some((issue) => issue.label === 'Embrace'));
assert.ok(bad.some((issue) => issue.label === 'Journey'));

const good = textIssues('You like trying new things, even when everyone else would rather stick with what they know.');
assert.equal(good.length, 0, good.map((issue) => issue.detail).join('; '));
assert.equal(
  metaphorSymbolIssues('You opened a new ticket when the specials board still had a blank line, then let the loud option wait by the kettle.').length,
  0,
);
assert.equal(metaphorSymbolIssues('She reached the same fork with a different bag and pulled up a chair in a costume.').length, 0);

assert.ok(textIssues('That was lowkey the whole plan.').some((issue) => issue.detail.includes('casual')));
assert.equal(textIssues('That was lowkey the whole plan.', { casual: true }).length, 0);
assert.ok(textIssues('That was lowkey a slay.', { casual: true }).some((issue) => issue.detail.includes('more than one slang')));
assert.equal(textIssues('This read is early.').length, 0);
assert.equal(textIssues('The real journey took years.', { allowJourney: true }).length, 0);

const capped = shapeStats(['One?', 'Two?', 'Three?', 'Four.']);
assert.ok(capped.share > SHAPE_CAP);

assert.equal(openerKey("You'd rather try something new."), 'would rather');
assert.equal(openerKey('You would rather try something new.'), 'would rather');
assert.equal(openerKey('You will try something new.'), 'will try');
assert.equal(openerKey('You will keep the familiar one.'), 'will keep');
assert.ok(openerOveruse(["You'd rather stay in tonight.", "You'd rather go out instead.", "You'd rather wait a bit."]));
assert.equal(
  openerOveruse([
    'You will try the new one today and see.',
    'A familiar plan can wait and still be fine for now.',
    'From a recent answer, the choice was plain enough.',
  ]),
  null,
);
const poles = TRAIT_AXES.flatMap((axis) => [TRAIT_POLE_LINES[axis].low, TRAIT_POLE_LINES[axis].high]);
const poleOpen = openerOveruse(poles);
assert.equal(poleOpen, null, poleOpen ? `pole opener "${poleOpen.key}" on ${poleOpen.count}/${poleOpen.total}` : '');

assert.equal(sceneReuse({ openness: 'left early', conscientiousness: 'keeps a familiar plan' }).length, 0);

const guide = readFileSync(resolve(__dirname, '../docs/voice-guide.md'), 'utf8');
const prompt = buildStoryLibraryDraftPrompt(guide);
assert.match(prompt, /Player-facing voice/);
assert.match(prompt, /Meaning first/);
assert.match(prompt, /do not invent/i);
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
