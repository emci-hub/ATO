/**
 * Insights makes no AI call and takes no typed text (emci 2026-10-14).
 *
 * Walks every module the Insights tab reaches (its whole import graph under
 * src/) and fails if any of them is an AI client: the model gateway, the AI
 * library client, the quota claim, or one of the generators. Then pins the
 * Insights-owned files themselves: no generateText, no edge-function invoke,
 * no claim RPC, no AI consent card, no AI badge, no TextInput, and the Story
 * AI polish flag is never read there.
 * Run: npm run check:insights-no-ai
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:insights-no-ai'], 'tsx ./scripts/insights-no-ai-check.ts');
ok('wired as check:insights-no-ai (check:ota-gate runs every check:* script)');

/** The Insights screen and the files it owns. */
export const INSIGHTS_FILES = [
  'src/app/(tabs)/insights.tsx',
  'src/components/insights/today-focus-card.tsx',
  'src/components/insights/insights-story-card.tsx',
  'src/components/daily-insights/try-today-card.tsx',
  'src/components/daily-insights/superpower-card.tsx',
  'src/components/daily-insights/conflict-style-card.tsx',
  'src/components/daily-insights/script-parts.tsx',
  'src/hooks/use-try-today.ts',
  'src/components/flip-card.tsx',
  'src/components/typewriter-text.tsx',
  'src/components/spectrum-slider.tsx',
  'src/components/insight-collection.tsx',
  'src/components/icon-pop.tsx',
  'src/lib/insights-spectrum.ts',
  'src/lib/insights-typewriter.ts',
  'src/lib/insight-collection-store.ts',
  'src/lib/insight-collection.ts',
] as const;

/** Any of these anywhere in the graph means an AI client is reachable. */
export const AI_CLIENT_MODULES = [
  'src/lib/ai/generate.ts',
  'src/lib/ai-library/client.ts',
  'src/lib/voice/quota-server.ts',
  'src/lib/category-deep-dive/generate.ts',
  'src/lib/legend-figures/generate.ts',
  'src/lib/legends64/generate-story.ts',
  'src/lib/rolls/generate.ts',
  'src/lib/explore/generate.ts',
] as const;

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = resolve(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // a package: not app code
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = entries.map((rel) => resolve(root, rel));
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(IMPORT_RE)) {
      // `import type` pulls in no runtime code.
      if (/^import\s+type\b/.test(match[0]) || /^export\s+type\b/.test(match[0])) continue;
      const target = resolveImport(file, match[1] ?? match[2] ?? '');
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return new Set([...seen].map((file) => relative(root, file).replace(/\\/g, '/')));
}

for (const rel of INSIGHTS_FILES) assert.ok(existsSync(resolve(root, rel)), `${rel} exists`);
const graph = importGraph(INSIGHTS_FILES);
assert.ok(graph.size > INSIGHTS_FILES.length, 'the walk follows imports');
// Self-test: the walker does find an AI client when one is imported.
assert.ok(importGraph(['src/components/category-deep-dive-card.tsx']).has('src/lib/ai-library/client.ts'));
ok(`import walker follows ${graph.size} modules and finds an AI client where one is imported`);

const reached = AI_CLIENT_MODULES.filter((mod) => graph.has(mod));
assert.deepEqual(reached, [], `Insights reaches an AI client: ${reached.join(', ')}`);
ok('no AI client anywhere in the Insights import graph');

for (const rel of INSIGHTS_FILES) {
  const src = read(rel);
  assert.doesNotMatch(src, /\bgenerateText\b/, `${rel}: no generateText`);
  assert.doesNotMatch(src, /functions\.invoke|serveLibraryCard|writeLibraryCard|wantLibraryCards/, `${rel}: no AI library / edge function`);
  assert.doesNotMatch(src, /claim[A-Z]\w*\(|\.rpc\(\s*'claim_/, `${rel}: no claim (quota or tokens)`);
  assert.doesNotMatch(src, /AiConsentCard|aiConsentFor|AiBadge/, `${rel}: no AI consent or AI badge`);
  assert.doesNotMatch(src, /\bTextInput\b/, `${rel}: no free-text input`);
  assert.doesNotMatch(src, /STORY_AI_POLISH|polishStory/, `${rel}: never reads the Story AI polish`);
}
ok('Insights files: no model call, no library, no claim, no consent, no badge, no TextInput, no polish');

// The old AI Story path is gone, not just switched off.
assert.ok(!existsSync(resolve(root, 'src/components/sage-story-fold.tsx')), 'the old Story fold is deleted');
assert.ok(!existsSync(resolve(root, 'src/lib/explore/generate.ts')), 'the old Story rewrite generator is deleted');
assert.ok(!existsSync(resolve(root, 'src/lib/insight/generate-insight.ts')), 'the AI daily-insight writer is deleted');
ok('the old AI Story fold, its rewrite path and the AI daily-insight writer are gone');

console.log(`\ninsights-no-ai: ${passed} checks passed`);
