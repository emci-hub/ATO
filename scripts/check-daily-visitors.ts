/**
 * Daily visitors (Divecore roadmap step 4, plan approved by emci 2026-10-15).
 * Run: npm run check:daily-visitors
 *
 *   1. Roster: 12 rotate + 2 stand-ins, all real heroes, no repeats; every one is ROOM-READY
 *      (its packed cast art has both an idle and a walk clip — the kit the room plays).
 *   2. Rotation: from the local date alone; 12 days = all 12 once; consecutive weeks differ;
 *      never your pet's own hero (a stand-in comes, and never the pet's hero either).
 *   3. Rewards: 1st greeting = sticker, 2nd = a line, 3rd = the rare look (once), then visits;
 *      one greeting a day; never a hero copy, never currency (tokens/shells/stones/egg tickets unchanged).
 *   4. Rare looks: one tint per visitor, not for sale, not in any Dive loot table.
 *   5. Save: rides the Hideout state → the whole Play doc → the wave96 cloud save; a round trip
 *      keeps it, garbage reads as empty, an old save without the field reads as empty.
 *   6. Art: every visitor has its sticker in the art library (128×128, in-use) and the UI names it
 *      through ART.icon.stickers (never a typed id or path).
 *   7. Copy: moment-voice bans, curly apostrophes, ids forever-shaped, notice ≤ 3 / ≤ 10 words,
 *      ships behind VISITORS_COPY_REVIEWED = false with a review doc.
 *   8. Room: the visitor's spot is on the Hideout walk floor; one call site (the Hideout screen).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

import { playSheetsSearchText } from './art-sheets';

import {
  VISITOR_CLEAR_PX,
  VISITOR_DAY0,
  VISITOR_LOOK_AT,
  VISITOR_MIN_PET_STRIP_PX,
  VISITOR_SPOT,
  greetVisitor,
  parseVisitorBook,
  rewardFor,
  stickerCount,
  visitorFor,
  weekLineup,
  ymdDayNumber,
  type VisitorBook,
} from '../src/play/daily-visitors';
import { VISITOR_LINES, VISITOR_UI, VISITORS_COPY_REVIEWED } from '../src/play/daily-visitors-bank';
import {
  VISITOR_ROTATION,
  VISITOR_STAND_INS,
  VISITOR_STICKER_HEROES,
  VISITOR_TINT_COLOR,
  visitorTintId,
} from '../src/play/daily-visitors-roster';
import { cloudSavePayload } from '../src/play/cloud-save-model';
import { allHeroes, heroName } from '../src/play/heroes-data';
import { HIDEOUT_GEOM, isoClampToWalk, isoOnWalkFloor, planHideoutStep } from '../src/play/hideout-iso';
import { RAIL_ROOM_GEOM, railWalkBounds } from '../src/play/hideout-rails-model';
import { emptyHideout, parseHideout } from '../src/play/hideout-progress';
import { kitHas, petKitOfRole, type PetKitSource } from '../src/play/pet-actor';
import { COSMETICS, cosmeticById } from '../src/play/pet-cosmetics';
import { PET_BANNED_WORDS } from '../src/play/pet-talk';
import { buyCosmetic, defaultPlayStore, greetDailyVisitor, markHideoutCoach, parsePlayStore } from '../src/play/playStore';

const root = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

/* 1 · roster + room-ready ------------------------------------------------- */

assert.equal(VISITOR_ROTATION.length, 12, '12 visitors rotate');
assert.equal(VISITOR_STAND_INS.length, 2, '2 stand-ins');
assert.equal(new Set(VISITOR_STICKER_HEROES).size, 14, 'no hero twice across rotation + stand-ins');
const heroIds = new Set(allHeroes().map((h) => h.id));

