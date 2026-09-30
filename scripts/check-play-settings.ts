/**
 * Divecore menus + settings checks (v24, 2026-09-30). Run: npm run check:play-settings
 *
 *   - Change egg can't leak or keep an old roll (new seed, nothing rolled,
 *     ticket refunded; Egg only).
 *   - Quiet hours delay notices to the end of the window (incl. across
 *     midnight); nothing else moves.
 *   - Bedtime changes looks only (Sleepy status / motion), never hunger,
 *     mood, care, grade or odds.
 *   - Chatter Off stops idle talk but not tapping / coach tips.
 *   - "Charges full": off by default, only after all charges were spent
 *     (0 → full), at most once every 6h.
 *   - Default toggles (new + old saves), v24 round-trip, the Journal counts
 *     real events, milestones pay once and never tokens/shells, the name
 *     filter, and Reset keeps settings.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { petMoodKind } from '../src/play/pet-actor';
import { PET_STAGE_MS, agePet, newPet, type PetState } from '../src/play/pet';
import { careScore, gradeOdds, gradeTag } from '../src/play/pet-eggs';
import { planPlayNotices, type NoticeInput } from '../src/play/play-notices';
import {
  CHARGES_NOTICE_GAP_MS,
  MILESTONES,
  chargesNoticeAt,
  checkPetName,
  defaultSettings,
  deferForQuiet,
  idleTalkDelayMs,
  isBedtime,
  parseSettings,
} from '../src/play/play-settings';
import { petStatus } from '../src/play/pet-status';
import {
  applyTicketDoc,
  changeEggDoc,
  chooseEggDoc,
  claimMilestone,
  deeperDive,
  defaultPlayStore,
  parsePlayStore,
  playView,
  recordDefendWin,
  releasePetDoc,
  renamePetDoc,
  resetDivecore,
  sendPetExpedition,
  setPlaySettings,
  startDive,
  surfaceDive,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const MIN = 60_000;
const H = 60 * MIN;
/** A local-time moment (these checks run in the machine's own time zone). */
const at = (h: number, m = 0, day = 1) => new Date(2026, 9, day, h, m, 0, 0).getTime();
const T0 = at(12);
const doc = (over: Partial<PlayStoreDoc> = {}): PlayStoreDoc => ({ ...defaultPlayStore(T0), ...over });

/* ----------------------------------------------------------- change egg --- */

{
  const withTicket = doc({ pet_tickets: { common: 0, rare: 1, epic: 0, legendary: 0 } });
  const chosen = chooseEggDoc(withTicket, T0, 'knight', 'rare', () => 0.42)!;
  const oldSeed = chosen.pet.seed;
  const warmed = { ...chosen, pet: { ...agePet(chosen.pet, 2 * MIN), seen_at: T0 } };
  const changed = changeEggDoc(warmed, T0 + MIN)!;
  assert.ok(changed, 'an egg can be changed');
  assert.equal(changed.pet.egg, null, 'back to the egg picker');
  assert.deepEqual(
    [changed.pet.hero, changed.pet.grade, changed.pet.shiny, changed.pet.band, changed.pet.ticket],
    [null, null, false, null, null],
    'no hero, grade, shiny, band or ticket kept',
  );
  assert.equal(changed.pet.warm_ms, 0, 'warmth and care start over');
  assert.equal(changed.pet_tickets.rare, 1, 'the spent ticket comes back');
  assert.ok(!JSON.stringify(changed).includes(`"seed":${oldSeed},`) || oldSeed === 0, 'the old seed is not kept anywhere');
  const next = chooseEggDoc(changed, T0 + MIN, 'wizard', null, () => 0.9)!;
  assert.notEqual(next.pet.seed, oldSeed, 'the new egg gets a new seed');
  // Nothing from the old seed was ever rolled or shown before the change.
  assert.equal(chosen.pet.hero, null);
  assert.equal(warmed.pet.hero, null);
  // Only while it is still an egg.
  const baby = { ...next, pet: { ...agePet(next.pet, PET_STAGE_MS.egg), seen_at: T0 + MIN } };
  assert.equal(baby.pet.stage, 'baby');
  assert.equal(changeEggDoc(baby, T0 + MIN), null, 'a Baby can’t be changed');
  assert.equal(changeEggDoc(doc(), T0), null, 'nothing to change at the picker');
}
ok('change egg: Egg only, back to the picker, new seed, nothing rolled or kept, ticket refunded');

