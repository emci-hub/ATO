/**
 * check:circle-visits — Divecore Circle visits (hideout roadmap step 6, plan approved by emci 2026-10-15).
 *
 *   1. Privacy (phone): a friend's look is ONLY hero / stage / shiny + 3 known decor slots. A name, traits,
 *      tokens or any other field in the reply is dropped; bad heroes, slots, items, ids and handles too.
 *   2. Gifts: one opened gift = one sticker (a sticker hero) or one stamp; the same gift never counts twice;
 *      the opened list is capped; an old save reads as empty; garbage never crashes.
 *   3. Economy: opening a gift changes nothing but `hideout.circle` (tokens, shells, stones, pet tokens,
 *      the pet and the wardrobe untouched); the book rides the whole doc → wave96 cloud save.
 *   4. Rail: Circle is the Hideout room's 5th action (only when the screen asks for it, never in another
 *      room) and five buttons fit the rail at 375×667 and 430×932.
 *   5. Server path: the phone only calls the six wave97 RPCs with an id at most, never reads a table.
 *      When wave97 is in the tree: the look function returns only line / hero / stage / shiny / decor,
 *      nobody can call it directly, every call needs auth + the Circle row + BOTH switches (default off)
 *      + no block, one gift per pair per day, no trait column and no currency anywhere in it.
 *   6. Screen: the list / gift cards float (away card first, busy through hideoutBusy), a visit swaps the
 *      notice lane + dock contents (never their size), hides the rails, and back = home.
 *   7. Copy: curly apostrophes, moment-voice bans, short lines; ships with CIRCLE_VISITS_COPY_REVIEWED =
 *      false and a review doc.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CIRCLE_OPENED_CAP,
  CIRCLE_UI,
  CIRCLE_VISITS_COPY_REVIEWED,
  EMPTY_CIRCLE_BOOK,
  circleGiftIsSticker,
  cleanDecor,
  cleanHandle,
  friendStatus,
  nextCircleGift,
  openCircleGiftBook,
  parseCircleBook,
  parseCircleFriends,
  parseCircleInbox,
  parseCircleLook,
  type CircleBook,
  type CircleGift,
} from '../src/play/circle-visits';
import { VISITOR_STICKER_HEROES } from '../src/play/daily-visitors-roster';
import { cloudSavePayload } from '../src/play/cloud-save-model';
import { allHeroes } from '../src/play/heroes-data';
import { emptyHideout, parseHideout } from '../src/play/hideout-progress';
import { RAIL_BUTTON_PT, RAIL_GAP_PT, RAIL_MAX_ITEMS, leftRailActions, railMaxHeight } from '../src/play/hideout-rails-model';
import { PET_BANNED_WORDS } from '../src/play/pet-talk';
import { defaultPlayStore, openCircleGift, parsePlayStore } from '../src/play/playStore';
import { computeStageFrame } from '../src/play/stage-frame';
import { TRAIT_AXES } from '../src/lib/traits';

const root = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
const ok = (label: string) => {
  passed += 1;
  console.log(`  ✓ ${label}`);
};

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* 1 · privacy on the phone ------------------------------------------------- */

