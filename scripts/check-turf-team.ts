/**
 * Turf team check (pet team roadmap P5, 2026-10-18). Pins, offline against the real code:
 *   - the approved balance numbers (helper 13 / range 15 / skill 16 s, +6% per star, epic +10% range,
 *     legendary 30% splash in 4, rare +1 pounce, boss knock-out at 8);
 *   - who may help (Child+, not the leader's hero, not a bound tower hero, one per hero) and the
 *     tolerant save read (max 2, distinct, finite);
 *   - lanes: every snapped spot is off the road and every pad, from anywhere on the board;
 *   - the sim: helpers hit with their kit, stars / grade change the numbers, a boss knocks a helper out
 *     for the wave (and only that helper), a retry or a new wave stands it back up, the rare spare;
 *   - the leader's star power and epic reach;
 *   - a full wave with 3 heroes clears, and one sim step stays far inside a 60 fps frame;
 *   - the screen wiring (picker in the Setup sheet with the status badge, team placed at Call wave,
 *     faint clip on a knock-out).
 *
 * Run: npm run check:turf-team  (part of check:ota-gate)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { BOARD_MAPS } from '../src/play/board-data';
import {
  castPetPounce,
  createDefendLive,
  helperUnitId,
  placeTurfTeam,
  puffPosition,
  retryDefendLive,
  stepDefendLive,
  type DefendLive,
  type Puff,
  type TurfHelperSpec,
} from '../src/play/defend';
import { allHeroes } from '../src/play/heroes-data';
import { newPet, type PetState } from '../src/play/pet';
import {
  BOSS_KO_RADIUS,
  EPIC_RANGE_MULT,
  HELPER_BASE_ATTACK,
  HELPER_RANGE,
  HELPER_ROAD_CLEARANCE,
  HELPER_PAD_CLEARANCE,
  HELPER_SKILL_COOLDOWN_MS,
  LEGENDARY_SPLASH_PCT,
  LEGENDARY_SPLASH_RADIUS,
  RARE_POUNCE_SPARE,
  STAR_POWER_STEP,
  TURF_HELPER_SLOTS,
  defaultHelperSpot,
  helperSpotOk,
  livePicks,
  parseTurfHelpers,
  snapHelperSpot,
  starPowerMult,
  teamPounceSpare,
  turfCandidates,
} from '../src/play/turf-team';

const repo = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
let passed = 0;
const ok = (msg: string) => {
  passed += 1;
  console.log(`  ✓ ${msg}`);
};

const map = BOARD_MAPS.ato;
const T0 = Date.UTC(2026, 9, 18);
const buckets = { wavePower: 1, towerSpeed: 1, avatarLevel: 1, legendElement: null, avatarStars: 0 };
const far = { x: -500, y: -500 };

/* ------------------------------------------------------------- balance --- */
{
  assert.equal(TURF_HELPER_SLOTS, 2);
  assert.equal(HELPER_BASE_ATTACK, 13, 'helper attack 13 (60% of a hero tower)');
  assert.equal(HELPER_RANGE, 15, 'helper range = the leader');
  assert.equal(HELPER_SKILL_COOLDOWN_MS, 16_000);
  assert.equal(STAR_POWER_STEP, 0.06);
  assert.equal(EPIC_RANGE_MULT, 1.1);
  assert.equal(LEGENDARY_SPLASH_PCT, 0.3);
  assert.equal(LEGENDARY_SPLASH_RADIUS, 4);
  assert.equal(RARE_POUNCE_SPARE, 1);
  assert.equal(BOSS_KO_RADIUS, 8);
  assert.equal(starPowerMult(0), 1);
  assert.equal(starPowerMult(1), 1);
  assert.ok(Math.abs(starPowerMult(3) - 1.12) < 1e-9);
  assert.ok(Math.abs(starPowerMult(5) - 1.24) < 1e-9, '5★ = +24%');
  assert.ok(Math.abs(starPowerMult(9) - 1.24) < 1e-9, 'capped at 5★');
  assert.equal(teamPounceSpare(['common', 'epic', 'legendary']), 0);
  assert.equal(teamPounceSpare(['rare', 'rare', null]), 1, 'one rare is enough, two give no more');
  ok('balance numbers pinned (13 / 15 / 16 s, +6%/★, epic ×1.1, legendary 30% in 4, rare +1, KO 8)');
}

