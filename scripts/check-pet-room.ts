/**
 * Pet room checks (overhaul, 2026-09-29). Run: npm run check:pet-room
 *
 *   1. Clips: for every pet line × stage × form × mood (day and night), the
 *      behaviour loop only ever asks for clips that line's art authors. Kits
 *      are rebuilt from DATA the way the renderer's `heroAvatarRole` /
 *      `getSkinRole` do — heroes.json clip names counted against the packed
 *      sheet registry (scanned as text; Metro requires can't run under tsx),
 *      creeps from the Cast skin.json, art-less heroes → the Corvus fallback.
 *   2. Status: the bubble's priority order (Away › Egg › Starving › Very sad ›
 *      Hungry › Sad › Sleepy › Evolving soon › Happy › Okay), the night hours,
 *      and "evolving soon" = the smaller of 12h or 25% of the stage.
 *   3. Coach: every status has a tip, each button opens the right sheet, an
 *      empty pantry never offers Feed, a sleepy hungry pet asks for food.
 *   4. Sharp pixels: every room size is a whole number of device pixels per
 *      source pixel.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PET_COACH_ICON, petCoachTip, type PetCoachInput } from '../src/play/coach';
import { allHeroes } from '../src/play/heroes-data';
import { PET_BRANCHES, PET_STAGES, PET_STAGE_MS, petLines, petLookFor, type PetStage } from '../src/play/pet';
import {
  PET_CLIPS,
  PET_ROOM_BOX,
  kitHas,
  petFrameAt,
  petKitOfRole,
  petMoodKind,
  petPose,
  planPetStep,
  sharpPetBox,
  type PetClipKit,
  type PetKitSource,
  type PetMoodKind,
} from '../src/play/pet-actor';
import {
  PET_STATUSES,
  evolvingSoonWindowMs,
  heartsText,
  isNightHour,
  justEvolved,
  petStatus,
  petStatusLabel,
  type PetStatus,
  type PetStatusInput,
} from '../src/play/pet-status';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* ------------------------------------------------------------- kits --- */

const sheetsText = fs.readFileSync('src/play/generated-play-sheets.ts', 'utf8');
/** East-facing frame count of a packed hero clip sheet (0 = not packed). */
function sheetFrames(heroId: string, clip: string): number {
  const key = `"sheets/cast/heroes/${heroId}/${clip}": {`;
  const at = sheetsText.indexOf(key);
  if (at < 0) return 0;
  // The next ENTRY (a top-level key), not this entry's own "sheet" path value.
  const next = sheetsText.indexOf('\n  "sheets/', at + key.length);
  const body = sheetsText.slice(at, next < 0 ? undefined : next);
  return (body.match(/"east\/frame_\d+"/g) ?? []).length;
}

type SkinJsonRole = PetKitSource & { keys?: string[] };
const castSkin = JSON.parse(fs.readFileSync('assets/play/skins/cast/skin.json', 'utf8')) as {
  roles?: Record<string, SkinJsonRole>;
} & Record<string, SkinJsonRole>;
const skinRoles: Record<string, SkinJsonRole> = castSkin.roles ?? castSkin;

/** The hero's role as `heroAvatarRole` builds it, reduced to what the kit reads. */
function heroKitSource(heroId: string): { source: PetKitSource; fallback: boolean } {
  const hero = allHeroes().find((h) => h.id === heroId);
  assert.ok(hero, `hero ${heroId} exists`);
  const clips = hero.clips as Partial<Record<string, string | null>>;
  const walkFrames = clips.walk ? sheetFrames(heroId, clips.walk) : 0;
  const anims: Record<string, { frames: number }> = {};
  for (const slot of ['idle', 'attack', 'skill', 'hurt', 'dash']) {
    const name = clips[slot];
    const frames = name ? sheetFrames(heroId, name) : 0;
    if (frames > 0) anims[slot] = { frames };
  }
  const anyArt = walkFrames > 0 || Object.keys(anims).length > 0 || sheetsText.includes(`"sheets/cast/heroes/${heroId}/rotations"`);
  if (!anyArt) return { source: skinRoles['unit.avatar'], fallback: true };
  return { source: { walk: walkFrames > 0 ? { frames: walkFrames } : undefined, anims }, fallback: false };
}

