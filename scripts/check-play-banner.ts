/**
 * Floating banner checks (v25, 2026-09-30). Run: npm run check:play-banner
 *
 *   - One banner at a time, the rest wait in order; dismissing (timeout,
 *     swipe up, tap) shows the next; an exact repeat is skipped; a flood
 *     keeps the one showing + the newest few.
 *   - News: hatched / revealed banner only away from the Pet screen; a newly
 *     ready milestone banners anywhere and taps to the Journal; first load
 *     banners nothing.
 *   - The screen: the banner is rendered once, outside every ScrollView, and
 *     the old in-scroll toast is gone.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BANNER_MAX_WAITING,
  BANNER_MS,
  EMPTY_BANNERS,
  bannerEvents,
  currentBanner,
  dismissBanner,
  enqueueBanner,
  type BannerWatch,
} from '../src/play/play-banner-queue';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

{
  let q = EMPTY_BANNERS;
  assert.equal(currentBanner(q), null);
  q = enqueueBanner(q, { title: 'A', body: 'a', target: null });
  q = enqueueBanner(q, { title: 'B', body: 'b', target: 'pet' });
  q = enqueueBanner(q, { title: 'C', body: 'c', target: 'journal' });
  assert.equal(currentBanner(q)?.title, 'A', 'the oldest shows first');
  const a = currentBanner(q)!;
  assert.equal(dismissBanner(q, 999), q, 'dismissing one that is not showing does nothing');
  q = dismissBanner(q, a.id);
  assert.equal(currentBanner(q)?.title, 'B', 'then the next');
  assert.equal(dismissBanner(q, a.id), q, 'a second dismiss of the same banner is ignored');
  q = dismissBanner(q, currentBanner(q)!.id);
  q = dismissBanner(q, currentBanner(q)!.id);
  assert.equal(currentBanner(q), null, 'empty after the last');
  assert.ok(BANNER_MS >= 2500 && BANNER_MS <= 4000, 'stays about 3s');
}
ok('one banner at a time, first in first out; dismiss shows the next');

{
  let q = enqueueBanner(EMPTY_BANNERS, { title: 'Surfaced', body: 'x', target: null });
  q = enqueueBanner(q, { title: 'Surfaced', body: 'x', target: null });
  assert.equal(q.items.length, 1, 'an exact repeat is skipped');
  for (let i = 0; i < 20; i += 1) q = enqueueBanner(q, { title: `N${i}`, body: '', target: null });
  assert.equal(q.items.length, BANNER_MAX_WAITING + 1, 'a flood keeps a short queue');
  assert.equal(currentBanner(q)?.title, 'Surfaced', 'never drops the one showing');
  assert.equal(q.items[q.items.length - 1].title, 'N19', 'keeps the newest');
  const ids = q.items.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
}
ok('repeats skipped; a flood never drops the one showing');

{
  const w = (stage: string, oddsOpen: boolean, milestonesReady = 0): BannerWatch => ({ stage, oddsOpen, milestonesReady });
  assert.deepEqual(bannerEvents(null, w('baby', true, 3), false), [], 'first load: nothing');
  const hatched = bannerEvents(w('egg', true), w('baby', true), false);
  assert.equal(hatched.length, 1);
  assert.equal(hatched[0].target, 'pet', 'hatched taps to the pet');
  assert.deepEqual(bannerEvents(w('egg', true), w('baby', true), true), [], 'on the Pet screen the room shows it');
  const revealed = bannerEvents(w('baby', true), w('child', false), false);
  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].title, 'Grade revealed');
  assert.deepEqual(bannerEvents(w('god', false), w('egg', true), false), [], 'a new egg is not news');
  assert.deepEqual(bannerEvents(w('child', false, 1), w('child', false, 1), false), [], 'nothing new: nothing');
  const ready = bannerEvents(w('child', false, 1), w('child', false, 2), true);
  assert.equal(ready.length, 1, 'a milestone banners even on the Pet screen');
  assert.equal(ready[0].target, 'journal');
  assert.deepEqual(bannerEvents(w('child', false, 2), w('child', false, 1), false), [], 'claiming is not news');
}
ok('hatched / revealed banner away from the Pet screen; milestone ready → Journal');

{
  const root = join(__dirname, '..');
  const play = readFileSync(join(root, 'src/app/play.tsx'), 'utf8');
  assert.ok(!play.includes('MilestoneToast'), 'the old toast is gone from Play');
  assert.equal(play.split('<PlayBanner').length - 1, 1, 'the banner is rendered exactly once');
  const at = play.indexOf('<PlayBanner');
  const before = play.slice(0, at);
  const opens = before.split('<ScrollView').length - 1;
  const closes = before.split('</ScrollView>').length - 1;
  assert.equal(opens, closes, 'never inside a ScrollView');
  assert.ok(play.includes('useReducer(bannerReducer'), 'every setToast goes through the queue');
  const banner = readFileSync(join(root, 'src/play/play-banner.tsx'), 'utf8');
  assert.ok(banner.includes("position: 'absolute'"), 'it floats');
  assert.ok(banner.includes('insets.top + TOP_BAR_H'), 'below the status bar and the top bar');
  assert.ok(banner.includes('onPanResponderRelease'), 'swipe up to dismiss');
}
ok('Play renders one floating banner outside every ScrollView');

console.log(`\ncheck:play-banner — ${passed} groups passed.`);
