/**
 * "While you were away" card check (2026-10-15, roadmap step 1).
 * Run: npm run check:away-card
 *
 * - Nothing under an hour away; good news first; at most 3 lines with one slot kept for "what would
 *   help"; every line ≤ 10 words, even with a long name; no blame words.
 * - A push that already said it while away (hunger, full charges) is not repeated.
 * - Wired: the summary comes from the save before vs after the on-open catch-up; the card floats
 *   over the Hideout (no region change), closes on Got it / outside tap / Android back, fades gently
 *   under Reduce Motion, and is read by VoiceOver.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AWAY_MAX_LINES, AWAY_MAX_WORDS, AWAY_MIN_MS, awayLabel, awaySummary, countWords } from '../src/play/away-summary';
import { DIVE_CHARGE_CAP, DIVE_CHARGE_REFILL_MS, defaultPlayStore, type PlayStoreDoc } from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 15, 8, 0, 0);
const H = 3_600_000;
function doc(mut: (d: PlayStoreDoc) => void = () => {}): PlayStoreDoc {
  const d = defaultPlayStore(T);
  d.pet = { ...d.pet, seen_at: T, stage: 'child', hunger: 3, mood: 3, name: 'Raven' };
  d.dive_charge = DIVE_CHARGE_CAP;
  mut(d);
  return d;
}
const later = (before: PlayStoreDoc, mut: (d: PlayStoreDoc) => void) => {
  const d = structuredClone(before);
  mut(d);
  return d;
};

// --- when it shows ----------------------------------------------------------------------------
const before = doc();
assert.equal(awaySummary(before, later(before, (d) => (d.pet.hunger = 1)), T + AWAY_MIN_MS - 1), null, 'under an hour: nothing');
assert.equal(awaySummary(before, before, T + 5 * H), null, 'nothing changed: nothing');
ok('nothing under an hour away, and nothing when nothing changed');

// --- the stage ceremony owns hatching / the grade / growing up; good news first --------------------
const egg = doc((d) => (d.pet = { ...d.pet, stage: 'egg' }));
const grown = awaySummary(egg, later(egg, (d) => (d.pet = { ...d.pet, stage: 'adult', hunger: 1 })), T + 9 * H);
assert.ok(grown);
assert.deepEqual(grown!.lines.map((l) => l.id), ['snack'], 'hatch / grade / grow are left to the reveal ceremony');
assert.equal(awayLabel(grown!.awayMs), 'Away 9h');
assert.equal(awayLabel(50 * H), 'Away 2 days');
const trip = doc((d) => (d.pet_expedition = { started_at: T } as never));
const teen = awaySummary(trip, later(trip, (d) => {
  d.pet_expedition = null;
  d.pet.hunger = 1;
}), T + 30 * H);
assert.deepEqual(teen!.lines.map((l) => l.id), ['expedition_back', 'snack'], 'good news first, then what would help');
assert.equal(teen!.lines[0]!.text, 'Raven is back from the trip.');
ok('ceremony owns stage news; trip back first, then a gentle snack line; away label');

// --- at most 3, one slot kept for help ------------------------------------------------------------
const busy = doc((d) => {
  d.pet_expedition = { started_at: T } as never;
  d.hideout.builds = { loft: { duration_ms: 1, elapsed_ms: 0, speedup_ms: 0 } } as never;
  d.dive_charge = 0;
  d.dive_charge_at = T;
});
const lots = awaySummary(
  busy,
  later(busy, (d) => {
    d.pet_expedition = null;
    d.hideout.builds = {};
    d.hideout.rooms_unlocked = { ...d.hideout.rooms_unlocked, loft: true };
    d.pet.hunger = 0;
  }),
  T + DIVE_CHARGE_CAP * DIVE_CHARGE_REFILL_MS + 2 * H,
);
assert.ok(lots && lots.lines.length === AWAY_MAX_LINES, 'never more than 3 lines');
assert.equal(lots!.lines[AWAY_MAX_LINES - 1]!.id, 'snack', 'the last slot stays for what would help');
ok('at most 3 lines; good news fills the first two, help keeps the last');

// --- pushes are not repeated -------------------------------------------------------------------------
const hungry = awaySummary(before, later(before, (d) => (d.pet.hunger = 1)), T + 6 * H, { hungerAt: T + 4 * H });
assert.equal(hungry, null, 'the hunger push already said it');
assert.ok(awaySummary(before, later(before, (d) => (d.pet.hunger = 1)), T + 6 * H, { hungerAt: T - H }), 'a push from before the gap does not count');
const charges = doc((d) => {
  d.dive_charge = 0;
  d.dive_charge_at = T;
});
const full = T + DIVE_CHARGE_CAP * DIVE_CHARGE_REFILL_MS + H;
assert.deepEqual(awaySummary(charges, charges, full)!.lines.map((l) => l.id), ['charges_full']);
assert.equal(awaySummary(charges, charges, full, { chargesAt: full - 1000 }), null, 'the full-charges push already said it');
ok('a push that already said it while away is left out');

// --- words: short, kind -------------------------------------------------------------------------------
const long = doc((d) => {
  d.pet = { ...d.pet, name: 'Sixteen Charname' };
  d.pet_expedition = { started_at: T } as never;
});
const all = awaySummary(long, later(long, (d) => {
  d.pet_expedition = null;
  d.pet.mood = 0;
}), T + 3 * H)!;
for (const l of [...all.lines, ...grown!.lines, ...lots!.lines, ...teen!.lines]) {
  assert.ok(countWords(l.text) <= AWAY_MAX_WORDS, `"${l.text}" ≤ ${AWAY_MAX_WORDS} words`);
}
const model = read('src/play/away-summary.ts');
for (const w of ['starv', 'neglect', 'died', 'dying', 'hungry!', 'abandon', 'fail', 'lonely', 'sad']) {
  assert.ok(!model.toLowerCase().includes(`'${w}`) && !new RegExp(`text: \`[^\`]*${w}`, 'i').test(model), `no blame word "${w}"`);
}
ok('every line ≤ 10 words (long names too); no blame words');

// --- wiring ---------------------------------------------------------------------------------------------
const store = read('src/play/use-play-store.ts');
assert.match(store, /setAway\(awaySummary\(loaded, next, now, \{ hungerAt, chargesAt \}\)\)/, 'before = the save as loaded, after = after the catch-up');
assert.match(store, /if \(now - loaded\.pet\.seen_at >= AWAY_MIN_MS\)/);
const screen = read('src/play/pet-screen.tsx');
assert.match(screen, /awayShown && away && onAwayClose \? \(\s*<AwayCard/, 'the card floats over the Hideout (GameScreen float)');
assert.match(screen, /const awayShown = away != null && onAwayClose != null && !settingsOpen && \(pet\.reveals\[revealStep\] \?\? null\) == null;/, 'it waits for a reveal ceremony and hides under Settings');
assert.match(screen, /const busy = sheet != null \|\| game != null \|\| awayShown;/, 'while it shows: no coach tip, no iOS swipe-back');
const rememberFn = store.slice(store.indexOf('const remember = useCallback'), store.indexOf('const hydrate = useCallback'));
assert.ok(rememberFn.length > 0 && !/setAway/.test(rememberFn), 'automatic saves on open (trip notice, reveal ack) never close it');
assert.match(read('src/app/play.tsx'), /else dismissAway\(\);/, 'leaving the Hideout closes it (never stale)');
assert.match(read('src/play/pet-reminder.ts'), /if \(!\(await petNoticesAllowed\(\)\)\) return null;/, 'with notifications off, nothing counts as already said');
const card = read('src/play/away-card.tsx');
assert.match(card, /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android back closes it');
assert.match(card, /label="Got it"/);
assert.match(card, /accessibilityLabel="Close"/, 'outside tap closes it');
assert.match(card, /ReduceMotion\.Never/, 'a gentle fade under Reduce Motion, never still');
assert.ok(!/Slide|translate/.test(card), 'no slide');
assert.match(card, /announceForAccessibility/, 'VoiceOver reads it once');
assert.match(card, /absoluteFill\} accessibilityViewIsModal>/, 'VoiceOver stays inside the card while it shows');
assert.match(read('src/app/play.tsx'), /away=\{away\}\s*onAwayClose=\{dismissAway\}/);
ok('wired: catch-up diff, floats over the Hideout, Got it / outside / back close it, gentle fade, VoiceOver');

console.log(`\ncheck:away-card — ${passed} groups passed.`);
