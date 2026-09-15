/**
 * Tower skin data-contract checks (K0/K1). Run: npx tsx scripts/check-towers.ts
 *
 * Guards `src/play/data/towerSkins.json` — the contract the board reads to find
 * a tower's idle loop + shoot one-shot (the same cast clip-kit schema heroes
 * use). The failure modes it catches mirror `check-heroes.ts`:
 *
 *   1. IDs / required fields: the nine skin ids (three defaults + six owned),
 *      each with a valid role, folder and unlock lane.
 *   2. A skin's `id` drifting from its art folder slug — the folder must be
 *      exactly `assets/play/skins/cast/towers/<id>`.
 *   3. Clip names the art registry does not key — a clip folder renamed, or
 *      copied with its `N._` ordering prefix still on it.
 *   4. A truncated bundle: facings that disagree on frame count, or a registry
 *      with fewer frames than the PNGs on disk.
 *   5. The reusable tower-kit template: a DEFAULT tower whose clip art IS
 *      bundled must author `idle` + `attack` (the shoot one-shot). Until the
 *      animation folders are copied (today: none exist — only rotations), a
 *      default is a stub and its missing clips are REPORTED, never failed.
 *
 * A clip is ENFORCED as soon as its skin's animation art is bundled — measured
 * against the generated registry (tracked), so the same clips hold on any
 * clone. A skin with no animation art at all is an honest stub.
 *
 * Metro `require`s can't run under tsx, so the registry is scanned as TEXT
 * (same as kenney-check / check-heroes); disk frames are counted as files.
 *
 * Pure data + file reads — no React, network, or keys.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { CAST_CLIP_SLOTS } from '../src/play/cast-kits';
import {
  TOWER_SKIN_ROLES,
  allTowerSkins,
  defaultTowerSkin,
  towerSkinById,
} from '../src/play/tower-skins-data';

/** The authored roster, in authoring order (towerSkins.json). */
const EXPECTED_IDS = [
  'viper',
  'ghost',
  'lux',
  'akira',
  'nova',
  'zero',
  'cyber-angel',
  'omega',
  'void',
] as const;

/** The three default skins the board actually draws today (one per tower role:
 * archer → viper, vine → ghost, crystal → lux). */
const EXPECTED_DEFAULT_IDS = ['viper', 'ghost', 'lux'] as const;

/** The clips a default tower must author once its animation art is bundled.
 * `idle` is the breathing loop; `attack` is the SHOOT one-shot (a pack that
 * names the folder `fire` is aliased to `attack` by the loader). */
const REQUIRED_DEFAULT_CLIPS = ['idle', 'attack'] as const;

/** A raw pack folder name leaked into the contract: `Breathing_Idle-ab12cd34`. */
const HASH_SUFFIX = /-[0-9a-f]{8}$/;
/** A raw pack ordering prefix leaked in: `1._Breathing_Idle`. */
const ORDER_PREFIX = /^\d+\._/;
/** Cast clips ship at least a couple of frames per facing, never one. */
const MIN_FRAMES_PER_FACING = 2;
const FACINGS = ['east', 'west'] as const;