const full = parseCircleLook({
  pet: { line: 'solo_kael', hero: 'kael', stage: 'adult', shiny: true, name: 'Biscuit', hunger: 3, traits: { openness: 0.9 } },
  decor: { d1: 'dc_plant', d2: 'dc_nope', d9: 'dc_crate', d3: 'dc_boombox' },
  tokens: 999,
  handle_typed: 'hi',
});
assert.deepEqual(full, { heroId: 'kael', stage: 'adult', shiny: true, decor: { d1: 'dc_plant', d3: 'dc_boombox' } }, 'only hero / stage / shiny / known decor survive');
assert.deepEqual(Object.keys(full!).sort(), ['decor', 'heroId', 'shiny', 'stage'], 'no other field reaches the phone');
const fromLine = parseCircleLook({ pet: { line: 'line_knight', hero: null, stage: 'egg' }, decor: null });
assert.equal(fromLine?.heroId, 'raven', 'no locked hero yet: the line’s grown hero');
assert.equal(fromLine?.shiny, false);
assert.deepEqual(fromLine?.decor, {});
assert.equal(parseCircleLook({ pet: { hero: 'not-a-hero', line: '../../x' } }), null, 'unknown hero + bad line = no look');
assert.equal(parseCircleLook({ pet: { hero: 'kael', stage: 'mega' } })?.stage, null, 'unknown stage dropped');
assert.equal(parseCircleLook(null), null);
assert.equal(parseCircleLook('kael'), null);
assert.deepEqual(cleanDecor(['dc_plant']), {});
assert.equal(cleanHandle('@ato_dev'), 'ato_dev');
for (const bad of ['', 'a b', '<script>', 'x'.repeat(31), 7, null]) assert.equal(cleanHandle(bad), null, `bad handle ${String(bad)} dropped`);
const friends = parseCircleFriends([
  { peer: ID(1), handle: 'amy', mine: true, allowed: true, gifted_today: false, traits: { x: 1 } },
  { peer: ID(2), handle: '@bo', mine: true, allowed: false },
  { peer: 'nope', handle: 'cy', mine: true },
  { peer: ID(3), handle: 'bad handle' },
  'junk',
]);
assert.deepEqual(friends, [
  { peer: ID(1), handle: 'amy', mine: true, allowed: true, giftedToday: false },
  { peer: ID(2), handle: 'bo', mine: true, allowed: false, giftedToday: false },
]);
assert.deepEqual(friends.map(friendStatus), ['sharing', 'waiting']);
assert.equal(friendStatus({ peer: ID(4), handle: 'x', mine: false, allowed: false, giftedToday: false }), 'off', 'default = not sharing');
const inbox = parseCircleInbox([
  { id: ID(10), handle: 'amy', look: { pet: { hero: 'oni', stage: 'teen', name: 'Mochi' }, decor: { d2: 'dc_cone' } } },
  { id: ID(11), handle: 'bo', look: { pet: { hero: 'aurex' } } },
  { id: 'x', handle: 'amy', look: { pet: { hero: 'oni' } } },
  { id: ID(12), handle: 'amy', look: null },
]);
assert.equal(inbox.length, 2, 'bad ids and look-less gifts are dropped');
assert.ok(!JSON.stringify(inbox).includes('Mochi'), 'a pet name never reaches the phone');
ok('privacy: a friend’s reply keeps only hero / stage / shiny / 3 known decor slots; names, traits, extra fields dropped');

/* 2 · gifts ---------------------------------------------------------------- */

const sticker = inbox[0]!;
const stamp = inbox[1]!;
assert.ok(circleGiftIsSticker('oni') && !circleGiftIsSticker('aurex'));
let book: CircleBook = EMPTY_CIRCLE_BOOK;
assert.equal(nextCircleGift(inbox, book)?.id, sticker.id, 'oldest first');
book = openCircleGiftBook(book, sticker)!;
assert.deepEqual(book.gifts, { oni: 1 });
assert.equal(book.stamps, 1);
assert.equal(openCircleGiftBook(book, sticker), null, 'the same gift never counts twice');
assert.equal(nextCircleGift(inbox, book)?.id, stamp.id);
book = openCircleGiftBook(book, stamp)!;
assert.deepEqual(book.gifts, { oni: 1 }, 'a hero without a sticker gives a stamp only');
assert.equal(book.stamps, 2);
assert.equal(nextCircleGift(inbox, book), null);
let many: CircleBook = EMPTY_CIRCLE_BOOK;
for (let i = 0; i < CIRCLE_OPENED_CAP + 15; i += 1) many = openCircleGiftBook(many, { ...sticker, id: ID(100 + i) })!;
assert.equal(many.opened.length, CIRCLE_OPENED_CAP, 'opened ids are capped');
assert.equal(many.stamps, CIRCLE_OPENED_CAP + 15);
assert.deepEqual(emptyHideout().circle, { gifts: {}, stamps: 0, opened: [] });
assert.deepEqual(parseHideout({}, 0).circle, { gifts: {}, stamps: 0, opened: [] }, 'an old save without the field reads as empty');
assert.deepEqual(
  parseCircleBook({ gifts: { oni: 2.6, nobody: 3, kael: -1 }, stamps: 'x', opened: [ID(1), 'nope', 5] }),
  { gifts: { oni: 2 }, stamps: 0, opened: [ID(1)] },
  'garbage is dropped, never a crash',
);
for (const h of VISITOR_STICKER_HEROES) assert.ok(allHeroes().some((x) => x.id === h), `${h}: a real hero`);
ok('gifts: a sticker (14 sticker heroes) or a stamp; one count per gift id; capped; tolerant parse');

