/**
 * Preview save for step 0p (Stash): 7 pets collected, 9 slots open (2 free, 11 locked), three resting
 * pets wear a holo finish so the preview proves the Stash draws none of it.
 * Run: npx tsx docs/divecore/0p/seed.ts > <scratch>/seed.json
 */
import { defaultPlayStore, devFillDen } from '../../../src/play/playStore';
import { newPet } from '../../../src/play/pet';

const now = Date.now();
let doc = defaultPlayStore(now);
const pet = newPet(now);
pet.stage = 'child';
pet.egg = 'knight';
pet.hero = 'corvus';
pet.grade = 'common';
pet.name = 'Raven';
pet.hunger = 2;
pet.mood = 3;
pet.forms = ['standard'];
pet.reveals = [];
pet.finish_kind = 'holo';
doc.pet = pet;
doc.play_settings = { ...doc.play_settings, tutorialSeen: true, chatter: 'off' };
(doc as { tokens: number }).tokens = 1240;
(doc as { shells: number }).shells = 500;
doc = { ...doc, den_slots: 7 };
let n = 0.1;
doc = devFillDen(doc, now, () => {
  n = (n * 7.3 + 0.13) % 1;
  return n;
});
const heroes = ['kael', 'kitsune', 'oni'] as const;
doc.pet_den = doc.pet_den.map((p, i) =>
  i < 3 ? { ...p, stage: 'child', hero: heroes[i], grade: 'common', finish_kind: 'holo', fav: i === 0 } : p,
);
doc = { ...doc, den_slots: 9 };
process.stdout.write(JSON.stringify(doc));
