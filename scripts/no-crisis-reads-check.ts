/**
 * No client code reads or writes the removed crisis tables/fields (Step 3, 2026-10-20).
 * The crisis system left the app on 2026-10-14 (static HelplineRow). This pins that nothing under
 * src/ names `crisis_flags` (the table) or `crisis_since` (home_bootstrap's old field), and that the
 * prepared, NOT APPLIED wave103 migration really removes the server side.
 *
 * Run: npm run check:no-crisis-reads
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:no-crisis-reads'], 'tsx ./scripts/no-crisis-reads-check.ts');
ok('wired as check:no-crisis-reads (check:ota-gate runs every check:* script)');

/** The names no client file may carry. */
export const CRISIS_NAMES = /\bcrisis_flags\b|\bcrisis_since\b/;

export function crisisReads(source: string): string[] {
  return source
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter((l) => CRISIS_NAMES.test(l.line))
    .map((l) => `${l.n}: ${l.line.trim().slice(0, 80)}`);
}

// Failing samples (each must be caught) and passing samples (must not be).
for (const bad of [
  "supabase.from('crisis_flags').select('*')",
  "const f = await supabase.from(\"crisis_flags\").insert({ user_id })",
  'const since = row.crisis_since;',
  "{ ...row, crisis_since: [] }",
  "const PREVIEW_TABLES = ['checks', 'crisis_flags']",
]) {
  assert.ok(crisisReads(bad).length > 0, `must flag: ${bad}`);
}
for (const good of [
  "supabase.from('checks').select('*')",
  'const helpline = <HelplineRow />;',
  "const row = { checks: [], trait_tracks: [] };",
  '// the crisis system was removed 2026-10-14',
]) {
  assert.equal(crisisReads(good).length, 0, `must not flag: ${good}`);
}
ok('scanner flags table reads, writes, field reads and table lists; leaves ordinary code alone');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const hits: string[] = [];
for (const file of walk(resolve(root, 'src'))) {
  for (const h of crisisReads(readFileSync(file, 'utf8'))) {
    hits.push(`${relative(root, file).replace(/\\/g, '/')}:${h}`);
  }
}
assert.deepEqual(hits, [], `src/ still names crisis_flags / crisis_since:\n${hits.join('\n')}`);
ok('no file under src/ reads or writes crisis_flags or crisis_since');

// The prepared server side: wave103 (NOT APPLIED) drops the table and restates every reader.
const sql = readFileSync(resolve(root, 'supabase/migrations/wave103_drop_crisis_plumbing.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/--[^\n]*/g, '');
assert.match(sql, /drop table if exists public\.crisis_flags;/, 'wave103 drops the table');
assert.match(sql, /drop function if exists public\._library_crisis\(uuid\);/, 'wave103 drops the old helper');
const withoutDrops = sql.replace(/drop table if exists public\.crisis_flags;/, '').replace(/drop function if exists public\._library_crisis\(uuid\);/, '');
assert.doesNotMatch(withoutDrops, /crisis_flags/, 'no restated function still touches crisis_flags');
assert.doesNotMatch(withoutDrops, /crisis_since|v_crisis/, 'home_bootstrap no longer builds crisis_since');
assert.doesNotMatch(withoutDrops, /_library_crisis/, 'the library functions call the renamed helper');
assert.equal((sql.match(/public\._library_paused\(uid\)/g) ?? []).length, 3, 'claim_library_write, library_serve and library_want use the renamed helper');
ok('wave103 (not applied) drops crisis_flags + the old helper and restates every function that read it');

console.log(`\nno-crisis-reads: ${passed} checks passed`);