function kitFor(lineId: string, stage: PetStage): { kit: PetClipKit; label: string } {
  const look = petLookFor(lineId, stage);
  assert.ok(look, 'non-egg stages have a look');
  if (look.kind === 'creep') {
    const role = skinRoles[look.role];
    assert.ok(role, `creep role ${look.role} exists`);
    return { kit: petKitOfRole(role), label: look.role };
  }
  const { source, fallback } = heroKitSource(look.heroId);
  return { kit: petKitOfRole(source, fallback ? undefined : look.heroId), label: fallback ? `${look.heroId}→corvus` : look.heroId };
}

/** Deterministic 0..1 source. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOODS: PetMoodKind[] = ['happy', 'okay', 'hungry', 'sad', 'asleep'];
const GROWN: PetStage[] = PET_STAGES.filter((s) => s !== 'egg');
const missing: string[] = [];
let stepsRun = 0;
for (const line of petLines()) {
  for (const stage of GROWN) {
    const { kit, label } = kitFor(line.id, stage);
    // An empty kit would make every assertion below pass vacuously.
    assert.ok(Object.keys(kit).length >= 2, `${label}: kit has clips (${JSON.stringify(kit)})`);
    for (const clip of PET_CLIPS) {
      if (!kitHas(kit, clip)) missing.push(`${label}:${clip}`);
    }
    // No pose the fallbacks return is ever missing from the kit.
    for (const clip of PET_CLIPS) {
      const pose = petPose(kit, clip);
      if (pose) assert.ok(kitHas(kit, pose.clip), `${label}: petPose(${clip}) → ${pose.clip} is authored`);
    }
    for (const branch of PET_BRANCHES) {
      for (const mood of MOODS) {
        const rng = seeded(line.id.length * 97 + stage.length * 13 + branch.length * 7 + mood.length);
        let x = 0.5;
        for (let i = 0; i < 60; i += 1) {
          const step = planPetStep({ kit, mood, branch, stage, x, rng });
          stepsRun += 1;
          if (step.pose) {
            assert.ok(
              kitHas(kit, step.pose.clip),
              `${line.id}/${stage}/${branch}/${mood}: step "${step.act}" asked for "${step.pose.clip}", which ${label} does not author`,
            );
            const frame = petFrameAt(kit, step.pose, step.ms + 5000, step.loop);
            assert.ok(frame >= 0 && frame < (kit[step.pose.clip] ?? 1), `${label}: frame in range`);
          }
          assert.ok(step.ms > 0 && step.toX >= 0 && step.toX <= 1, 'step length and target sane');
          if (mood === 'asleep') assert.equal(step.act, 'sleep', 'asleep = sleeps');
          x = step.toX;
        }
      }
    }
  }
}
ok(`behaviour loop: ${stepsRun} steps over every line × stage × form × mood use only authored clips`);
console.log(`    (reported, not failed — clips a line lacks, handled by fallbacks: ${[...new Set(missing)].join(', ') || 'none'})`);

// Fallbacks behave as designed.
assert.deepEqual(petPose({ idle: 4 }, 'walk'), { clip: 'idle', hold: false }, 'no walk → glide on idle');
assert.deepEqual(petPose({ dash: 9, attack: 11 }, 'idle'), { clip: 'attack', hold: true }, 'no idle → hold a frame');
assert.equal(petPose({ idle: 4, walk: 6 }, 'attack'), null, 'no attack/skill → no show-off clip (hop instead)');
assert.equal(petPose({ idle: 4, hurt: 5 }, 'hurt')?.clip, 'hurt');
assert.equal(petPose({ idle: 4 }, 'hurt'), null, 'no hurt → caller flashes');
assert.equal(petKitOfRole({ anims: { hurt: { frames: 11 }, idle: { frames: 4 } } }, 'kitsune').hurt, undefined, 'Kitsune’s death clip is not a pet hurt');
assert.equal(planPetStep({ kit: { idle: 4 }, mood: 'happy', branch: 'battle', stage: 'child', x: 0.5, rng: () => 0 }).act, 'hop', 'a show-off without an attack clip is a hop');
ok('fallbacks: glide, hold, hop, flash; Kitsune hurt dropped');

// Mood for motion.
assert.equal(petMoodKind(4, 4, true), 'asleep');
assert.equal(petMoodKind(1, 4, false), 'hungry');
assert.equal(petMoodKind(3, 1, false), 'sad');
assert.equal(petMoodKind(3, 3, false), 'happy');
assert.equal(petMoodKind(2, 3, false), 'okay');
ok('motion mood: night sleeps, hungry, sad, happy, okay');

/* ----------------------------------------------------------- status --- */

