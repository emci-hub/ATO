/**
 * Per-frame holds (AN3). Run: npx tsx scripts/check-clip-holds.ts
 *
 * A packed clip may carry `holds` (ms per frame). The players read them first and fall
 * back to their flat per-clip-type cadence. Pins: the frame math (cast actor + pet),
 * the flat fallback staying exactly as before, one-shot lengths, and the data — every
 * Streetwear hero clip carries a full set, and every clip but Idle keeps its old total
 * length (so the attack gate and one-shot ends do not move).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CAST_ACTOR_FRAME_MS,
  castActorClipHolds,
  castActorCreate,
  castActorFaintFrame,
  castActorFrame,
  castActorStartOnce,
} from '../src/play/cast-actor';
import { PET_FRAME_MS, petFrameAt, petKitOfRole, petPoseMs, type PetClipKit } from '../src/play/pet-actor';
import type { SkinRole } from '../src/play/skin';

const ok = (m: string) => console.log(`ok  ${m}`);
const walk = (frames: number, holds?: number[]) => ({ dirs: 2 as const, order: ['east', 'west'], frames, base: 'x', ...(holds ? { holds } : {}) });
const role = (anims: SkinRole['anims'], w?: ReturnType<typeof walk>): SkinRole =>
  ({ keys: [], dirs: 8, pivot: 'feet', walk: w, anims }) as SkinRole;

/* ---- cast actor ---- */
{
  const IDLE = [400, 250, 400, 250];
  const r = role({ idle: walk(4, IDLE), attack: walk(8, [90, 70, 45, 40, 45, 60, 80, 90]), faint: walk(3, [100, 100, 300]) });
  const a = castActorCreate('avatar');
  a.clipStartAt = 1000;
  const at = (t: number) => castActorFrame(a, 1000 + t, r);
  assert.deepEqual([0, 399, 400, 649, 650, 1049, 1050, 1299].map(at), [0, 0, 1, 1, 2, 2, 3, 3], 'idle holds step 400/250/400/250');
  assert.equal(at(1300), 0, 'idle wraps after the last hold');
  assert.equal(at(1300 + 400), 1, 'and keeps its holds on the second lap');
  assert.equal(at(-50), 0, 'before the start is frame 0');
  assert.deepEqual(castActorClipHolds('idle', r), IDLE);
  assert.equal(castActorClipHolds('skill', r), undefined, 'no holds when the clip has none');
  assert.equal(castActorClipHolds('idle', role({ idle: walk(4, [400, 250]) })), undefined, 'a short set is ignored, never half-applied');

  const now = 5000;
  assert.equal(castActorStartOnce(a, 'attack', now, r), true);
  assert.equal(a.onceEndAt, now + 520, 'a one-shot ends after the SUM of its holds');
  assert.equal(castActorFrame(a, now + 89, r), 0);
  assert.equal(castActorFrame(a, now + 90, r), 1);
  assert.equal(castActorFrame(a, now + 520, r), 7, 'a one-shot holds its last frame');
  assert.equal(castActorFrame(a, now + 99999, r), 7);

  assert.equal(castActorFaintFrame(1100, 1000, r), 1, 'faint reads its holds');
  assert.equal(castActorFaintFrame(1200, 1000, r), 2);
  assert.equal(castActorFaintFrame(99999, 1000, r), 2, 'faint holds lying down');

  // Flat fallback: no holds means exactly the old frames x cadence.
  const flat = role({ idle: walk(4), attack: walk(8) });
  const b = castActorCreate('avatar');
  b.clipStartAt = 0;
  assert.deepEqual([0, 119, 120, 479, 480].map((t) => castActorFrame(b, t, flat)), [0, 0, 1, 3, 0]);
  assert.equal(castActorStartOnce(b, 'attack', 0, flat), true);
  assert.equal(b.onceEndAt, 8 * CAST_ACTOR_FRAME_MS.avatar.attack!, 'flat one-shot length unchanged');
}
ok('cast actor: holds step, wrap, hold-last, one-shot length, faint; flat fallback unchanged');