/* 3 · economy + save ------------------------------------------------------- */

const doc0 = defaultPlayStore(Date.UTC(2026, 9, 15, 12));
const doc1 = openCircleGift(doc0, sticker)!;
assert.ok(doc1, 'a new gift opens');
assert.equal(openCircleGift(doc1, sticker), null, 'twice = no change');
const minusCircle = (d: typeof doc0) => JSON.stringify({ ...d, hideout: { ...d.hideout, circle: null } });
assert.equal(minusCircle(doc1), minusCircle(doc0), 'opening a gift changes nothing but hideout.circle (no currency, no pet, no wardrobe)');
assert.equal(doc1.tokens, doc0.tokens);
const back = parsePlayStore(JSON.stringify(doc1), Date.UTC(2026, 9, 15, 13));
assert.deepEqual(back?.hideout.circle, doc1.hideout.circle, 'the book survives the save round trip');
const payload = cloudSavePayload(doc1, Date.UTC(2026, 9, 15, 13));
assert.ok(payload, 'fits the cloud cap');
assert.deepEqual(parsePlayStore(JSON.stringify(payload.p_doc), Date.UTC(2026, 9, 15, 14))?.hideout.circle, doc1.hideout.circle, 'rides the wave96 cloud save');
ok('economy: a gift moves no tokens / shells / stones / pet tokens; the book rides the cloud save');

/* 4 · rail ----------------------------------------------------------------- */

const h = emptyHideout();
assert.deepEqual(leftRailActions('hideout', h).map((a) => a.label), ['Stash', 'Play', 'Underground', 'Explore'], 'no Circle unless the screen asks');
const withCircle = leftRailActions('hideout', h, { circle: true });
assert.deepEqual(withCircle.map((a) => a.label), ['Stash', 'Play', 'Underground', 'Explore', 'Circle']);
assert.equal(withCircle.length, RAIL_MAX_ITEMS, 'five on the rail, the cap');
assert.equal(withCircle[4]!.kind, 'circle');
for (const room of ['loft', 'garage', 'rooftop'] as const) {
  assert.ok(!leftRailActions(room, h, { circle: true }).some((a) => a.kind === 'circle'), `${room}: no Circle (their decor is the Hideout room)`);
}
const railH = RAIL_MAX_ITEMS * RAIL_BUTTON_PT + (RAIL_MAX_ITEMS - 1) * RAIL_GAP_PT;
for (const [w, hh, top] of [[375, 667, 20], [430, 932, 59]] as const) {
  const f = computeStageFrame('hideout', { width: w, height: hh }, { top, bottom: w === 375 ? 0 : 34, left: 0, right: 0 });
  assert.ok(railH <= railMaxHeight(f.stage.height), `${w}×${hh}: 5 rail buttons (${railH}) fit the stage (${railMaxHeight(f.stage.height)})`);
}
const railsSrc = read('src/play/hideout-rails.tsx');
assert.match(railsSrc, /leftRailActions\(viewed, hideout, \{ circle: onCircle != null \}\)/);
assert.match(railsSrc, /else if \(a\.kind === 'circle'\) onCircle\?\.\(\);/);
assert.match(read('src/play/hideout-art.ts'), /star: png\(ART\.icon\.streetwear\.star\)/, 'the icon comes from the art library');
ok('rail: Circle is the Hideout room’s 5th button (library star icon) and fits at 375×667 and 430×932');

