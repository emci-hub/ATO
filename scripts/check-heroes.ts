/**
 * Hero data-contract checks (Slice A1). Run: npx tsx scripts/check-heroes.ts
 *
 * Guards `src/play/data/heroes.json` — the contract the Avatar swap (A3) reads
 * to find a Hero's sprite clips. Four failure modes it catches:
 *
 *   1. IDs / required fields: five unique Hero ids, each with the folder,
 *      unlock lane, skillId and facings the contract promises.
 *   2. A Hero's `id` drifting from its art folder slug — the folder must be
 *      exactly `assets/play/skins/cast/heroes/<id>`, since A2's copy step and
 *      every registry key are derived from it.
 *   3. Clip names the art registry does not key — a clip folder renamed, or
 *      copied with its `N._` ordering prefix still on it, resolves to nothing
 *      and draws no animation.
 *   4. A truncated bundle: facings that disagree on frame count, or a registry
 *      with fewer frames than the PNGs on disk.
 *
 * A clip is ENFORCED as soon as its Hero's art is bundled — measured against
 * the generated registry, which IS tracked (the PNGs are not yet), so the same
 * clips are enforced on any clone. A clip whose Hero has no art at all is an
 * honest stub: reported, never failed. Corvus — the live Avatar — must always
 * be enforced, all six clips, whatever the tree looks like.
 *
 * Metro `require`s can't run under tsx, so the registry is scanned as TEXT
 * (same as kenney-check); disk frames are counted as files.
 *
 * Pure data + file reads — no React, network, or keys.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_AVATAR_HERO_ID,
  HERO_CLIPS,
  allHeroes,
  heroById,
  type HeroClip,
  type HeroDef,
} from '../src/play/heroes-data';

/** The Batch 1 roster, in authoring order. */
const EXPECTED_IDS = ['archangel', 'aurex', 'corvus', 'kitsune', 'oni'] as const;