/* ---- pet ---- */
{
  const kit = petKitOfRole({ anims: { idle: walk(4, [400, 250, 400, 250]), attack: walk(8) }, walk: walk(8) });
  assert.deepEqual(kit.holds?.idle, [400, 250, 400, 250]);
  assert.equal(kit.holds?.attack, undefined, 'a clip without holds is not listed');
  assert.equal(kit.idle, 4);
  const pose = { clip: 'idle' as const, hold: false };
  assert.deepEqual([0, 399, 400, 650, 1050, 1300].map((t) => petFrameAt(kit, pose, t, true)), [0, 0, 1, 2, 3, 0]);
  assert.equal(petFrameAt(kit, pose, 1199, true, 3), 0, 'asleep stretches every hold by the slowdown');
  assert.equal(petFrameAt(kit, pose, 1200, true, 3), 1);
  assert.equal(petFrameAt(kit, { clip: 'idle', hold: false }, 99999, false), 3, 'a one-shot holds its last frame');
  assert.equal(petPoseMs(kit, pose), 1300, 'one-shot length = sum of holds');
  const plain: PetClipKit = { idle: 4, attack: 8 };
  assert.equal(petPoseMs(plain, { clip: 'attack', hold: false }), 8 * PET_FRAME_MS.attack, 'flat length unchanged');
  assert.equal(petFrameAt(plain, { clip: 'idle', hold: false }, PET_FRAME_MS.idle, true), 1, 'flat frame math unchanged');
}
ok('pet: holds step, slow factor, one-shot length; flat fallback unchanged');

/* ---- data: every Streetwear hero clip carries a full set ---- */
{
  const sheets = JSON.parse(fs.readFileSync('assets/art/legacy-play-sheets.json', 'utf8')) as Record<
    string,
    { frames: Record<string, unknown>; holds?: number[] }
  >;
  const OLD_TOTAL: Record<string, number> = {
    Walk: 8 * CAST_ACTOR_FRAME_MS.avatar.walk!,
    Dash: 8 * CAST_ACTOR_FRAME_MS.avatar.dash!,
    Attack: 8 * CAST_ACTOR_FRAME_MS.avatar.attack!,
    Skill: 8 * CAST_ACTOR_FRAME_MS.avatar.skill!,
    Hurt: 6 * CAST_ACTOR_FRAME_MS.avatar.hurt!,
    Faint: 7 * CAST_ACTOR_FRAME_MS.tower.faint!,
  };
  const heroes = new Set<string>();
  for (const key of Object.keys(sheets)) {
    const m = /^sheets\/streetwear\/heroes\/([^/]+)\/([A-Za-z]+)$/.exec(key);
    if (m) heroes.add(m[1]);
  }
  assert.ok(heroes.size >= 16, `16 Streetwear heroes packed (${heroes.size})`);
  for (const hero of heroes) {
    for (const clip of ['Idle', 'Walk', 'Dash', 'Attack', 'Skill', 'Hurt', 'Faint']) {
      const key = `sheets/streetwear/heroes/${hero}/${clip}`;
      const s = sheets[key];
      assert.ok(s, `${key} is packed`);
      const perDir = Object.keys(s.frames).filter((f) => f.startsWith('east/')).length;
      assert.ok(s.holds, `${key} carries holds`);
      assert.equal(s.holds.length, perDir, `${key}: one hold per frame`);
      assert.ok(s.holds.every((h) => Number.isInteger(h) && h >= 30 && h <= 600), `${key}: holds are whole ms, 30-600`);
      const total = s.holds.reduce((a, b) => a + b, 0);
      if (clip === 'Idle') assert.equal(total, 1300, `${key}: the breathing loop is 1300 ms`);
      else if (clip === 'Attack') assert.equal(total, perDir * CAST_ACTOR_FRAME_MS.avatar.attack!, `${key}: keeps the attack length (frames x 65)`);
      else assert.equal(total, OLD_TOTAL[clip], `${key}: keeps its old length (${total} vs ${OLD_TOTAL[clip]})`);
    }
  }
}
ok('data: all 16 hero sheets carry full holds; non-Idle clips keep their old length');

console.log('check:clip-holds passed');
