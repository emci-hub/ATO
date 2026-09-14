/**
 * Library copy + Sage grounding. Run: npm run check:library
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cueAfterYou } from '../src/lib/voice/cue';
import { LIBRARY_MARKDOWN } from '../src/lib/voice/content.generated';
import { containsFrameworkTerm, matchingFrameworkTerms } from '../src/lib/voice/framework-fence';
import {
  LIBRARY_TEACHING_LEAK,
  libraryGroundingBlock,
  parseLibraryEntries,
  selectLibraryEntries,
} from '../src/lib/voice/library';
import type { VoiceMe } from '../src/lib/voice/types';

const library = readFileSync(resolve('src/app/copy/library.md'), 'utf8');

const ALLOWED_LIBRARY_TERMS = new Set([
  'growth mindset',
  'fixed mindset',
  'locus of control',
  'self-efficacy',
  'self efficacy',
  'self-determination',
  'self determination',
]);

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const headings = [...library.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
assert.deepEqual(headings, [
  'Sleep',
  'Workload',
  'Conflict',
  'Communication',
  'Health',
  'Money',
  'Loneliness',
  'Self-Determination Theory',
  'Growth mindset',
  'Locus of control',
  'Self-efficacy',
]);
ok('seven domain entries and four framework entries exist under the expected headings');

assert.match(library, /CDC \/ AASM/);
assert.match(library, /Karasek; Sonnentag/);
assert.match(library, /John Gottman/);
assert.match(library, /Marshall Rosenberg/);
assert.match(library, /Wood; Lally/);
assert.match(library, /Thaler on mental buckets/);
assert.match(library, /Deci and Richard M\. Ryan/);
assert.match(library, /Carol S\. Dweck/);
assert.match(library, /Julian B\. Rotter/);
assert.match(library, /Albert Bandura/);
assert.doesNotMatch(library, /16personalities|myers.?briggs|Mindset Works quiz|GSES item|I-E item \d|Maslach item/i);
ok('academic sources named; no commercial-platform or licensed-item copy');

const forSageBlocks = [...library.matchAll(/### For Sage\n\n([\s\S]*?)(?=\n---|\n## |$)/g)].map(
  (m) => m[1].trim(),
);
assert.equal(forSageBlocks.length, 11);
for (const block of forSageBlocks) {
  const hits = matchingFrameworkTerms(block);
  assert.deepEqual(hits, [], `For Sage should be fence-clean, got ${hits.join(', ')}:\n${block}`);
  assert.equal(containsFrameworkTerm(block), false);
}
ok('For Sage paraphrase blocks do not trip containsFrameworkTerm');

const extraHits = matchingFrameworkTerms(library).filter((term) => !ALLOWED_LIBRARY_TERMS.has(term));
assert.deepEqual(extraHits, [], `unexpected fence hits in Library: ${extraHits.join(', ')}`);
ok('Library body has no fence hits besides the four frameworks naming themselves');

assert.match(library, /Sage does not quote this file/);
assert.match(readFileSync(resolve('scripts/sync-voice-content.mjs'), 'utf8'), /library\.md/);
ok('voice sync ships library.md');

const parsedFile = parseLibraryEntries(library);
const parsedSync = parseLibraryEntries(LIBRARY_MARKDOWN);
assert.equal(parsedFile.length, 11);
assert.deepEqual(
  parsedFile.map((e) => e.id),
  parsedSync.map((e) => e.id),
);
for (const entry of parsedFile) {
  assert.equal(LIBRARY_TEACHING_LEAK.test(entry.paraphrases.join('\n')), false);
}
ok('synced Library matches the markdown; For Sage lines have no teaching/source copy');

const emptyMe: VoiceMe = {
  name: 'Riley',
  show_up: '',
  talk_style: 'even',
  knocks_you_off: '',
  morning_cue: 'make coffee',
};
assert.equal(selectLibraryEntries(emptyMe, { day: 4, surface: 'card' }).length, 0);
ok('no knock, trait, or fact → no Library entry (existence is not enough)');

const pileMe: VoiceMe = {
  name: 'Riley',
  show_up: '',
  talk_style: 'even',
  knocks_you_off: 'workload',
  morning_cue: 'making coffee',
};
const pileEntries = selectLibraryEntries(pileMe, { day: 4, surface: 'card' });
assert.deepEqual(pileEntries.map((e) => e.id), ['workload']);
const pileGrounding = libraryGroundingBlock(pileEntries);
assert.match(pileGrounding, /one next piece, not the whole list/);
assert.equal(LIBRARY_TEACHING_LEAK.test(pileGrounding), false);
assert.doesNotMatch(pileGrounding, /^Source:/m);
ok('workload knock selects only Workload For Sage paraphrases');

const lonelyMe: VoiceMe = {
  name: 'Riley',
  show_up: '',
  talk_style: 'even',
  knocks_you_off: 'loneliness',
  morning_cue: 'make coffee',
};
const lonelyEntries = selectLibraryEntries(lonelyMe, { day: 4, surface: 'card' });
assert.deepEqual(lonelyEntries.map((e) => e.id), ['loneliness']);
const lonelyGrounding = libraryGroundingBlock(lonelyEntries);
assert.match(lonelyGrounding, /beats a whole new social life/);
assert.equal(LIBRARY_TEACHING_LEAK.test(lonelyGrounding), false);
assert.doesNotMatch(lonelyGrounding, /^Source:/m);
ok('loneliness knock selects only Loneliness For Sage paraphrases');

assert.equal(
  selectLibraryEntries(pileMe, { day: 4, surface: 'talk', message: 'Should I get flowers today?' }).length,
  0,
);
const talkPile = selectLibraryEntries(pileMe, {
  day: 4,
  surface: 'talk',
  message: 'The pile at work never ends.',
});
assert.deepEqual(talkPile.map((e) => e.id), ['workload']);
ok('a typed line pulls Workload; a standing knock alone does not');

// The card and Talk prompt builders went with the voice provider lane
// (2026-09-14), so the assertions that they grounded in For Sage lines and
// never in teaching/source copy have nothing left to run against. The
// selection logic above still proves WHICH entries a surface gets; what is
// no longer proven is that a prompt builder uses them correctly. Explore is
// the one surviving consumer, and its own grounding is asserted below.

assert.equal(cueAfterYou('making coffee'), 'make coffee');
assert.equal(cueAfterYou('make coffee'), 'make coffee');
ok('morning-cue gerunds render as infinitive after "After you"');

// Explore is the only live surface that still grounds in the library, so the
// wiring assertion moved here from the deleted card-prompt block.
assert.match(readFileSync(resolve('src/lib/explore/prompt.ts'), 'utf8'), /libraryGroundingBlock/);
ok('Explore still grounds its prompt in the For Sage library');

console.log(`\n${passed} library checks passed`);