/* 5 · server path ---------------------------------------------------------- */

const storeSrc = read('src/play/circle-visits-store.ts');
const rpcs = [...storeSrc.matchAll(/call(?:<[^>]+>)?\('([a-z_]+)'/g)].map((m) => m[1]).sort();
assert.deepEqual(rpcs, ['circle_gift_inbox', 'circle_open_gift', 'circle_send_gift', 'circle_visit_friends', 'circle_visit_room', 'set_circle_visit_share']);
assert.ok(!/\.from\(/.test(storeSrc), 'the phone never reads a table: RPCs only');
for (const m of storeSrc.matchAll(/\{ (p_[a-z_]+: [a-z]+(?:, p_[a-z_]+: [a-z]+)*) \}/g)) {
  for (const arg of m[1]!.split(', ')) assert.ok(/^p_(peer|id|on): (peer|id|on)$/.test(arg), `sends only an id / the switch (${arg})`);
}
const supabaseUsers = fs
  .readdirSync(path.join(root, 'src/play'))
  .filter((f) => /^circle-visits/.test(f) && /@\/lib\/supabase/.test(read(`src/play/${f}`)));
assert.deepEqual(supabaseUsers, ['circle-visits-store.ts'], 'one file talks to the server');
for (const f of ['circle-visits.ts', 'circle-visits-store.ts', 'circle-visits-ui.tsx']) {
  assert.ok(!/@\/app\//.test(read(`src/play/${f}`)), `${f}: stays in Play`);
}

const wave97 = 'supabase/migrations/wave97_circle_visits.sql';
let serverNote = 'wave97 not in this tree (server PR) — phone side only';
if (fs.existsSync(path.join(root, wave97))) {
  const sql = read(wave97);
  const shared = sql.slice(0, sql.indexOf('-- 6. Account reset')).replace(/--[^\n]*/g, '');
  const lookFn = shared.slice(shared.indexOf('create or replace function public._circle_visit_look'), shared.indexOf('$$;', shared.indexOf('create or replace function public._circle_visit_look')));
  // Object keys open a line (`'line', case …`, `'decor', coalesce(…`); the stage list sits mid-line.
  const keys = [...lookFn.matchAll(/^\s*'([a-z_]+)', /gm)].map((m) => m[1]);
  assert.match(lookFn, /jsonb_build_object\(\s*'pet', jsonb_build_object\(/, 'the outer object starts with pet');
  assert.deepEqual(keys, ['pet', 'line', 'hero', 'stage', 'shiny', 'decor'], 'the look function builds only pet{line, hero, stage, shiny} + decor');
  assert.match(lookFn, /d\.key in \('d1', 'd2', 'd3'\) and d\.value ~ '\^dc_\[a-z_\]\{1,32\}\$'/, 'decor: 3 known slots, item ids only');
  assert.doesNotMatch(lookFn, /'name'|->> ?'name'|-> ?'name'/, 'never the pet’s name');
  assert.match(shared, /revoke all on function public\._circle_visit_look\(uuid\) from public, anon, authenticated;/, 'nobody calls the look directly');
  for (const t of TRAIT_AXES) assert.ok(!new RegExp(`\\b${t}\\b`).test(shared), `no trait (${t}) anywhere in the shared part`);
  assert.doesNotMatch(shared, /\btokens\b|ato_tokens|shells|stones|ato_token_events/, 'no currency moves');
  const allowed = shared.slice(shared.indexOf('create or replace function public.circle_visit_allowed'), shared.indexOf('$$;', shared.indexOf('create or replace function public.circle_visit_allowed')));
  assert.match(allowed, /from public\.connections c\s*where c\.user_id = auth\.uid\(\) and c\.peer_id = p_peer/, 'Circle row (the scan-in model)');
  assert.match(allowed, /s\.user_id = auth\.uid\(\) and s\.peer_id = p_peer and s\.enabled/, 'my switch');
  assert.match(allowed, /s\.user_id = p_peer and s\.peer_id = auth\.uid\(\) and s\.enabled/, 'their switch');
  assert.match(allowed, /not exists \(\s*select 1 from public\.blocks b/, 'no block either way');
  assert.match(shared, /enabled boolean not null default false/, 'default off');
  assert.match(shared, /create unique index circle_gifts_one_a_day on public\.circle_gifts \(user_id, peer_id, local_day\);/, 'one gift per pair per day');
  assert.match(shared, /on conflict \(user_id, peer_id, local_day\) do nothing/);
  assert.match(shared, /revoke all on public\.circle_gifts from public, anon, authenticated;/, 'gifts: functions only');
  assert.match(shared, /revoke all on public\.circle_visit_share from public, anon, authenticated;\s*grant select on public\.circle_visit_share to authenticated;/, 'switch: read own row, written only through the RPC');
  assert.match(allowed, /s\.updated_at >= c\.created_at[\s\S]*s\.updated_at >= c\.created_at/, 'unfriend + scan back in = both switches off again');
  assert.match(shared, /where y\.look is not null and \(y\.look #>> '\{pet,hero\}'\) is not null\s*order by y\.created_at\s*limit 20/, 'inbox filters (a save with a pet hero) before its limit (no stuck gifts)');
  for (const fn of ['circle_visit_friends()', 'set_circle_visit_share(uuid, boolean)', 'circle_visit_room(uuid)', 'circle_send_gift(uuid)', 'circle_gift_inbox()', 'circle_open_gift(uuid)', 'circle_visit_allowed(uuid)']) {
    assert.ok(shared.includes(`revoke all on function public.${fn} from public, anon;`), `${fn}: not for anon`);
  }
  for (const fn of ['circle_visit_room', 'circle_send_gift']) {
    const body = shared.slice(shared.indexOf(`create or replace function public.${fn}`), shared.indexOf('$$;', shared.indexOf(`create or replace function public.${fn}`)));
    assert.match(body, /if not public\.circle_visit_allowed\(p_peer\) then/, `${fn}: both switches + Circle row checked first`);
  }
  assert.match(shared, /where g\.peer_id = uid and g\.opened_at is null and public\.circle_visit_allowed\(g\.user_id\)/, 'inbox: a switch turned off hides their gifts');
  assert.match(shared, /set_circle_visit_share[\s\S]*?not exists \(select 1 from public\.connections c where c\.user_id = uid and c\.peer_id = p_peer\)/, 'a switch only for someone in your Circle');
  serverNote = 'wave97 pinned';
}
ok(`server path: six RPCs, ids only, no table reads; ${serverNote}`);

/* 6 · screen --------------------------------------------------------------- */

const screen = read('src/play/pet-screen.tsx');
assert.match(screen, /const hideoutBusy = overlayBusy \|\| circleShown \|\| circleGiftShown \|\| circleVisit != null;/, 'cards and visits count as busy');
assert.match(screen, /idle: streetUiOn\(\) && !hideoutBusy &&/, 'no coach tip over a card or during a visit');
assert.match(screen, /onBusyChange\?\.\(hideoutBusy\);/, 'the shell knows (no tab swipe under a card)');
assert.match(screen, /const circleShown = circleOpen && !circleVisit && !awayShown && !settingsOpen && !visitorShown && !decorShown/, 'the list waits for the away / visitor / decor cards');
assert.match(screen, /const circleGiftShown = circleGiftCard != null && !awayShown && !settingsOpen/);
assert.match(screen, /circleGiftShown && circleGiftCard \? \(\s*<CircleGiftCard/, 'gift card floats');
assert.match(screen, /circleShown \? \(\s*<CircleSheet/, 'the list floats');
assert.match(screen, /circleVisit \? \(\s*<CircleVisitStrip/, 'visiting: the notice lane says whose Hideout');
assert.match(screen, /rails=\{\s*street \? \(\s*<HideoutRails\s*onCircle=\{openCircle\}\s*hidden=\{circleVisit != null\}/, 'no rails in a friend’s Hideout; Circle on the home rail');
assert.match(railsSrc, /if \(props\.hidden\) return null;/, 'hidden rails draw nothing');
assert.match(screen, /\(circleVisit \? \[\] : street \? ICONS\.filter/, 'the dock swaps Feed + Info for Gift + Home in the same row');
assert.match(screen, /onView: \(id: HideoutRoomId\) => \(circleVisit \? undefined :/, 'a swipe stays in their room');
assert.match(screen, /if \(circleVisitOn\) \{\s*leaveVisitRef\.current\(\);\s*return true;\s*\}/, 'back = home');
assert.match(screen, /const circleGiftHere = circleGift != null && \(!visitor \|\| !visitorOpen \|\| visitorGreeted\);/, 'a friend’s pet waits for today’s visitor’s hello (while the visitor is in; step 0o)');
assert.match(screen, /commit\(\(doc\) => openCircleGift\(doc, gift\)\);/, 'opening saves through the store');
assert.match(screen, /if \(!circleOpenRef\.current\) return;/, 'a visit that loads after the list closed never starts');
const room = read('src/play/pet-room.tsx');
assert.match(room, /\{decorOn && decor && !visiting \? <DecorSpots/, 'a friend’s decor has no tap spots');
assert.match(room, /const decor = visiting && circle\?\.decor \? \{ placed: circle\.decor, onTap: noDecorTap \} : ownDecor;/);
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const uiUsers = walk(path.join(root, 'src'))
  .filter((f) => /from '@\/play\/circle-visits-ui'/.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(root, f).split(path.sep).join('/'));
assert.deepEqual(uiUsers, ['src/play/pet-screen.tsx'], 'one call site: the Hideout');
const uiSrc = read('src/play/circle-visits-ui.tsx');
assert.match(uiSrc, /const LIST_H = ROW_H \* 4 \+ ROW_GAP \* 3;/);
assert.match(uiSrc, /list: \{ height: LIST_H \}/, 'the list box is fixed: loading / empty / full keep one size');
assert.match(uiSrc, /note: \{[^}]*height: 18/, 'the note line is reserved');
ok('screen: cards float and wait their turn; a visit swaps notice + dock contents, hides the rails; back = home');

/* 7 · copy ----------------------------------------------------------------- */

assert.equal(CIRCLE_VISITS_COPY_REVIEWED, true, 'emci read the copy (2026-10-15)');
assert.ok(fs.existsSync(path.join(root, 'docs/divecore/circle-visits/review.md')), 'review doc exists');
const banned = new RegExp(`\\b(${PET_BANNED_WORDS.join('|')})\\b`, 'i');
const strings: string[] = [];
const collect = (v: unknown) => {
  if (typeof v === 'string') strings.push(v);
  else if (typeof v === 'function') strings.push(String((v as (...a: unknown[]) => string)('ato_dev_longname', true)));
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(CIRCLE_UI);
for (const s of strings) {
  assert.ok(!s.includes("'"), `"${s}": curly apostrophes only`);
  assert.ok(!/\byou are\b|\byou're\b|\byou’re\b|\balways\b|\bshould\b/i.test(s), `"${s}": moment-voice bans`);
  assert.ok(!banned.test(s), `"${s}": banned Play word`);
  assert.ok(s.length <= 80, `"${s}": short`);
}
assert.ok(CIRCLE_UI.railLabel.split(/\s+/).length === 1, 'rail label is one word');
assert.ok(CIRCLE_UI.visiting('ato_dev_longname_x').length <= 32, 'visiting title fits one SE line');
const giftExample: CircleGift = sticker;
assert.ok(CIRCLE_UI.giftTitle(giftExample.handle).length <= 28);
ok(`copy: ${strings.length} strings, curly apostrophes, moment-voice bans, CIRCLE_VISITS_COPY_REVIEWED = true`);

console.log(`\ncheck:circle-visits ok — ${passed} groups`);
