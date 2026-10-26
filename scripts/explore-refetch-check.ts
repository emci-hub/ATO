/**
 * Categories (on You since IA P5; was Explore) shows the same counts as Questions: it refetches trait tracks every
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

// IA P5 (2026-10-26): the Explore tab is gone (its route file only redirects to You). Categories now lives
// on You, which has its own `home_bootstrap` focus refetch with the same guards Explore had.
const exploreRoute = read('src/app/(tabs)/explore.tsx');
assert.match(exploreRoute, /<Redirect href="\/you\?section=categories" \/>/, 'explore.tsx is only the redirect');
assert.doesNotMatch(exploreRoute, /fetchTraitTracks|reloadTracks|useFocusEffect/, 'the Explore route no longer fetches anything');
ok('Explore route is only the redirect; it fetches no tracks');

const explore = read('src/app/(tabs)/you.tsx');
assert.match(explore, /import \{[^}]*useFocusEffect[^}]*\} from 'expo-router'/);
assert.match(explore, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*void reloadTracks\(\);/);
ok('You refetches trait tracks on focus');
assert.match(explore, /fetchHomeBootstrap\(timeZone\)/, 'the refetch is the one-RPC home_bootstrap');
assert.match(explore, /const loadedOnceRef = useRef\(false\);/);
assert.match(explore, /const requestIdRef = useRef\(0\);/);
assert.match(explore, /if \(requestId !== requestIdRef\.current\) return;\s*loadedOnceRef\.current = true;\s*setTracks\(next\.tracks\)/);
ok('only the newest refetch may write (requestIdRef + loadedOnceRef)');
// A failed refetch must keep what is on screen: the catch never clears tracks.
const catchBody = explore.slice(explore.indexOf('} catch (err) {', explore.indexOf('reloadTracks')));
assert.doesNotMatch(catchBody.slice(0, catchBody.indexOf('} finally')), /setTracks\(/);
ok('a failed refetch keeps the tracks already shown');
assert.match(explore, /<CategoriesFold[\s\S]*?tracks=\{tracksReady \? tracks : undefined\}/);
ok('You hands its fresh tracks to Categories');

const fold = read('src/components/categories-fold.tsx');
assert.match(fold, /tracks: parentTracks/);
assert.match(fold, /if \(!parentTracks\) return;\s*setTracks\(parentTracks\);/);
ok('Categories prefers the parent tracks over its own fetch');

console.log(`\nexplore-refetch: ${passed} passed`);