const sheetsText = playSheetsSearchText(root);
function sheetFrames(heroId: string, clip: string): number {
  const key = `"sheets/cast/heroes/${heroId}/${clip}": {`;
  const at = sheetsText.indexOf(key);
  if (at < 0) return 0;
  const next = sheetsText.indexOf('\n  "sheets/', at + key.length);
  const body = sheetsText.slice(at, next < 0 ? undefined : next);
  return (body.match(/"east\/frame_\d+"/g) ?? []).length;
}
/** The kit the room plays for a hero, rebuilt from data like `heroAvatarRole` (as check:pet-room does). */
function roomKit(heroId: string) {
  const hero = allHeroes().find((h) => h.id === heroId)!;
  const clips = hero.clips as Partial<Record<string, string | null>>;
  const walkFrames = clips.walk ? sheetFrames(heroId, clips.walk) : 0;
  const anims: Record<string, { frames: number }> = {};
  for (const slot of ['idle', 'attack', 'skill', 'hurt', 'dash']) {
    const name = clips[slot];
    const frames = name ? sheetFrames(heroId, name) : 0;
    if (frames > 0) anims[slot] = { frames };
  }
  const source: PetKitSource = { walk: walkFrames > 0 ? { frames: walkFrames } : undefined, anims };
  return petKitOfRole(source, heroId);
}
const roomReady = (id: string) => {
  const kit = roomKit(id);
  return kitHas(kit, 'idle') && kitHas(kit, 'walk');
};
for (const id of VISITOR_STICKER_HEROES) {
  assert.ok(heroIds.has(id), `${id}: a real hero`);
  assert.ok(roomReady(id), `${id}: room-ready (idle + walk packed) — only room-ready heroes can visit`);
}
// The two left out today are left out for the stated reason (if their art lands, they may join).
for (const id of ['aurex', 'morwen']) {
  if (!VISITOR_STICKER_HEROES.includes(id)) assert.ok(!roomReady(id), `${id} is now room-ready: consider adding it`);
}

/* 2 · rotation ------------------------------------------------------------ */

const addDays = (ymd: string, n: number) => new Date((ymdDayNumber(ymd) + n) * 86_400_000).toISOString().slice(0, 10);
assert.equal(addDays('2026-12-31', 1), '2027-01-01', 'day arithmetic crosses a year');
assert.equal(addDays('2027-03-13', 1), '2027-03-14', 'day arithmetic ignores DST');
for (let start = 0; start < 30; start += 1) {
  const seen = new Set<string>();
  for (let i = 0; i < 12; i += 1) seen.add(visitorFor(addDays(VISITOR_DAY0, start + i), null).heroId);
  assert.equal(seen.size, 12, 'any 12 days in a row = all 12 visitors once');
}
assert.deepEqual(weekLineup(VISITOR_DAY0), VISITOR_ROTATION.slice(0, 7), 'week 1 = the first 7 in order');
for (let w = 0; w < 24; w += 1) {
  const a = weekLineup(addDays(VISITOR_DAY0, 7 * w));
  const b = weekLineup(addDays(VISITOR_DAY0, 7 * (w + 1)));
  assert.notDeepEqual(a, b, 'each week brings a different line-up');
  // The week strip agrees with the day rule.
  for (let d = 0; d < 7; d += 1) assert.equal(visitorFor(addDays(VISITOR_DAY0, 7 * w + d), null).heroId, a[d]);
}
assert.equal(visitorFor('2026-10-15', null).heroId, VISITOR_ROTATION[3], 'Thursday of week 1 = the 4th visitor');
for (const pet of [...VISITOR_STICKER_HEROES, 'aurex', 'morwen', null]) {
  for (let d = -40; d < 40; d += 1) {
    const v = visitorFor(addDays(VISITOR_DAY0, d), pet);
    assert.notEqual(v.heroId, pet, `never your pet's own hero (${pet})`);
    assert.ok(VISITOR_STICKER_HEROES.includes(v.heroId));
    assert.equal(v.standIn, VISITOR_STAND_INS.includes(v.heroId) && VISITOR_ROTATION.includes(pet ?? ''), 'stand-ins only cover a clash');
  }
}

