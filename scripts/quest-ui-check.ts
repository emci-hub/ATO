/**
 * Quests UI v3 (ATO-BUILD PHASE-16).
 * Run: npm run check:quest-ui
 *
 * Pins the pure logic behind the screens (typewriter timing, keyword tint, the
 * d20 badge text, stat changes, the Said cards and Save rule), the §1.8 tokens,
 * the Quests copy against the fence, and the rules that live in the component
 * source: one frame callback per screen, 20 particles or fewer, a Reduce Motion
 * branch in every animated component, the 250 ms hold plus a one-tap path for
 * VoiceOver and Switch Control, nothing pre-ticked, no import from src/play, no
 * model call and no typed text.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AXIS_POLES } from '../src/lib/axis-poles';
import { questCopyHits } from '../src/lib/quests/banned';
import { checkOdds } from '../src/lib/quests/d20';
import type { AxisVerdict, RunScore } from '../src/lib/quests/score';
import { UI_COPY } from '../src/lib/quests/strings';
import { QT, QT_BAR, QT_RADIUS, plateHeight } from '../src/lib/quests/theme';
import {
  TYPE,
  canSave,
  chapterCount,
  charsAt,
  checkBadge,
  endingProgress,
  saidModel,
  sliceSegs,
  speakerOf,
  splitKeywords,
  statAnnouncement,
  statChanges,
  typeSchedule,
  typeTotalMs,
} from '../src/lib/quests/view';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
};

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const components = readdirSync(join(__dirname, '..', 'src/components/quests')).filter((f) => f.endsWith('.tsx'));
const sources: Record<string, string> = {};
for (const f of components) sources[`src/components/quests/${f}`] = read(`src/components/quests/${f}`);
sources['src/app/quest/index.tsx'] = read('src/app/quest/index.tsx');
sources['src/app/quest/[id].tsx'] = read('src/app/quest/[id].tsx');

// --- pure logic ----------------------------------------------------------------

ok('typewriter: 70 characters a second, +120 ms after . , —', () => {
  const plain = typeSchedule('abcdefg');
  assert.equal(plain.length, 7);
  assert.ok(Math.abs(plain[6] - 7 * (1000 / 70)) < 0.001);
  const pause = typeSchedule('a,b');
  assert.ok(Math.abs(pause[2] - pause[1] - (1000 / 70 + 120)) < 0.001, 'the comma costs 120 ms before the next letter');
  assert.ok(typeSchedule('a—b')[2] - typeSchedule('a—b')[1] > 120, 'a dash pauses too');
  assert.equal(typeTotalMs(''), 0);
});

ok('typewriter: charsAt only grows and ends at the full length', () => {
  const s = typeSchedule('Hello there, friend.');
  let last = 0;
  for (let ms = 0; ms < 2000; ms += 25) {
    const n = charsAt(s, ms);
    assert.ok(n >= last && n <= s.length);
    last = n;
  }
  assert.equal(charsAt(s, 99_999), s.length);
  assert.equal(charsAt(s, 0), 0);
});

ok('keywords: tinted once, first match, overlapping or missing ones ignored', () => {
  const segs = splitKeywords('The lantern glows blue.', ['lantern', 'blue']);
  assert.deepEqual(
    segs.map((s) => [s.text, s.hot]),
    [['The ', false], ['lantern', true], [' glows ', false], ['blue', true], ['.', false]],
  );
  assert.deepEqual(splitKeywords('plain', ['nope']), [{ text: 'plain', hot: false }]);
  assert.equal(splitKeywords('abc', ['ab', 'bc']).filter((s) => s.hot).length, 1, 'overlaps keep the first');
  const cut = sliceSegs(segs, 6);
  assert.equal(cut.map((s) => s.text).join(''), 'The la');
  assert.equal(cut[1].hot, true);
});

ok('speaker pill: narration has none', () => {
  assert.equal(speakerOf({ kind: 'narrator', text: 'x' }), null);
  assert.equal(speakerOf({ kind: 'dialogue', speaker: 'Rook', text: 'x' }), 'Rook');
});

ok('d20 badge: "CHECK: SUPPLIES ≥ 11 · 55%" uses the real odds', () => {
  const b = checkBadge({ stat: 'supplies', dc: 11, success: 'a', fail: 'b' }, { supplies: 1, morale: 0, renown: 0 });
  assert.equal(b.text, 'CHECK: SUPPLIES ≥ 11 · 55%');
  assert.equal(b.odds, Math.round(checkOdds(11, 1) * 100));
  assert.match(b.a11y, /Supplies of at least 11, 55 percent/);
});

ok('stats: changes in order, announcement names each one', () => {
  const from = { supplies: 3, morale: 2, renown: 0 };
  const to = { supplies: 2, morale: 2, renown: 1 };
  const c = statChanges(from, to);
  assert.deepEqual(c, [{ stat: 'supplies', delta: -1 }, { stat: 'renown', delta: 1 }]);
  assert.equal(statAnnouncement(c), 'Supplies down 1. Renown up 1');
  assert.deepEqual(statChanges(from, from), []);
});

ok('progress: ending bar and chapter count', () => {
  assert.equal(endingProgress(2, 4), 0.5);
  assert.equal(endingProgress(9, 4), 1);
  assert.equal(endingProgress(0, 0), 0);
  assert.equal(chapterCount([{ chapter: 1 }, { chapter: 3 }, { chapter: 4, retired: true }]), 3);
});

const verdict = (axis: TraitAxis, lean: number, status: AxisVerdict['status']): AxisVerdict => ({
  axis,
  P: lean * 4,
  W: 4,
  lean,
  scenes: 4,
  primaryPicks: 4,
  agreeing: 3,
  consistency: 0.75,
  eligible: true,
  status,
});

ok('said: cards come from the writes, phrase from the pole, none for a run that does not count', () => {
  const apply = [verdict('openness', 0.8, 'apply'), verdict('autonomy', -0.6, 'apply')];
  const score: RunScore = {
    counts: true,
    axes: [...apply, verdict('playfulness', 0.5, 'contradiction')],
    apply,
    notEnough: ['extraversion'],
  };
  const m = saidModel(score);
  assert.equal(m.cards.length, 2);
  assert.equal(m.cards[0].phrase, AXIS_POLES.openness.high);
  assert.equal(m.cards[1].phrase, AXIS_POLES.autonomy.low);
  assert.deepEqual([m.cards[0].scenes, m.cards[0].same], [4, 3]);
  assert.equal(m.contradiction, true);
  assert.deepEqual(m.notEnough, ['extraversion']);
  assert.equal(m.note, null);

  const fun = saidModel({ counts: false, why: 'for_fun', axes: apply, apply: [], notEnough: [] });
  assert.equal(fun.cards.length, 0);
  assert.equal(fun.note, 'for_fun');
  const window = saidModel({ counts: false, why: 'evidence_window', axes: [], apply: [], notEnough: [] });
  assert.equal(window.note, 'evidence_window');
});

ok('said: Save stays off until a card is ticked and not turned away', () => {
  assert.equal(canSave(new Set(), new Set()), false);
  assert.equal(canSave(new Set<TraitAxis>(['openness']), new Set()), true);
  assert.equal(canSave(new Set<TraitAxis>(['openness']), new Set<TraitAxis>(['openness'])), false);
});

// --- tokens + copy -------------------------------------------------------------

ok('§1.8 tokens', () => {
  assert.equal(QT.bg, '#070B16');
  assert.equal(QT.glassFill, 'rgba(16,22,40,0.62)');
  assert.equal(QT.cyan, '#22D3EE');
  assert.equal(QT.amber, '#F9C22B');
  assert.equal(QT.rose, '#FF5C7A');
  assert.equal(QT_BAR.height, 6);
  assert.equal(QT_BAR.radius, 99);
  assert.deepEqual([QT_RADIUS.card, QT_RADIUS.choice, QT_RADIUS.stat, QT_RADIUS.pill], [20, 18, 16, 999]);
  assert.equal(plateHeight(667), 220, 'the plate is 220 pt on a 375×667 phone');
  assert.ok(plateHeight(932) > 220 && plateHeight(932) <= 380);
});

ok('timing constants', () => {
  assert.equal(TYPE.charsPerSecond, 70);
  assert.equal(TYPE.pauseMs, 120);
  assert.equal(TYPE.chapterCharMs, 40);
  assert.equal(TYPE.chapterTotalMs, 1200);
});

ok('Quests copy passes the fence and is never built by joining pieces', () => {
  // The fence guards story copy. The ethics line is spec-mandated word for word (PHASE-16) and
  // is the only sentence allowed to say "test", and only to say it is not one.
  const mandated: Record<string, string[]> = { saidEthics: ['test'] };
  for (const [key, text] of Object.entries(UI_COPY)) {
    assert.deepEqual(questCopyHits(text), mandated[key] ?? [], `UI_COPY.${key} hits the fence`);
  }
  assert.equal(UI_COPY.saidEthics, 'This is a story, not a test. There are no wrong choices.');
  assert.equal(UI_COPY.saidTickFirst, 'Tick what sounds like you');
  assert.equal(UI_COPY.saidMessing, 'I was messing around');
});

// --- rules that live in the source ---------------------------------------------

ok('one frame callback per screen (only the stage has one)', () => {
  const owners = Object.entries(sources).filter(([, src]) => src.includes('useFrameCallback('));
  assert.deepEqual(owners.map(([f]) => f), ['src/components/quests/stage.tsx']);
  assert.equal((sources['src/components/quests/stage.tsx'].match(/useFrameCallback\(/g) ?? []).length, 1);
});

ok('at most 20 ambient particles, half under Reduce Motion', () => {
  assert.match(sources['src/components/quests/stage.tsx'], /const count = rm \? 10 : 20;/);
});

ok('every animated component has a Reduce Motion branch', () => {
  for (const f of ['stage', 'dialogue', 'choice-card', 'stat-bar', 'd20-tile', 'ending-card', 'said-card', 'chapter-card']) {
    assert.match(sources[`src/components/quests/${f}.tsx`], /useMotionReduced\(/, `${f} has no Reduce Motion branch`);
  }
  assert.match(read('src/app/quest/index.tsx'), /useMotionReduced\(/);
});

ok('choose: hold 250 ms or double-tap; one activation for VoiceOver and Switch Control', () => {
  const src = sources['src/components/quests/choice-card.tsx'];
  assert.match(src, /export const HOLD_MS = 250;/);
  assert.match(src, /LongPress\(\)\s*\.minDuration\(HOLD_MS\)/);
  assert.match(src, /numberOfTaps\(2\)/);
  assert.match(src, /accessibilityHint=\{UI_COPY\.chooseHint\}/);
  assert.match(src, /onAccessibilityAction/);
  assert.match(src, /isScreenReaderEnabled/);
  assert.match(src, /isSwitchControlEnabled/);
  assert.match(src, /assistive \? \(\s*<Pressable[\s\S]*onPress=\{choose\}/);
});

ok('Said: nothing pre-ticked, Save gated, ethics line always shown, discard behind a confirm', () => {
  const src = sources['src/app/quest/[id].tsx'];
  assert.match(src, /useState<ReadonlySet<TraitAxis>>\(new Set\(\)\)/);
  assert.match(src, /canSave\(ticked, notMe\)/);
  assert.match(src, /UI_COPY\.saidEthics/);
  assert.match(src, /setConfirm\(true\)/);
  assert.match(src, /type: 'discard'/);
});

ok('the screen drives the run only through the reducer and the store', () => {
  const hook = read('src/lib/quests/use-run.ts');
  assert.match(hook, /reduceRun\(prev, action\)/);
  assert.match(hook, /await runStore\.afterAction\(prev, action, next/);
  assert.match(sources['src/app/quest/[id].tsx'], /await dispatch\(\{ type: 'select'/);
  assert.match(sources['src/app/quest/[id].tsx'], /await dispatch\(\{ type: 'commit' \}\)/);
});

ok('samples are listed in development only', () => {
  assert.match(sources['src/app/quest/index.tsx'], /__DEV__ \|\| !c\.isSample/);
});

ok('plates with no art carry a dev-only label', () => {
  assert.match(sources['src/components/quests/stage.tsx'], /__DEV__ && !hasPlate && !isEnding \? <Text style=\{styles\.placeholder\}>/);
});

ok('isolation: no src/play import, no model call, no typed text, no fixed font bypass', () => {
  for (const [file, src] of Object.entries(sources)) {
    assert.doesNotMatch(src, /from '@\/play\/|src\/play/, `${file} imports from src/play`);
    assert.doesNotMatch(src, /ai-library|ai-generate|claim_ai_call|fetch\(/, `${file} reaches a model or the network`);
    assert.doesNotMatch(src, /TextInput/, `${file} takes typed text`);
    assert.doesNotMatch(src, /useAppearance|appearance\.ts/, `${file} reads the appearance mode (R06)`);
  }
});

ok('the routes are registered inside the signed-in stack', () => {
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<Stack\.Screen name="quest\/index" \/>/);
  assert.match(layout, /<Stack\.Screen name="quest\/\[id\]" \/>/);
});

console.log(`\ncheck:quest-ui — ${passed} checks passed`);
