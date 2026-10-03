/**
 * Explore shows the same counts as Questions: it refetches trait tracks every
 * time the tab gains focus (the fix Home already has), and Categories uses
 * those fresh tracks instead of its own mount-time fetch.
 * Run: npm run check:explore-refetch
 *
 * Why: tab screens stay mounted, so Explore's old fetch (keyed on
 * [userId, me, dataEpoch]) never re-ran after answering on Questions. emci saw
 * "12 of 16 filled" on Explore while Questions said done (2026-10-02).
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

const explore = read('src/app/(tabs)/explore.tsx');
assert.match(explore, /import \{[^}]*useFocusEffect[^}]*\} from 'expo-router'/);
assert.match(explore, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*void reloadTracks\(\);/);
ok('Explore refetches trait tracks on focus');
assert.match(explore, /if \(requestId !== requestIdRef\.current\) return;\s*setTracks\(rows\)/);
ok('only the newest refetch may write');
// A failed refetch must keep what is on screen: the catch never clears tracks.
const catchBody = explore.slice(explore.indexOf('} catch (err) {', explore.indexOf('reloadTracks')));
assert.doesNotMatch(catchBody.slice(0, catchBody.indexOf('} finally')), /setTracks\(/);
ok('a failed refetch keeps the tracks already shown');
assert.match(explore, /<CategoriesFold[\s\S]*?tracks=\{tracksReady \? tracks : undefined\}/);
ok('Explore hands its fresh tracks to Categories');

const fold = read('src/components/categories-fold.tsx');
assert.match(fold, /tracks: parentTracks/);
assert.match(fold, /if \(!parentTracks\) return;\s*setTracks\(parentTracks\);/);
ok('Categories prefers the parent tracks over its own fetch');

console.log(`\nexplore-refetch: ${passed} passed`);