const HOUR = 3600_000;
const base: PetStatusInput = { stage: 'teen', hunger: 4, mood: 4, away: false, night: false, stageLeftMs: 40 * HOUR };
const cases: [Partial<PetStatusInput>, PetStatus][] = [
  [{ away: true, hunger: 0, mood: 0, night: true }, 'away'],
  [{ stage: 'egg', hunger: 0, stageLeftMs: 50 * 60_000 }, 'egg'],
  [{ stage: 'egg', stageLeftMs: 10 * 60_000 }, 'egg'],
  [{ hunger: 0, mood: 0, night: true, stageLeftMs: 1 }, 'starving'],
  [{ mood: 0, hunger: 1, night: true }, 'very_sad'],
  [{ hunger: 1, mood: 1, night: true }, 'hungry'],
  [{ mood: 1, night: true, stageLeftMs: 1 }, 'sad'],
  [{ night: true, stageLeftMs: 1 }, 'sleepy'],
  [{ stageLeftMs: 1 }, 'evolving'],
  [{}, 'happy'],
  [{ hunger: 2 }, 'okay'],
  [{ stage: 'god', stageLeftMs: null }, 'happy'],
];
for (const [patch, want] of cases) {
  assert.equal(petStatus({ ...base, ...patch }), want, `status ${JSON.stringify(patch)} → ${want}`);
}
const covered = new Set(cases.map(([, s]) => s));
for (const s of PET_STATUSES) assert.ok(covered.has(s), `status ${s} is covered`);
assert.equal(petStatusLabel('hungry', 'teen'), '😋 Hungry');
assert.equal(petStatusLabel('egg', 'egg', 10 * 60_000), '✨ Hatching soon', 'an egg about to hatch keeps its Choose button');
assert.equal(petStatusLabel('egg', 'egg', 50 * 60_000), '🥚 Egg');
assert.equal(petStatusLabel('evolving', 'teen', 1), '✨ Evolving soon');
assert.equal(heartsText(3), '❤❤❤♡');
assert.equal(heartsText(0), '♡♡♡♡');
ok('status: priority order Away › Egg › Starving › Very sad › Hungry › Sad › Sleepy › Evolving › Happy › Okay');

for (let h = 0; h < 24; h += 1) assert.equal(isNightHour(h), h >= 22 || h < 7, `hour ${h}`);
for (const stage of PET_STAGES) {
  const w = evolvingSoonWindowMs(stage);
  if (stage === 'god') {
    assert.equal(w, null);
    continue;
  }
  assert.equal(w, Math.min(12 * HOUR, PET_STAGE_MS[stage] * 0.25), `${stage} evolving-soon window`);
}
assert.equal(evolvingSoonWindowMs('egg'), 15 * 60_000, 'Egg (1h): 15 minutes');
assert.equal(evolvingSoonWindowMs('baby'), 3 * HOUR, 'Baby (12h): 3 hours');
assert.equal(evolvingSoonWindowMs('adult'), 12 * HOUR, 'Adult (5d): capped at 12 hours');
assert.equal(justEvolved('child', 'teen'), true);
assert.equal(justEvolved('god', 'egg'), false, 'a rebirth is not an evolution');
assert.equal(justEvolved(null, 'teen'), false);
ok('night 22:00-07:00; evolving soon = min(12h, 25% of the stage); just-evolved');

/* ------------------------------------------------------------ coach --- */