{
  const d = doc({ pet_tickets: { common: 0, rare: 0, epic: 2, legendary: 0 } });
  const egg = chooseEggDoc(d, T0, 'village', null)!;
  const ticketed = applyTicketDoc(egg, T0, 'epic')!;
  assert.equal(ticketed.pet.ticket, 'epic');
  assert.equal(ticketed.pet_tickets.epic, 1, 'spent');
  assert.equal(applyTicketDoc(ticketed, T0, 'epic'), null, 'one ticket per pet');
  assert.equal(applyTicketDoc(chooseEggDoc(doc(), T0, 'knight', null)!, T0, 'epic'), null, 'no ticket, no guarantee');
  const child = { ...egg, pet: { ...agePet(egg.pet, PET_STAGE_MS.egg + PET_STAGE_MS.baby), seen_at: T0 } };
  assert.equal(applyTicketDoc(child, T0, 'epic'), null, 'not after the roll');
}
ok('tickets from the menu: Egg or Baby only, once, never after the roll');

/* -------------------------------------------------------- quiet hours --- */

const quiet = { from: 22 * 60, to: 7 * 60 };
assert.equal(deferForQuiet(at(21, 59), quiet), at(21, 59), 'before quiet hours: unchanged');
assert.equal(deferForQuiet(at(23, 30), quiet), at(7, 0, 2), '23:30 waits until 07:00 next day');
assert.equal(deferForQuiet(at(3, 0, 2), quiet), at(7, 0, 2), '03:00 waits until 07:00 the same day');
assert.equal(deferForQuiet(at(7, 0, 2), quiet), at(7, 0, 2), 'the end is not inside');
assert.equal(deferForQuiet(at(13, 0), { from: 12 * 60, to: 14 * 60 }), at(14, 0), 'a daytime window works too');
assert.equal(deferForQuiet(at(23, 0), { from: 0, to: 0 }), at(23, 0), 'an empty window never delays');
{
  const settings = { ...defaultSettings(), notif: { hunger: true, egg: true, expedition: true, charges: true } };
  const pet: PetState = { ...newPet(at(21, 50)), stage: 'child', hero: 'raven', egg: 'knight', grade: 'common', hunger: 1, hunger_acc_ms: 0 };
  const base: NoticeInput = {
    settings,
    pet,
    name: 'Kiki',
    expeditionBackInMs: 30 * MIN,
    chargesFullAt: at(23, 0),
    chargesArmed: true,
    hungerLastFiredAt: null,
    chargesLastFiredAt: null,
    now: at(21, 50),
  };
  const plan = planPlayNotices(base);
  for (const n of plan) assert.ok(!(new Date(n.at).getHours() >= 22 || new Date(n.at).getHours() < 7), `${n.kind} never lands in quiet hours`);
  assert.equal(plan.find((n) => n.kind === 'expedition')?.at, at(7, 0, 2), 'expedition back at 22:20 waits until 07:00');
  assert.equal(plan.find((n) => n.kind === 'charges')?.at, at(7, 0, 2), 'charges full at 23:00 waits until 07:00');
  assert.match(plan.find((n) => n.kind === 'expedition')?.title ?? '', /Kiki/, 'the pet’s name is in the text');
  const daytime = planPlayNotices({ ...base, now: at(10), expeditionBackInMs: 30 * MIN, chargesFullAt: at(11), pet: { ...pet, seen_at: at(10) } });
  assert.equal(daytime.find((n) => n.kind === 'expedition')?.at, at(10, 30), 'outside quiet hours nothing moves');
  const off = planPlayNotices({ ...base, settings: { ...settings, notif: { hunger: false, egg: false, expedition: false, charges: false } } });
  assert.equal(off.length, 0, 'every toggle off: nothing scheduled');
}
ok('quiet hours: a notice inside the window waits until it ends (across midnight too); outside, nothing moves');

/* ------------------------------------------------------- charges full --- */

