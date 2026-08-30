/**
 * Ask sheet. Run: npm run check:ask-sheet
 *
 * One frame, one header. Mechanic names never reach this file.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const sheet = read('src/components/ask-sheet.tsx');
const sageCard = read('src/components/sage-knows-card.tsx');
const rankingCard = read('src/components/ranking-card.tsx');
const scenarioCard = read('src/components/scenario-card.tsx');
const themeLab = read('src/app/theme-lab.tsx');

assert.match(sheet, /One thing, then back to your day\./);
ok('header is the shared ask line');

assert.doesNotMatch(sheet, /SAGE_KNOWS_LABEL/);
assert.doesNotMatch(sheet, /RANKING_LABEL/);
assert.doesNotMatch(sheet, /SCENARIO_LABEL/);
ok('mechanic labels never appear in AskSheet');

assert.match(sageCard, /export function SageKnowsCard/);
assert.match(rankingCard, /export function RankingCard/);
assert.match(scenarioCard, /export function ScenarioCard/);
ok('original three cards still export their components');

assert.match(themeLab, /AskSheet/);
ok('theme-lab mounts AskSheet');

console.log(`\nAll ${passed} ask-sheet checks passed.`);
