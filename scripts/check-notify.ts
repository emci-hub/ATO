/**
 * Divecore notices gate (Phase 2, 2026-10-14; spec docs/divecore-layout-spec.md §1 NoticeLane).
 * Run: npm run check:notify (part of check:ota-gate). Replaces check:play-banner.
 *
 *   Pure queue: kinds + priority, first in first out, dedupe → ×N counter, cap 4 (oldest
 *   low drops first), pause (only ERROR), same-kind 1 s gap, durations (+1 s Reduce Motion),
 *   "Important only". Pure news → notices (`noticeEvents`, was bannerEvents).
 *   Static: every notice in src/play goes through notify(); word limits on every notify()
 *   call; the lane announces to VoiceOver, is a live region, fades (never instant) under
 *   Reduce Motion, is one line, and sits in GameScreen's notice region BY LAYOUT (no
 *   hard-coded or measured top bar height); PlayBanner is gone.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMPTY_NOTICES,
  NOTICE_DEDUPE_MS,
  NOTICE_MAX_WAITING,
  NOTICE_MS,
  dismissNotice,
  enqueueNotice,
  nextNoticeWake,
  noticeAnnouncement,
  noticeCopyProblem,
  noticeDuration,
  tickNotices,
  type NoticeQueue,
} from '../src/play/notify/queue';
import { noticeEvents, type NoticeWatch } from '../src/play/notify/events';
import { fitNotice, fitWords, shopBuyBody, skipBody, surfaceBody } from '../src/play/notify/copy';
import { BUFF_IDS, BUFF_LABEL, BUFF_NOTICE } from '../src/play/play-buffs';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};
const run = { paused: false, reduceMotion: false };

/* ------------------------------------------------------------ pure queue --- */

{
  let q: NoticeQueue = EMPTY_NOTICES;
  q = enqueueNotice(q, { kind: 'notify', title: 'A' }, 0);
  q = enqueueNotice(q, { kind: 'notify', title: 'B' }, 1);
  q = enqueueNotice(q, { kind: 'celebrate', title: 'Hatched' }, 2);
  q = tickNotices(q, 3, run);
  assert.equal(q.showing?.title, 'Hatched', 'high priority goes first');
  q = dismissNotice(q, q.showing!.id, 4);
  q = tickNotices(q, 5, run);
  assert.equal(q.showing?.title, 'A', 'then first in first out');
  assert.equal(dismissNotice(q, 999, 6), q, 'dismissing one not showing does nothing');
  const a = q.showing!.id;
  q = dismissNotice(q, a, 6);
  assert.equal(dismissNotice(q, a, 7), q, 'a second dismiss is ignored');
  q = tickNotices(q, 7, run);
  assert.equal(q.showing, null, 'same kind waits out the 1 s gap');
  assert.equal(nextNoticeWake(q, 7, run), 999, 'and the renderer wakes when it opens');
  q = tickNotices(q, 1_006, run);
  assert.equal(q.showing?.title, 'B');
}
ok('one at a time: high > normal > low, first in first out; same kind never back to back < 1 s');

{
  let q = enqueueNotice(EMPTY_NOTICES, { kind: 'error', title: 'Bag full', body: 'Sell a Look.' }, 0);
  q = tickNotices(q, 0, run);
  q = enqueueNotice(q, { kind: 'error', title: 'Bag full', body: 'Sell a Look.' }, 500);
  q = enqueueNotice(q, { kind: 'error', title: 'Bag full', body: 'Sell a Look.' }, 900);
  assert.equal(q.waiting.length, 0, 'a repeat of the one showing merges');
  assert.equal(q.showing?.count, 3, '…into a ×3 counter');
  assert.equal(noticeAnnouncement(q.showing!), 'Bag full ×3. Sell a Look.');
  q = enqueueNotice(q, { kind: 'notify', title: 'Back', dedupeKey: 'exp' }, 1_000);
  q = enqueueNotice(q, { kind: 'notify', title: 'Back again', dedupeKey: 'exp' }, 1_100);
  assert.equal(q.waiting.length, 1, 'a dedupeKey merges waiting ones too');
  assert.equal(q.waiting[0].count, 2);
  const shown = q.showing!.id;
  q = dismissNotice(q, shown, 2_000);
  q = enqueueNotice(q, { kind: 'error', title: 'Bag full', body: 'Sell a Look.' }, 2_000 + NOTICE_DEDUPE_MS - 1);
  assert.equal(q.waiting.find((n) => n.title === 'Bag full')?.count, 2, 'a repeat inside 10 s comes back counted');
  q = enqueueNotice(q, { kind: 'celebrate', title: 'Rare find' }, 3_000);
  q = enqueueNotice(q, { kind: 'celebrate', title: 'Rare find' }, 3_000 + NOTICE_DEDUPE_MS + 5);
  assert.equal(q.waiting.filter((n) => n.title === 'Rare find').length, 1, 'still waiting = still merges');
}
ok('dedupe by dedupeKey or kind+title within 10 s; repeats merge into ×N');