/* 3 · rewards + once a day + no economy ---------------------------------- */

assert.deepEqual(rewardFor('kael', 1, []), { kind: 'sticker', heroId: 'kael' });
assert.deepEqual(rewardFor('kael', 2, []), { kind: 'line', heroId: 'kael' });
assert.deepEqual(rewardFor('kael', VISITOR_LOOK_AT, []), { kind: 'look', heroId: 'kael', cosmeticId: visitorTintId('kael') });
assert.deepEqual(rewardFor('kael', VISITOR_LOOK_AT, [visitorTintId('kael')]), { kind: 'visit', heroId: 'kael' }, 'a look is never given twice');
assert.deepEqual(rewardFor('kael', 9, []), { kind: 'visit', heroId: 'kael' });

let book: VisitorBook = parseVisitorBook(null);
const kaelDay = VISITOR_DAY0;
const v1 = visitorFor(kaelDay, null);
const g1 = greetVisitor(book, v1, []);
assert.ok(g1 && g1.reward.kind === 'sticker');
book = g1.book;
assert.equal(greetVisitor(book, v1, []), null, 'one greeting a day');
assert.equal(stickerCount(book), 1);
// Run 60 days of greeting every day through the real doc transition.
let doc = defaultPlayStore(Date.UTC(2026, 9, 12, 12));
const econ = (d: typeof doc) =>
  JSON.stringify({
    tokens: d.tokens,
    shells: d.shells,
    shine: d.shine_stones,
    prism: d.prism_stones,
    petTokens: [d.pet_tokens_today, d.pet_tokens_ymd],
  });
const looks = new Set<string>();
for (let d = 0; d < 60; d += 1) {
  const ymd = addDays(VISITOR_DAY0, d);
  const now = Date.UTC(2026, 9, 12 + d, 12);
  const res = greetDailyVisitor(doc, now, visitorFor(ymd, null));
  assert.ok(res, `day ${d}: greeted`);
  // Same day, same clock, no greeting: the pet's own day (daily income, ageing) is the control.
  const control = markHideoutCoach(doc, now);
  assert.equal(econ(res.doc), econ(control), `day ${d}: a greeting moves no tokens, shells, stones or pet tokens`);
  assert.deepEqual(res.doc.pet, control.pet, `day ${d}: a greeting never changes the pet (no hero copy)`);
  const extra = res.doc.pet_cosmetics.filter((id) => !control.pet_cosmetics.includes(id));
  assert.deepEqual(extra, res.reward.kind === 'look' ? [res.reward.cosmeticId] : [], `day ${d}: only the rare look joins the wardrobe`);
  assert.ok(['sticker', 'line', 'look', 'visit'].includes(res.reward.kind), 'only stickers, lines, looks and visits');
  if (res.reward.kind === 'look') looks.add(res.reward.cosmeticId);
  assert.equal(greetDailyVisitor(res.doc, now + 1000, visitorFor(ymd, null)), null, 'second tap the same day saves nothing');
  doc = res.doc;
}
assert.equal(stickerCount(doc.hideout.visitors), 12, '12 stickers in 12 days');
assert.equal(looks.size, 12, 'the 3rd greeting of each visitor gave its look (day 25–36)');
for (const id of looks) assert.ok(doc.pet_cosmetics.includes(id), `${id} is in the wardrobe`);

/* 4 · rare looks ---------------------------------------------------------- */