const coachBase: PetCoachInput = {
  status: 'okay',
  hunger: 3,
  pantryTotal: 2,
  expeditionReady: false,
  diveCharges: 0,
  tokensLeftToday: 0,
  backIn: null,
};
for (const status of PET_STATUSES) {
  for (const pantryTotal of [0, 3]) {
    for (const hunger of [0, 1, 2, 3, 4]) {
      const tip = petCoachTip({ ...coachBase, status, pantryTotal, hunger });
      assert.ok(tip.tip.length > 0, `${status}: has a tip`);
      assert.equal(tip.action == null, tip.button == null, `${status}: a button iff an action`);
      if (pantryTotal === 0) assert.notEqual(tip.action, 'feed', `${status}: an empty pantry never offers Feed`);
    }
  }
}
const coach = (patch: Partial<PetCoachInput>) => petCoachTip({ ...coachBase, ...patch });
assert.equal(coach({ status: 'starving' }).action, 'feed');
assert.match(coach({ status: 'hungry', pantryTotal: 3 }).tip, /I need food! 3 in the pantry/);
assert.equal(coach({ status: 'hungry', pantryTotal: 0 }).action, 'catch', 'empty pantry → Catch the food');
assert.match(coach({ status: 'hungry', pantryTotal: 0 }).tip, /dive/i, 'empty pantry also suggests a dive');
assert.equal(coach({ status: 'sad' }).action, 'play');
assert.equal(coach({ status: 'very_sad' }).action, 'play');
assert.equal(coach({ status: 'sleepy', hunger: 2 }).action, 'feed', 'feed me before bed');
assert.match(coach({ status: 'sleepy', hunger: 2 }).tip, /before bed/);
assert.equal(coach({ status: 'sleepy', hunger: 2, pantryTotal: 0 }).action, 'catch');
assert.equal(coach({ status: 'sleepy', hunger: 3 }).action, null);
assert.equal(coach({ status: 'evolving' }).action, null, 'evolving soon: no button');
assert.match(coach({ status: 'evolving' }).tip, /hearts up/);
assert.equal(coach({ status: 'happy', expeditionReady: true, diveCharges: 3 }).action, 'expedition', 'expedition first');
assert.match(coach({ status: 'happy' }).tip, /^All good!/);
assert.equal(coach({ status: 'okay', diveCharges: 1 }).action, 'dive');
assert.equal(coach({ status: 'egg' }).action, 'hatch');
assert.equal(coach({ status: 'away', backIn: '2h 5m' }).tip, 'Out exploring — back in 2h 5m.');
// The button opens the right sheet (and that icon pulses).
assert.equal(PET_COACH_ICON.feed, 'feed');
assert.equal(PET_COACH_ICON.catch, 'play');
assert.equal(PET_COACH_ICON.play, 'play');
assert.equal(PET_COACH_ICON.dive, 'dive');
assert.equal(PET_COACH_ICON.expedition, 'expedition');
assert.equal(PET_COACH_ICON.hatch, 'info');
ok('coach: every status has a tip, buttons go to the right sheet, empty pantry → Catch the food');

/* -------------------------------------------------------- sharp box --- */

for (const pr of [1, 1.5, 2, 2.625, 3, 3.5]) {
  for (const cell of [64, 120, 124, 128, 156, 188]) {
    for (const stage of PET_STAGES) {
      const box = sharpPetBox(PET_ROOM_BOX[stage], cell, pr);
      const k = (box * pr) / cell;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-9 && k >= 1, `pr ${pr} cell ${cell} ${stage}: whole device px per source px`);
    }
  }
}
ok('sharp pixels: every room size is a whole number of device pixels per source pixel');

// The room screen wires the pure pieces (not a stub).
const room = fs.readFileSync('src/play/pet-room.tsx', 'utf8');
for (const needle of ['planPetStep', 'petStatus(', 'petCoachTip(', 'pickPetLine(', 'PET_COACH_ICON']) {
  assert.ok(room.includes(needle) || fs.readFileSync('src/play/pet-screen.tsx', 'utf8').includes(needle), `room uses ${needle}`);
}
ok('room screen uses the planner, status, coach and talk picker');

console.log(`\ncheck:pet-room — ${passed} groups passed.`);