{
  let q = EMPTY_NOTICES;
  q = enqueueNotice(q, { kind: 'notify', title: 'Low 1', priority: 'low' }, 0);
  q = enqueueNotice(q, { kind: 'notify', title: 'Low 2', priority: 'low' }, 1);
  for (let i = 0; i < 3; i += 1) q = enqueueNotice(q, { kind: 'notify', title: `N${i}` }, 2 + i);
  assert.equal(q.waiting.length, NOTICE_MAX_WAITING, 'at most 4 waiting');
  assert.ok(!q.waiting.some((n) => n.title === 'Low 1'), 'the oldest low drops first');
  assert.ok(q.waiting.some((n) => n.title === 'Low 2'));
  for (let i = 0; i < 4; i += 1) q = enqueueNotice(q, { kind: 'error', title: `E${i}` }, 10 + i);
  assert.ok(q.waiting.every((n) => n.kind === 'error'), 'a flood of errors pushes out the rest');
}
ok('cap: 4 waiting; the oldest lowest-priority drops first');

{
  const paused = { paused: true, reduceMotion: false };
  let q = enqueueNotice(EMPTY_NOTICES, { kind: 'celebrate', title: 'Hatched' }, 0);
  q = tickNotices(q, 0, paused);
  assert.equal(q.showing, null, 'paused: celebrate waits');
  assert.equal(nextNoticeWake(q, 0, paused), null, 'paused: no timer');
  q = enqueueNotice(q, { kind: 'error', title: 'Cannot merge', body: 'Unequip it first.' }, 1);
  q = tickNotices(q, 1, paused);
  assert.equal(q.showing?.kind, 'error', 'ERROR still shows while paused');
  q = dismissNotice(q, q.showing!.id, 2);
  q = tickNotices(q, 3, run);
  assert.equal(q.showing?.title, 'Hatched', 'unpaused: the held one shows');
}
ok('pause (modal / tip / wave-critical): only ERROR goes up');

{
  assert.equal(noticeDuration('celebrate', false), 3_500);
  assert.equal(noticeDuration('notify', false), 3_000);
  assert.equal(noticeDuration('error', false), 5_000);
  assert.equal(noticeDuration('notify', true), NOTICE_MS.notify + 1_000, 'Reduce Motion: +1 s');
  let q = tickNotices(enqueueNotice(EMPTY_NOTICES, { kind: 'notify', title: 'Back' }, 0), 0, run);
  assert.ok(tickNotices(q, 2_999, run).showing, 'still up at 2.999 s');
  assert.equal(tickNotices(q, 3_000, run).showing, null, 'gone at 3 s');
  q = tickNotices(enqueueNotice(EMPTY_NOTICES, { kind: 'notify', title: 'Back' }, 0), 0, { paused: false, reduceMotion: true });
  assert.ok(tickNotices(q, 3_500, { paused: false, reduceMotion: true }).showing, 'Reduce Motion keeps it longer');
  assert.equal(enqueueNotice(EMPTY_NOTICES, { kind: 'notify', title: 'Back' }, 0, 'important'), EMPTY_NOTICES, 'Important only drops NOTIFY');
  assert.notEqual(enqueueNotice(EMPTY_NOTICES, { kind: 'error', title: 'No' }, 0, 'important'), EMPTY_NOTICES);
  assert.notEqual(enqueueNotice(EMPTY_NOTICES, { kind: 'celebrate', title: 'Yes' }, 0, 'important'), EMPTY_NOTICES);
  // A game-critical NOTIFY (Turf War "BOSS INCOMING", emci 2026-10-17) still shows on Important only.
  assert.notEqual(enqueueNotice(EMPTY_NOTICES, { kind: 'notify', title: 'BOSS INCOMING', important: true }, 0, 'important'), EMPTY_NOTICES, 'Important only keeps an important NOTIFY');
}
ok('durations 3.5 / 3 / 5 s (+1 s Reduce Motion); "Important only" = ERROR + CELEBRATE');

