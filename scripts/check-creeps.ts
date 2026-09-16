/**
 * Path-walker skin data-contract checks (K2 → K2.5). Run: npx tsx scripts/check-creeps.ts
 *
 * Guards every PATH WALKER role in `assets/play/skins/cast/skin.json` — the
 * three creeps (`unit.puff` Village Girl · `unit.runner` Wizard · `unit.tank`
 * Knight) AND the two bosses that ride the road as path enemies
 * (`unit.boss_scout` Crimson Oni, the scout mini-boss + scout boss ·
 * `unit.final` Archangel Commander, the Main Final). This is the contract the
 * board reads to find a walker's walk cycle, its breathing idle loop, and its
 * death one-shot. Same cast clip-kit schema the heroes and towers use; the
 * failure modes mirror `check-heroes.ts` / `check-towers.ts`:
 *
 *   1. A role's art folder drifting from its slug — every key must live under
 *      `assets/play/skins/cast/<artRoot>/`, the role's own art root (creeps:
 *      `creeps/<id>`, the Oni boss: `boss/oni`, the Archangel boss:
 *      `heroes/archangel` — the boss roles deliberately re-use their hero's
 *      cast folder rather than duplicating it).
 *   2. Clip names the art registry does not key — a clip folder renamed, or
 *      copied with its `N._` ordering prefix still on it.
 *   3. A truncated bundle: facings that disagree on frame count, a declared
 *      `frames` that disagrees with the registry, or a registry with fewer
 *      frames than the PNGs on disk.
 *   4. The path-walker template: a walker whose clip art IS bundled must author
 *      every slot its pack ships art for — the ONE enforce rule this file adds.
 *      A walker with an `animations/Breathing_Idle` folder but a null `idle` is
 *      a silent gap (the art is in the bundle and nothing draws it), so it
 *      FAILS. Folders that belong to no path slot are REPORTED, never failed:
 *      path ATTACK is deliberately parked (`SLOT_FOLDER_ALIASES` names the
 *      folders that DO satisfy a slot, so nothing gets mapped to `death` by
 *      accident — a slash or a wave is not a corpse).
 *   5. The FSM ladder itself (`creepClip` in cast-kits.ts + `castActorPathFrame`
 *      in cast-actor.ts): death > walk > idle, a slot the art does not author is
 *      skipped rather than invented, and a death one-shot holds its last frame
 *      instead of looping back to standing. Joined per role to the declared
 *      frames, so the data and the decision table can never drift apart.
 *
 * Metro `require`s can't run under tsx, so the registry is scanned as TEXT
 * (same as check-heroes / check-towers); disk frames are counted as files.
 *
 * Pure data + file reads — no React, network, or keys.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CAST_CLIP_SLOTS,
  CREEP_PATH_CLIPS,
  CREEP_STILL_MS,
  creepClip,
  type CreepPathClip,
} from '../src/play/cast-kits';
import { castActorPathFrame } from '../src/play/cast-actor';

/**
 * Every path walker, in the art order the board maps them (see `puffUnitRole`
 * / `BAND_UNIT_ROLE`). `artRoot` is the role's folder under
 * `assets/play/skins/cast/` — the three creeps own `creeps/<id>`; the two boss
 * roles point at the cast folder their art already lives in (`boss/oni`, the
 * Oni's own pack copy for the road; `heroes/archangel`, shared with the
 * Archangel hero rather than duplicated), which is why the prefix is per-role
 * and not one hardcoded `creeps/` path.
 */
const PATH_ROSTER = [
  { role: 'unit.puff', name: 'Village Girl', artRoot: 'creeps/village-girl' },
  { role: 'unit.runner', name: 'Wizard', artRoot: 'creeps/wizard' },
  { role: 'unit.tank', name: 'Knight', artRoot: 'creeps/knight' },
  { role: 'unit.boss_scout', name: 'Crimson Oni', artRoot: 'boss/oni' },
  { role: 'unit.final', name: 'Archangel', artRoot: 'heroes/archangel' },
] as const;

