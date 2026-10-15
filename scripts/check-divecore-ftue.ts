/**
 * Divecore first-time guidance check (Phase 4, 2026-10-14).
 *
 * ONE "?" per game screen (≤ 3 bullets, ≤ 10 words each, Full guide → Hideout → Info → Guide) and
 * FOUR coach tips (≤ 6 words, one at a time, never blocking, never resizing a region) instead of the
 * old blocking five-card tutorial. Pure rules in `src/play/help/help-content.ts` and
 * `src/play/ftue/coach-tips.ts`; static pins on how they are wired.
 *
 * Run: npm run check:divecore-ftue
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  HELP,
  HELP_FRAME,
  HELP_IDS,
  HELP_MAX_BULLETS,
  HELP_MAX_WORDS,
  FULL_GUIDE_PATH,
  helpGuideLinkAllowed,
  wordCount,
} from '../src/play/help/help-content';
import {
  COACH_TIP_DEFS,
  TIP_MAX_WORDS,
  allTipsSeen,
  markTipSeen,
  pickCoachTip,
  replayTipsPatch,
  tipPlacement,
  type TipContext,
} from '../src/play/ftue/coach-tips';
import { COACH_TIPS, parseSettings, type CoachTipId } from '../src/play/play-settings';
import { REGIONS } from '../src/play/stage-frame';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (f: string) => readFileSync(f, 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ------------------------------------------------------------ the "?" copy --- */

for (const id of HELP_IDS) {
  const e = HELP[id];
  assert.ok(e.title.length > 0, `${id}: has a title`);
  assert.ok(e.bullets.length >= 1 && e.bullets.length <= HELP_MAX_BULLETS, `${id}: 1-${HELP_MAX_BULLETS} bullets (${e.bullets.length})`);
  for (const b of e.bullets) {
    assert.ok(wordCount(b) <= HELP_MAX_WORDS, `${id}: "${b}" is ${wordCount(b)} words (max ${HELP_MAX_WORDS})`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(b), `${id}: no emoji in "${b}"`);
  }
}
for (const frame of Object.keys(REGIONS)) {
  assert.ok(HELP_IDS.some((id) => HELP_FRAME[id] === frame), `frame ${frame} has a help entry`);
}
ok(`every game screen has a "?" entry: ≤ ${HELP_MAX_BULLETS} bullets, ≤ ${HELP_MAX_WORDS} words each`);

assert.equal(FULL_GUIDE_PATH, 'Hideout → Info → Guide');
assert.ok(helpGuideLinkAllowed('hideout') && helpGuideLinkAllowed('locker') && helpGuideLinkAllowed('turf-setup'));
for (const live of ['dive', 'turf-wave', 'pet-game'] as const) {
  assert.ok(!helpGuideLinkAllowed(live), `${live}: a live run only names the guide path (leaving would end it)`);
}
ok('Full guide is a link where leaving is safe, and just the path inside a live run');

/* --------------------------------------------------------------- the tips --- */

assert.deepEqual([...COACH_TIPS], ['warm', 'feed', 'dive', 'turf'], 'four tips, in order: warm · Feed · Underground · Turf War');
assert.ok(COACH_TIPS.length <= 4);
for (const id of COACH_TIPS) {
  const t = COACH_TIP_DEFS[id];
  assert.ok(wordCount(t.text) <= TIP_MAX_WORDS, `${id}: "${t.text}" is ${wordCount(t.text)} words (max ${TIP_MAX_WORDS})`);
}
assert.deepEqual(
  COACH_TIPS.map((id) => COACH_TIP_DEFS[id].anchor),
  ['egg', 'feed', 'hatch', 'turf'],
);
ok(`four tips, ≤ ${TIP_MAX_WORDS} words each, anchored on the egg, Feed, the hatch and the Turf War tab`);

const none: Record<CoachTipId, boolean> = { warm: false, feed: false, dive: false, turf: false };
const idleEgg: TipContext = { idle: true, egg: true, eggPicked: true };
const idleGrown: TipContext = { idle: true, egg: false, eggPicked: true };
assert.equal(pickCoachTip(none, idleEgg)?.id, 'warm', 'a picked egg: warm it first');
assert.equal(pickCoachTip(none, { idle: true, egg: true, eggPicked: false }), null, 'still picking an egg: no tip');
assert.equal(pickCoachTip(none, idleGrown)?.id, 'feed', 'a hatched pet skips the egg tip: Feed first');
assert.equal(pickCoachTip(none, { ...idleGrown, idle: false }), null, 'nothing while a sheet / game / Settings is open');
let seen = markTipSeen(none, 'warm');
assert.equal(pickCoachTip(seen, idleEgg), null, 'while it is still an egg, only the egg tip applies');
assert.equal(pickCoachTip(seen, idleGrown)?.id, 'feed');
seen = markTipSeen(seen, 'feed');
assert.equal(pickCoachTip(seen, idleGrown)?.id, 'dive');
seen = markTipSeen(seen, 'dive');
assert.equal(pickCoachTip(seen, idleGrown)?.id, 'turf');
seen = markTipSeen(seen, 'turf');
assert.equal(pickCoachTip(seen, idleGrown), null, 'all four seen: no more tips');
assert.ok(allTipsSeen(seen) && !allTipsSeen(none));
assert.equal(markTipSeen(seen, 'warm'), seen, 'marking a seen tip changes nothing');
ok('one tip at a time, in order, only on an idle Hideout; each ends once seen');

