/**
 * Dev-lab Home overrides. Run: npm run check:dev-overrides
 *
 * Keys live in one module. Readers no-op in production. Home is not wired yet.
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

const overrides = read('src/lib/dev-overrides.ts');
const hub = read('src/app/dev-lab.tsx');
const home = read('src/app/(tabs)/index.tsx');
const blob = `${overrides}\n${hub}\n${home}`;

assert.equal((blob.match(/ato\.dev\.slot-override\.v1/g) ?? []).length, 1);
assert.equal((blob.match(/ato\.dev\.ask-override\.v1/g) ?? []).length, 1);
ok('both storage keys appear exactly once each');

function functionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, name);
  const next = src.indexOf('export async function', start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

assert.match(functionBody(overrides, 'readSlotOverride'), /if \(!__DEV__\)/);
assert.match(functionBody(overrides, 'readAskOverride'), /if \(!__DEV__\)/);
ok('both reader functions contain a __DEV__ guard');

assert.doesNotMatch(home, /ato\.dev\.slot-override\.v1/);
assert.doesNotMatch(home, /ato\.dev\.ask-override\.v1/);
assert.doesNotMatch(home, /readSlotOverride|readAskOverride|SLOT_OVERRIDE_KEY|ASK_OVERRIDE_KEY/);
ok('Home does not reference either override key');

console.log(`\nAll ${passed} dev-overrides checks passed.`);
