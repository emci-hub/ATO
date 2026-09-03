/**
 * trait_history.source CHECK parity — guards the bug class where a trait
 * source added client-side never reaches the DB constraint (self_scenario
 * was missing from the wave19 CHECK until wave38, so every scenario-answer
 * history write failed silently for ~3 days).
 *
 * Asserts the LATEST migration that defines trait_history_source_known (by
 * file order — wave38 re-adds it after wave19) allows exactly the client's
 * TRAIT_SOURCES list, in the same order. If a future wave adds a 9th source
 * to src/lib/traits.ts, this check fails until the migration is widened too.
 *
 * Run: npm run check:trait-sources
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { TRAIT_SOURCES } from '../src/lib/traits';

function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

const MIGRATIONS_DIR = resolve(__dirname, '../supabase/migrations');

/** Pull the source list from every `add constraint trait_history_source_known ...`; latest file wins. */
function latestSourceCheckList(): string[] | null {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  let latest: string[] | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const re = /add\s+constraint\s+trait_history_source_known\s+check\s*\(\s*source\s+in\s*\(([\s\S]*?)\)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      latest = [...m[1].matchAll(/'([^']+)'/g)].map((mm) => mm[1]);
    }
  }
  return latest;
}

const dbSources = latestSourceCheckList();
assert.ok(dbSources, 'no add constraint trait_history_source_known found in supabase/migrations');
assert.deepEqual(dbSources, [...TRAIT_SOURCES]);
ok(
  `trait_history_source_known CHECK (${dbSources.length} values) exactly matches client TRAIT_SOURCES — no source drift`,
);