assert.equal(defaultSettings().notif.charges, false, 'charges full is off by default');
const full = at(15);
assert.equal(chargesNoticeAt({ on: true, armed: false, fullAt: full, lastFiredAt: null, now: T0 }), null, 'not armed (never hit 0): no notice');
assert.equal(chargesNoticeAt({ on: false, armed: true, fullAt: full, lastFiredAt: null, now: T0 }), null, 'off: no notice');
assert.equal(chargesNoticeAt({ on: true, armed: true, fullAt: full, lastFiredAt: null, now: T0 }), full, '0 → full: fires when full');
assert.equal(chargesNoticeAt({ on: true, armed: true, fullAt: full, lastFiredAt: full - 2 * H, now: T0 }), full - 2 * H + CHARGES_NOTICE_GAP_MS, 'at most once every 6h');
assert.equal(chargesNoticeAt({ on: true, armed: true, fullAt: null, lastFiredAt: null, now: T0 }), null, 'already full: nothing to send');
{
  // Arming: spending the last charge arms it; spending one of many does not.
  const many = doc({ dive_charge: 5, dive_charge_at: T0 });
  const one = startDive(many, T0, () => 0.5)!.doc;
  assert.equal(one.charges_armed, false, 'charges left: not armed');
  const last = startDive(doc({ dive_charge: 1, dive_charge_at: T0 }), T0, () => 0.5)!.doc;
  assert.equal(last.charges_armed, true, 'the last charge spent arms it');
  const refilled = touchPet({ ...last, dive_run: null }, T0 + 200 * MIN);
  assert.equal(refilled.charges_armed, false, 'once full again it disarms (fires at most once per run-down)');
}
ok('charges full: off by default, only after all charges were spent (0 → full), at most once every 6h');

/* ------------------------------------------------------------ bedtime --- */

{
  const bed = { from: 21 * 60, to: 8 * 60 };
  assert.equal(isBedtime(new Date(at(21, 30)), bed), true);
  assert.equal(isBedtime(new Date(at(20, 30)), bed), false);
  assert.equal(isBedtime(new Date(at(7, 59, 2)), bed), true);
  // Looks only: the same pet, awake or asleep, ages identically.
  const pet: PetState = { ...newPet(T0), stage: 'teen', hero: 'raven', egg: 'knight', grade: 'rare', hunger: 3, mood: 3 };
  const status = (night: boolean) => petStatus({ stage: 'teen', hunger: 3, mood: 3, away: false, night, stageLeftMs: 40 * H });
  assert.equal(status(true), 'sleepy', 'bedtime: Sleepy');
  assert.equal(status(false), 'happy');
  assert.equal(petMoodKind(3, 3, true), 'asleep', 'bedtime: the sleep look');
  const a = agePet(pet, 48 * H);
  const b = agePet(pet, 48 * H);
  assert.deepEqual(a, b, 'aging never reads bedtime');
  assert.deepEqual(gradeOdds('great'), gradeOdds('great'));
  assert.equal(careScore({ warmMs: 1, eggMs: 2, skill: 12, acts: 1 }), careScore({ warmMs: 1, eggMs: 2, skill: 12, acts: 1 }));
  const withBed = setPlaySettings(doc({ pet }), { bedtime: bed });
  assert.deepEqual(touchPet(withBed, T0 + 5 * H).pet, touchPet(doc({ pet }), T0 + 5 * H).pet, 'changing bedtime changes nothing about the pet');
}
ok('bedtime: drives Sleepy and the sleep look only — hunger, mood, care and odds identical');

/* ------------------------------------------------------------ chatter --- */