/** A raw pack folder name leaked into the contract: `PLAGUE_IDLE-ab12cd34`. */
const HASH_SUFFIX = /-[0-9a-f]{8}$/;
/** A raw pack ordering prefix leaked in: `1._PLAGUE_IDLE`. */
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
function registryBase(hero: HeroDef, name: string): string {
  return `${hero.folder.replace(/^assets\/play\//, '')}/animations/${name}`;
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

/** On-disk clip folders by hash-stripped name: `Celestial_Drift-3cc23ab3`
 * → `Celestial_Drift`. The copied Cast packs are inconsistent about keeping the
 * pack hash (Corvus's folders don't, Archangel's do) but the registry key
 * never carries it, so the contract is spelled without it. */
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

const heroes = allHeroes();

// 1 — the roster itself.
assert.equal(heroes.length, EXPECTED_IDS.length, 'Batch 1 has five Heroes');
assert.deepEqual(
  [...heroes.map((hero) => hero.id)].sort(),
  [...EXPECTED_IDS].sort(),
  'roster ids are exactly the Batch 1 heroes',
);
assert.equal(new Set(heroes.map((hero) => hero.id)).size, heroes.length, 'ids are unique');
ok(`roster: ${heroes.length} heroes with unique ids (${EXPECTED_IDS.join(', ')})`);

// The loader's lookups actually reach the defs (the silent-empty failure).
for (const id of EXPECTED_IDS) {
  const hero = heroById(id);
  assert.ok(hero, `heroById('${id}') resolves`);
  assert.equal(hero.id, id);
  assert.equal(hero.role, 'hero');
  assert.equal(hero.face, 'ew');
  assert.ok(hero.folder.length > 0 && hero.skillId.length > 0, `${id} has folder + skillId`);
}
assert.equal(heroById('not_a_hero'), undefined, 'an unknown id resolves to undefined');
ok('heroById resolves every id and declines unknown ones');

assert.equal(DEFAULT_AVATAR_HERO_ID, 'corvus', 'Corvus stays the live Avatar');
assert.ok(heroById(DEFAULT_AVATAR_HERO_ID), 'the default Avatar id is a real Hero');
ok(`default Avatar is ${DEFAULT_AVATAR_HERO_ID}`);

// 2 — id ↔ art folder slug.
for (const hero of heroes) {
  assert.equal(
    hero.folder,
    `assets/play/skins/cast/heroes/${hero.id}`,
    `${hero.id}: folder must be the hero's own slug`,
  );
}
ok('every hero folder is assets/play/skins/cast/heroes/<id>');

// 3 + 4 — clip spelling, bundle completeness and the frames behind them.
/** Heroes whose at least one clip is bundled — art copied, so every clip of
 * theirs has to hold up. Art-detection reads the TRACKED registry, so this
 * answer does not depend on which PNGs a given working tree happens to have. */
let enforced = 0;
const stubs: string[] = [];

for (const hero of heroes) {
  const animations = path.join(repoRoot, hero.folder, 'animations');
  const onDisk = clipFolders(animations);
  const authored = Object.entries(hero.clips);
  assert.ok(authored.length > 0, `${hero.id}: authors at least one clip`);
  const clips = authored.map(([clip, name]) => ({ clip, name, base: registryBase(hero, name) }));
  const bundled = clips.some(({ base }) => registryFrames(base, 'east') > 0);

  for (const { clip, name, base } of clips) {
    assert.ok(
      HERO_CLIPS.includes(clip as HeroClip),
      `${hero.id}/${clip}: not a clip slot (${HERO_CLIPS.join('/')})`,
    );
    assert.doesNotMatch(name, HASH_SUFFIX, `${hero.id}/${clip}: "${name}" kept its pack hash`);
    assert.doesNotMatch(name, ORDER_PREFIX, `${hero.id}/${clip}: "${name}" kept its N._ prefix`);

    if (!bundled) {
      // The hero's art is not copied into the bundle at all — an honest stub.
      stubs.push(`${hero.id}/${clip}`);
      continue;
    }

    // The Hero is bundled: this clip must resolve, on both facings.
    for (const face of FACINGS) {
      const frames = registryFrames(base, face);
      assert.ok(
        frames >= MIN_FRAMES_PER_FACING,
        `${hero.id}/${clip}: registry has ${frames} ${face} frame(s) under ${base} — renamed, or copied with its N._ prefix`,
      );
    }
    assert.equal(
      registryFrames(base, 'east'),
      registryFrames(base, 'west'),
      `${hero.id}/${clip}: facings disagree on frame count`,
    );

    if (fs.existsSync(animations)) {
      const dirName = onDisk.get(name);
      assert.ok(
        dirName,
        `${hero.id}/${clip}: no "${name}" folder in ${hero.folder}/animations — renamed, or copied with its N._ prefix`,
      );
      for (const face of FACINGS) {
        const dir = path.join(animations, dirName, face);
        assert.equal(
          diskFrames(dir),
          registryFrames(base, face),
          `${hero.id}/${clip}/${face}: PNGs on disk and registry keys disagree (re-run play-art-prep)`,
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

// Corvus is the Hero that is live today: never a stub, whatever the tree holds.
const corvus = heroById('corvus');
assert.ok(corvus, 'corvus exists');
for (const clip of HERO_CLIPS) {
  assert.ok(corvus.clips[clip], `corvus authors the ${clip} clip`);
  assert.ok(!stubs.includes(`corvus/${clip}`), `corvus/${clip} is bundled (the live Avatar needs it)`);
}
assert.equal(
  Object.keys(corvus.clips).length,
  HERO_CLIPS.length,
  'corvus authors exactly the six clips',
);
assert.equal(corvus.skillId, 'black_death_ritual', 'corvus ships its own skill kit');
ok('corvus is fully specified and bundled: all six clips + its own skillId');

// Skill kits are per-hero (never a shared/default id).
assert.equal(
  new Set(heroes.map((hero) => hero.skillId)).size,
  heroes.length,
  'each hero brings its own skill kit',
);
ok('skill kit ids are per-hero (no shared kit)');

// The loader normalizes explicit `null`s away, so callers never see one.
for (const hero of heroes) {
  for (const [clip, name] of Object.entries(hero.clips)) {
    assert.equal(typeof name, 'string', `${hero.id}/${clip} normalized to a name`);
    assert.ok(name.length > 0);
  }
}
ok('partial clips normalize to authored keys only (nulls dropped)');

console.log(`\nAll ${passed} hero-contract checks passed.`);
