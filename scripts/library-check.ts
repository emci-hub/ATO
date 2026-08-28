/**
 * Library copy — domain + framework entries, fence-safe For Sage lines.
 * Run: npm run check:library
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { containsFrameworkTerm, matchingFrameworkTerms } from '../src/lib/voice/framework-fence';

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
assert.doesNotMatch(readFileSync(resolve('src/lib/voice/providers/prompt.ts'), 'utf8'), /library\.md/);
assert.doesNotMatch(readFileSync(resolve('scripts/sync-voice-content.mjs'), 'utf8'), /library\.md/);
ok('Sage prompt and voice sync still do not read the Library (content-only box)');

console.log('\nAll library checks passed.');