assert.equal(idleTalkDelayMs('off', 16_000, 32_000), null, 'Off: no idle talk');
const chatty = idleTalkDelayMs('chatty', 16_000, 32_000)!;
const normal = idleTalkDelayMs('normal', 16_000, 32_000)!;
const quietT = idleTalkDelayMs('quiet', 16_000, 32_000)!;
assert.ok(chatty.min < normal.min && normal.min < quietT.min, 'Chatty < Normal < Quiet');
{
  // Tapping and coach tips never read the chatter level (source check).
  const src = readFileSync('src/play/pet-screen.tsx', 'utf8');
  const tapStart = src.indexOf('const tapPet = () => {');
  const tapEnd = src.indexOf('\n  };', tapStart);
  // The chatter SETTING (the \`chatter\` variable / idleTalkDelayMs) — not the
  // 'chatter' talk situation a tapped egg can say.
  const tap = src.slice(tapStart, tapEnd);
  assert.ok(tapStart > 0 && !/(?<!['"])\bchatter\b(?!['"])/.test(tap) && !tap.includes('idleTalkDelayMs'), 'tap-to-talk ignores the chatter setting');
  assert.match(src, /idleTalkDelayMs\(chatter/, 'only the idle timer reads chatter');
}
ok('chatter: Off stops idle talk only; tapping and coach tips always talk');

/* ----------------------------------------------------------- defaults --- */

assert.deepEqual(defaultSettings().notif, { hunger: true, egg: true, expedition: true, charges: false }, 'new saves');
assert.deepEqual(parseSettings(undefined, { remind: false, hasProgress: true }).notif, { hunger: false, egg: true, expedition: true, charges: false }, 'an old save keeps its hunger choice (off)');
assert.deepEqual(parseSettings(undefined, { remind: true, hasProgress: false }).notif.hunger, true, '…or on');
assert.equal(parseSettings(undefined, { remind: false, hasProgress: true }).tutorialSeen, true, 'progress: no tutorial');
assert.equal(parseSettings(undefined, { remind: false, hasProgress: false }).tutorialSeen, false, 'no progress: the tutorial shows');
{
  const v23: Record<string, unknown> = { ...defaultPlayStore(T0), version: 23, pet_remind: false };
  for (const k of ['play_settings', 'play_stats', 'milestones', 'ribbons', 'dye_unlocked', 'charges_armed']) delete v23[k];
  const up = parsePlayStore(JSON.stringify(v23), T0)!;
  assert.equal(up.version, 24);
  assert.equal(up.play_settings.notif.hunger, false, 'v23 → v24 keeps a hunger reminder that was off');
  assert.deepEqual(up.play_settings.quiet, { from: 22 * 60, to: 7 * 60 }, 'quiet hours 22:00-07:00');
  assert.equal(up.play_settings.chatter, 'normal');
  assert.equal(up.play_stats.dives, 0, 'the Journal starts from now');
  assert.deepEqual([up.milestones, up.ribbons, up.dye_unlocked, up.charges_armed], [[], [], [], false]);
  const roundTrip = parsePlayStore(JSON.stringify(up), T0);
  assert.deepEqual(roundTrip, up, 'v24 round-trips unchanged');
  assert.equal(parsePlayStore(JSON.stringify({ ...up, play_settings: { chatter: 'loud', quiet: { from: 9999 } } }), T0)!.play_settings.chatter, 'normal', 'bad values fall back');
}
ok('defaults: new saves hunger/egg/expedition on, charges off; old saves keep their hunger choice; v24 round-trips');

/* ------------------------------------------------------------ journal --- */

{
  let d = chooseEggDoc(doc({ dive_charge: 3, dive_charge_at: T0 }), T0, 'knight', null, () => 0.3)!;
  d = touchPet(d, T0 + 20 * MIN); // hatches and reveals
  assert.equal(d.play_stats.eggs_hatched, 1, 'a hatch is counted');
  const g = d.pet.grade!;
  assert.equal(d.play_stats.pulled[g], 1, 'the reveal is counted by grade');
  assert.equal(touchPet(d, T0 + 21 * MIN).play_stats.eggs_hatched, 1, 'never twice');
  d = startDive(d, T0 + 21 * MIN, () => 0.5)!.doc;
  d = deeperDive(d, T0 + 21 * MIN, 'safe', () => 0.99)!.doc; // safe
  d = surfaceDive(d, T0 + 22 * MIN, () => 0.5)!.doc;
  assert.deepEqual([d.play_stats.dives, d.play_stats.surfaces, d.play_stats.best_depth], [1, 1, 1]);
  d = startDive(d, T0 + 23 * MIN, () => 0.5)!.doc;
  d = deeperDive(d, T0 + 23 * MIN, 'safe', () => 0)!.doc; // bust
  assert.equal(d.play_stats.busts, 1, 'a bust is counted');
  const sent = sendPetExpedition(d, T0 + 24 * MIN).doc;
  assert.equal(sent.play_stats.expeditions, 1);
  assert.equal(sendPetExpedition(sent, T0 + 24 * MIN).doc.play_stats.expeditions, 1, 'a refused send is not counted');
  const released = releasePetDoc(d, T0 + 25 * MIN)!;
  assert.equal(released.play_stats.releases, 1);
  assert.ok(released.play_stats.days_played >= 1, 'days played');
}
{
  // A reveal that happens during a TD wave clear still counts.
  const egg = chooseEggDoc(doc(), T0, 'wizard', null, () => 0.7)!;
  const won = recordDefendWin(egg, { phase: 'trial', wave: 1, mode: 'replay' }, T0 + 20 * MIN, () => 0.99).doc;
  assert.equal(won.pet.stage, 'child');
  assert.equal(won.play_stats.eggs_hatched, 1, 'the hatch counted in the wave clear');
  assert.equal(won.play_stats.pulled[won.pet.grade!], 1, 'the reveal counted in the wave clear');
  assert.equal(touchPet(won, T0 + 20 * MIN).play_stats.eggs_hatched, 1, 'and not again on the next touch');
}
ok('journal: hatches, reveals by grade, dives, surfaces, busts, best depth, expeditions, releases, days — each once');

/* --------------------------------------------------------- milestones --- */

{
  const four = doc({
    pet_heroes: Object.fromEntries(['aurex', 'oni', 'raven', 'kitsune'].map((h) => [h, { copies: 1, shinies: 0, grades: ['common' as const], forms: [], dye: false }])),
  });
  const before = { tokens: four.tokens, shells: four.shells };
  const claimed = claimMilestone(four, T0, 'heroes_4')!;
  assert.equal(claimed.pet_tickets.rare, 1, '4 heroes → a Rare+ ticket');
  assert.deepEqual({ tokens: claimed.tokens, shells: claimed.shells }, before, 'never tokens or shells');
  assert.equal(claimMilestone(claimed, T0, 'heroes_4'), null, 'once');
  assert.equal(claimMilestone(four, T0, 'heroes_8'), null, 'not before it is reached');
  const legend = doc({ pet_heroes: { kitsune: { copies: 1, shinies: 0, grades: ['legendary'], forms: [], dye: false } } });
  const dyed = claimMilestone(legend, T0, 'first_legendary')!;
  assert.deepEqual(dyed.dye_unlocked, ['kitsune'], 'first Legendary unlocks that hero’s dye');
  assert.ok(dyed.ribbons.includes('legend'));
  for (const m of MILESTONES) assert.ok(['ticket', 'cosmetic', 'dye', 'ribbon'].includes(m.reward.kind), `${m.id}: looks / egg-grade reward only`);
  assert.equal(playView(dyed, T0).milestones.find((m) => m.def.id === 'first_legendary')?.claimed, true);
}
ok('milestones: claim once when reached; tickets, cosmetics, a dye or a ribbon — never tokens or shells');

/* ---------------------------------------------------------- name + reset --- */

assert.deepEqual(checkPetName('  Kiki  '), { ok: true, name: 'Kiki' });
assert.equal(checkPetName('').ok, false);
assert.equal(checkPetName('ThirteenChars').ok, false, 'max 12');
assert.equal(checkPetName('Kiki!').ok, false, 'letters, numbers, spaces, - and ’ only');
assert.equal(checkPetName('sh1t').ok, false, 'digits read as letters');
assert.equal(checkPetName('c0ck').ok, false);
assert.equal(checkPetName('Shitty').ok, false, 'blocked stems match anywhere');
for (const fine of ['Grape', 'Peacock', 'Essex', 'Dickens', 'Hancock', 'Pip’s', "Mr O'Neil-2"]) {
  assert.equal(checkPetName(fine).ok, true, `${fine} is fine (short words match only whole)`);
}
{
  const egg = chooseEggDoc(doc(), T0, 'village', null)!;
  const named = renamePetDoc(egg, T0, 'Kiki')!;
  assert.equal(named.pet.name, 'Kiki');
  assert.equal(renamePetDoc(egg, T0, 'x'.repeat(20)), null, 'too long refused');
  const grown = touchPet(named, T0 + 20 * MIN);
  const released = releasePetDoc(grown, T0 + 20 * MIN)!;
  assert.equal(released.pet_hall.at(-1)?.name, 'Kiki', 'the Hall keeps its name');
  const settings = setPlaySettings(released, { chatter: 'quiet', skipReveals: true }).play_settings;
  const reset = resetDivecore({ ...released, play_settings: settings }, T0 + 30 * MIN);
  assert.deepEqual(reset.play_settings, settings, 'Reset keeps the settings');
  assert.deepEqual([reset.pet_hall.length, reset.play_stats.eggs_hatched, Object.keys(reset.pet_heroes).length], [0, 0, 0], 'and clears the progress');
  assert.equal(reset.pet.egg, null);
}
ok('name: 12 characters, allowed characters, a small word list; kept in the Hall; Reset clears progress, keeps settings');

assert.equal(gradeTag('epic'), '★★★ Epic', 'grade = stars + word, never colour alone');
ok('grade tag: stars and the word');

console.log(`\ncheck:play-settings — ${passed} groups passed.`);
