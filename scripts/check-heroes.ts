/**
 * Hero data-contract checks (Slice A1). Run: npx tsx scripts/check-heroes.ts
 *
 * Guards `src/play/data/heroes.json` — the contract the Avatar swap (A3) reads
 * to find a Hero's sprite clips. Four failure modes it catches:
 *
 *   1. IDs / required fields: sixteen unique Hero ids, each with the folder,
 *      unlock lane, skillId and facings the contract promises.
 *   2. A Hero's `id` drifting from its art folder slug — the folder must be
 *      exactly `assets/play/skins/cast/heroes/<id>`, since A2's copy step and
 *      every registry key are derived from it.
 *   3. Clip names the art registry does not key — a clip folder renamed, or
 *      copied with its `N._` ordering prefix still on it, resolves to nothing
 *      and draws no animation.
 *   4. A truncated bundle: facings that disagree on frame count, or a registry
 *      with fewer frames than the PNGs on disk.
 *   5. The reusable-hero-kit template (A3): a Hero whose art IS bundled must
 *      author `attack` + `skill`, and the Avatar-reachable Heroes must author
 *      both even before their art lands — so a kit can never ship idle-only.
 *      The remaining template slots are reported, not failed.
 *
 * A clip is ENFORCED as soon as its Hero's art is bundled — measured against
 * the generated registry, which IS tracked (the PNGs are not yet), so the same
 * clips are enforced on any clone. A clip whose Hero has no art at all is an
 * honest stub: reported, never failed.
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
  boundHeroTowerClips,
  heroById,
  heroName,
  type HeroClip,
  type HeroDef,
} from '../src/play/heroes-data';
import {
  BOUND_HERO_MAX,
  bindHeroAsTower,
  boundHeroIdsOf,
  clearHeroOffer,
  defaultPlayStore,
  devClearHeroOffer,
  devClearOwnedHeroes,
  devOwnAllHeroes,
  devOwnHero,
  devSetAvatarHero,
  heroOwned,
  ownHero,
  parsePlayStore,
  playView,
  recordDefendWin,
  setAvatarHero,
} from '../src/play/playStore';
import {
  BOUND_BOSS_MAX_ON_BOARD,
  HERO_TOWER_SKILL_COOLDOWN_MS,
  HERO_TOWER_STATS,
  TOWER_SKILL_DAMAGE_MULT,
  boundBossHeroId,
  createDefendLive,
  heroTowerTarget,
  isHeroBoundTower,
  placeBoundBoss,
  puffPosition,
  removeBoundBoss,
  stepDefendLive,
  type Puff,
} from '../src/play/defend';
import { BOARD_MAPS } from '../src/play/board-data';

/** The full hero roster (Batch 1 + Batch 2 + Batch 3), in authoring order. */
const EXPECTED_IDS = [
  'archangel',
  'aurex',
  'corvus',
  'kitsune',
  'oni',
  'cyber-shinobi',
  'elowen',
  'kael',
  'maldrath',
  'morwen',
  'neon-viper',
  'raven',
  'sak',
  'frost-lich',
  'velkhar',
  'void-raven',
] as const;

/** Heroes reachable as the Avatar TODAY: the airport free loop owns EVERY hero
 * on Play load (`free_farm` — no Premium while PRE_LAUNCH_DEV), so all sixteen
 * must author `attack` + `skill` whatever this tree has copied. */
const AVATAR_READY_IDS = EXPECTED_IDS;

/** The clips a Hero must author once its art is bundled. `idle`/`walk`/`dash`
 * alone make a kit that can only move; an Avatar also has to hit and cast. */