{
  assert.equal(noticeCopyProblem({ title: 'Bag full', body: 'Sell a Look.' }), null);
  assert.match(noticeCopyProblem({ title: 'Your egg has hatched' }) ?? '', /title is 4 words/);
  assert.match(
    noticeCopyProblem({ title: 'Odds', body: 'one two three four five six seven eight nine ten eleven' }) ?? '',
    /body is 11 words/,
  );
}
ok('word limits: title ≤ 3, body ≤ 10');

{
  // Phase 5: notices built from values. Worst cases through the real builders must fit 3 / 10.
  const fits = (label: string, title: string, body: string) => assert.equal(noticeCopyProblem({ title, body }), null, `${label}: "${title}" / "${body}"`);
  const longName = 'Midnight Subway Conductor Collectors Edition';
  fits(
    'surface, everything at once',
    'Surfaced',
    surfaceBody({
      banked: ['a', 'b', 'c', 'd'],
      shellsGained: 120,
      free: false,
      swordDrop: longName,
      netFind: longName,
      heartyFind: longName,
      powersToday: 6,
      powersCap: 6,
      powersConverted: 2,
      overflowShells: 5,
    }),
  );
  const plain = surfaceBody({ banked: ['a', 'b', 'c'], shellsGained: 12, free: false, swordDrop: null, netFind: null, heartyFind: null, powersToday: 2, powersCap: 6, powersConverted: 0, overflowShells: 5 });
  assert.equal(plain, '3 finds · +12 shells · Powers 2/6', 'a plain surface keeps finds, shells, Powers');
  const withSword = surfaceBody({ banked: ['a'], shellsGained: 3, free: false, swordDrop: 'Rusty Pipe', netFind: null, heartyFind: null, powersToday: 1, powersCap: 6, powersConverted: 0, overflowShells: 5 });
  assert.match(withSword, /Sword: Rusty Pipe/, 'a sword drop outranks Powers');
  fits(
    'skip, crate + milestones',
    'Skipped ahead',
    skipBody({ tokens: 1200, xp: 340, waves: 12, crate: [longName, longName], milestones: [{ wave: 10, name: longName }, { wave: 20, name: longName }] }),
  );
  assert.match(skipBody({ tokens: 5, xp: 2, waves: 1, crate: [], milestones: [] }), /^\+5 tokens · \+2 XP · 1 wave$/, 'a skip keeps pay + waves');
  fits('shop buy, everything', 'Dive charge', shopBuyBody({ tokensSpent: 250, grantedName: longName, diveCharges: { now: 9, cap: 10 }, shellsInstead: 40 }));
  assert.equal(shopBuyBody({ tokensSpent: 30, grantedName: null, diveCharges: null, shellsInstead: 0 }), '−30 tokens', 'a plain buy is the price');
  // The net under every other notify(): server-named items, rescued lists, long titles.
  const net = fitNotice({ kind: 'notify' as const, title: 'The Extra Long Shop Item Name', body: 'one two three four five six seven eight nine ten eleven twelve' });
  assert.equal(noticeCopyProblem(net), null, 'fitNotice trims title + body to the limits');
  assert.equal(net.title, 'The Extra Long');
  const same = { kind: 'notify' as const, title: 'Bag full', body: 'Sell a Look.' };
  assert.equal(fitNotice(same), same, 'copy that fits is returned untouched');
  assert.equal(fitWords('Pet saved Raven, Kelp, Net. The rest sank.', 4), 'Pet saved Raven, Kelp', 'cuts on a word, no trailing comma');
  // Buff notices use the short line, not the guide sentence.
  for (const b of BUFF_IDS) fits(`buff ${b}`, BUFF_LABEL[b], BUFF_NOTICE[b]);
}
ok('Phase 5: surface / skip / shop / buff copy fits 3 / 10 at its worst; fitNotice is the net');