const repoRoot = path.resolve(__dirname, '..');
const registryText = fs.readFileSync(
  path.resolve(repoRoot, 'src/play/generated-play-assets.ts'),
  'utf8',
);

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/** Registry key base for a clip: repo-relative, no `assets/play/` prefix. */
function registryBase(folder: string, name: string): string {
  return `${folder.replace(/^assets\/play\//, '')}/animations/${name}`;
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

/** On-disk clip folders by hash-stripped name. */
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

const skins = allTowerSkins();

// 1 — the roster itself.
assert.equal(skins.length, EXPECTED_IDS.length, 'the roster has nine skins');
assert.deepEqual(
  [...skins.map((skin) => skin.id)].sort(),
  [...EXPECTED_IDS].sort(),
  'roster ids are exactly the authored skins',
);
assert.equal(new Set(skins.map((skin) => skin.id)).size, skins.length, 'ids are unique');
ok(`roster: ${skins.length} skins with unique ids (${EXPECTED_IDS.join(', ')})`);

// The loader's lookups actually reach the defs (the silent-empty failure).
for (const id of EXPECTED_IDS) {
  const skin = towerSkinById(id);
  assert.ok(skin, `towerSkinById('${id}') resolves`);
  assert.equal(skin.id, id);
  assert.ok(
    TOWER_SKIN_ROLES.includes(skin.role),
    `${id} has a valid role (${skin.role})`,
  );
  assert.ok(skin.folder.length > 0, `${id} has a folder`);
}
assert.equal(towerSkinById('not_a_skin'), undefined, 'an unknown id resolves to undefined');
ok('towerSkinById resolves every id and declines unknown ones');

// The default mapping the board uses to resolve a placed tower's kit.
assert.equal(defaultTowerSkin('archer')?.id, 'viper', 'archer → viper');
assert.equal(defaultTowerSkin('vine')?.id, 'ghost', 'vine → ghost');
assert.equal(defaultTowerSkin('crystal')?.id, 'lux', 'crystal → lux');
assert.equal(defaultTowerSkin('archer')?.isDefault, true, 'viper is flagged default');
ok('defaultTowerSkin maps archer→viper, vine→ghost, crystal→lux');

// 2 — id ↔ art folder slug.
for (const skin of skins) {
  assert.equal(
    skin.folder,
    `assets/play/skins/cast/towers/${skin.id}`,
    `${skin.id}: folder must be the skin's own slug`,
  );
}
ok('every tower folder is assets/play/skins/cast/towers/<id>');

// 3 + 4 — clip spelling, bundle completeness and the frames behind them.
let enforced = 0;
const stubs: string[] = [];
const bundledSkinIds = new Set<string>();

for (const skin of skins) {
  const animations = path.join(repoRoot, skin.folder, 'animations');
  const onDisk = clipFolders(animations);
  const clips = Object.entries(skin.clips).map(([clip, name]) => ({
    clip,
    name,
    base: registryBase(skin.folder, name),
  }));
  const bundled = clips.some(({ base }) => registryFrames(base, 'east') > 0);
  if (bundled) bundledSkinIds.add(skin.id);

  for (const { clip, name, base } of clips) {
    assert.ok(
      CAST_CLIP_SLOTS.includes(clip as (typeof CAST_CLIP_SLOTS)[number]),
      `${skin.id}/${clip}: not a clip slot (${CAST_CLIP_SLOTS.join('/')})`,
    );
    assert.doesNotMatch(name, HASH_SUFFIX, `${skin.id}/${clip}: "${name}" kept its pack hash`);
    assert.doesNotMatch(name, ORDER_PREFIX, `${skin.id}/${clip}: "${name}" kept its N._ prefix`);

    if (!bundled) {
      // The skin's animation art is not copied into the bundle — an honest stub.
      stubs.push(`${skin.id}/${clip}`);
      continue;
    }

    for (const face of FACINGS) {
      const frames = registryFrames(base, face);
      assert.ok(
        frames >= MIN_FRAMES_PER_FACING,
        `${skin.id}/${clip}: registry has ${frames} ${face} frame(s) under ${base} — renamed, or copied with its N._ prefix`,
      );
    }
    assert.equal(
      registryFrames(base, 'east'),
      registryFrames(base, 'west'),
      `${skin.id}/${clip}: facings disagree on frame count`,
    );

    if (fs.existsSync(animations)) {
      const dirName = onDisk.get(name);
      assert.ok(
        dirName,
        `${skin.id}/${clip}: no "${name}" folder in ${skin.folder}/animations — renamed, or copied with its N._ prefix`,
      );
      for (const face of FACINGS) {
        const dir = path.join(animations, dirName, face);
        assert.equal(
          diskFrames(dir),
          registryFrames(base, face),
          `${skin.id}/${clip}/${face}: PNGs on disk and registry keys disagree (re-run play-art-prep)`,
        );
      }
    }
    enforced += 1;
  }
}
ok(`every bundled clip resolves on both facings, frames on disk = frames registered (${enforced} clips)`);
if (stubs.length > 0) {
  console.log(
    `  · ${stubs.length} clip(s) await the art copy (stubs, not failures): ${stubs.join(', ')}`,
  );
}

// 5 — the reusable tower-kit template. A default tower whose clip art IS
// bundled must author idle + attack (its shoot one-shot), so a kit can never
// ship as "static forever but fires" — the moment its animation folders land it
// must name both. Today no tower animation folders exist, so this rule is
// dormant and the defaults are honest stubs.
for (const id of EXPECTED_DEFAULT_IDS) {
  const skin = towerSkinById(id);
  assert.ok(skin, `${id}: a default tower must exist`);
  if (!bundledSkinIds.has(id)) continue;
  for (const clip of REQUIRED_DEFAULT_CLIPS) {
    assert.ok(
      skin.clips[clip],
      `${id}: art is bundled but "${clip}" is null — a default tower with no ${clip} ` +
        `plays no ${clip === 'attack' ? 'shot' : 'breathing loop'}. Copy the ${clip} clip folder and name it here (see tower-skins-data.ts).`,
    );
  }
}
ok(
  `bundled default tower art authors ${REQUIRED_DEFAULT_CLIPS.join(' + ')} ` +
    `(${[...bundledSkinIds].sort().join(', ') || 'none bundled yet'})`,
);

// The defaults' missing clips are REPORTED, not failed (their animation folders
// aren't copied yet). Surfaced so a gap is always a decision, never unnoticed.
const unfilled = EXPECTED_DEFAULT_IDS.flatMap((id) => {
  const skin = towerSkinById(id);
  if (!skin) return [];
  return REQUIRED_DEFAULT_CLIPS.filter((clip) => !skin.clips[clip]).map((clip) => `${id}/${clip}`);
});
if (unfilled.length > 0) {
  console.log(
    `  · default tower slot(s) with no authored clip (reported, not failed — ` +
      `the tower stays a static rotation until the folder is copied): ${unfilled.join(', ')}`,
  );
}

// A tree where NOTHING is bundled enforces nothing against the registry — say so
// loudly, because that is the shape a stale play-art-prep run or a forgotten art
// copy would take, and it must not read as "all good".
if (enforced === 0) {
  console.log(
    '  ! 0 tower clips bundled in this tree — clip→registry enforcement is dormant. ' +
      'Run `npx tsx scripts/play-art-prep.ts` after copying tower animation art if that is unexpected.',
  );
}

console.log(`\nAll ${passed} tower-kit checks passed.`);
