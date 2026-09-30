/**
 * Back-one-level check (2026-09-29).
 *
 * Play is one route with its sub-screens as a `mode`; the phone's own back
 * used to leave Play from anywhere and skip Defend's mid-wave Leave confirm.
 * Pins the rules in `src/play/edge-back.ts` and that the Play shell wires them
 * (native swipe only on the hub, Android back + our edge swipe elsewhere).
 *
 * Run: npm run check:edge-back
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EDGE_TRIGGER_DX,
  EDGE_ZONE,
  backDecision,
  defendBackStep,
  defendEdgeSwipe,
  isEdgeSwipeComplete,
  isEdgeSwipeStart,
  diveBackStep,
  petBackStep,
} from '../src/play/edge-back';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// Hub: the phone's own back leaves Play, as before.
assert.equal(backDecision(true, null, 'edge'), 'native');
assert.equal(backDecision(true, null, 'hardware'), 'native');
// Sub-screen (Dive / Dress / Shop / About): one level back.
assert.equal(backDecision(false, null, 'edge'), 'step');
assert.equal(backDecision(false, null, 'hardware'), 'step');
ok('hub: native back leaves Play; any sub-screen: back steps one level');

// Defend: edge swipe OFF while a wave runs (board drags), Android back still
// opens the Leave confirm — never a silent leave mid-wave.
assert.equal(defendEdgeSwipe('running'), false, 'no edge swipe mid-wave');
assert.equal(defendEdgeSwipe('setup'), true, 'edge swipe fine in setup');
assert.equal(defendEdgeSwipe('won'), true);
assert.equal(backDecision(false, { edgeSwipe: false }, 'edge'), 'ignore', 'a mid-wave edge swipe does nothing');
assert.equal(backDecision(false, { edgeSwipe: false }, 'hardware'), 'step', 'Android back still reaches Defend');
assert.equal(defendBackStep('running', false), 'request-leave', 'mid-wave back = the Leave confirm');
assert.equal(defendBackStep('running', true), 'close-confirm', 'back again closes the confirm');
assert.equal(defendBackStep('setup', false), 'hub', 'setup back = hub');
assert.equal(defendBackStep('lost', false), 'hub');
ok('Defend: mid-wave edge swipe off, back opens/closes the Leave confirm; setup back → hub');

assert.equal(petBackStep(true, true), 'close-game', 'a running mini-game stops first');
assert.equal(petBackStep(false, true), 'close-game');
assert.equal(petBackStep(true, false), 'close-sheet', 'then an open sheet closes');
assert.equal(petBackStep(false, false), 'hub', 'then the room goes back to the hub');
ok('Pet room: back stops a mini-game, then closes a sheet, then the hub');

assert.equal(diveBackStep(true), 'close-sheet', 'a Dive sheet closes first');
assert.equal(diveBackStep(false), 'room', 'then Dive goes back to the Pet room');
ok('Dive: back closes a sheet first, then returns to the Pet room');

// The gesture: starts at the edge, runs sideways, goes far enough.
assert.equal(isEdgeSwipeStart(10, 20, 2), true);
assert.equal(isEdgeSwipeStart(EDGE_ZONE + 20, 40, 0), false, 'not from mid-screen');
assert.equal(isEdgeSwipeStart(5, 20, 30), false, 'not a vertical scroll');
assert.equal(isEdgeSwipeStart(5, -20, 0), false, 'not leftward');
assert.equal(isEdgeSwipeComplete(EDGE_TRIGGER_DX, 0), true);
assert.equal(isEdgeSwipeComplete(EDGE_TRIGGER_DX - 1, 0), false, 'a short drag springs back');
assert.equal(isEdgeSwipeComplete(EDGE_TRIGGER_DX / 2, 1), true, 'a flick counts');
ok('edge swipe: from the left edge, sideways, far enough (or flicked)');

// The shell wires it.
const shell = readFileSync('src/app/play.tsx', 'utf8');
assert.match(shell, /gestureEnabled: mode === 'grove'/, 'native swipe-back only on the hub');
assert.match(shell, /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android back handled');
assert.match(shell, /\{\.\.\.edgeSwipe\.panHandlers\}/, 'edge swipe attached to the sub-screens');
assert.equal((shell.match(/registerBack=\{registerBack\}/g) ?? []).length, 3, 'Defend, Pet and Dive register their back');
assert.match(shell, /modeRef\.current === 'dive' \? 'pet' : 'grove'/, 'Dive steps back to the Pet room');
ok('Play shell: native swipe on hub only, Android back + edge swipe on sub-screens, Defend/Pet/Dive registered');

// v24: on the hub, the Settings sheet / tutorial close first (the phone's own
// swipe is off while one is open); in the Pet room, Settings closes first.
assert.match(shell, /if \(overlayRef\.current\) \{\s*overlayRef\.current\(\);\s*return true;/, 'hub: an open overlay closes first');
assert.match(shell, /gestureEnabled: mode === 'grove' && !hubOverlayOpen/, 'hub: no native swipe while an overlay is open');
const petShell = readFileSync('src/play/pet-screen.tsx', 'utf8');
assert.match(petShell, /if \(settingsOpen\) \{\s*setSettingsOpen\(false\);\s*return true;/, 'Pet room: Settings closes first');
ok('hub and Pet room: Settings / the tutorial close first on back');

console.log(`\ncheck:edge-back — ${passed} groups passed.`);