{
  const w = (stage: string, oddsOpen: boolean, milestonesReady = 0): NoticeWatch => ({ stage, oddsOpen, milestonesReady });
  assert.deepEqual(noticeEvents(null, w('baby', true, 3), false), [], 'first load: nothing');
  const hatched = noticeEvents(w('egg', true), w('baby', true), false);
  assert.equal(hatched.length, 1);
  assert.equal(hatched[0].kind, 'celebrate');
  assert.equal(hatched[0].target, 'pet', 'hatched taps to the pet');
  assert.deepEqual(noticeEvents(w('egg', true), w('baby', true), true), [], 'in the Hideout the room shows it');
  const revealed = noticeEvents(w('baby', true), w('child', false), false);
  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].title, 'Grade revealed');
  assert.deepEqual(noticeEvents(w('god', false), w('egg', true), false), [], 'a new egg is not news');
  assert.deepEqual(noticeEvents(w('child', false, 1), w('child', false, 1), false), [], 'nothing new: nothing');
  const ready = noticeEvents(w('child', false, 1), w('child', false, 2), true);
  assert.equal(ready.length, 1, 'a milestone notifies even in the Hideout');
  assert.equal(ready[0].target, 'journal');
  assert.deepEqual(noticeEvents(w('child', false, 2), w('child', false, 1), false), [], 'claiming is not news');
  const tide = noticeEvents({ ...w('child', false), streakYmd: '2026-10-13', streakDay: 3 }, { ...w('child', false), streakYmd: '2026-10-14', streakDay: 4 }, false);
  assert.equal(tide.length, 1, 'a new Tide day notifies');
  for (const n of [...hatched, ...revealed, ...ready, ...tide]) assert.equal(noticeCopyProblem(n), null, `"${n.title}" fits the word limits`);
}
ok('news: hatched / revealed only away from the Hideout; milestone → Journal; Tide day; copy fits');

/* ---------------------------------------------------------------- static --- */

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
}
const files: string[] = [];
walk(path.join(repo, 'src/play'), files);
files.push(path.join(repo, 'src/app/play.tsx'));
const rel = (f: string) => path.relative(repo, f).replace(/\\/g, '/');

