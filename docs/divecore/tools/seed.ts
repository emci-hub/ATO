/**
 * Writes a Play save for the measuring harness (hatched Child pet, tutorial seen, 1,240 Caps).
 * Run: npx tsx docs/divecore/tools/seed.ts > docs/divecore/tools/seed.json
 */
import { defaultPlayStore } from '../../../src/play/playStore';
import { newPet } from '../../../src/play/pet';

const now = Date.now();
const doc = defaultPlayStore(now);
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
doc.pet = pet;
doc.play_settings = { ...doc.play_settings, tutorialSeen: true, chatter: 'off' };
(doc as { tokens: number }).tokens = 1240;
process.stdout.write(JSON.stringify(doc));