/**
 * The path slots an animation FOLDER NAME may satisfy when the folder is not
 * simply named after its slot. `Breathing_Idle` is the pack's idle loop and
 * `Walking` is the Knight's / the Oni's locomotion row (the Girl's and the
 * Wizard's are already plain `Walk` / `walk`); the Archangel names its pack
 * rows `Hover_Idle` (breathing), `Divine_Flight` (locomotion) and
 * `Angelic_Flinch` (the flinch it dies in), and the Oni's fall is
 * `EPIC_DEATH_FALL_OF_THE_CRIMSON_LEGEND`. This is the alias table the template
 * rule reads — the same idea as the tower loader's `fire` → `attack` alias, and
 * the ONLY place a folder is allowed to claim a path slot. Nothing else maps to
 * `death`: a slash / wave / attack row (or the Oni's unused `Running`) is not a
 * fall and stays parked.
 */
const SLOT_FOLDER_ALIASES: Record<string, CreepPathClip> = {
  Breathing_Idle: 'idle',
  Hover_Idle: 'idle',
  Walking: 'walk',
  Divine_Flight: 'walk',
  Angelic_Flinch: 'death',
  EPIC_DEATH_FALL_OF_THE_CRIMSON_LEGEND: 'death',
};

/** Which path slot an on-disk clip folder belongs to, or undefined when it
 * belongs to none (the parked attack / flavour clips). A folder named after a
 * slot satisfies it directly, whatever its casing. */
function slotForFolder(name: string): CreepPathClip | undefined {
  const alias = SLOT_FOLDER_ALIASES[name];
  if (alias) return alias;
  const lower = name.toLowerCase();
  return CREEP_PATH_CLIPS.find((clip) => clip === lower);
}

/** Named clips the path FSM can actually play: the breathing loop and the
 * death one-shot. A walker that authors anything else here is a path-ATTACK
 * decision, and that stays parked. */
const CREEP_ANIM_SLOTS: readonly CreepPathClip[] = ['idle', 'death'];

/** A raw pack folder name leaked into the contract: `Breathing_Idle-ab12cd34`. */
const HASH_SUFFIX = /-[0-9a-f]{8}$/;
/** A raw pack ordering prefix leaked in: `1._Breathing_Idle`. */
const ORDER_PREFIX = /^\d+\._/;
/** Cast clips ship at least a couple of frames per facing, never one. */
const MIN_FRAMES_PER_FACING = 2;
/** Path walkers are drawn as side profiles, so both rows must be authored. */
const FACINGS = ['east', 'west'] as const;

const repoRoot = path.resolve(__dirname, '..');
const registryText = fs.readFileSync(
  path.resolve(repoRoot, 'src/play/generated-play-assets.ts'),
  'utf8',
);
type SkinWalkDef = {
  dirs: number;
  order: readonly string[];
  frames: number;
  base: string;
};
type SkinRoleDef = {
  keys: readonly string[];
  dirs: number;
  pivot: string;
  walk?: SkinWalkDef;
  anims?: Partial<Record<string, SkinWalkDef>>;
};
const skin = JSON.parse(
  fs.readFileSync(path.resolve(repoRoot, 'assets/play/skins/cast/skin.json'), 'utf8'),
) as { pack: string; roles: Record<string, SkinRoleDef> };
const screen = fs.readFileSync(path.resolve(repoRoot, 'src/play/defend-screen.tsx'), 'utf8');

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function frameKey(base: string, face: string, frame: number): string {
  return `'${base}/${face}/frame_${String(frame).padStart(3, '0')}'`;
}

/** Frames the registry bundles for one facing (`frame_000`, `frame_001`, …). */
function registryFrames(base: string, face: string): number {
  let frames = 0;
  while (registryText.includes(frameKey(base, face, frames))) frames += 1;
  return frames;
}

/** On-disk clip folders by hash-stripped name: `Breathing_Idle-5cdc75df` →
 * `Breathing_Idle`. The packed folders are inconsistent about keeping the pack
 * hash (the Girl's don't, the Wizard's and Knight's do) but a registry key never
 * carries it, so the contract is spelled without it. */
function clipFolders(animations: string): Map<string, string> {
  const folders = new Map<string, string>();
  if (!fs.existsSync(animations)) return folders;
  for (const entry of fs.readdirSync(animations, { withFileTypes: true })) {
    if (entry.isDirectory()) folders.set(entry.name.replace(HASH_SUFFIX, ''), entry.name);
  }
  return folders;
}

function diskFrames(dir: string): number {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith('.png')).length : 0;
}

/**
 * Frames on disk for one facing of a clip. The pack hash can land on the FACING
 * segment as well as the clip one (the Knight ships `Walking-feaba143/west-0247c925`)
 * and `play-art-prep` strips it from EVERY segment when it writes the registry
 * alias, so the face is matched by its hash-stripped name — a literal `west`
 * lookup would count 0 files and report a truncated bundle that is not one.
 */