/* --------------------------------------------------------- who may help --- */
const heroIds = allHeroes().map((h) => h.id);
let uidNext = 1;
function pet(hero: string | null, stage: PetState['stage'], grade: PetState['grade'] = 'common'): PetState {
  return { ...newPet(T0), uid: uidNext++, hero, stage, grade: hero ? grade : null, shiny: false };
}
{
  const [a, b, c, d] = heroIds;
  const pets = [
    pet(a, 'teen'), // the leader's hero
    pet(b, 'egg'),
    pet(c, 'baby'),
    pet(d, 'child', 'rare'),
    pet(heroIds[4], 'god', 'legendary'), // bound as a tower
    pet(heroIds[5], 'adult', 'epic'),
    pet(heroIds[5], 'teen', 'common'), // a stray duplicate
    pet(null, 'child'),
  ];
  const list = turfCandidates(pets, { leaderHeroId: a, boundHeroIds: [heroIds[4]], copiesOf: (h) => (h === d ? 4 : 1) });
  assert.deepEqual(list.map((x) => x.heroId), [d, heroIds[5]], 'Child+ only, no leader, no bound hero, one per hero');
  assert.equal(list[0].stars, 4, 'stars come from the hero book copies');
  assert.equal(list[0].grade, 'rare');
  const picks = parseTurfHelpers([
    { uid: list[0].uid, x: 30, y: 200 },
    { uid: list[0].uid, x: 1, y: 1 },
    { uid: 'x', x: 1, y: 1 },
    { uid: list[1].uid, x: NaN, y: 1 },
    { uid: list[1].uid, x: 70, y: 20 },
    { uid: 999, x: 5, y: 5 },
  ]);
  assert.deepEqual(picks, [{ uid: list[0].uid, x: 30, y: 100 }, { uid: list[1].uid, x: 70, y: 20 }], 'tolerant read: distinct, finite, clamped, max 2');
  assert.deepEqual(parseTurfHelpers(undefined), []);
  assert.deepEqual(parseTurfHelpers({}), []);
  assert.deepEqual(livePicks([{ uid: 999, x: 1, y: 1 }, picks[1]], list), [picks[1]], 'a pick whose pet left is dropped');
  ok('candidates: Child+, not the leader, not a bound tower, one per hero; save read is tolerant');
}

/* ---------------------------------------------------------------- lanes --- */
{
  let checked = 0;
  for (let x = 0; x <= 100; x += 2.5) {
    for (let y = 0; y <= 100; y += 2.5) {
      const s = snapHelperSpot(map, x, y);
      assert.ok(helperSpotOk(map, s.x, s.y), `snap (${x}, ${y}) → (${s.x.toFixed(1)}, ${s.y.toFixed(1)}) is legal`);
      checked += 1;
    }
  }
  for (const p of map.path) {
    const s = snapHelperSpot(map, p.x * 100, p.y * 100);
    assert.ok(helperSpotOk(map, s.x, s.y), 'a drop on the road snaps off it');
  }
  for (const pad of map.pads) {
    const s = snapHelperSpot(map, pad.x, pad.y);
    assert.ok(Math.hypot(s.x - pad.x, s.y - pad.y) >= HELPER_PAD_CLEARANCE - 1e-6, 'a drop on a pad snaps off it');
    assert.ok(Math.hypot(s.x - pad.x, s.y - pad.y) < 25, 'and stays near where it was dropped');
  }
  const legal = snapHelperSpot(map, 50, 50);
  assert.deepEqual(snapHelperSpot(map, legal.x, legal.y), legal, 'a legal spot is kept as is');
  for (const slot of [0, 1]) {
    const s = defaultHelperSpot(map, { x: 50, y: 50 }, slot);
    assert.ok(helperSpotOk(map, s.x, s.y), 'the default spot beside the leader is legal');
  }
  for (const id of Object.keys(BOARD_MAPS) as (keyof typeof BOARD_MAPS)[]) {
    const m = BOARD_MAPS[id];
    for (let x = 5; x <= 95; x += 10) {
      const s = snapHelperSpot(m, x, 50);
      assert.ok(helperSpotOk(m, s.x, s.y), `board ${id}: snap is legal`);
    }
  }
  assert.ok(HELPER_ROAD_CLEARANCE > 5.5, 'clearance is wider than the road');
  ok(`lanes: ${checked} drops + every path point and pad snap to a legal spot (off road ≥ ${HELPER_ROAD_CLEARANCE}, off pads)`);
}

/* ------------------------------------------------------------------ sim --- */
const burstHero = allHeroes().find((h) => h.kit.behavior === 'burst')!;
assert.ok(burstHero, 'a burst hero exists');