const replay = replayTipsPatch();
assert.deepEqual(replay.tipsSeen, none, 'Replay tips makes all four unseen');
assert.equal(replay.tutorialSeen, true, 'the old blocking tutorial flag stays set');
// Saves: progress counts as all seen; a new save sees all four; a stored mix is kept.
assert.ok(allTipsSeen(parseSettings(undefined, { remind: false, hasProgress: true }).tipsSeen), 'a save with progress: no tips');
assert.deepEqual(parseSettings(undefined, { remind: false, hasProgress: false }).tipsSeen, none, 'a new save: all four tips');
assert.equal(parseSettings({ tutorialSeen: true, tipsSeen: { warm: false } }, null).tipsSeen.warm, false, 'a stored flag wins');
ok('tipsSeen: new save sees all four, progress sees none, Replay tips resets them');

const place = tipPlacement({ x: 10, y: 607, width: 100, height: 56 }, { width: 375, height: 667 }, 260, 40);
assert.ok(place.left >= 8 && place.left + 260 <= 375 - 8, 'the words stay on screen horizontally');
assert.ok(place.top >= 8 && place.top + 40 <= 667 - 8, 'the words stay on screen vertically');
ok('tip placement keeps the words on screen');

/* ------------------------------------------------------------------ wiring --- */

assert.ok(!existsSync('src/play/divecore-tutorial.tsx'), 'the blocking tutorial file is gone');
const shell = read('src/app/play.tsx');
const settings = read('src/play/divecore-settings.tsx');
assert.ok(!/DivecoreTutorial|showTutorial|tutorialReplay/.test(code(shell)), 'play.tsx has no tutorial overlay');
assert.match(settings, /label="Replay tips"/, 'Settings says "Replay tips"');
assert.ok(!/Replay the tutorial/.test(settings), 'no "Replay the tutorial"');
assert.match(shell, /onReplayTips=/, 'Replay tips is wired');
assert.match(shell, /setGuideOpener\(/, 'the Full guide link opens Hideout → Info → Guide through the shell');
ok('no blocking tutorial; Settings says "Replay tips"; Full guide reaches the Guide');

const layout = read('src/play/stage-layout.tsx');
const layer = read('src/play/ftue/coach-tip-layer.tsx');
const sheet = read('src/play/help/help-sheet.tsx');
assert.match(layout, /help\?: HelpId/, 'GameScreen takes the one help entry');
assert.equal((layout.match(/<HelpButton/g) ?? []).length, 1, 'exactly one "?" button is drawn, by GameScreen');
assert.match(layout, /reserveRight=\{help \? HELP_COLUMN : 0\}/, 'the lane gives up width for the "?", never height');
assert.match(layout, /onTouchStart=\{tip && tipShown && onTipSeen/, 'any touch dismisses a tip once it is on screen (the touch still reaches its target)');
for (const f of ['pet-screen', 'defend-screen', 'dive-scene', 'pet-games']) {
  assert.match(read(`src/play/${f}.tsx`), /help=(\{[^}]+\}|"[a-z-]+")/, `${f}: its GameScreen passes a help entry`);
}
assert.match(shell, /help=\{mode === 'dress' \? 'locker'/, 'Locker / Blades / Store pass their help entry');
ok('one "?" per GameScreen (lane right end), every game screen passes its entry');

const stripped = code(layer);
assert.match(stripped, /pointerEvents="none"/, 'the tip layer can not take a tap');
assert.ok(!/<Pressable|onPress=/.test(stripped), 'the tip layer has no button: nothing to block');
assert.match(stripped, /position: 'absolute'/, 'the ring and words are absolutely placed (no region resizes)');
assert.ok(!/ReduceMotion\.System/.test(stripped), 'the ring breathes under Reduce Motion too (never still)');
assert.match(stripped, /reduced \? 2400 : 1400/, 'Reduce Motion = a slower, smaller breathe');
assert.match(layout, /\{tip \? <CoachTipLayer/, 'the tip is drawn by GameScreen over the stage');
ok('coach tips: non-blocking, absolutely placed, breathe slowly under Reduce Motion');

assert.match(code(sheet), /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android back closes the help card first');
assert.match(sheet, /accessibilityLabel="Help"/, 'the "?" is labelled for VoiceOver');
assert.match(code(read('src/play/notify/notice-lane.tsx')), /reserveRight/, 'the lane takes the reserved width');
for (const f of ['pet-room', 'hideout-rails', 'street-shell', 'pet-screen']) {
  assert.match(read(`src/play/${f}.tsx`), /tipAnchorRef\('(egg|hatch|turf|feed)'\)/, `${f}: registers a tip anchor`);
}
ok('help card closes on Android back; the "?" is labelled; the four tips each find their control');

assert.ok(!/useNoticePause\([^)]*tip/i.test(code(shell)), 'coach tips never pause notices');
ok('coach tips do not pause notices');

console.log(`\ncheck:divecore-ftue — ${passed} groups passed.`);
