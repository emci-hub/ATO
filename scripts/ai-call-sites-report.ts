/**
 * Prints every AI generation call site with its declared metadata flags.
 * Run: npm run report:ai
 *
 * Flags (see src/lib/ai/types.ts):
 *   personalized     — output is per-user; cannot be shared
 *   cohortShareable  — one generation could serve every user
 *   bucketShareable  — one generation per trait-profile bucket serves the bucket
 *   latencySensitive — a user is waiting live on the call today
 */
import { AI_CALL_SITES } from '../src/lib/ai/call-sites';

const FLAGS = ['personalized', 'cohortShareable', 'bucketShareable', 'latencySensitive'] as const;

function row(cells: string[]): string {
  return cells.map((cell, i) => (i === 0 ? cell.padEnd(22) : cell.padEnd(16))).join(' | ').trimEnd();
}

console.log('AI call sites — declared metadata');
console.log(
  row(['Feature', 'personalized', 'cohortShareable', 'bucketShareable', 'latencySensitive']),
);
console.log('-'.repeat(88));

let latencySensitive = 0;
for (const site of AI_CALL_SITES) {
  console.log(
    row([
      site.feature,
      ...FLAGS.map((flag) => (site.meta[flag] ? 'yes' : 'no')),
    ]),
  );
  if (site.meta.latencySensitive) latencySensitive += 1;
}

console.log('-'.repeat(88));
console.log(`Location key: ${AI_CALL_SITES.map((site) => site.feature).join(' / ')}`);
console.log(`\n${AI_CALL_SITES.length} call sites · ${latencySensitive} latency-sensitive today`);
console.log('Source of truth: src/lib/ai/call-sites.ts (enforced by npm run check:ai)');