/** A live board with one creep (spawned by the director), frozen at `dist` with huge HP. */
function boardWith(dist: number, opts: { kind?: Puff['kind']; second?: number } = {}): DefendLive {
  let s = createDefendLive(1, { mapId: 'trial', boardId: 'ato' });
  for (let i = 0; i < 400 && s.puffs.length === 0; i += 1) s = stepDefendLive(s, 100, buckets, far).state;
  const base = s.puffs[0];
  const puffs: Puff[] = [{ ...base, dist, hp: 1e9, maxHp: 1e9, kind: opts.kind ?? 'puff', slowMs: 0, slowFactor: 1 }];
  if (opts.second != null) puffs.push({ ...base, id: base.id + 1000, dist: opts.second, hp: 1e6, maxHp: 1e6, kind: 'puff', slowMs: 0, slowFactor: 1 });
  return { ...s, puffs, schedule: [] };
}
const at = (dist: number) => {
  const p = puffPosition(dist, map);
  return { x: p.x * 100, y: p.y * 100 };
};
function spec(over: Partial<TurfHelperSpec> & { x: number; y: number }): TurfHelperSpec {
  return { slot: 0, heroId: burstHero.id, stars: 1, grade: 'common', ...over };
}
/** One tick with the helper's first shot (its auto-attack: the ultimate starts on its 16 s cooldown);
 * the helper's damage on the primary. */
function helperHit(state: DefendLive): number {
  assert.ok(state.helpers.every((h) => h.skillCooldownMs === HELPER_SKILL_COOLDOWN_MS), 'the ultimate starts on cooldown');
  const step = stepDefendLive(state, 100, buckets, far);
  const hits = step.hits.filter((h) => h.sourceId === helperUnitId(0));
  assert.ok(hits.every((h) => !h.ultimate), 'no ultimate on the first tick');
  return hits[0] ? hits[0].damage[0] : 0;
}

{
  const p = at(0.3);
  const near = { x: p.x + 10, y: p.y };
  const one = helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...near, stars: 1 })], null));
  const five = helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...near, stars: 5 })], null));
  assert.ok(one > 0, 'a helper in range hits with its kit');
  assert.ok(Math.abs(five / one - 1.24) < 0.01, `5★ hits 24% harder (${(five / one).toFixed(3)})`);
  const out = { x: p.x + 16, y: p.y };
  assert.equal(helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...out, grade: 'common' })], null)), 0, 'out of reach at 16');
  assert.ok(helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...out, grade: 'epic' })], null)) > 0, 'epic reaches 16.5');
  ok('helper: kit hit in range, +24% at 5★, epic reaches 10% further');
}

{
  // Ultimate: never before 16 s, then every 16 s — and only for a hero whose art has a skill clip.
  const p = at(0.3);
  const near = { x: p.x + 10, y: p.y };
  const ultTimes = (heroId: string) => {
    let s = placeTurfTeam(boardWith(0.3), [spec({ ...near, heroId })], null);
    const times: number[] = [];
    for (let t = 100; t <= 40_000; t += 100) {
      const step = stepDefendLive(s, 100, buckets, far);
      if (step.hits.some((h) => h.sourceId === helperUnitId(0) && h.ultimate)) times.push(t);
      s = { ...step.state, puffs: step.state.puffs.map((x) => ({ ...x, dist: 0.3, hp: 1e9 })) };
    }
    return times;
  };
  const skilled = allHeroes().find((h) => h.clips.skill != null)!;
  const times = ultTimes(skilled.id);
  assert.ok(times.length >= 2, 'a skill hero casts its ultimate');
  assert.ok(times[0] >= HELPER_SKILL_COOLDOWN_MS, `first ultimate at ${times[0]} ms, not before 16 s`);
  assert.ok(Math.abs(times[1] - times[0] - HELPER_SKILL_COOLDOWN_MS) <= 200, 'then every 16 s');
  const plain = allHeroes().find((h) => h.clips.skill == null);
  if (plain) assert.deepEqual(ultTimes(plain.id), [], 'no skill clip → no ultimate');
  ok(`ultimate: first at ${times[0] / 1000} s, then every 16 s${plain ? '; none without a skill clip' : ''}`);
}