function diskFaceFrames(clipDir: string, face: string): number {
  if (!fs.existsSync(clipDir)) return 0;
  const dir = fs
    .readdirSync(clipDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.replace(HASH_SUFFIX, '') === face);
  return dir ? diskFrames(path.join(clipDir, dir.name)) : 0;
}

/** The role def for a path walker, or a loud failure — the whole file is about these. */
function walkerRoleDef(role: string): SkinRoleDef {
  const def = skin.roles[role];
  assert.ok(def, `${role}: no such role in the cast skin`);
  return def;
}

/* ------------------------------------------------------------- 1 — roster --- */

assert.equal(skin.pack, 'cast', 'the path-walker roles live in the cast skin');
assert.equal(PATH_ROSTER.length, 5, 'three creeps + two bosses walk the road');
for (const { role, artRoot } of PATH_ROSTER) {
  const def = walkerRoleDef(role);
  assert.equal(def.dirs, 8, `${role}: the 8-dir rotations are the fallback art`);
  assert.equal(def.pivot, 'feet', `${role}: path walkers are feet-pivoted`);
  assert.equal(def.keys.length, 8, `${role}: eight rotation keys`);
  for (const key of def.keys) {
    assert.ok(
      key.startsWith(`skins/cast/${artRoot}/rotations/`),
      `${role}: key "${key}" is not in skins/cast/${artRoot}/rotations — the role and the art folder have drifted`,
    );
  }
  for (const face of FACINGS) {
    assert.ok(
      def.keys.some((key) => key.endsWith(`/rotations/${face}`)),
      `${role}: no ${face} rotation key`,
    );
  }
}
ok(`roster: ${PATH_ROSTER.length} path-walker roles, 8-dir rotations under their own art folders`);

// The rotation art really is bundled (the silent-empty failure: a role whose
// keys resolve to nothing draws a fallback circle instead of a walker).
for (const { role, artRoot } of PATH_ROSTER) {
  const def = walkerRoleDef(role);
  for (const face of FACINGS) {
    const key = `skins/cast/${artRoot}/rotations/${face}`;
    assert.ok(def.keys.includes(key), `${role}: the ${face} rotation key is "${key}"`);
    assert.ok(registryText.includes(`'${key}':`), `${role}: ${key} is not in the art registry`);
  }
}
ok('every path-walker rotation key resolves in the art registry (east + west)');

// The roster here and the board's side-profile set have to be the same five
// roles. A walker the board does not classify as a path walker draws its 8-dir
// rotation and snaps north/south through a vertical lane instead of holding its
// side profile — the exact regression `skinWalkFace` exists to prevent. Read as
// TEXT because `src/play/skin.ts` imports the Metro art registry (PLAY_ART) at
// module load, so it cannot be imported under tsx.
const skinSource = fs.readFileSync(path.resolve(repoRoot, 'src/play/skin.ts'), 'utf8');
const pathWalkerBlock =
  /SKIN_PATH_WALKER_ROLES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(skinSource)?.[1] ?? '';
