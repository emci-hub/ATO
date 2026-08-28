/**
 * Library copy + Sage grounding. Run: npm run check:library
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildVoiceConfig } from '../src/lib/voice/config';
import { LIBRARY_MARKDOWN } from '../src/lib/voice/content.generated';
import { containsFrameworkTerm, matchingFrameworkTerms } from '../src/lib/voice/framework-fence';
import {
  LIBRARY_TEACHING_LEAK,
  libraryGroundingBlock,
  parseLibraryEntries,
  selectLibraryEntries,
} from '../src/lib/voice/library';
import { localProvider } from '../src/lib/voice/providers/local';
import { buildPrompt, buildTalkPrompt } from '../src/lib/voice/providers/prompt';
import { routeVoiceCard } from '../src/lib/voice/router';
import { routeTalkReply } from '../src/lib/voice/talk';
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

function ok(label: string) {
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
  'Self-Determination Theory',
  'Growth mindset',
  'Locus of control',
  'Self-efficacy',
]);
ok('six domain entries and four framework entries exist under the expected headings');

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
assert.equal(forSageBlocks.length, 10);
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
assert.match(readFileSync(resolve('src/lib/voice/providers/prompt.ts'), 'utf8'), /libraryGroundingBlock/);
ok('voice sync ships library.md; Sage prompt reads For Sage grounding only');

const parsedFile = parseLibraryEntries(library);
const parsedSync = parseLibraryEntries(LIBRARY_MARKDOWN);
assert.equal(parsedFile.length, 10);
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
ok('Talk pulls Workload from the typed line, not from a standing knock alone');

const pilePrompt = buildPrompt({
  me: pileMe,
  day: 4,
  tone: 'even',
  history: [],
  crisisToday: false,
  previousHadCut: false,
});
assert.match(pilePrompt, /FRAMING NOTES/);
assert.match(pilePrompt, /one next piece, not the whole list/);
assert.doesNotMatch(pilePrompt, /Karasek|Sonnentag|Maslach/);
assert.doesNotMatch(pilePrompt, /the Maslach Burnout Inventory/);
ok('card prompt grounds in For Sage lines, never teaching/source copy');

const flowerTalk = buildTalkPrompt({
  me: pileMe,
  message: 'Should I get flowers today?',
  day: 4,
  history: [],
});
assert.doesNotMatch(flowerTalk, /FRAMING NOTES/);
assert.doesNotMatch(flowerTalk, /one next piece/);
const pileTalkPrompt = buildTalkPrompt({
  me: pileMe,
  message: 'The pile at work never ends.',
  day: 4,
  history: [],
});
assert.match(pileTalkPrompt, /one next piece, not the whole list/);
assert.doesNotMatch(pileTalkPrompt, /Karasek/);
ok('Talk prompt is silent unless the typed line connects; then For Sage only');

async function main() {
  const localConfig = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
  const pileCard = await routeVoiceCard(
    { me: pileMe, checkCount: 3, history: [], aiConsent: true },
    { config: localConfig, isDev: true },
  );
  assert.ok(pileCard.card);
  assert.match(pileCard.card.read, /one next piece, not the whole list/);
  assert.match(pileCard.card.do, /one next piece, not the whole list/);
  assert.equal(LIBRARY_TEACHING_LEAK.test(`${pileCard.card.read}\n${pileCard.card.do}`), false);
  assert.equal(containsFrameworkTerm(pileCard.card.read), false);
  assert.equal(containsFrameworkTerm(pileCard.card.do), false);
  if (pileCard.nudge) {
    assert.equal(containsFrameworkTerm(pileCard.nudge), false);
    assert.equal(LIBRARY_TEACHING_LEAK.test(pileCard.nudge), false);
  }
  ok('generated workload card uses Library paraphrase language and stays fence-clean');

  const direct = await localProvider.generate({
    me: pileMe,
    day: 4,
    tone: 'even',
    history: [],
    crisisToday: false,
    previousHadCut: false,
  });
  assert.equal(direct.read, pileCard.card.read);
  assert.equal(direct.do, pileCard.card.do);

  const pileTalk = await routeTalkReply(
    {
      me: pileMe,
      message: 'The pile at work never ends.',
      checkCount: 3,
      history: [],
      aiConsent: true,
    },
    { config: localConfig, isDev: true },
  );
  assert.equal(pileTalk.kind, 'reply');
  assert.match(pileTalk.reply ?? '', /one next piece, not the whole list/);
  assert.equal(LIBRARY_TEACHING_LEAK.test(pileTalk.reply ?? ''), false);
  assert.equal(containsFrameworkTerm(pileTalk.reply), false);
  ok('Talk reply on a pile-day is shaped by Workload For Sage and stays fence-clean');

  console.log('\nAll library checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