{
  // Legendary splash: the second foe 1 path-step away (within 4 units) takes 30% of the hit.
  const p = at(0.3);
  const near = { x: p.x + 8, y: p.y };
  const lenUnits = (() => {
    let total = 0;
    for (let i = 0; i < map.path.length - 1; i += 1) total += Math.hypot(map.path[i + 1].x - map.path[i].x, map.path[i + 1].y - map.path[i].y);
    return total * 100;
  })();
  const second = 0.3 + 2 / lenUnits; // 2 board units further along the road
  const run = (grade: TurfHelperSpec['grade']) => {
    const step = stepDefendLive(placeTurfTeam(boardWith(0.3, { second }), [spec({ ...near, grade })], null), 100, buckets, far);
    const hit = step.hits.find((h) => h.sourceId === helperUnitId(0))!;
    const other = step.state.puffs.find((x) => x.maxHp === 1e6)!;
    return { dealt: hit.damage[0], otherLost: 1e6 - other.hp };
  };
  const common = run('common');
  const legend = run('legendary');
  const extra = legend.otherLost - common.otherLost;
  assert.ok(Math.abs(extra - legend.dealt * 0.3) < 1e-6, `legendary splash = 30% of the hit (${extra.toFixed(2)} vs ${(legend.dealt * 0.3).toFixed(2)})`);
  ok('legendary helper: its hit splashes 30% onto a foe within 4');
}

{
  // Knock-out: a boss within 8 → that helper is out for the wave; the other keeps fighting.
  const p = at(0.3);
  const close = { x: p.x + 7, y: p.y };
  const safe = { x: p.x + 12, y: p.y };
  let s = placeTurfTeam(boardWith(0.3, { kind: 'boss' }), [spec({ ...close, slot: 0 }), spec({ ...safe, slot: 1 })], null);
  const step = stepDefendLive(s, 100, buckets, far);
  assert.deepEqual(step.knockedOut, [helperUnitId(0)], 'the close helper is knocked out, the far one is not');
  assert.equal(step.state.helpers[0].knockedOut, true);
  assert.equal(step.state.helpers[1].knockedOut, false);
  assert.ok(!step.hits.some((h) => h.sourceId === helperUnitId(0)), 'a knocked-out helper does not hit');
  assert.ok(step.hits.some((h) => h.sourceId === helperUnitId(1)), 'its partner still hits');
  s = step.state;
  for (let i = 0; i < 20; i += 1) {
    const next = stepDefendLive(s, 100, buckets, far);
    assert.ok(!next.hits.some((h) => h.sourceId === helperUnitId(0)), 'stays out for the wave');
    // (The walking boss may reach the partner later — that is its own knock-out.)
    assert.ok(!next.knockedOut.includes(helperUnitId(0)), 'knocked out once');
    s = next.state;
  }
  assert.ok(retryDefendLive(s).helpers.every((h) => !h.knockedOut), 'a retry stands the team back up');
  const nextWave = placeTurfTeam(createDefendLive(2, { mapId: 'trial', boardId: 'ato' }), [spec({ ...close })], null);
  assert.equal(nextWave.helpers[0].knockedOut, false, 'the next wave builds a fresh team');
  const noBoss = stepDefendLive(placeTurfTeam(boardWith(0.3), [spec({ ...close })], null), 100, buckets, far);
  assert.deepEqual(noBoss.knockedOut, [], 'a normal creep never knocks a helper out');
  ok('knock-out: a boss within 8 drops that helper for the wave only; retry / next wave bring it back');
}

{
  // Rare pounce spare.
  const p = at(0.3);
  const rare = placeTurfTeam(boardWith(0.3), [spec({ x: p.x + 10, y: p.y, grade: 'rare' })], null);
  assert.equal(rare.petPounceSpare, 1);
  const first = castPetPounce(rare, p, 40, null);
  assert.ok(first);
  const second = castPetPounce(first.state, p, 40, null);
  assert.ok(second, 'a rare on the team: a second pounce');
  assert.equal(castPetPounce(second.state, p, 40, null), null, 'and no third');
  assert.equal(retryDefendLive(second.state).petPounceSpare, 1, 'a retry gives the spare back');
  const leaderRare = placeTurfTeam(boardWith(0.3), [], 'rare');
  assert.equal(leaderRare.petPounceSpare, 1, 'a rare leader counts too');
  const plain = placeTurfTeam(boardWith(0.3), [spec({ x: p.x + 10, y: p.y, grade: 'epic' })], 'common');
  const once = castPetPounce(plain, p, 40, null)!;
  assert.equal(castPetPounce(once.state, p, 40, null), null, 'no rare: once per wave as before');
  ok('rare: +1 pounce per fight (leader or helper), restored on retry; none without a rare');
}

