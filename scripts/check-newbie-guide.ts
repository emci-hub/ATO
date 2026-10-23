/**
 * The newbie guide (Divecore finish step 5, emci 2026-10-19).
 * Run: npm run check:newbie-guide   (the Info → Guide content has its own check: check:guide)
 *
 * - One step at a time, in the approved order: egg → feed → dive → research → Trial 1 → Power → Loft → trip.
 * - A step shows only when the player can act on it; a veteran is never nagged (the furthest step done counts).
 * - "Got it" hides a step; the Settings switch turns the guide off; the bubble shows only on the screens that
 *   belong to the step (the Hideout always; the Locker for the Power step; Turf setup for the Trial step).
 * - Hidden while anything is open over the screen, and never together with a coach tip.
 * - Calm copy: no "!", no urgency, no streak, no countdown; short and plain.
 * - The flag lives on the phone (ato.play.guide.v1), the save stays v33, and nothing is written to the save.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  allGuideLines,
  GUIDE_STEPS,
  guideStep,
  parseGuideStore,
  serializeGuideStore,
  type GuideInput,
  type GuideScreen,
  type GuideStore,
} from '../src/play/guide';
import { guideInputOf } from '../src/play/guide-input';
import { HIDEOUT_SAVE_VERSION } from '../src/play/hideout-progress';
import { getItemDef } from '../src/play/items';
import { defaultPlayStore, normalizedAvatarHeroId, playView, type PlayStoreDoc } from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 19, 9, 0, 0);
const on: GuideStore = { off: false, dismissed: [] };
const none: GuideInput = {
  eggPicked: false, hatched: false, petOut: false, fed: false, dived: false, claimed: false, researchReady: false,
  wonTrial: false, powerWorn: false, hasPower: false, loftBuilt: false, loftBuildable: false, tripped: false, tripReady: false,
};
const id = (over: Partial<GuideInput>, screen: GuideScreen = 'hideout', store: GuideStore = on) =>
  guideStep(screen, { ...none, ...over }, store)?.id ?? null;
const out = { hatched: true, petOut: true };

// --- order ---------------------------------------------------------------------------------------------
{
  assert.deepEqual([...GUIDE_STEPS], ['egg', 'feed', 'dive', 'research', 'turf', 'power', 'loft', 'trip']);
  assert.equal(id({}), 'egg');
  assert.equal(guideStep('hideout', none, on)?.text, 'Pick an egg. It hatches into your first pet.');
  assert.equal(guideStep('hideout', { ...none, eggPicked: true }, on)?.text, 'Tap your egg to keep it warm until it hatches.');
  assert.equal(id({ ...out }), 'feed');
  assert.equal(id({ ...out, fed: true }), 'dive');
  assert.equal(id({ ...out, fed: true, dived: true }), 'turf', 'a claim that is not ready is skipped, not nagged');
  assert.equal(id({ ...out, fed: true, dived: true, researchReady: true }), 'research', 'a ready claim comes before Trial 1');
  assert.equal(id({ ...out, fed: true, dived: true, claimed: true, researchReady: true }), 'turf', 'a claim already made is done');
  assert.equal(id({ ...out, fed: true, dived: true, claimed: true, wonTrial: true, hasPower: true }), 'power');
  assert.equal(id({ ...out, fed: true, dived: true, claimed: true, wonTrial: true, powerWorn: true, loftBuildable: true }), 'loft');
  assert.equal(id({ ...out, fed: true, dived: true, claimed: true, wonTrial: true, powerWorn: true, loftBuilt: true, tripReady: true }), 'trip');
  assert.equal(id({ ...out, fed: true, dived: true, claimed: true, wonTrial: true, powerWorn: true, loftBuilt: true, tripped: true, tripReady: true }), null, 'then quiet for good');
  ok('one step at a time, in the approved order; a not-ready claim is skipped; quiet at the end');
}

// --- only what can be acted on ---------------------------------------------------------------------------
{
  const base = { ...out, fed: true, dived: true, claimed: true, wonTrial: true };
  assert.equal(id({ ...base }), null, 'no Power in the bag, Loft not buildable, no trip ready: nothing to say');
  assert.equal(id({ ...base, hasPower: true }), 'power');
  assert.equal(id({ ...base, loftBuildable: true }), 'loft');
  assert.equal(id({ ...base, tripReady: true }), 'trip');
  assert.equal(id({ hatched: false, petOut: false }), 'egg', 'before it hatches, only the egg step');
  assert.equal(id({ hatched: true, petOut: false, fed: false }), 'turf', 'a hatched player whose pet is an egg again is not told to Feed');
  ok('Power, Loft and trip steps show only when they can be done now; Feed / Dive need the pet out of its egg');
}

// --- veterans are never nagged ---------------------------------------------------------------------------
{
  assert.equal(id({ hatched: true, petOut: true, wonTrial: true }), null, 'a Trial 1 win means egg / feed / dive / research are all behind them');
  assert.equal(id({ hatched: true, petOut: true, wonTrial: true, hasPower: true }), 'power', 'but a Power in the bag still gets its nudge');
  assert.equal(id({ hatched: true, petOut: true, loftBuilt: true }), null);
  assert.equal(id({ hatched: true, petOut: true, loftBuilt: true, tripReady: true }), 'trip');
  assert.equal(id({ hatched: true, petOut: true, tripped: true, researchReady: true }), null, 'a first trip sent: nothing earlier comes back');
  ok('the furthest step already done counts: earlier steps never come back for a veteran');
}

// --- got it / off ----------------------------------------------------------------------------------------
{
  const s = { ...out, fed: true, dived: true, researchReady: true };
  assert.equal(id(s), 'research');
  assert.equal(id(s, 'hideout', { off: false, dismissed: ['research'] }), 'turf', 'Got it hides that step; the next one comes up');
  assert.equal(id(s, 'hideout', { off: true, dismissed: [] }), null, 'the Settings switch turns the whole guide off');
  assert.equal(id({}, 'hideout', { off: true, dismissed: [] }), null);
  ok('"Got it" hides a step for good; Off hides the guide');
}

// --- which screen shows what -------------------------------------------------------------------------------
{
  const power = { ...out, fed: true, dived: true, claimed: true, wonTrial: true, hasPower: true };
  assert.equal(id(power, 'hideout'), 'power');
  assert.equal(id(power, 'locker'), 'power');
  assert.equal(guideStep('locker', { ...none, ...power }, on)?.text, 'Put a Power on: pick one in the bag and tap Equip.');
  assert.equal(id(power, 'turf'), null, 'the Power step does not show on Turf setup');
  const trial = { ...out, fed: true, dived: true, claimed: true };
  assert.equal(id(trial, 'turf'), 'turf');
  assert.equal(guideStep('turf', { ...none, ...trial }, on)?.text, 'Clear Trial 1: place towers on the pads, then call the wave.');
  assert.equal(id(trial, 'locker'), null);
  const feed = { ...out };
  assert.equal(id(feed, 'locker'), null, 'Feed shows on the Hideout only');
  assert.equal(id(feed, 'turf'), null, 'and never jumps ahead to a later step on another screen');
  assert.equal(id(feed, 'hideout'), 'feed');
  ok('the Hideout shows every step; the Locker only the Power step; Turf setup only the Trial step; no skipping ahead');
}

// --- calm copy ---------------------------------------------------------------------------------------------
{
  const lines = allGuideLines();
  assert.ok(lines.length >= 10);
  for (const line of lines) {
    assert.ok(line.split(/\s+/).length <= 12, `short: "${line}"`);
    assert.ok(/[.]$/.test(line), `ends with a full stop: "${line}"`);
    assert.ok(!/[!]/.test(line), `no exclamation mark: "${line}"`);
    assert.ok(!/urgent|hurry|last chance|don.t miss|streak|expires?|running out|starving|only \d|\d+\s?(s|m|h|min|sec|hours?|minutes?)\b/i.test(line), `no pressure or countdown: "${line}"`);
  }
  const all = lines.join(' ');
  for (const word of ['Underground', 'CLAIM', 'Explore', 'Rooms', 'Locker', 'Equip', 'Turf War', 'Feed']) assert.ok(all.includes(word), `names ${word}`);
  ok(`calm copy: ${lines.length} lines, short, plain, no "!", no pressure, no countdown`);
}

// --- the stored shape --------------------------------------------------------------------------------------
{
  assert.deepEqual(parseGuideStore(null), { off: false, dismissed: [] });
  assert.deepEqual(parseGuideStore('not json'), { off: false, dismissed: [] });
  assert.deepEqual(parseGuideStore(JSON.stringify({ v: 1, off: true, dismissed: ['feed', 'feed', 'bogus', 7] })), { off: true, dismissed: ['feed'] });
  const round = { off: false, dismissed: ['egg', 'dive'] };
  assert.deepEqual(parseGuideStore(serializeGuideStore(round)), round);
  const store = read('src/play/guide-store.ts');
  assert.ok(store.includes("'ato.play.guide.v1'"), 'the device-only key');
  assert.ok(/next = \{ off: true, dismissed: \[\], loaded: true \}/.test(store), 'an unreadable store stays quiet');
  assert.ok(/await load\(\);/.test(store) && /if \(!state\.loaded\) set\(next\)/.test(store), 'Got it / Off wait for the stored value; a reset during the load wins');
  assert.ok(/const snapshot = \(\): State => state;/.test(store) && /useSyncExternalStore\(subscribe, snapshot, snapshot\)/.test(store), 'one stable subscribe and snapshot');
  ok('the stored shape is tolerant and round-trips; an unreadable store keeps the guide quiet');
}

// --- signals from the real view ------------------------------------------------------------------------------
{
  const base = defaultPlayStore(T);
  const leader = normalizedAvatarHeroId(base);
  const view = (doc: PlayStoreDoc) => guideInputOf(playView(doc, T));
  const fresh = view(base);
  assert.equal(fresh.hatched, false);
  assert.equal(fresh.petOut, false);
  assert.equal(fresh.wonTrial, false);
  assert.equal(fresh.powerWorn, false);
  assert.equal(fresh.hasPower, false);
  assert.equal(fresh.loftBuilt, false);
  assert.equal(fresh.loftBuildable, false);
  assert.equal(view({ ...base, lifetime_waves_cleared: 1 }).wonTrial, true);
  assert.equal(view({ ...base, play_stats: { ...base.play_stats, dives: 1 } }).dived, true);
  assert.equal(view({ ...base, play_stats: { ...base.play_stats, expeditions: 1 } }).tripped, true);
  assert.equal(view({ ...base, hideout: { ...base.hideout, tend_days: 1 } }).claimed, true);
  assert.equal(view({ ...base, pet_rebirths: 1 }).hatched, true, 'a rebirth proves an earlier hatch');
  const LOOK = 'item_leaf_cape_01';
  const POWER = 'item_tide_blade_01';
  assert.ok(getItemDef(LOOK)?.core.kind === 'look' && getItemDef(POWER)?.core.kind === 'power');
  const wearing = (itemId: string, slot: 'cloak' | 'weapon') => ({ ...base, hero_gear: { [leader]: { [slot]: { id: itemId, star: 0 } } } });
  assert.equal(view(wearing(LOOK, 'cloak')).powerWorn, false, 'a worn Look is not a Power');
  assert.equal(view(wearing(POWER, 'weapon')).powerWorn, true);
  assert.equal(view({ ...base, inventory: [{ id: LOOK, star: 0, count: 2 }] }).hasPower, false);
  assert.equal(view({ ...base, inventory: [{ id: POWER, star: 0, count: 1 }] }).hasPower, true);
  const rich = { ...base, tokens: 5000, hideout: { ...base.hideout, ever_child: true, tend_days: 5 } };
  assert.equal(view(rich).loftBuildable, true, 'Loft: gate met and the tokens are there');
  assert.equal(view({ ...rich, tokens: 0 }).loftBuildable, false, 'no tokens: not buildable');
  assert.equal(view({ ...rich, hideout: { ...rich.hideout, rooms_unlocked: { ...rich.hideout.rooms_unlocked, loft: true } } }).loftBuilt, true);
  ok('the signals come from state the game already saves: Trial win, dive, trip, claim, rebirth, worn Power vs Look, Loft');
}

// --- wired -------------------------------------------------------------------------------------------------
{
  const pet = read('src/play/pet-screen.tsx');
  assert.ok(pet.includes('<GuideHost') && pet.includes('screen="hideout"') && pet.includes('active={guideIdle}'), 'Hideout hosts the guide');
  const idle = pet.slice(pet.indexOf('const guideIdle ='), pet.indexOf('const guideIdle =') + 520);
  for (const part of ['!hideoutBusy', '!settingsOpen', '!teaseOpen', "wipe === 'off'", '!pv.away', '!presence.peekaboo', 'tipCandidate == null', 'pet.reveals[revealStep]']) {
    assert.ok(idle.includes(part), `the Hideout guide waits for: ${part}`);
  }
  const defend = read('src/play/defend-screen.tsx');
  assert.ok(/<GuideHost\s+screen="turf"[\s\S]{0,260}active=\{phase === 'setup' && !setupOpen && !live\}/.test(defend), 'Turf setup hosts the guide only on the setup board');
  const play = read('src/app/play.tsx');
  assert.ok(play.includes('screen="locker"') && play.includes("mode === 'dress' && view"), 'the Locker hosts the guide');
  assert.ok(play.includes('void resetGuide();'), 'Replay tips restarts the guide');
  const settings = read('src/play/divecore-settings.tsx');
  assert.ok(settings.includes('Guide bubble · ') && settings.includes('setGuideOff(!guide.off)'), 'Settings has the Guide bubble switch');
  assert.ok(settings.includes('void resetGuide();'), 'Reset Divecore restarts the guide');
  const bubble = read('src/play/guide-bubble.tsx');
  assert.ok(bubble.includes('GUIDE_BUBBLE_HEIGHT = 76') && bubble.includes('pointerEvents="box-none"'), 'a fixed 76 pt box in a box-none wrapper');
  assert.ok(/width: 48, height: 48/.test(bubble), 'the Got it button is at least 44 pt');
  assert.ok(bubble.includes('numberOfLines={3}') && bubble.includes('maxFontSizeMultiplier={1.2}'), 'text capped at x1.2 in a fixed box');
  assert.ok(!/setInterval|setTimeout|withRepeat/.test(bubble), 'no timer and no loop: it never pulses');
  assert.ok(bubble.includes('motion.cosmeticsStill') && bubble.includes('motion.vestibularSafe'), 'Reduce Motion: shorter fade; motion Off: none');
  assert.ok(bubble.includes('announceForAccessibility'), 'VoiceOver hears each new step');
  assert.ok(!/setPlaySettings|commit\(/.test(bubble + read('src/play/guide-store.ts') + read('src/play/guide.ts')), 'nothing is written to the Divecore save');
  assert.equal(HIDEOUT_SAVE_VERSION, 33);
  assert.equal(defaultPlayStore(T).version, 33);
  ok('wired: Hideout (with every wait), Turf setup, Locker, the Settings switch, Replay tips and Reset; save stays v33');
}

console.log(`\ncheck:newbie-guide — ${passed} groups passed.`);