assert.ok(pathWalkerBlock, 'SKIN_PATH_WALKER_ROLES is declared in src/play/skin.ts');
for (const { role } of PATH_ROSTER) {
  assert.ok(
    pathWalkerBlock.includes(`'${role}'`),
    `${role}: rides the road but is not in SKIN_PATH_WALKER_ROLES (src/play/skin.ts) — the ` +
      `board would draw it as an N/S-snapping 8-dir rotation, not a sticky E/W side profile`,
  );
}
// …and the join the other way, so the roster cannot silently fall behind the
// board: a sixth path-walker role added to skin.ts + skin.json but not here
// would otherwise be checked by nothing at all.
const boardWalkers = [...pathWalkerBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
for (const role of boardWalkers) {
  assert.ok(
    PATH_ROSTER.some((entry) => entry.role === role),
    `${role}: the board classifies it as a path walker but PATH_ROSTER does not — add it here ` +
      `so its walk/idle/death slots are held to the art on disk`,
  );
}
ok(`the board and PATH_ROSTER name the same ${PATH_ROSTER.length} side-profile path walkers`);

/* ------------------------------------- 2 + 3 + 4 — clips and their frames --- */

/** Clips measured against the registry + disk; the number the template rule
 * below counts, so "bundled" is never a tree-dependent answer. */
let enforced = 0;
const stubs: string[] = [];
const parked: string[] = [];

for (const { role, artRoot } of PATH_ROSTER) {
  const def = walkerRoleDef(role);
  const animations = path.join(repoRoot, `assets/play/skins/cast/${artRoot}/animations`);
  const onDisk = clipFolders(animations);
  const declared = new Map<CreepPathClip, SkinWalkDef>();
  if (def.walk) declared.set('walk', def.walk);
  for (const [slot, walk] of Object.entries(def.anims ?? {})) {
    assert.ok(
      CREEP_ANIM_SLOTS.includes(slot as CreepPathClip),
      `${role}/anims.${slot}: the path FSM plays ${CREEP_ANIM_SLOTS.join(' + ')} only — ` +
        `path ATTACK art stays unreferenced`,
    );
    assert.notEqual(
      slot,
      'walk',
      `${role}/anims.walk: locomotion belongs in the role's own \`walk\` field`,
    );
    assert.ok(walk, `${role}/anims.${slot}: null entry — drop the key instead`);
    declared.set(slot as CreepPathClip, walk);
  }
  assert.ok(declared.has('walk'), `${role}: a path walker must author \`walk\``);

  // Every declared clip: the slot is part of the shared schema, the name is
  // spelled the way the registry keys it, and the frames behind it are real.
  for (const [slot, walk] of declared) {
    const label = `${role}/${slot}`;
    assert.ok(
      CAST_CLIP_SLOTS.includes(slot as (typeof CAST_CLIP_SLOTS)[number]),
      `${label}: not a cast clip slot (${CAST_CLIP_SLOTS.join('/')})`,
    );
    assert.doesNotMatch(walk.base, HASH_SUFFIX, `${label}: base kept its pack hash`);
    assert.doesNotMatch(walk.base, ORDER_PREFIX, `${label}: base kept its N._ prefix`);
    assert.ok(
      walk.base.startsWith(`skins/cast/${artRoot}/animations/`),
      `${label}: base "${walk.base}" is not under skins/cast/${artRoot}/animations`,
    );
    // The inverse of the template rule below, and what makes "no invented
    // corpse" a real guard: a declared clip's folder has to BE that slot's row.
    // Mapping e.g. the Knight's `Iron_Slash` (a slash) or the Girl's
    // `Flower_Wave` into `anims.death` would otherwise validate fine — the art
    // is bundled and the frames are real — and ship a fake death.
    const declaredName = walk.base.slice(walk.base.lastIndexOf('/') + 1);
    assert.equal(
      slotForFolder(declaredName),
      slot,
      `${label}: "${declaredName}" is not a ${slot} row — a slash / wave / attack row is not a ` +
        `death, and a locomotion row is not an idle. Point the slot at its own folder, or add ` +
        `the pack's name to SLOT_FOLDER_ALIASES if it is genuinely this slot.`,
    );
    assert.equal(walk.dirs, walk.order.length, `${label}: dirs must match the order rows`);
    for (const face of FACINGS) {
      assert.ok(
        walk.order.includes(face),
        `${label}: order is missing "${face}" — path walkers are drawn as side profiles`,
      );
    }

    const bundled = registryFrames(walk.base, 'east') > 0;
    if (!bundled) {
      // No registry keys for this clip. That is an honest stub ONLY when the
      // pack's folder is not in the tree either: `play-art-prep` generates the
      // keys from the PNGs, so a folder that IS on disk with no keys behind it
      // means the art copy happened and the registry was never re-baked — the
      // stale-bundle failure this check exists to catch, not a stub.
      const name = walk.base.slice(walk.base.lastIndexOf('/') + 1);
      assert.ok(
        !onDisk.has(name),
        `${label}: "${name}" is on disk but the registry keys nothing under ${walk.base} — ` +
          `re-run \`npx tsx scripts/play-art-prep.ts\` (the clip would draw nothing)`,
      );
      stubs.push(label);
      continue;
    }

    for (const face of FACINGS) {
      const frames = registryFrames(walk.base, face);
      assert.ok(
        frames >= MIN_FRAMES_PER_FACING,
        `${label}: registry has ${frames} ${face} frame(s) under ${walk.base} — renamed, or copied with its N._ prefix`,
      );
      assert.equal(
        frames,
        walk.frames,
        `${label}: declares ${walk.frames} ${face} frames, the registry bundles ${frames}`,
      );
    }
    assert.equal(
      registryFrames(walk.base, 'east'),
      registryFrames(walk.base, 'west'),
      `${label}: facings disagree on frame count`,
    );

    if (fs.existsSync(animations)) {
      const name = walk.base.slice(walk.base.lastIndexOf('/') + 1);
      const dirName = onDisk.get(name);
      assert.ok(
        dirName,
        `${label}: no "${name}" folder in ${role} animations — renamed, copied with its N._ prefix, ` +
          `or the art is not in this tree (the registry is tracked, so the PNGs must be committed with it)`,
      );
      for (const face of FACINGS) {
        assert.equal(
          diskFaceFrames(path.join(animations, dirName), face),
          registryFrames(walk.base, face),
          `${label}/${face}: PNGs on disk and registry keys disagree (re-run play-art-prep)`,
        );
      }
    }
    enforced += 1;
  }

  // The template rule (K2): the art is IN the bundle, so the contract has to
  // name it. A walker with an idle/death/walk folder that no slot references is
  // the silent gap this check exists for — the frames ship and nothing draws
  // them. Folders belonging to no path slot are parked on purpose.
  for (const name of onDisk.keys()) {
    const slot = slotForFolder(name);
    if (!slot) continue;
    const declaredWalk = declared.get(slot);
    if (!declaredWalk) {
      assert.fail(
        `${role}: the pack ships "${name}" (= the ${slot} slot) but the role declares no ${slot}. ` +
          `Name it in assets/play/skins/cast/skin.json (anims.${slot} for idle/death, \`walk\` for locomotion) ` +
          `or the walker walks with dead art in the bundle.`,
      );
    }
    assert.equal(
      declaredWalk.base.slice(declaredWalk.base.lastIndexOf('/') + 1),
      name,
      `${role}/${slot}: "${declaredWalk.base}" points at a different folder than the one on disk ("${name}")`,
    );
  }
  for (const name of onDisk.keys()) {
    if (!slotForFolder(name)) parked.push(`${role}/${name}`);
  }
}
ok(`every bundled path-walker clip resolves on both facings, declarations = registry = disk (${enforced} clips)`);
if (stubs.length > 0) {
  console.log(`  · ${stubs.length} path-walker clip(s) await the art copy (stubs, not failures): ${stubs.join(', ')}`);
}
if (parked.length > 0) {
  console.log(
    `  · ${parked.length} clip folder(s) parked on purpose — no path attack, and no invented corpse: ${parked.join(', ')}`,
  );
}

/* --------------------------------------------------- 5 — the FSM ladder --- */

// The ladder's slots are the shared schema's slots, and the stall window is the
// one number the walk tick and this decision table both read.
for (const clip of CREEP_PATH_CLIPS) {
  assert.ok(
    CAST_CLIP_SLOTS.includes(clip),
    `creep clip "${clip}" is not in the shared cast schema (${CAST_CLIP_SLOTS.join('/')})`,
  );
}
assert.equal(CREEP_STILL_MS, 250, 'the stall window is ~0.25s (the walk tick keeps the same one)');
ok(`the ladder plays ${CREEP_PATH_CLIPS.join(' > ')} on the shared slot names, ${CREEP_STILL_MS}ms stall window`);

const ALL_FRAMES = { idle: 4, walk: 6, death: 9 };
assert.equal(creepClip({ dead: false, rate: 0.06, frames: ALL_FRAMES }), 'walk', 'advancing ⇒ walk');
assert.equal(creepClip({ dead: false, rate: 0, frames: ALL_FRAMES }), 'idle', 'stalled ⇒ idle');
assert.equal(creepClip({ dead: true, rate: 0, frames: ALL_FRAMES }), 'death', 'killed ⇒ death');
assert.equal(
  creepClip({ dead: true, rate: 0.06, frames: ALL_FRAMES }),
  'death',
  'death outranks walk — a corpse never walks away',
);
assert.equal(
  creepClip({ dead: true, rate: 0, frames: { walk: 6, idle: 4 } }),
  null,
  'no death art ⇒ no corpse (the engine removal is still the whole tell)',
);
assert.equal(
  creepClip({ dead: false, rate: 0, frames: { walk: 6 } }),
  null,
  'no idle art ⇒ hold the last walk frame, exactly as before K2',
);
assert.equal(
  creepClip({ dead: false, rate: 0.06, frames: { idle: 4 } }),
  null,
  'no walk art ⇒ keep the static rotation',
);
assert.equal(creepClip({ dead: false, rate: 0, frames: { idle: 1 } }), null, 'one frame is not a clip');
assert.equal(creepClip({ dead: false, rate: 0, frames: {} }), null, 'no art at all ⇒ nothing to play');
ok('creepClip resolves death > walk > idle and skips every unauthored slot');

assert.equal(castActorPathFrame('idle', 0, 0, 0, 4), 0, 'an idle loop starts at frame 0');
assert.equal(castActorPathFrame('idle', 4 * 200, 0, 0, 4), 0, 'an idle loop wraps (4 frames ≈ 0.8s)');
assert.notEqual(castActorPathFrame('idle', 0, 0, 1, 4), 0, 'the idle seed slides a creep out of lockstep');
assert.equal(castActorPathFrame('death', 0, 0, 0, 9), 0, 'a death one-shot starts at frame 0');
assert.equal(castActorPathFrame('death', 10 * 70, 0, 0, 9), 8, 'a death one-shot holds its last frame — no standing back up');
assert.equal(castActorPathFrame('death', 10 * 70, 0, 0, 1), 0, 'a single-frame clip is always frame 0');
ok('castActorPathFrame loops the idle and holds the death one-shot on its last frame');

// The data ⇄ FSM join: the frames declared in the skin are what the ladder
// answers with, per role. This is what makes a null `idle` on art that ships a
// Breathing_Idle folder a real, caught gap rather than a quiet fallback.
for (const { role } of PATH_ROSTER) {
  const def = walkerRoleDef(role);
  const frames = {
    walk: def.walk?.frames,
    idle: def.anims?.idle?.frames,
    death: def.anims?.death?.frames,
  };
  assert.equal(creepClip({ dead: false, rate: 1, frames }), 'walk', `${role}: walks while it advances`);
  assert.equal(
    creepClip({ dead: false, rate: 0, frames }),
    frames.idle ? 'idle' : null,
    `${role}: ${frames.idle ? 'breathes' : 'holds its walk frame'} when stalled`,
  );
  assert.equal(
    creepClip({ dead: true, rate: 0, frames }),
    frames.death ? 'death' : null,
    `${role}: ${frames.death ? 'plays a death one-shot' : 'vanishes on death'}`,
  );
}
const deathRoles = PATH_ROSTER.filter(({ role }) => walkerRoleDef(role).anims?.death);
const idleRoles = PATH_ROSTER.filter(({ role }) => walkerRoleDef(role).anims?.idle);
console.log(
  `  · idle wired for ${idleRoles.map((r) => r.name).join(' / ') || 'no path walker'} · ` +
    `death wired for ${deathRoles.map((r) => r.name).join(' / ') || 'no path walker'}`,
);
ok('every path-walker role answers the ladder with the frames its skin declares');

// No invented corpses: the two creeps whose packs ship no fall row must declare
// no `death`, so a kill there stays the instant removal it always was. This is
// the pin the alias check above cannot state on its own — the Wizard's, the
// Oni's and the Archangel's rows are the only three deaths the board may play.
for (const role of ['unit.puff', 'unit.tank'] as const) {
  assert.equal(
    walkerRoleDef(role).anims?.death,
    undefined,
    `${role}: its pack ships no death row — declaring one invents a corpse out of a ` +
      `slash or a wave. Leave it out; the engine removal is the tell.`,
  );
}
ok('the two art-less creeps still vanish on death (idle only, no faked corpse)');

// The board must actually ASK: data + a decision table nothing calls is the
// silent-empty failure this file exists to prevent.
assert.match(screen, /creepClip\(/, 'defend-screen resolves a path stance through creepClip');
assert.match(screen, /castActorPathFrame\('idle'/, 'defend-screen clocks the idle loop through the CastActor');
assert.match(screen, /castActorPathFrame\('death'/, 'defend-screen plays the death one-shot through the CastActor');
ok('the board is wired to the ladder (stance + both wall-clock clips)');

// A tree where NOTHING is bundled enforces nothing against the registry — say
// so loudly, because that is the shape a stale play-art-prep run or a forgotten
// art copy would take, and it must not read as "all good".
if (enforced === 0) {
  console.log(
    '  ! 0 path-walker clips bundled in this tree — clip→registry enforcement is dormant. ' +
      'Run `npx tsx scripts/play-art-prep.ts` after copying creep/boss animation art if that is unexpected.',
  );
}

console.log(`\nAll ${passed} path-walker kit checks passed.`);