{
  // Leader: stars scale the leader's own hit; epic reaches further.
  const p = at(0.3);
  const leaderAt = { x: p.x + 10, y: p.y };
  const lost = (extra: object, where = leaderAt) => {
    const s = boardWith(0.3);
    const step = stepDefendLive(s, 100, { ...buckets, ...extra }, where);
    return 1e9 - step.state.puffs[0].hp;
  };
  const one = lost({ leaderStars: 1 });
  const five = lost({ leaderStars: 5 });
  assert.ok(one > 0);
  assert.ok(Math.abs(five / one - 1.24) < 0.01, `leader 5★ hits 24% harder (${(five / one).toFixed(3)})`);
  assert.equal(lost({}), one, 'no leader stars = ×1 (older callers)');
  const edge = { x: p.x + 15.8, y: p.y };
  assert.equal(lost({ leaderGrade: 'common' }, edge), 0, 'leader out of reach at 15.8');
  assert.ok(lost({ leaderGrade: 'epic' }, edge) > 0, 'an epic leader reaches it');
  ok('leader: +6% per star above 1, epic +10% reach');
}

{
  // A full wave with 3 heroes: leader + 2 helpers beside the road, no towers; it clears, every helper
  // fires, and one sim step costs a tiny slice of a 60 fps frame (16.7 ms).
  const strong = { ...buckets, wavePower: 3 };
  const p = at(0.8); // the leader guards the end; the helpers stand by the first half of the road
  const spots = [0.25, 0.5].map((d, slot) => defaultHelperSpot(map, at(d), slot));
  const heroes = allHeroes().filter((h) => h.id !== burstHero.id);
  let s = placeTurfTeam(
    createDefendLive(3, { mapId: 'trial', boardId: 'ato' }),
    [
      { slot: 0, heroId: burstHero.id, x: spots[0].x, y: spots[0].y, stars: 3, grade: 'epic' },
      { slot: 1, heroId: heroes[0].id, x: spots[1].x, y: spots[1].y, stars: 1, grade: 'legendary' },
    ],
    'rare',
  );
  const fired = new Set<number>();
  let ticks = 0;
  let worst = 0;
  const started = process.hrtime.bigint();
  let result: ReturnType<typeof stepDefendLive> | null = null;
  while (ticks < 3000) {
    const t0 = process.hrtime.bigint();
    result = stepDefendLive(s, 100, strong, p);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ticks > 20) worst = Math.max(worst, ms);
    for (const h of result.hits) if (h.sourceId < 0) fired.add(h.sourceId);
    s = result.state;
    ticks += 1;
    if (result.done || result.leak) break;
  }
  const avg = Number(process.hrtime.bigint() - started) / 1e6 / ticks;
  assert.ok(result?.done && !result.leak, 'the 3-hero wave clears');
  assert.ok(fired.has(helperUnitId(0)) && fired.has(helperUnitId(1)), 'both helpers fought');
  assert.ok(avg < 2, `a sim step averages ${avg.toFixed(3)} ms (budget: well under one 16.7 ms frame)`);
  ok(`3-hero wave clears in ${ticks} ticks; both helpers fire; step avg ${avg.toFixed(3)} ms, worst ${worst.toFixed(2)} ms`);
}

/* --------------------------------------------------------------- screen --- */
{
  const screen = read('src/play/defend-screen.tsx');
  const card = read('src/play/turf-team-card.tsx');
  const sheetAt = screen.indexOf('title="Setup"');
  const cardAt = screen.indexOf('<TurfTeamCard');
  assert.ok(sheetAt > 0 && cardAt > sheetAt, 'the picker sits inside the Setup sheet body');
  assert.match(card, /<PetStatusBadge status=\{[a-zA-Z]+\} variant="strip" \/>/, 'the picker reuses PetStatusBadge');
  assert.ok(!/height: \d/.test(card.replace(/minHeight: \d+/g, '')), 'the picker has no fixed heights (Larger Text grows the scroll)');
  assert.match(screen, /placeTurfTeam\(base, helperSpecsFor\(/, 'Call wave puts the team on the board');
  assert.match(screen, /castActorFaintFrame\(now, koAt, role\)/, 'a knocked-out helper plays its faint clip');
  assert.match(screen, /snapHelperSpot\(boardMap, bx, by\)/, 'a board drop snaps the helper off the road and pads');
  assert.match(screen, /!sim\.petPounceUsed \|\| sim\.petPounceSpare > 0/, 'the pounce button counts the rare spare');
  const skin = read('src/play/skin.ts');
  assert.match(skin, /export function resolveTurfHelperKit/, 'helpers draw from the hero kit + faint');
  const store = read('src/play/playStore.ts');
  assert.match(store, /turf_helpers: parseTurfHelpers\(data\.turf_helpers\)/, 'the save field is an additive v33 read');
  assert.match(store, /version: 33/, 'save stays v33');
  ok('screen: picker in the Setup sheet with the badge, team placed at Call wave, faint on KO, save stays v33');
}

console.log(`\ncheck:turf-team — ${passed} groups passed.`);