const lootText = read('src/play/data/dive-loot.json');
for (const id of VISITOR_STICKER_HEROES) {
  const cid = visitorTintId(id);
  assert.match(cid, /^cos_tint_visit_[a-z_]+$/);
  const def = cosmeticById(cid);
  assert.ok(def, `${cid} is a cosmetic`);
  assert.equal(def.slot, 'tint');
  assert.equal(def.price, null, `${cid}: never for sale`);
  assert.equal(def.source, 'visitor');
  assert.match(VISITOR_TINT_COLOR[id] ?? '', /^#[0-9A-F]{6}$/, `${id}: tint colour`);
  assert.ok(!lootText.includes(cid), `${cid}: never a Dive find`);
  const bought = buyCosmetic({ ...defaultPlayStore(0), tokens: 1e6 }, cid);
  assert.equal(bought.result.ok, false, `${cid}: the wardrobe refuses to sell it`);
}
assert.equal(new Set(COSMETICS.map((c) => c.id)).size, COSMETICS.length, 'cosmetic ids stay unique');
assert.equal(new Set(VISITOR_STICKER_HEROES.map((id) => VISITOR_TINT_COLOR[id])).size, 14, 'every tint colour differs');

/* 5 · save ---------------------------------------------------------------- */

assert.deepEqual(emptyHideout().visitors, { greets: {}, greeted_ymd: null });
assert.deepEqual(parseHideout({}, 0).visitors, { greets: {}, greeted_ymd: null }, 'an old save without the field reads as empty');
assert.deepEqual(
  parseVisitorBook({ greets: { kael: 2.7, nobody: 4, oni: -1, sak: 'x' }, greeted_ymd: 'yesterday' }),
  { greets: { kael: 2 }, greeted_ymd: null },
  'garbage is dropped, never a crash',
);
const restored = parsePlayStore(JSON.stringify(doc), Date.UTC(2026, 11, 11, 12));
assert.ok(restored, 'the whole doc (= the cloud save payload) parses');
assert.deepEqual(restored.hideout.visitors, doc.hideout.visitors, 'visitors survive the save round trip');
for (const id of looks) assert.ok(restored.pet_cosmetics.includes(id), 'rare looks survive the round trip');
// The wave96 push (`save_play_doc`) sends the whole doc; a restore parses it back the same way.
const payload = cloudSavePayload(doc, Date.UTC(2026, 11, 11, 12));
assert.ok(payload, 'the save fits the cloud cap with visitors in it');
const fromCloud = parsePlayStore(JSON.stringify(payload.p_doc), Date.UTC(2026, 11, 12, 12));
assert.deepEqual(fromCloud?.hideout.visitors, doc.hideout.visitors, 'visitors ride the wave96 cloud save');
assert.ok(/cloudSavePayload\(next\.doc/.test(read('src/play/cloud-save.ts')), 'cloud-save.ts pushes cloudSavePayload(doc)');

/* 6 · art ----------------------------------------------------------------- */

const uiSrc = read('src/play/daily-visitor-ui.tsx');
const camel = (id: string) => id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
for (const id of VISITOR_STICKER_HEROES) {
  const file = `assets/art/icons/in-use/stickers/streetwear/${id}.png`;
  assert.ok(fs.existsSync(path.join(root, file)), `${id}: sticker in the art library (${file})`);
  const png = PNG.sync.read(fs.readFileSync(path.join(root, file)));
  assert.equal(png.width, 128, `${id}: 128 wide (32 px ladder)`);
  assert.equal(png.height, 128, `${id}: 128 tall`);
  assert.ok(uiSrc.includes(`getArtSource(ART.icon.stickers.streetwear.${camel(id)})`), `${id}: named through ART.icon.stickers`);
}
assert.ok(!/require\(|['"`]icon\.stickers\.|assets\/art\//.test(uiSrc), 'no typed art id, path or require() in the visitor UI');

/* 7 · copy ---------------------------------------------------------------- */

assert.equal(VISITORS_COPY_REVIEWED, false, 'ships unreviewed until emci reads the bank');
assert.ok(fs.existsSync(path.join(root, 'docs/divecore/daily-visitors/review.md')), 'review doc exists');
const banned = new RegExp(`\\b(${PET_BANNED_WORDS.join('|')})\\b`, 'i');
const ids = new Set<string>();
for (const id of VISITOR_STICKER_HEROES) {
  const set = VISITOR_LINES[id];
  assert.ok(set, `${id}: has lines`);
  const all = [set.arrive, set.sticker, set.line, set.look, ...set.visits];
  for (const line of all) {
    assert.match(line.id, new RegExp(`^dv_${id.replace(/-/g, '_')}_0[1-6]$`), `${line.id}: id shape`);
    assert.ok(!ids.has(line.id), `${line.id}: unique`);
    ids.add(line.id);
    assert.ok(line.text.length > 0 && line.text.length <= 72, `${line.id}: short (≤ 72)`);
    assert.ok(!/\byou are\b|\byou're\b|\byou’re\b|\balways\b|\btry\b|\bshould\b/i.test(line.text), `${line.id}: moment-voice bans`);
    assert.ok(!banned.test(line.text), `${line.id}: banned Play word`);
    assert.ok(!line.text.includes("'"), `${line.id}: curly apostrophes only`);
    assert.ok(!/[?]$/.test(line.text), `${line.id}: no reflective question`);
  }
}
assert.equal(ids.size, 14 * 6);
assert.ok(VISITOR_UI.noticeTitle.split(/\s+/).length <= 3, 'notice title ≤ 3 words');
const uiStrings = [
  VISITOR_UI.noticeTitle,
  VISITOR_UI.noticeBody('Kael-09'),
  VISITOR_UI.cardTitle('Kael-09'),
  VISITOR_UI.sticker('Kael-09'),
  VISITOR_UI.look('Kael-09'),
  VISITOR_UI.lookHint,
  VISITOR_UI.stickerHint,
  VISITOR_UI.keep,
  VISITOR_UI.bye,
  VISITOR_UI.bookTitle,
  VISITOR_UI.bookNote(3, 14),
  VISITOR_UI.lookSource,
];
for (const s of uiStrings) {
  assert.ok(!/\byou are\b|\byou're\b|\byou’re\b|\balways\b/i.test(s), `UI copy "${s}": moment-voice bans`);
  assert.ok(!s.includes("'"), `UI copy "${s}": curly apostrophes only`);
  assert.ok(!banned.test(s), `UI copy "${s}": banned Play word`);
}
for (const id of VISITOR_STICKER_HEROES) {
  assert.ok(VISITOR_UI.noticeBody(heroName(id)).split(/\s+/).length <= 10, `${id}: notice body ≤ 10 words`);
  assert.ok(VISITOR_UI.noticeBody(heroName(id)).length <= 26, `${id}: notice body fits one SE line (≤ 26 chars)`);
  assert.ok(VISITOR_UI.cardTitle(heroName(id)).length <= 28, `${id}: card title fits one line`);
}

/* 8 · room + call sites -------------------------------------------------- */

assert.ok(isoOnWalkFloor(VISITOR_SPOT[0], VISITOR_SPOT[1], HIDEOUT_GEOM, 'adult'), 'the visitor spot is on the Hideout walk floor');
// The pet keeps left of the visitor (pet-room.tsx narrows its walk bounds the same way), at both phone widths.
let seed = 11;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const homeGeom = RAIL_ROOM_GEOM.hideout!;
for (const w of [430, 375]) {
  const rails = railWalkBounds({ stageW: w, originLeft: 0, pt: w / 352 });
  const [vx, vy] = isoClampToWalk(VISITOR_SPOT[0], VISITOR_SPOT[1], homeGeom, 'adult', rails);
  assert.ok(isoOnWalkFloor(vx, vy, homeGeom, 'adult'), `${w}: the clamped visitor spot is on the floor`);
  const cap = vx - VISITOR_CLEAR_PX;
  assert.ok(cap - rails.minX >= VISITOR_MIN_PET_STRIP_PX, `${w}: the pet keeps a real strip of floor beside the visitor`);
  const bounds = { minX: rails.minX, maxX: Math.min(rails.maxX, cap) };
  let x = homeGeom.spawns.default?.[0] ?? 176;
  let y = homeGeom.spawns.default?.[1] ?? 360;
  let moved = 0;
  for (let n = 0; n < 200; n += 1) {
    const step = planHideoutStep({ kit: { idle: 4, walk: 4, attack: 4, skill: 4 }, mood: 'happy', branch: 'standard', stage: 'adult', x, y, rng, geom: homeGeom, bounds });
    for (const p of step.path.slice(1)) assert.ok(p[0] <= cap + 8, `${w}: the pet never walks into the visitor (x ${Math.round(p[0])} > ${Math.round(cap)})`);
    if (step.toX !== x || step.toY !== y) moved += 1;
    x = step.toX;
    y = step.toY;
  }
  assert.ok(moved > 20, `${w}: the pet still roams with a visitor in (${moved} moves)`);
}
// …and pet-room.tsx really does that (the test above mirrors it), re-clamping when the visitor starts to block.
const roomSrc = read('src/play/pet-room.tsx');
assert.ok(/const cap = visitorFeet\[0\] - VISITOR_CLEAR_PX;/.test(roomSrc), 'pet-room narrows the pet to the left of the visitor');
assert.ok(/cap - minX >= VISITOR_MIN_PET_STRIP_PX/.test(roomSrc), 'pet-room keeps the minimum strip rule');
assert.ok(/walkBoundsRef\.current = \{ minX, maxX: Math\.min\(/.test(roomSrc), 'the narrowed bounds feed the walk loop');
assert.ok(/\[width, hideoutPt, hasRails, visitorBlocks\]/.test(roomSrc), 'the pet is re-clamped when the visitor starts blocking (room switch, Motion Off)');
assert.ok(/hideoutStage\?\.viewed === 'hideout'/.test(roomSrc), 'the visitor shows in the Hideout room only');
// pet-screen.tsx: street layout only, never while the pet is an egg, the day re-read at the tap, card waits for the away card.
const screenSrc = read('src/play/pet-screen.tsx');
assert.ok(/const visitor = streetUiOn\(\) && pet\.stage !== 'egg' \? visitorFor\(todayYmd, petHeroId\) : null;/.test(screenSrc), 'street only, no visitor for an egg');
assert.ok(/const tapYmd = localYmd\(\);/.test(screenSrc), 'a tap re-reads the local day (midnight-safe)');
assert.ok(/const visitorShown = visitorCard != null && !awayShown && !settingsOpen/.test(screenSrc), 'the card waits for the away card and hides under Settings');
assert.ok(/visitorShown && visitorCard \? \(\s*<VisitorCard/.test(screenSrc), 'the card floats over the Hideout (GameScreen float)');
assert.ok(/notify\(\{ kind: 'notify', title: VISITOR_UI\.noticeTitle/.test(screenSrc), 'the notice goes through notify() into the NoticeLane');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
const users = walk(path.join(root, 'src'))
  .filter((f) => /from '@\/play\/daily-visitor-ui'/.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(root, f).split(path.sep).join('/'))
  .sort();
// circle-visits-ui.tsx (step 6) reuses the sticker art for a Circle gift.
assert.deepEqual(users, ['src/play/circle-visits-ui.tsx', 'src/play/pet-room.tsx', 'src/play/pet-screen.tsx', 'src/play/pet-sheets.tsx'], 'only the Hideout uses the visitor UI');
for (const f of ['src/play/daily-visitors.ts', 'src/play/daily-visitors-roster.ts', 'src/play/daily-visitors-bank.ts', 'src/play/daily-visitor-ui.tsx']) {
  const src = read(f);
  assert.ok(!/from '@\/app\/|from '@\/lib\/supabase|generateText|ai-generate/.test(src), `${f}: no app screen, no network, no model call`);
}

console.log(
  `check:daily-visitors ok — 12 rotate + 2 stand-ins (all room-ready), 60-day run: 12 stickers, 12 looks, economy unchanged, ${ids.size} lines`,
);