{
  const offenders: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const r = rel(f);
    if (r.startsWith('src/play/notify/')) continue;
    // The retired paths: the old banner queue, a setToast reducer, ad-hoc absolute toasts.
    if (/from '@\/play\/play-banner(-queue)?'/.test(src)) offenders.push(`${r}: imports the old PlayBanner`);
    if (/\bsetToast\s*\(/.test(src)) offenders.push(`${r}: setToast(…) — use notify()`);
    if (/\bonBanner\b/.test(src)) offenders.push(`${r}: onBanner — use notify()`);
    if (/Alert\.alert\(/.test(src)) offenders.push(`${r}: Alert.alert — use a CONFIRM sheet or notify()`);
  }
  assert.deepEqual(offenders, [], `notices outside notify():\n  ${offenders.join('\n  ')}`);
}
ok('every notice in src/play goes through notify() (no setToast / onBanner / old PlayBanner / Alert)');

{
  const problems: string[] = [];
  const call = /notify\(\{\s*kind:\s*'(\w+)',\s*title:\s*(['`])((?:(?!\2).)*)\2(?:,\s*body:\s*(['`])((?:(?!\4).)*)\4)?/gs;
  let count = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(call)) {
      count += 1;
      const strip = (s: string | undefined) => (s ?? '').replace(/\$\{[^}]*\}/g, 'x');
      const p = noticeCopyProblem({ title: strip(m[3]), body: strip(m[5]) });
      if (p) problems.push(`${rel(f)}: "${m[3]}" — ${p}`);
      if (!['celebrate', 'notify', 'error'].includes(m[1])) problems.push(`${rel(f)}: kind '${m[1]}' is not a banner kind`);
    }
  }
  assert.ok(count >= 10, `found ${count} notify() calls — the migration should have many`);
  assert.deepEqual(problems, [], `notice copy over the limits:\n  ${problems.join('\n  ')}`);
  ok(`word limits hold on all ${count} literal notify() calls`);
}

{
  // The value-built notices go through the pure builders, and notify() trims whatever is left.
  const play = read('src/app/play.tsx');
  assert.match(play, /body: surfaceBody\(/, 'Surfaced uses surfaceBody');
  assert.match(play, /body: skipBody\(/, 'Skipped ahead uses skipBody');
  assert.match(play, /body: shopBuyBody\(/, 'a shop buy uses shopBuyBody');
  assert.ok(!/parts\.join\(' · '\)/.test(play), 'no notice body is joined by hand in play.tsx');
  assert.match(read('src/play/notify/notify.ts'), /enqueueNotice\(queue, fitNotice\(input\)/, 'notify() trims every notice to 3 / 10 words');
  assert.match(read('src/play/pet-screen.tsx'), /body: BUFF_NOTICE\[r\.buff\]/, 'a buff notice uses the short line');
  ok('play.tsx builds Surfaced / Skipped ahead / shop notices with the pure builders; notify() trims the rest');
}

{
  const lane = read('src/play/notify/notice-lane.tsx');
  assert.match(lane, /AccessibilityInfo\.announceForAccessibility/, 'announces on show');
  assert.match(lane, /accessibilityLiveRegion=/, 'the lane is a live region (Android)');
  assert.match(lane, /accessibilityHint=/, 'a tappable notice has a hint');
  assert.match(lane, /numberOfLines=\{1\}/, 'one-line body');
  assert.ok(!/numberOfLines=\{[2-9]\}/.test(lane), 'no multi-line notice');
  assert.match(lane, /REDUCED_DRIFT_PX = 2/, 'Reduce Motion: a 2 px drift…');
  assert.match(lane, /REDUCED_FADE_MS = 200/, '…with a 200 ms fade (never instant)');
  assert.match(lane, /reduceMotion: ReduceMotion\.Never/, 'the fade runs even with the phone on Reduce Motion (never still)');
  assert.ok(!/TOP_BAR_H\s*=\s*\d/.test(lane), 'no hard-coded top bar height');
  assert.ok(!/position:\s*'absolute'[^}]*top:|insets\.top/.test(lane), 'not a floating overlay: the lane is placed by layout');
  // The lane is drawn by GameScreen inside its fixed notice region (the region, not the lane, has the height).
  const layout = read('src/play/stage-layout.tsx');
  assert.match(
    layout,
    /<View style=\{\[styles\.region, \{ height: r\.notice\.height \}\]\}>[\s\S]{0,160}<NoticeLane height=\{r\.notice\.height\} idle=\{notice\}( reserveRight=\{help \? HELP_COLUMN : 0\})? \/>/,
    'GameScreen draws the NoticeLane in its fixed notice region, the screen line as idle content',
  );
  // One store, top-most lane only; nothing shows (or expires) with no lane mounted.
  const store = read('src/play/notify/notify.ts');
  assert.match(store, /if \(lanes\.length === 0\) return;/, 'no lane mounted: notices wait');
  assert.match(
    store,
    /queue\.showing && queue\.showing\.kind !== 'error'\) \{\s*queue = \{ \.\.\.queue, showing: null, waiting: \[queue\.showing, \.\.\.queue\.waiting\] \}/,
    'a cover (haul reveal, tutorial) puts the notice already up back in line, so it is not lost behind it',
  );
  assert.match(store, /topLane: lanes\.length > 0 \? lanes\[lanes\.length - 1\] : null/, 'only the top-most lane shows a notice');
  assert.match(lane, /topLane === laneId \? queue\.showing : null/, 'a lane under another (Hideout under a pet game) shows only its idle line');
  for (const gone of ['src/play/play-banner.tsx', 'src/play/play-banner-queue.ts', 'scripts/check-play-banner.ts']) {
    assert.ok(!fs.existsSync(path.join(repo, gone)), `${gone} is gone`);
  }
  ok('lane: VoiceOver announce + live region + hint, one line, Reduce Motion fade+drift, placed by layout; PlayBanner gone');
}

console.log(`\ncheck:notify — ${passed} groups passed.`);
