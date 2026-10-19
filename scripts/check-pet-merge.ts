/**
 * One of each hero (pet team roadmap P1, emci 2026-10-18).
 * Run: npm run check:pet-merge
 *
 * - An egg's duplicate joins the hero you keep once its Child reveal has played: one pet per hero,
 *   the copy goes into the Collection (stars unchanged), best grade, shiny kept, looks carried over.
 * - Kept = highest stage, so a new Child never replaces a grown pet; the grown one wakes as active.
 * - It waits while the reveal is still to play, mid-dive and while the pet is away.
 * - An old save that keeps a hero twice folds on load; folding again changes nothing.
 * - Wired: parse folds, the reveal ack folds and sets the note, the Pet screen says it once.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PetState } from '../src/play/pet';
import { mergeLine, planMerges } from '../src/play/pet-merge';
import {
  ackPetRevealsDoc,
  defaultPlayStore,
  foldDuplicatePets,
  heroBookOf,
  parsePlayStore,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 18, 9, 0, 0);
const base = defaultPlayStore(T);
function pet(over: Partial<PetState>): PetState {
  return { ...base.pet, seen_at: T, stage: 'child', grade: 'common', ...over };
}
function doc(active: PetState, den: PetState[], mut: (d: PlayStoreDoc) => void = () => {}): PlayStoreDoc {
  const d: PlayStoreDoc = { ...defaultPlayStore(T), pet: active, pet_den: den, den_slots: 12, pet_uid_next: 20 };
  mut(d);
  return d;
}
const copies = (d: PlayStoreDoc, hero: string) => heroBookOf(d)[hero]?.copies ?? 0;

// --- the rule -------------------------------------------------------------------------------------
const grown = pet({ uid: 2, hero: 'kael', stage: 'adult', grade: 'common', name: null });
const fresh = pet({ uid: 5, hero: 'kael', stage: 'child', grade: 'epic', shiny: true, shiny_style: 'classic', name: 'Sparks' });
const [plan] = planMerges([fresh, grown], fresh.uid);
assert.equal(plan.kept.uid, 2, 'the grown pet is kept over a new Child');
assert.equal(plan.kept.stage, 'adult');
assert.equal(plan.kept.grade, 'epic', 'best grade');
assert.equal(plan.kept.shiny, true, 'shiny kept');
assert.equal(plan.kept.name, 'Sparks', 'a name carries over when the kept pet has none');
assert.deepEqual(plan.dropped.map((p) => p.uid), [5]);
const tie = planMerges([pet({ uid: 7, hero: 'sak' }), pet({ uid: 3, hero: 'sak' })], 7)[0];
assert.equal(tie.kept.uid, 7, 'same stage: the active pet is kept');
assert.equal(planMerges([pet({ uid: 1, hero: 'kael' }), pet({ uid: 2, hero: 'sak' })], 1).length, 0, 'different heroes: nothing');
assert.equal(planMerges([pet({ uid: 1, hero: 'kael' }), pet({ uid: 2, hero: 'kael', stage: 'baby' })], 1).length, 0, 'before Child: untouched');
ok('kept = highest stage, then active; best grade, shiny and name carried; unrevealed pets untouched');

// --- an egg's duplicate, at the reveal ---------------------------------------------------------------
const atReveal = doc({ ...fresh, reveals: ['child'] }, [grown, pet({ uid: 3, hero: 'sak' })]);
const before = copies(atReveal, 'kael');
const acked = ackPetRevealsDoc(atReveal, T);
assert.ok(acked);
assert.equal(acked!.pet.uid, 2, 'the grown Kael wakes as the active pet');
assert.equal(acked!.pet.grade, 'epic');
assert.equal(acked!.pet_den.length, 1, 'the Den keeps only Sak');
assert.equal(acked!.pet_den[0].hero, 'sak');
assert.equal(copies(acked!, 'kael'), before, 'stars count every copy, exactly as before');
assert.equal(heroBookOf(acked!).kael?.shinies, heroBookOf(atReveal).kael?.shinies, 'a shiny taken over is counted once');
assert.deepEqual(heroBookOf(acked!).kael?.styles, heroBookOf(atReveal).kael?.styles, 'shiny styles unchanged');
assert.equal(acked!.pet_heroes.kael?.copies, 1, 'the joined copy is in the Collection');
assert.deepEqual(acked!.pet_merge_note, { hero: 'kael', stars_from: 1, stars_to: 2, grade_up: 'epic', shiny_up: true, shards: 0, shard_grade: null });
assert.equal(acked!.play_stats.releases, atReveal.play_stats.releases, 'not a release');
assert.equal(acked!.pet_hall.length, atReveal.pet_hall.length, 'no Hall entry');
assert.deepEqual(acked!.pet_shards, atReveal.pet_shards, 'no shard');
ok('at the reveal ack: grown pet kept and woken, copy into the Collection, no Hall / shard, note set');

// --- it waits ----------------------------------------------------------------------------------------
const pending = parsePlayStore(JSON.stringify(atReveal), T)!;
assert.equal(pending.pet.uid, 5, 'a reveal still to play: the load leaves the pair');
assert.equal(pending.pet_den.length, 2);
const away = doc(fresh, [grown], (d) => (d.pet_expedition = { left_age_ms: 0, len_ms: 3_600_000, step: 0, better: false }));
assert.equal(foldDuplicatePets(away, T).doc.pet.uid, 5, 'away on a trip: no swap');
ok('waits while the reveal is to play and while the pet is away');

// --- an old save -------------------------------------------------------------------------------------
const holo = pet({ uid: 4, hero: 'kael', stage: 'teen', finish_kind: 'holo', finish_color: 'gold' });
const old = doc(pet({ uid: 1, hero: 'sak', stage: 'adult' }), [grown, holo, pet({ uid: 6, hero: 'kael', stage: 'baby' })]);
const loaded = parsePlayStore(JSON.stringify(old), T)!;
const kaels = [loaded.pet, ...loaded.pet_den].filter((p) => p.hero === 'kael' && p.stage !== 'baby');
assert.equal(kaels.length, 1, 'one grown Kael left');
assert.equal(kaels[0].uid, 2);
assert.equal(kaels[0].finish_kind, holo.finish_kind, 'the finish moved over');
assert.equal(copies(loaded, 'kael'), copies(old, 'kael'), 'no copy lost');
assert.ok(loaded.pet_den.some((p) => p.uid === 6), 'the baby rests untouched');
assert.equal(loaded.pet.uid, 1, 'the active pet is untouched');
assert.deepEqual(parsePlayStore(JSON.stringify(loaded), T), loaded, 'folding again changes nothing');
ok('old save folds on load, nothing lost, idempotent');

// --- the line ------------------------------------------------------------------------------------------
assert.equal(mergeLine({ hero: 'kael', stars_from: 2, stars_to: 3, grade_up: null, shiny_up: false, shards: 0, shard_grade: null }, 'Kael'), 'Kael joined up! ★★ → ★★★');
assert.equal(mergeLine({ hero: 'kael', stars_from: 5, stars_to: 5, grade_up: 'legendary', shiny_up: false, shards: 0, shard_grade: null }, 'Kael'), 'Kael joined up! Now Legendary!');
ok('the joined-up line');

// --- wired -----------------------------------------------------------------------------------------------
const store = read('src/play/playStore.ts');
assert.match(store, /foldAvatarIntoPets\(foldDuplicatePets\(parsed, now\)\.doc, now\)/, 'parse folds duplicates first (then the P4 Avatar fold)');
assert.match(store, /foldDuplicatePets\(\{ \.\.\.touched, pet: ackPetReveals\(touched\.pet\) \}, now\)/, 'the reveal ack folds');
const screen = read('src/play/pet-screen.tsx');
assert.match(screen, /mergeLine\(mergeNote, heroName\(mergeNote\.hero\)\)/);
assert.match(screen, /clearMergeNote\(doc\)/, 'said once, then cleared');
ok('wired: parse, reveal ack, Pet screen');

console.log(`\ncheck:pet-merge — ${passed} groups passed`);