const REQUIRED_BUNDLED_CLIPS = ['attack', 'skill'] as const;

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
assert.equal(heroes.length, EXPECTED_IDS.length, 'the roster has sixteen Heroes');
assert.deepEqual(
  [...heroes.map((hero) => hero.id)].sort(),
  [...EXPECTED_IDS].sort(),
  'roster ids are exactly the authored heroes',
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
/** Heroes with at least one clip bundled in this tree — the ones the template
 * guard below can hold to the registry. */
const bundledHeroIds = new Set<string>();

for (const hero of heroes) {
  const animations = path.join(repoRoot, hero.folder, 'animations');
  const onDisk = clipFolders(animations);
  const authored = Object.entries(hero.clips);
  assert.ok(authored.length > 0, `${hero.id}: authors at least one clip`);
  const clips = authored.map(([clip, name]) => ({ clip, name, base: registryBase(hero, name) }));
  const bundled = clips.some(({ base }) => registryFrames(base, 'east') > 0);
  if (bundled) bundledHeroIds.add(hero.id);

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

// 5 — the reusable-kit template (A3). Two rules, so a Hero kit can never ship
// as "walks and idles but never hits": art that IS bundled must author attack +
// skill, and the Avatar-reachable Heroes must author both regardless of what
// this tree happens to have copied. Every hero is now free/owned (airport), so
// every one is held to rule 1 the moment its art lands.
for (const hero of heroes) {
  if (!bundledHeroIds.has(hero.id)) continue;
  for (const clip of REQUIRED_BUNDLED_CLIPS) {
    assert.ok(
      hero.clips[clip],
      `${hero.id}: art is bundled but "${clip}" is null — a bound/owned Hero with no ${clip} ` +
        `plays no one-shot. Copy the ${clip} clip folder and name it here (see heroes-data.ts).`,
    );
  }
}
ok(
  `bundled Hero art authors ${REQUIRED_BUNDLED_CLIPS.join(' + ')} ` +
    `(${[...bundledHeroIds].sort().join(', ')})`,
);

for (const id of AVATAR_READY_IDS) {
  const hero = heroById(id);
  assert.ok(hero, `${id}: an Avatar-reachable Hero must exist`);
  for (const clip of REQUIRED_BUNDLED_CLIPS) {
    assert.ok(
      hero.clips[clip],
      `${id} is reachable as the Avatar and must author "${clip}" — a Hero you can fight as ` +
        `whose ${clip} is null (or whose ${clip} art was never copied) plays no ${clip} at all.`,
    );
  }
}
ok(
  `Avatar-reachable Heroes author ${REQUIRED_BUNDLED_CLIPS.join(' + ')} ` +
    `(${AVATAR_READY_IDS.join(', ')})`,
);

// The other template slots (idle / walk / dash / hurt) are reported, not failed:
// a Hero missing one simply plays no one-shot for it — the clip player skips it
// and never invents a frame — and a slot can legitimately be null because the
// art pack has no such clip (Crimson Oni ships no flinch). Surfaced so a gap is
// always a decision someone made, never something nobody noticed.
const unfilled = AVATAR_READY_IDS.flatMap((id) => {
  const hero = heroById(id);
  if (!hero) return [];
  return HERO_CLIPS.filter((clip) => !hero.clips[clip]).map((clip) => `${id}/${clip}`);
});
if (unfilled.length > 0) {
  console.log(
    `  · Avatar-reachable Hero slot(s) with no authored clip (reported, not failed — ` +
      `that one-shot is skipped): ${unfilled.join(', ')}`,
  );
}

// Corvus — the STARTER Hero, owned on every save — is held to its own skillId
// and to having no unknown clip slot, on top of the six-slot rule above. The
// three Avatar-reachable Heroes are checked as a set by the template guard; this
// block pins the one piece that is Corvus-specific (its kit id).
const corvus = heroById('corvus');
assert.ok(corvus, 'corvus exists');
for (const clip of HERO_CLIPS) {
  assert.ok(corvus.clips[clip], `corvus authors the ${clip} clip`);
}
assert.equal(
  Object.keys(corvus.clips).length,
  HERO_CLIPS.length,
  'corvus authors exactly the six clips',
);
assert.equal(corvus.skillId, 'black_death_ritual', 'corvus ships its own skill kit');
assert.equal(
  Object.keys(corvus.clips).some((clip) => !HERO_CLIPS.includes(clip as HeroClip)),
  false,
  'corvus authors no unknown clip slot',
);
const corvusArtBundled = HERO_CLIPS.every((clip) => !stubs.includes(`corvus/${clip}`));
ok(
  `corvus is fully specified in the contract: six clips + its own skillId` +
    (corvusArtBundled ? ' (art bundled + enforced)' : ' (art not bundled in this tree)'),
);

// A tree where NOTHING is bundled enforces nothing against the registry — say so
// loudly, because that is the shape a stale play-art-prep run or a forgotten art
// copy would take, and it must not read as "all good".
if (enforced === 0) {
  console.log(
    '  ! 0 heroes bundled in this tree — clip→registry enforcement is dormant. ' +
      'Run `npx tsx scripts/play-art-prep.ts` after copying hero art if that is unexpected.',
  );
}

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

for (const hero of heroes) {
  assert.equal(typeof hero.name, 'string', `${hero.id} has a display name`);
  assert.ok(hero.name.length > 0, `${hero.id} display name is non-empty`);
  assert.equal(heroName(hero.id), hero.name, `heroName('${hero.id}') reads it back`);
  // The Dress roster's locked rows have no other source for the earn hint.
  assert.equal(typeof hero.acquire, 'string', `${hero.id} has an acquire hint`);
  assert.ok(hero.acquire.length > 0, `${hero.id} acquire hint is non-empty`);
}
assert.equal(heroName('nobody'), 'nobody', 'an unknown hero name falls back to the id');
ok('every hero carries a display name + an acquire hint (Dress locked rows)');

/* ------------------------------------------------------------------ A2 -----
 * Ownership + the Avatar / Bound-Boss exclusivity rules. The store is pure, so
 * the whole contract is assertable offline — this is where "same hero cannot be
 * Avatar AND tower", the bind cap, and the one-shot offer are actually held.
 * ------------------------------------------------------------------------- */

const base = defaultPlayStore(0);
assert.deepEqual(base.owned_hero_ids, ['corvus'], 'a fresh save owns the starter hero');
assert.equal(base.active_avatar_hero_id, 'corvus', 'and has it as the active Avatar hero');
assert.equal(base.hero_offer, null, 'with no offer queued');
assert.deepEqual(boundHeroIdsOf(base), [], 'and nothing bound');
ok('a fresh save starts with the starter hero owned + active');

// First own queues the offer; a repeat own is silent.
const owned = ownHero(base, 'archangel');
assert.equal(owned.gained, true, 'owning a new hero gains it');
assert.ok(heroOwned(owned.doc, 'archangel'), 'the hero is owned');
assert.deepEqual(owned.doc.hero_offer, { hero_id: 'archangel', label: 'Archangel' }, 'offer queued');
assert.equal(ownHero(owned.doc, 'archangel').gained, false, 'owning twice is a no-op');
assert.equal(ownHero(base, 'nobody').gained, false, 'an unknown hero is never owned');
ok('ownHero queues a one-shot offer and refuses unknown / repeat owns');

// Exclusivity A: binding refuses while the hero is the active Avatar.
const asAvatar = setAvatarHero(owned.doc, 'archangel');
assert.equal(asAvatar.ok, true, 'an owned hero can be set as the Avatar');
assert.equal(asAvatar.reason, null);
assert.equal(asAvatar.doc.active_avatar_hero_id, 'archangel');
assert.equal(asAvatar.doc.hero_offer, null, 'setting the Avatar clears the offer');
const refusedBind = bindHeroAsTower(asAvatar.doc, 'archangel');
assert.equal(refusedBind.ok, false, 'the active Avatar hero cannot also be bound');
assert.equal(refusedBind.reason, 'active_avatar');
assert.equal(refusedBind.doc, asAvatar.doc, 'a refused bind does not touch the save');
assert.equal(setAvatarHero(base, 'aurex').reason, 'not_owned', 'an unowned hero cannot be set');
assert.equal(setAvatarHero(base, 'nobody').reason, 'unknown_hero', 'an unknown hero cannot be set');
ok('binding an active Avatar hero is refused (unequip as Avatar first)');

// Exclusivity B: binding works once the Avatar moved away, and switching the
// Avatar back to a bound hero gives up the bind in the same write.
const backToCorvus = setAvatarHero(asAvatar.doc, 'corvus');
assert.equal(backToCorvus.ok, true, 'switching back to the starter works');
const bound = bindHeroAsTower(backToCorvus.doc, 'archangel');
assert.equal(bound.ok, true, 'a non-Avatar owned hero binds');
assert.deepEqual(boundHeroIdsOf(bound.doc), ['archangel'], 'the hero is bound');
assert.equal(bound.doc.bound_bosses.at(-1)?.stars, 1, 'bound at ★1 (A5/A6 def comes later)');
assert.equal(bound.doc.bound_bosses.at(-1)?.bound_wave, null, 'no wave recorded yet');
const rebound = bindHeroAsTower(bound.doc, 'archangel');
assert.equal(rebound.ok, true, 'binding twice succeeds (idempotent)');
assert.equal(rebound.doc, bound.doc, 'and writes nothing — no duplicate record');
const backAsAvatar = setAvatarHero(bound.doc, 'archangel');
assert.equal(backAsAvatar.ok, true, 'a bound hero can still be set as the Avatar');
assert.deepEqual(boundHeroIdsOf(backAsAvatar.doc), [], 'setting it as Avatar unbinds it');
assert.equal(backAsAvatar.doc.active_avatar_hero_id, 'archangel');
ok('Avatar/bound exclusivity holds in both directions');

// The bind cap counts HERO bindings only, and the cycle boss never eats a slot.
const capBase = setAvatarHero(ownHero(owned.doc, 'oni').doc, 'corvus').doc;
const twoBound = bindHeroAsTower(bindHeroAsTower(capBase, 'archangel').doc, 'oni');
assert.equal(twoBound.ok, true, 'a second hero binds');
assert.equal(boundHeroIdsOf(twoBound.doc).length, BOUND_HERO_MAX, 'the cap is filled');
assert.equal(
  bindHeroAsTower(twoBound.doc, 'aurex').reason,
  'not_owned',
  'an unowned hero is refused before the cap is consulted',
);
const withAurex = ownHero(twoBound.doc, 'aurex').doc;
assert.equal(
  bindHeroAsTower(withAurex, 'aurex').reason,
  'cap',
  `a third hero binding is refused at BOUND_HERO_MAX (${BOUND_HERO_MAX})`,
);
// The cycle boss's own record is not a hero, so it never consumes a hero slot.
const withCycleBoss = {
  ...twoBound.doc,
  bound_bosses: [
    { id: 'ember_sovereign', stars: 3, frags: 0, bound_wave: 19 },
    ...twoBound.doc.bound_bosses,
  ],
};
assert.equal(boundHeroIdsOf(withCycleBoss).length, BOUND_HERO_MAX, 'Ember is not counted as a hero binding');
// A stars-0 record means "fragments only, no tower yet" — it must not eat a
// slot, and binding that hero upgrades the record in place (frags survive).
const fragsOnly = {
  ...ownHero(capBase, 'aurex').doc,
  bound_bosses: [{ id: 'aurex', stars: 0, frags: 2, bound_wave: null }],
};
assert.deepEqual(boundHeroIdsOf(fragsOnly), [], 'a stars-0 hero record is not a bind');
const upgraded = bindHeroAsTower(fragsOnly, 'aurex');
assert.equal(upgraded.ok, true, 'binding a fragments-only hero works');
assert.equal(upgraded.doc.bound_bosses[0]?.stars, 1, 'and upgrades it to ★1 in place');
assert.equal(upgraded.doc.bound_bosses[0]?.frags, 2, 'keeping its fragments');
assert.equal(upgraded.doc.bound_bosses.length, 1, 'with no duplicate record');
ok(`hero bindings cap at ${BOUND_HERO_MAX} (the cycle boss does not consume a slot)`);

// The grant path: a CAMPAIGN clear of a hero band first-owns its hero, and a
// replay of the same band never re-grants or re-offers.
const NEVER_ROLLS = () => 1; // above every drop/fragment/star roll in the win path
const scoutClear = recordDefendWin(
  { ...base, campaign: { phase: 'main', wave_in_phase: 5 } },
  { phase: 'main', wave: 5, mode: 'campaign' },
  0,
  NEVER_ROLLS,
);
assert.deepEqual(scoutClear.result.heroOwned, { heroId: 'oni', label: 'Crimson Oni' }, 'Main w5 grants Oni');
assert.ok(heroOwned(scoutClear.doc, 'oni'), 'Oni is owned by the win');
assert.equal(scoutClear.doc.hero_offer?.hero_id, 'oni', 'and its offer is queued for the sheet');
const finalClear = recordDefendWin(
  { ...base, campaign: { phase: 'main', wave_in_phase: 10 } },
  { phase: 'main', wave: 10, mode: 'campaign' },
  0,
  NEVER_ROLLS,
);
assert.deepEqual(finalClear.result.heroOwned, { heroId: 'archangel', label: 'Archangel' }, 'Main w10 grants Archangel');
const scoutReplay = recordDefendWin(
  { ...base, campaign: { phase: 'main', wave_in_phase: 5 } },
  { phase: 'main', wave: 5, mode: 'replay' },
  0,
  NEVER_ROLLS,
);
assert.equal(scoutReplay.result.heroOwned, null, 'a replay never grants a hero');
assert.deepEqual(scoutReplay.doc.owned_hero_ids, ['corvus'], 'and owns nothing new');
const trialMini = recordDefendWin(
  { ...base, campaign: { phase: 'trial', wave_in_phase: 5 } },
  { phase: 'trial', wave: 5, mode: 'campaign' },
  0,
  NEVER_ROLLS,
);
assert.equal(trialMini.result.heroOwned, null, 'the Trial scout MINI-boss grants no hero');
const alreadyOwned = recordDefendWin(
  { ...ownHero(base, 'oni').doc, campaign: { phase: 'main', wave_in_phase: 5 } },
  { phase: 'main', wave: 5, mode: 'campaign' },
  0,
  NEVER_ROLLS,
);
assert.equal(alreadyOwned.result.heroOwned, null, 'a re-clear of an owned band stays silent');
ok('Main w5 grants Oni and Main w10 grants Archangel — campaign clears only');

// The v17→v18 migration: an old save opens and gains the new fields without
// losing anything it already had. This is the whole risk of the version bump.
const v17 = JSON.stringify({
  ...base,
  version: 17,
  tokens: 1234,
  owned_hero_ids: undefined,
  active_avatar_hero_id: undefined,
  hero_offer: undefined,
  bound_bosses: [{ id: 'ember_sovereign', stars: 2, frags: 1, bound_wave: 19 }],
  avatars: [{ id: 'ava_sprout', xp: 5, level: 7, stars: 2, equipped: {}, park: {} }],
  active_avatar_id: 'ava_sprout',
  lifetime_waves_cleared: 42,
});
const migrated = parsePlayStore(v17, 0);
assert.ok(migrated, 'a v17 save still parses');
assert.equal(migrated.version, 18, 'and is written back as v18');
assert.equal(migrated.tokens, 1234, 'its tokens survive');
assert.equal(migrated.lifetime_waves_cleared, 42, 'its lifetime clears survive');
assert.equal(migrated.avatars[0]?.level, 7, 'its Avatar level survives');
assert.deepEqual(migrated.owned_hero_ids, ['corvus'], 'and it owns the starter hero');
assert.equal(migrated.active_avatar_hero_id, 'corvus', 'with the starter as its Avatar hero');
assert.equal(migrated.hero_offer, null, 'and nothing queued');
assert.deepEqual(boundHeroIdsOf(migrated), [], 'its Ember bind is not mistaken for a hero bind');
assert.equal(migrated.bound_bosses[0]?.stars, 2, 'and the cycle boss keeps its stars');
// A save naming heroes this build does not have must not carry them forward.
const stale = parsePlayStore(
  JSON.stringify({
    ...base,
    version: 18,
    owned_hero_ids: ['corvus', 'hero_that_left', 'oni'],
    active_avatar_hero_id: 'hero_that_left',
    hero_offer: { hero_id: 'hero_that_left', label: 'Gone' },
  }),
  0,
);
assert.deepEqual(stale?.owned_hero_ids, ['corvus', 'oni'], 'unknown hero ids are dropped');
assert.equal(stale?.active_avatar_hero_id, 'corvus', 'a stale active Avatar hero falls back to the starter');
assert.equal(stale?.hero_offer, null, 'a stale queued offer clears rather than throwing');
assert.equal(parsePlayStore('not json', 0), null, 'unreadable storage returns null, never throws');
ok('v17 saves migrate to v18 and stale hero ids are dropped');

// The dev affordance has to be re-runnable: tapping "Own Archangel" again after
// the sheet was dismissed must re-show it, or the sheet is testable once per
// hero per save (ownHero alone is idempotent and would no-op).
const devReoffer = devOwnHero(clearHeroOffer(ownHero(base, 'archangel').doc), 'archangel');
assert.equal(devReoffer.hero_offer?.hero_id, 'archangel', 'a dev own re-queues the offer');
assert.equal(devOwnHero(base, 'nobody'), base, 'a dev own of an unknown hero writes nothing');
ok('the dev "own hero" rows re-queue the offer, so the sheet is repeatable');

// The Hero roster in Dress reads the VIEW, so the view has to carry the owned
// set + active hero — a plumbing regression there would show every hero locked.
const view = playView(base, 0);
assert.deepEqual([...view.ownedHeroIds], ['corvus'], 'the view exposes the owned hero ids');
assert.equal(view.activeAvatarHeroId, 'corvus', 'and the active Avatar hero');
assert.deepEqual([...view.boundHeroIds], [], 'and the bound hero ids');
assert.equal(view.heroOffer, null, 'and the queued offer');
const ownedView = playView(asAvatar.doc, 0);
assert.equal(ownedView.activeAvatarHeroId, 'archangel', 'the view follows a set Avatar hero');
assert.ok(ownedView.ownedHeroIds.includes('archangel'), 'including ownership');
ok('the view carries the hero fields the Dress roster renders');

// Dev: own-all owns every authored hero (and queues no single hero's offer).
const allOwned = devOwnAllHeroes(clearHeroOffer(base));
for (const hero of heroes) {
  assert.ok(heroOwned(allOwned, hero.id), `own-all owns ${hero.id}`);
}
assert.equal(allOwned.hero_offer, null, 'own-all queues no offer');
assert.equal(devOwnAllHeroes(allOwned), allOwned, 'own-all is idempotent');
ok('own-all owns every hero in heroes.json and queues nothing');

// Dev: "Set Avatar → X" auto-owns first, so the row works from a fresh save.
const devSet = devSetAvatarHero(base, 'oni');
assert.equal(devSet.active_avatar_hero_id, 'oni', 'a dev set switches the Avatar hero');
assert.ok(heroOwned(devSet, 'oni'), 'auto-owning it on the way');
assert.equal(devSetAvatarHero(base, 'nobody'), base, 'a dev set of an unknown hero writes nothing');
assert.equal(
  devSetAvatarHero(base, 'aurex').active_avatar_hero_id,
  'aurex',
  'an unowned hero is owned then set (the dev speed hatch)',
);
// The dev setter goes through the real setter, so exclusivity still holds.
const devSetUnbinds = devSetAvatarHero(bound.doc, 'archangel');
assert.deepEqual(boundHeroIdsOf(devSetUnbinds), [], 'a dev set still unbinds that hero');
ok('the dev set Avatar row auto-owns and still honours exclusivity');

// Dev: clear-owned back to just the starter. Hero BINDINGS go too (a bound hero
// the save no longer owns would break "bound ⊆ owned"), but the cycle boss and
// its stars are not a hero and must survive.
const cleared = devClearOwnedHeroes({
  ...bound.doc,
  bound_bosses: [
    { id: 'ember_sovereign', stars: 3, frags: 1, bound_wave: 19 },
    ...bound.doc.bound_bosses,
  ],
  hero_offer: { hero_id: 'oni', label: 'Crimson Oni' },
});
assert.deepEqual(cleared.owned_hero_ids, ['corvus'], 'clear-owned leaves only the starter');
assert.equal(cleared.active_avatar_hero_id, 'corvus', 'and makes it the active Avatar hero');
assert.deepEqual(boundHeroIdsOf(cleared), [], 'dropping the hero bindings');
assert.equal(cleared.bound_bosses.length, 1, 'but keeping the cycle boss');
assert.equal(cleared.bound_bosses[0]?.id, 'ember_sovereign', 'which is the one left');
assert.equal(cleared.bound_bosses[0]?.stars, 3, 'with its stars intact');
assert.equal(cleared.hero_offer, null, 'and no offer left queued');
assert.equal(devClearOwnedHeroes(cleared), cleared, 'clear-owned is idempotent');
assert.equal(devClearOwnedHeroes(base), base, 'and writes nothing when already clear');
const clearOffer = devClearHeroOffer({ ...base, hero_offer: { hero_id: 'oni', label: 'Crimson Oni' } });
assert.equal(clearOffer.hero_offer, null, 'clear-offer drops the queue');
assert.equal(devClearHeroOffer(base), base, 'and is a no-op when empty');
ok('clear-owned resets to Corvus, drops hero binds, keeps the cycle boss');

/* ------------------------------------------------------- A6 prep --------
 * A hero bound as a tower resolves its idle/attack/skill clips through the
 * SAME `heroes.json` clips the Avatar uses (`resolveBoundHeroTowerKit` in
 * skin.ts, not importable here because it reads the Metro art registry).
 * `boundHeroTowerClips` is the pure data read both share — assert the resolve
 * path's source of truth, pinned to Archangel so its skill clip is testable
 * the day A6 places it. */
const archangelTower = boundHeroTowerClips(heroById('archangel')!);
assert.equal(archangelTower.idle, 'Hover_Idle', 'archangel tower idle clip');
assert.equal(archangelTower.attack, 'Attack_01_Seraph_Strike', 'archangel tower attack clip');
assert.equal(
  archangelTower.skill,
  'Ultimate_Final_Judgment',
  'archangel tower skill clip (the resolve path has a real skill one-shot)',
);
for (const hero of heroes) {
  const tower = boundHeroTowerClips(hero);
  // A hero that authors a skill contributes it to its bound-tower kit.
  if (hero.clips.skill) {
    assert.equal(
      tower.skill,
      hero.clips.skill,
      `${hero.id}: the bound-tower kit carries the hero's skill clip`,
    );
  }
}
ok('boundHeroTowerClips resolves each hero to its tower subset (idle/attack/skill)');

/* ------------------------------------------------------------- A6 --------
 * Bound Boss PLACE: a hero bound as a tower places on a pad (FREE for v1),
 * auto-attacks like a crystal/chunk tower, and auto-casts its skill when the
 * hero authors `clips.skill` (Archangel Ultimate / Oni Iaijutsu). The engine
 * (`defend.ts`) is pure, so the whole place/remove/combat contract is
 * assertable offline.
 * ------------------------------------------------------------------------- */

// The documented stats pick: crystal-like, and FREE place for v1.
assert.equal(HERO_TOWER_STATS.placeCost, 0, 'a hero tower places free for v1 (economy TBD)');
assert.ok(HERO_TOWER_STATS.baseAttack > 0 && HERO_TOWER_STATS.cooldownMs > 0 && HERO_TOWER_STATS.range > 0, 'hero tower has a full stat block');
assert.equal(HERO_TOWER_SKILL_COOLDOWN_MS, 12_000, 'hero tower skill CD mirrors the archer tower default');
assert.equal(isHeroBoundTower('archangel'), true, 'archangel is a hero tower');
assert.equal(isHeroBoundTower('oni'), true, 'oni is a hero tower');
assert.equal(isHeroBoundTower('ember_sovereign'), false, 'the cycle boss is not a hero tower');
assert.equal(isHeroBoundTower('nobody'), false, 'an unknown id is not a hero tower');
ok('hero-tower stats are fixed + free, and isHeroBoundTower splits hero vs cycle boss');

// Cycle-boss ART mapping (PRODUCT LOCK): the Final cycle boss draws the
// Archangel kit; a hero tower resolves itself; an unmapped id has no hero art.
assert.equal(boundBossHeroId('ember_sovereign'), 'archangel', 'the Final cycle boss draws Archangel');
assert.equal(boundBossHeroId('archangel'), 'archangel', 'a hero tower resolves its own hero id');
assert.equal(boundBossHeroId('oni'), 'oni', 'Oni resolves itself as a hero tower');
assert.equal(boundBossHeroId('nobody'), null, 'an unmapped id has no hero art');
ok('boundBossHeroId maps the Final cycle boss → Archangel and resolves hero towers');

// Place: a hero tower lands on an empty pad free, and blocks on occupied / cap.
const live = createDefendLive(1, { boardId: 'ato', scrap: 100 });
const placedHero = placeBoundBoss(live, 0, 'archangel', 1);
assert.ok(placedHero, 'a hero bound as a tower places on an empty pad');
assert.equal(placedHero.scrap, 100, 'and places FREE — no scrap is deducted');
assert.equal(placedHero.boundBosses[0]?.bossId, 'archangel');
assert.equal(placeBoundBoss(placedHero, 0, 'oni', 1), null, 'an occupied pad is refused');
const twoHeroes = placeBoundBoss(placedHero, 1, 'oni', 1);
assert.ok(twoHeroes, 'a second hero tower places (cap is 2)');
assert.equal(
  placeBoundBoss(twoHeroes, 2, 'corvus', 1),
  null,
  `a third Bound Boss is refused at BOUND_BOSS_MAX_ON_BOARD (${BOUND_BOSS_MAX_ON_BOARD})`,
);
assert.equal(placeBoundBoss(live, 0, 'nobody', 1), null, 'an unknown bound-boss id is refused');
ok('placeBoundBoss places hero towers free and enforces pad + board caps');

// Remove: frees the pad, keeps the OWNED + BOUND record (store is untouched).
const removed = removeBoundBoss(twoHeroes, twoHeroes.boundBosses[0].id);
assert.ok(removed, 'removing a placed Bound Boss works');
assert.equal(removed.boundBosses.length, 1, 'and lifts only that one tower');
assert.equal(removed.boundBosses[0]?.bossId, 'oni', 'the other bound boss stays placed');
assert.equal(removeBoundBoss(twoHeroes, 9999), null, 'removing an id not on the board is a no-op');
ok('removeBoundBoss frees the pad and keeps the bound record');

// Combat: a hero tower auto-attacks the highest-HP creep in range and casts its
// skill on cooldown when a target is in range. Place a puff on the path within
// the hero tower's range, step once, and read the damage + cooldowns back.
function distNearPad(pad: { x: number; y: number }, within: number): number {
  const map = BOARD_MAPS.ato;
  for (let d = 0; d <= 1; d += 0.0005) {
    const pos = puffPosition(d, map);
    if (Math.hypot(pos.x * 100 - pad.x, pos.y * 100 - pad.y) <= within) return d;
  }
  return -1;
}
function makePuff(dist: number, hp: number, id: number): Puff {
  return {
    id,
    dist,
    hp,
    maxHp: hp,
    slowMs: 0,
    slowFactor: 1,
    kind: 'puff',
    tint: null,
    size: 1,
    burstHpPct: null,
    burstFired: false,
    laneIndex: 0,
  };
}
const pad0 = BOARD_MAPS.ato.pads[0];
const d = distNearPad(pad0, HERO_TOWER_STATS.range - 2);
assert.ok(d >= 0, 'found a path point within hero-tower range of pad 0');
// Highest-HP-in-range target rule: two puffs, the fatter one wins the hit.
const twoPuffs: Puff[] = [makePuff(d, 60, 1), makePuff(d, 100, 2)];
const combatState = { ...placedHero, puffs: twoPuffs, schedule: [], elapsedMs: 0 };
const target = heroTowerTarget(combatState.boundBosses[0], combatState.puffs, BOARD_MAPS.ato);
assert.ok(target, 'a hero tower acquires a target in range');
assert.equal(target?.id, 2, 'and picks the highest-HP creep in range');
const stepped = stepDefendLive(
  combatState,
  100,
  { wavePower: 1, towerSpeed: 1, avatarLevel: 1, typeMatch: 0, avatarStars: 0 },
  { x: 0, y: 0 },
);
const afterBig = stepped.state.puffs.find((p) => p.id === 2);
assert.ok(afterBig, 'the fat puff survives one tick');
const expectedHp =
  100 - HERO_TOWER_STATS.baseAttack - HERO_TOWER_STATS.baseAttack * TOWER_SKILL_DAMAGE_MULT;
assert.ok(
  Math.abs((afterBig?.hp ?? 0) - expectedHp) < 0.01,
  `hero tower auto-attack + skill dropped the fat puff to ~${expectedHp.toFixed(1)} (got ${afterBig?.hp})`,
);
assert.equal(
  stepped.state.boundBosses[0]?.cooldownMs,
  HERO_TOWER_STATS.cooldownMs,
  'the hero tower attack cooldown reset',
);
assert.equal(
  stepped.state.boundBosses[0]?.skillCooldownMs,
  HERO_TOWER_SKILL_COOLDOWN_MS,
  'the hero tower skill (Archangel Ultimate) fired and set its cooldown',
);
ok('hero towers auto-attack the highest-HP creep and auto-cast their skill on CD');

console.log(`\nAll ${passed} hero-contract checks passed.`);
