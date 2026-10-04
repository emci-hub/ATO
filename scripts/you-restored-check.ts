/**
 * What came back on You (emci 2026-10-04: "bring those back"). Run: npm run check:you-restored
 *
 * Parked 2026-09-15 (Card F), restored: the appearance picker, the city picker,
 * the Account fold (birthday), and notification preferences. NOT restored on
 * purpose: the share poster (the identity card already has "Share my card").
 * The delete-account / sign-out / AI-consent floor is pinned in rebuilt-check.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const you = read('src/app/(tabs)/you.tsx');
assert.match(you, /<AppearancePicker \/>/);
assert.match(you, /<CityPicker\s+value=\{me\.city\}\s+onChange=\{\(slug\) => \{\s+void saveCity\(slug\);/);
assert.match(you, /await setCity\(me\.id, slug\);\s+await refresh\(\);/, 'saving a city refreshes the account');
assert.match(you, /<SettingsFold title="Account">\s+<BirthdayRow me=\{me\} onUpdated=\{\(\) => refresh\(\)\} \/>/);
assert.match(you, /<NotificationPrefsFold \/>/);
assert.doesNotMatch(you, /<SharePoster/, 'the poster stays off You: the identity card already shares');
assert.doesNotMatch(you, /AppVersionDevUnlock|you-dev-tools|push-test-card|sentry-test-card/, 'no dev tool on You (dev-fab / prod-you pins)');
ok('You mounts the appearance picker, city picker, birthday (Account fold) and notification preferences; no poster, no dev tools');

const fold = read('src/components/notification-prefs-fold.tsx');
const rows = [...fold.matchAll(/\{ kind: '(\w+)', label: (?:"([^"]+)"|'([^']+)') \}/g)].map((m) => `${m[1]}:${m[2] ?? m[3]}`);
assert.deepEqual(rows, ["morning:Morning · today's line", 'sunday:Sunday · week recap']);
assert.match(fold, /getPushPrefs\(\)/);
assert.match(fold, /setPushPref\(kind, !prefs\[kind\]\)/);
assert.match(fold, /resyncPushForUser\(me\)/, 'a toggle takes effect now, not at the next sync');
const push = read('src/lib/push.ts');
assert.match(push, /EVENING_PUSH_ENABLED = false/, 'the Evening reminder is still off app-wide, so it has no toggle');
ok('notification preferences list only the two that can fire (morning line, Sunday recap); a toggle resyncs at once');

for (const gone of ['src/components/optional-intake.tsx', 'src/components/explore-panel.tsx']) {
  assert.ok(!existsSync(resolve(root, gone)), `${gone} stays deleted`);
}
ok('the two dead files (optional fill, old Explore panel) stay deleted');

// Name styles: free to pick while NAME_STYLES_FREE (emci 2026-10-04).
{
  const store = read('src/lib/legends64/identity-store.ts');
  assert.match(store, /export const NAME_STYLES_FREE = true;/);
  assert.match(store, /NAME_STYLES_FREE \|\| parsed\.skin === DEFAULT_LEGEND_SKIN \|\| unlocked\.includes\(parsed\.skin\)/, 'a picked style survives a reload without being "unlocked"');
  const card = read('src/components/identity-card.tsx');
  assert.equal((card.match(/const owned = NAME_STYLES_FREE \|\|/g) ?? []).length, 2, 'every style reads as owned, in the picker and in pickStyle');
  assert.match(card, /\{credits > 0 && !NAME_STYLES_FREE \? \(/, 'no "you already paid" line while free');
  assert.match(card, /payForStyleUnlock\(\)/, 'the paid path is kept for when the flag flips back');
  ok('every name style is pickable for free (one flag turns the 10-token, one-a-day unlock back on)');
}

// The name on Home: display only.
{
  const chip = read('src/components/identity-title-chip.tsx');
  assert.match(chip, /nextLockedPoles\(tracks, stored\?\.poles \?\? \{\}\)/);
  assert.doesNotMatch(chip, /saveIdentityState|supabase|generateText|\.rpc\(|spendAtoTokens/, 'Home only reads: no write, no model call, no spend');
  assert.match(chip, /view\.lockedCount === 0\) return null/, 'nothing shows until part of the name has settled');
  assert.doesNotMatch(chip, /identityProgressLine/, 'no "N of M settled" line on Home');
  assert.match(chip, /useFocusEffect/, 'reloads on focus so a style picked on You shows on Home');
  assert.match(read('src/app/(tabs)/index.tsx'), /<IdentityTitleChip userId=\{me\.id\} tracks=\{tracks\} \/>/);
  ok('Home shows the earned name (display only, no write, no model call)');
}

console.log(`\n${passed} you-restored checks passed`);
