/**
 * Turf team check (pet team roadmap P5 → P5b "one AI helper", 2026-10-18). Pins, offline against the
 * real code:
 *   - the approved P5b numbers (1 slot, attack 20, range 15, leash 15, follow gap 6, walk 40 / run back
 *     50, skill first 6 s then every 14 s, boss swing every 5 s within 8, daze 4 s, get-up 0.6 s,
 *     daze-proof 11 s) and the kept star / grade perks;
 *   - who may help and the tolerant save read (one pick; an old 2-pick P5 save reads as its first);
 *   - lanes: every snapped / follow spot is legal (off road and pads), the follow spot is inside the leash;
 *   - movement: follows the leader, chases boss first inside the leash, only steps onto the road for a boss;
 *   - the sim: kit hits, stars / grade, its own hero skill cadence, legendary splash, the daze cycle
 *     (never removed, normal creeps never daze it, daze-proof after getting up), rare spare, leader perks;
 *   - a full wave with leader + helper clears, the helper fights and casts, never out for the wave, and
 *     one sim step stays far inside a 60 fps frame;
 *   - the screen wiring (picker in the Setup sheet, one slot, no Move / tap-to-place, movement on shared
 *     values with no new interval, walk / faint / get-up clips, save stays v33);
 *   - balance (Divecore finish step 6): the six wave-table edits, hero towers at 40 scrap, and Trial 4
 *     needing no more than Trial 5 with the average helper (see games/grove/BALANCE_REPORT.md).
 *
 * Run: npm run check:turf-team  (part of check:ota-gate)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { BOARD_MAPS } from '../src/play/board-data';
import { waveDefFor } from '../src/play/director';
import {
  AVATAR_RANGE,
  HERO_TOWER_STATS,
  TOWER_DEFS,
  castPetPounce,
  createDefendLive,
  heroCastSkill,
  helperUnitId,
  placeTower,
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
  BOSS_SWING_MS,
  BOSS_SWING_RADIUS,
  EPIC_RANGE_MULT,
  HELPER_BASE_ATTACK,
  HELPER_BOSS_CLOSE,
  HELPER_DAZE_MS,
  HELPER_DAZE_PROOF_MS,
  HELPER_FOLLOW_GAP,
  HELPER_GET_UP_MS,
  HELPER_LEASH,
  HELPER_MOVE_SPEED,
  HELPER_PAD_CLEARANCE,
  HELPER_RANGE,
  HELPER_RETURN_SPEED,
  HELPER_ROAD_CLEARANCE,
  HELPER_SKILL_COOLDOWN_MS,
  HELPER_SKILL_FIRST_MS,
  LEGENDARY_SPLASH_PCT,
  LEGENDARY_SPLASH_RADIUS,
  RARE_POUNCE_SPARE,
  STAR_POWER_STEP,
  TURF_HELPER_SLOTS,
  helperFollowSpot,
  helperGoal,
  helperOffRoad,
  helperSpotOk,
  livePicks,
  parseTurfHelpers,
  pickHelperChase,
  snapHelperSpot,
  starPowerMult,
  stepHelperToward,
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
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------- balance --- */
{
  assert.equal(TURF_HELPER_SLOTS, 1, 'one AI helper');
  assert.equal(HELPER_BASE_ATTACK, 20);
  assert.equal(HELPER_RANGE, 15, 'helper range = the leader');
  assert.equal(HELPER_LEASH, 15);
  assert.equal(HELPER_FOLLOW_GAP, 6);
  assert.equal(HELPER_MOVE_SPEED, 40);
  assert.equal(HELPER_RETURN_SPEED, 50);
  assert.equal(HELPER_SKILL_FIRST_MS, 6_000);
  assert.equal(HELPER_SKILL_COOLDOWN_MS, 14_000);
  assert.equal(BOSS_SWING_MS, 5_000);
  assert.equal(BOSS_SWING_RADIUS, 8);
  assert.equal(HELPER_DAZE_MS, 4_000);
  assert.equal(HELPER_GET_UP_MS, 600);
  assert.equal(HELPER_DAZE_PROOF_MS, 11_000);
  assert.ok(HELPER_BOSS_CLOSE < BOSS_SWING_RADIUS, 'chasing a boss puts the helper inside its swing (the risk)');
  assert.equal(STAR_POWER_STEP, 0.06);
  assert.equal(EPIC_RANGE_MULT, 1.1);
  assert.equal(LEGENDARY_SPLASH_PCT, 0.3);
  assert.equal(LEGENDARY_SPLASH_RADIUS, 4);
  assert.equal(RARE_POUNCE_SPARE, 1);
  assert.equal(starPowerMult(0), 1);
  assert.equal(starPowerMult(1), 1);
  assert.ok(Math.abs(starPowerMult(3) - 1.12) < 1e-9);
  assert.ok(Math.abs(starPowerMult(5) - 1.24) < 1e-9, '5★ = +24%');
  assert.ok(Math.abs(starPowerMult(9) - 1.24) < 1e-9, 'capped at 5★');
  assert.equal(teamPounceSpare(['common', 'epic', 'legendary']), 0);
  assert.equal(teamPounceSpare(['rare', 'rare', null]), 1, 'one rare is enough, two give no more');
  ok('P5b numbers pinned (1 slot, 20 / 15, leash 15, 40 & 50 u/s, skill 6 s then 14 s, swing 5 s in 8, daze 4 s, proof 11 s)');
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
  // An old P5 save with 2 picks reads as its first valid pick; a missing / bad spot is tolerated.
  const old = parseTurfHelpers([
    { uid: 'x', x: 1, y: 1 },
    { uid: list[0].uid, x: 30, y: 200 },
    { uid: list[1].uid, x: 70, y: 20 },
  ]);
  assert.deepEqual(old, [{ uid: list[0].uid, x: 30, y: 100 }], 'old 2-pick save → its first valid pick');
  assert.deepEqual(parseTurfHelpers([{ uid: list[1].uid }]), [{ uid: list[1].uid, x: 50, y: 50 }], 'a pick without a spot still reads');
  assert.deepEqual(parseTurfHelpers([{ uid: list[1].uid, x: NaN, y: 1 }]), [{ uid: list[1].uid, x: 50, y: 1 }]);
  assert.deepEqual(parseTurfHelpers(undefined), []);
  assert.deepEqual(parseTurfHelpers({}), []);
  assert.deepEqual(livePicks([{ uid: 999, x: 1, y: 1 }], list), [], 'a pick whose pet left is dropped');
  ok('candidates: Child+, not the leader, not a bound tower, one per hero; save read keeps one pick');
}

/* ---------------------------------------------------------------- lanes --- */
{
  let checked = 0;
  for (let x = 0; x <= 100; x += 2.5) {
    for (let y = 0; y <= 100; y += 2.5) {
      const s = snapHelperSpot(map, x, y);
      assert.ok(helperSpotOk(map, s.x, s.y), `snap (${x}, ${y}) is legal`);
      checked += 1;
    }
  }
  for (const p of map.path) {
    const s = snapHelperSpot(map, p.x * 100, p.y * 100);
    assert.ok(helperSpotOk(map, s.x, s.y), 'a spot on the road snaps off it');
  }
  for (const pad of map.pads) {
    const s = snapHelperSpot(map, pad.x, pad.y);
    assert.ok(dist(s, pad) >= HELPER_PAD_CLEARANCE - 1e-6, 'a spot on a pad snaps off it');
    assert.ok(dist(s, pad) < 25, 'and stays near it');
  }
  const legal = snapHelperSpot(map, 50, 50);
  assert.deepEqual(snapHelperSpot(map, legal.x, legal.y), legal, 'a legal spot is kept as is');
  let follows = 0;
  let legalFollows = 0;
  let pastLeash = 0;
  let worstKnot = 0;
  for (const id of Object.keys(BOARD_MAPS) as (keyof typeof BOARD_MAPS)[]) {
    const m = BOARD_MAPS[id];
    for (let x = 2.5; x <= 97.5; x += 2.5) {
      for (let y = 2.5; y <= 97.5; y += 2.5) {
        const leader = { x, y };
        const f = helperFollowSpot(m, leader);
        // Always off the road. Inside the leash unless the leader stands in a road knot with no off-road
        // point within 15 — then the nearest legal spot, a little past it (lanes win).
        assert.ok(helperOffRoad(m, f.x, f.y), `board ${id}: follow spot for (${x}, ${y}) off the road`);
        const d = dist(f, leader);
        if (d > HELPER_LEASH + 1e-6) {
          assert.ok(helperSpotOk(m, f.x, f.y) && d < 2 * HELPER_LEASH, `board ${id}: a knot spot for (${x}, ${y}) is legal and near (${d.toFixed(1)})`);
          pastLeash += 1;
          worstKnot = Math.max(worstKnot, d);
        }
        if (helperSpotOk(m, f.x, f.y)) legalFollows += 1;
        else if (id === 'ato') assert.fail(`ato: follow spot for (${x}, ${y}) off road and pads`);
        if (id === 'ato') assert.ok(d <= HELPER_LEASH + 1e-6, `ato: follow spot for (${x}, ${y}) inside the leash`);
        assert.deepEqual(helperFollowSpot(m, leader), f, 'deterministic');
        follows += 1;
      }
    }
  }
  assert.ok(HELPER_ROAD_CLEARANCE > 5.5, 'clearance is wider than the road');
  assert.ok(legalFollows / follows > 0.95, 'almost every follow spot is off the pads too');
  assert.ok(pastLeash / follows < 0.05, 'road knots are rare');
  ok(`lanes: ${checked} snaps legal; ${follows} follow spots off the road (${legalFollows} off pads too, ${pastLeash} road-knot spots past the leash, worst ${worstKnot.toFixed(1)})`);
}

/* ------------------------------------------------------ movement (pure) --- */
const at = (d: number) => {
  const p = puffPosition(d, map);
  return { x: p.x * 100, y: p.y * 100 };
};
{
  const leader = { x: 50, y: 50 };
  const self = helperFollowSpot(map, leader);
  const creep = { id: 1, ...at(0.4), boss: false };
  const boss = { id: 2, ...at(0.45), boss: true };
  const farFoe = { id: 3, x: leader.x + HELPER_LEASH + HELPER_RANGE + 2, y: leader.y, boss: true };
  assert.equal(pickHelperChase(leader, self, [creep, boss], HELPER_RANGE)?.id ?? null, dist(boss, leader) <= HELPER_LEASH + HELPER_RANGE ? 2 : creep.id);
  assert.equal(pickHelperChase(leader, self, [farFoe], HELPER_RANGE), null, 'a foe it could not reach inside the leash is ignored');
  assert.deepEqual(helperGoal(map, leader, self, null, HELPER_RANGE), self, 'nothing to chase → its follow spot');
  // Over a grid of leaders and foes on the road: a goal never leaves the leash; only a boss chase may use the road.
  let goals = 0;
  for (let lx = 10; lx <= 90; lx += 10) {
    for (let ly = 10; ly <= 90; ly += 10) {
      const L = { x: lx, y: ly };
      const S = helperFollowSpot(map, L);
      for (let d = 0.05; d < 1; d += 0.1) {
        const p = at(d);
        const g = helperGoal(map, L, S, { id: 9, ...p, boss: false }, HELPER_RANGE);
        assert.ok(dist(g, L) <= HELPER_LEASH + 1e-6, 'a creep chase stays inside the leash');
        assert.ok(helperSpotOk(map, g.x, g.y), 'a creep chase stays off the road');
        const gb = helperGoal(map, L, S, { id: 9, ...p, boss: true }, HELPER_RANGE);
        assert.ok(dist(gb, L) <= HELPER_LEASH + 1e-6, 'a boss chase stays inside the leash');
        goals += 2;
      }
    }
  }
  // A boss chase closes to HELPER_BOSS_CLOSE when the leash allows (here: the boss beside the leader).
  const bossNear = { id: 5, x: 60, y: 50, boss: true };
  const gb = helperGoal(map, { x: 55, y: 50 }, { x: 40, y: 50 }, bossNear, HELPER_RANGE);
  assert.ok(Math.abs(dist(gb, bossNear) - HELPER_BOSS_CLOSE) < 1e-6, 'a boss chase closes in to 6');
  const s1 = stepHelperToward({ x: 0, y: 0 }, { x: 100, y: 0 }, HELPER_MOVE_SPEED, 100);
  assert.ok(Math.abs(s1.x - 4) < 1e-9 && Math.abs(s1.moved - 4) < 1e-9, '40 u/s = 4 units a 100 ms tick');
  assert.deepEqual(stepHelperToward({ x: 0, y: 0 }, { x: 1, y: 0 }, HELPER_MOVE_SPEED, 100), { x: 1, y: 0, moved: 1 }, 'lands on the goal');
  ok(`movement: boss first inside leash + range; ${goals} goals inside the leash, off road unless a boss; 40 u/s`);
}

/* ------------------------------------------------------------------ sim --- */
const burstHero = allHeroes().find((h) => h.kit.behavior === 'burst')!;
assert.ok(burstHero, 'a burst hero exists');

/** A live board with one creep (spawned by the director), frozen at `dist` with huge HP. */
function boardWith(d: number, opts: { kind?: Puff['kind']; second?: number } = {}): DefendLive {
  let s = createDefendLive(1, { mapId: 'trial', boardId: 'ato' });
  for (let i = 0; i < 400 && s.puffs.length === 0; i += 1) s = stepDefendLive(s, 100, buckets, { x: 50, y: 50 }).state;
  const base = s.puffs[0];
  const puffs: Puff[] = [{ ...base, dist: d, hp: 1e9, maxHp: 1e9, kind: opts.kind ?? 'puff', slowMs: 0, slowFactor: 1 }];
  if (opts.second != null) puffs.push({ ...base, id: base.id + 1000, dist: opts.second, hp: 1e6, maxHp: 1e6, kind: 'puff', slowMs: 0, slowFactor: 1 });
  return { ...s, puffs, schedule: [], helpers: [] };
}
/** Keep the board's creeps frozen in place with full HP (so a test isolates the helper). */
const freeze = (s: DefendLive, d: number) => ({ ...s, puffs: s.puffs.map((x) => ({ ...x, dist: d, hp: x.maxHp, slowMs: 0, slowFactor: 1 })) });
function spec(over: Partial<TurfHelperSpec> & { x: number; y: number }): TurfHelperSpec {
  return { slot: 0, heroId: burstHero.id, stars: 1, grade: 'common', ...over };
}
/** One 1 ms tick (the helper barely moves: 0.04 units) — its first auto-attack on the primary. */
function helperHit(state: DefendLive, leader: { x: number; y: number }): number {
  const step = stepDefendLive(state, 1, buckets, leader);
  const hits = step.hits.filter((h) => h.sourceId === helperUnitId(0));
  return hits[0] ? hits[0].damage[0] : 0;
}

{
  // Kit hit numbers (the leader stands on the helper, so it stays inside the leash).
  const p = at(0.3);
  const near = { x: p.x + 10, y: p.y };
  const one = helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...near, stars: 1 })], null), near);
  const five = helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...near, stars: 5 })], null), near);
  assert.ok(one > 0, 'a helper in range hits with its kit');
  assert.ok(Math.abs(five / one - 1.24) < 0.01, `5★ hits 24% harder (${(five / one).toFixed(3)})`);
  const out = { x: p.x + 16, y: p.y };
  assert.equal(helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...out, grade: 'common' })], null), out), 0, 'out of reach at 16');
  assert.ok(helperHit(placeTurfTeam(boardWith(0.3), [spec({ ...out, grade: 'epic' })], null), out) > 0, 'epic reaches 16.5');
  ok('helper: kit hit in range, +24% at 5★, epic reaches 10% further');
}

{
  // Follow: the leader walks off 30 units; the helper walks after it at 40 u/s and ends at its follow
  // spot, inside the leash, with the walk flag on while it moves.
  const L0 = { x: 30, y: 30 };
  const L1 = { x: 60, y: 30 };
  const start = helperFollowSpot(map, L0);
  let s = placeTurfTeam({ ...boardWith(0.3), puffs: [] }, [spec({ ...start })], null);
  let movedTicks = 0;
  for (let t = 0; t < 30; t += 1) {
    const before = s.helpers[0];
    s = stepDefendLive(s, 100, buckets, L1).state;
    const h = s.helpers[0];
    const step = dist(before, h);
    assert.ok(step <= 4 + 1e-6, 'never faster than 40 u/s');
    if (h.moving) movedTicks += 1;
  }
  const end = helperFollowSpot(map, L1);
  assert.ok(dist(s.helpers[0], end) < 1e-6, 'it ends at its follow spot beside the leader');
  assert.ok(dist(s.helpers[0], L1) <= HELPER_LEASH, 'inside the leash');
  assert.equal(s.helpers[0].moving, false, 'standing still at the end');
  assert.ok(movedTicks >= 6, 'the walk flag was on while it walked');
  ok(`follow: walks after the leader at 40 u/s (${movedTicks} walking ticks), ends at its follow spot`);
}

{
  // Chase: a creep in the window → it closes to ~80% of its range, never leaving the leash or using the
  // road; a boss → it closes in to 6 (onto the road if need be) and is soon inside the swing.
  const p = at(0.3);
  const leader = { x: p.x, y: p.y - 14 };
  let s = placeTurfTeam(boardWith(0.3), [spec(helperFollowSpot(map, leader))], null);
  for (let t = 0; t < 30; t += 1) {
    s = freeze(stepDefendLive(s, 100, buckets, leader).state, 0.3);
    const h = s.helpers[0];
    assert.ok(dist(h, leader) <= HELPER_LEASH + 1e-6, 'chasing a creep stays inside the leash');
    assert.ok(helperSpotOk(map, h.x, h.y), 'chasing a creep keeps it off the road');
  }
  assert.ok(dist(s.helpers[0], p) <= HELPER_RANGE, 'it brought the creep into its range');
  let b = placeTurfTeam(boardWith(0.3, { kind: 'boss' }), [spec(helperFollowSpot(map, leader))], null);
  let closest = Infinity;
  for (let t = 0; t < 30; t += 1) {
    b = freeze(stepDefendLive(b, 100, buckets, leader).state, 0.3);
    const h = b.helpers[0];
    if (h.dazedMs > 0) break;
    assert.ok(dist(h, leader) <= HELPER_LEASH + 1e-6, 'chasing a boss stays inside the leash');
    closest = Math.min(closest, dist(h, p));
  }
  assert.ok(closest <= BOSS_SWING_RADIUS, `a boss chase closes in to ${closest.toFixed(1)} (inside its swing)`);
  ok(`chase: creep in range off the road; boss chased to ${closest.toFixed(1)} — all inside the leash`);
}

{
  // Its own hero skill: never before 6 s, then every 14 s, only with a foe inside the veil.
  const p = at(0.3);
  const leader = { x: p.x + 10, y: p.y };
  const hero = allHeroes().find((h) => heroCastSkill(h.id).radius >= HELPER_RANGE) ?? burstHero;
  const casts = (puffs: boolean) => {
    let s = placeTurfTeam(puffs ? boardWith(0.3) : { ...boardWith(0.3), puffs: [] }, [spec({ ...leader, heroId: hero.id })], null);
    const times: number[] = [];
    for (let t = 100; t <= 40_000; t += 100) {
      const step = stepDefendLive(s, 100, buckets, leader);
      if (step.helperCasts.includes(helperUnitId(0))) times.push(t);
      s = puffs ? freeze(step.state, 0.3) : step.state;
    }
    return times;
  };
  const times = casts(true);
  assert.ok(times.length >= 2, `${hero.id} casts its own skill`);
  assert.ok(times[0] >= HELPER_SKILL_FIRST_MS && times[0] <= HELPER_SKILL_FIRST_MS + 200, `first cast at ${times[0]} ms (6 s)`);
  assert.ok(Math.abs(times[1] - times[0] - HELPER_SKILL_COOLDOWN_MS) <= 200, 'then every 14 s');
  assert.deepEqual(casts(false), [], 'no foe in the veil → no cast (the skill waits)');
  ok(`skill: ${heroCastSkill(hero.id).name} first at ${times[0] / 1000} s, then every 14 s; none with no foe near`);
}

{
  // Legendary splash: the second foe 2 units further along the road takes 30% of the hit.
  const p = at(0.3);
  const near = { x: p.x + 8, y: p.y };
  const lenUnits = (() => {
    let total = 0;
    for (let i = 0; i < map.path.length - 1; i += 1) total += Math.hypot(map.path[i + 1].x - map.path[i].x, map.path[i + 1].y - map.path[i].y);
    return total * 100;
  })();
  const second = 0.3 + 2 / lenUnits;
  const run = (grade: TurfHelperSpec['grade']) => {
    const step = stepDefendLive(placeTurfTeam(boardWith(0.3, { second }), [spec({ ...near, grade })], null), 1, buckets, near);
    const hit = step.hits.find((h) => h.sourceId === helperUnitId(0))!;
    const other = step.state.puffs.find((x) => x.maxHp === 1e6)!;
    return { dealt: hit.damage[0], otherLost: 1e6 - other.hp, step, otherId: other.id };
  };
  const common = run('common');
  const legend = run('legendary');
  // Display only: the splash comes with its own element-coloured entry (not in `hits`: no second shot / hit stop).
  assert.deepEqual(common.step.splashHits, [], 'a common helper has no splash entry');
  if (burstHero.kit.element) {
    assert.equal(legend.step.splashHits.length, 1, 'a legendary splash reports one entry');
    const sp = legend.step.splashHits[0];
    assert.deepEqual(sp.puffIds, [legend.otherId], 'only the splashed foe is a victim');
    assert.equal(sp.behavior, 'splash');
    assert.equal(sp.element, burstHero.kit.element, "in the helper's element colour");
    assert.equal(sp.radius, LEGENDARY_SPLASH_RADIUS);
    assert.equal(sp.ultimate, false, 'no ultimate → no hit stop');
    assert.equal(sp.centredOnSource, true, 'the ring is centred on the target, so no bolt travels from the helper');
    assert.ok(Math.hypot(sp.from.x - near.x, sp.from.y - near.y) > 1, 'the ring sits on the target, not on the helper');
    assert.equal(legend.step.hits.filter((h) => h.sourceId === helperUnitId(0)).length, 1, 'the splash is not a second hit');
  } else {
    assert.deepEqual(legend.step.splashHits, [], 'an element-less helper draws no splash effect');
  }
  const extra = legend.otherLost - common.otherLost;
  assert.ok(Math.abs(extra - legend.dealt * 0.3) < 1e-6, `legendary splash = 30% of the hit (${extra.toFixed(2)})`);
  ok('legendary helper: its hit splashes 30% onto a foe within 4');
}

{
  // The daze cycle, with a boss parked right beside the helper and the leader beside both:
  // 5 s of swings-in-reach → dazed (down 4 s, no hits, no walking) → gets up (0.6 s) → runs back →
  // 11 s daze-proof from getting up (two swings absorbed at +5 s and +10 s) → the +15 s swing dazes it again. It is never removed.
  const p = at(0.3);
  const spot = { x: p.x + 5, y: p.y };
  let s = placeTurfTeam(boardWith(0.3, { kind: 'boss' }), [spec(spot)], null);
  const events: { t: number; kind: string }[] = [];
  let downTicks = 0;
  for (let t = 100; t <= 40_000; t += 100) {
    const before = s.helpers[0];
    const step = stepDefendLive(s, 100, buckets, spot);
    if (step.dazed.includes(helperUnitId(0))) events.push({ t, kind: 'dazed' });
    if (step.gotUp.includes(helperUnitId(0))) events.push({ t, kind: 'up' });
    const h = step.state.helpers[0];
    assert.equal(step.state.helpers.length, 1, 'the helper is never removed');
    if (before.dazedMs > 0 || before.getUpMs > 0) {
      downTicks += 1;
      assert.ok(!step.hits.some((x) => x.sourceId === helperUnitId(0)), 'a dazed helper does not hit');
      assert.ok(dist(before, h) < 1e-9, 'a dazed helper does not walk');
    }
    s = freeze(step.state, 0.3);
  }
  const dazes = events.filter((e) => e.kind === 'dazed').map((e) => e.t);
  const ups = events.filter((e) => e.kind === 'up').map((e) => e.t);
  assert.ok(dazes.length >= 2, `dazed more than once (${dazes.join(', ')})`);
  assert.ok(Math.abs(dazes[0] - BOSS_SWING_MS) <= 100, `first daze after one 5 s swing (${dazes[0]})`);
  assert.ok(Math.abs(ups[0] - dazes[0] - HELPER_DAZE_MS) <= 100, `down 4 s (${ups[0] - dazes[0]} ms)`);
  const standAt = ups[0] + HELPER_GET_UP_MS;
  assert.ok(dazes[1] - standAt >= HELPER_DAZE_PROOF_MS - 100, `daze-proof 11 s after getting up (next daze ${dazes[1] - standAt} ms later)`);
  assert.ok(dazes[1] - standAt >= 2 * BOSS_SWING_MS, 'two boss swings are absorbed before the next daze');
  assert.ok(downTicks < 400 * 0.6, 'down well under the whole run');
  // A normal creep never dazes it; a retry and a new wave stand it up fresh.
  let c = placeTurfTeam(boardWith(0.3), [spec(spot)], null);
  for (let t = 0; t < 200; t += 1) {
    const step = stepDefendLive(c, 100, buckets, spot);
    assert.deepEqual(step.dazed, [], 'a normal creep never dazes the helper');
    c = freeze(step.state, 0.3);
  }
  const downNow = { ...s, helpers: s.helpers.map((h) => ({ ...h, dazedMs: 2_000 })) };
  assert.ok(retryDefendLive(downNow).helpers.every((h) => h.dazedMs === 0 && h.getUpMs === 0), 'a retry stands it up');
  const fresh = placeTurfTeam(createDefendLive(2, { mapId: 'trial', boardId: 'ato' }), [spec(spot)], null);
  assert.equal(fresh.helpers[0].dazedMs, 0, 'a new wave builds it fresh');
  assert.equal(fresh.helpers[0].skillCooldownMs, HELPER_SKILL_FIRST_MS);
  ok(`daze: first at ${dazes[0] / 1000} s, down 4 s, up 0.6 s, proof 11 s, again at ${dazes[1] / 1000} s; never removed; creeps never daze`);
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
  assert.equal(placeTurfTeam(boardWith(0.3), [], 'rare').petPounceSpare, 1, 'a rare leader counts too');
  const plain = placeTurfTeam(boardWith(0.3), [spec({ x: p.x + 10, y: p.y, grade: 'epic' })], 'common');
  const once = castPetPounce(plain, p, 40, null)!;
  assert.equal(castPetPounce(once.state, p, 40, null), null, 'no rare: once per wave as before');
  const two = placeTurfTeam(boardWith(0.3), [spec({ x: 1, y: 1 }), spec({ x: 2, y: 2, slot: 1 })], null);
  assert.equal(two.helpers.length, 1, 'only one helper goes on the board');
  ok('rare: +1 pounce per fight (leader or helper), restored on retry; one helper on the board');
}

{
  // Leader: stars scale the leader's own hit; epic reaches further.
  const p = at(0.3);
  const leaderAt = { x: p.x + 10, y: p.y };
  const lost = (extra: object, where = leaderAt) => {
    const step = stepDefendLive(boardWith(0.3), 100, { ...buckets, ...extra }, where);
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
  // A full wave: leader + the helper, no towers. It clears, the helper fights and casts, it is never
  // out for the whole wave, and one sim step costs a tiny slice of a 60 fps frame (16.7 ms).
  const strong = { ...buckets, wavePower: 3 };
  const leader = at(0.6);
  const start = helperFollowSpot(map, leader);
  let s = placeTurfTeam(
    createDefendLive(3, { mapId: 'trial', boardId: 'ato' }),
    [{ slot: 0, heroId: burstHero.id, x: start.x, y: start.y, stars: 3, grade: 'legendary' }],
    'rare',
  );
  let fired = false;
  let cast = false;
  let ticks = 0;
  let down = 0;
  let worst = 0;
  const started = process.hrtime.bigint();
  let result: ReturnType<typeof stepDefendLive> | null = null;
  while (ticks < 3000) {
    const t0 = process.hrtime.bigint();
    result = stepDefendLive(s, 100, strong, leader);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ticks > 20) worst = Math.max(worst, ms);
    if (result.hits.some((h) => h.sourceId === helperUnitId(0))) fired = true;
    if (result.helperCasts.length > 0) cast = true;
    const h = result.state.helpers[0];
    if (h.dazedMs > 0 || h.getUpMs > 0) down += 1;
    assert.ok(dist(h, leader) <= HELPER_LEASH + 1e-6, 'the helper never leaves the leash');
    s = result.state;
    ticks += 1;
    if (result.done || result.leak) break;
  }
  const avg = Number(process.hrtime.bigint() - started) / 1e6 / ticks;
  assert.ok(result?.done && !result.leak, 'the wave clears');
  assert.ok(fired, 'the helper fought');
  assert.ok(cast, 'the helper cast its own skill');
  assert.ok(down < ticks, 'the helper was never out for the whole wave');
  assert.ok(avg < 2, `a sim step averages ${avg.toFixed(3)} ms (budget: well under one 16.7 ms frame)`);
  ok(`wave clears in ${ticks} ticks; helper fights + casts, down ${down} ticks; step avg ${avg.toFixed(3)} ms, worst ${worst.toFixed(2)} ms`);
}

/* ------------------------------------------------------ balance (step 6) --- */
// Divecore finish step 6 (emci, 2026-10-19): `npm run sim:balance` with the helper + gear. Pins the six
// wave-table edits and the hero-tower price it approved, and replays the headline target in the real
// engine: on a fresh board (80 scrap → the sim's first two Mixed towers on the best pads) with the average
// helper (Kitsune, common, 2★), Trial 4 needs no more damage than Trial 5.
{
  const groups = (phase: 'trial' | 'main', wave: number) =>
    waveDefFor(phase, wave)!.groups.map((g) => `${g.role}:${g.count}@${g.gapSec}/${g.delaySec}${g.pattern === 'cluster' ? 'c' : ''}`).join(' ');
  assert.equal(groups('trial', 4), 'swarm:4@0.8/0 runner:2@0.7/4', 'Trial 4: 4 swarm + 2 runners in a stream (was a 3-runner cluster)');
  assert.equal(groups('trial', 5), 'swarm:7@0.7/0 boss:1@1/8', 'Trial 5: 7 swarm before the boss (was 4)');
  assert.equal(groups('main', 3), 'swarm:6@0.8/0 tank:2@1.5/4', 'Main 3: 6 swarm, tanks at 4 s');
  assert.equal(groups('main', 4), 'swarm:4@0.8/0 runner:3@0.7/3', 'Main 4: 3 runners in a stream (was a 4-runner cluster)');
  assert.equal(groups('main', 6), 'swarm:8@0.75/0 tank:2@1.4/5', 'Main 6: 8 swarm');
  assert.equal(groups('main', 7), 'swarm:4@0.75/0 runner:5@0.7/3', 'Main 7: 5 runners in a stream (was a cluster)');
  assert.equal(HERO_TOWER_STATS.placeCost, 40, 'a hero tower costs 40 scrap to place');
  assert.match(read('src/play/defend-screen.tsx'), /hero \? `\$\{placeCost\} scrap`/, 'the setup row shows the hero tower price, not "free"');

  const map = BOARD_MAPS.ato;
  const samples = Array.from({ length: 240 }, (_, i) => {
    const p = puffPosition(i / 239, map);
    return { x: p.x * 100, y: p.y * 100 };
  });
  const cover = (p: { x: number; y: number }, r: number) => samples.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= r).length;
  const leader = samples.reduce((b, p) => (cover(p, AVATAR_RANGE) > cover(b, AVATAR_RANGE) ? p : b), samples[0]);
  const spot = helperFollowSpot(map, leader);
  const clears = (wave: number, mult: number) => {
    let s = createDefendLive(wave, { mapId: 'trial', boardId: 'ato' });
    for (const kind of ['archer', 'vine'] as const) {
      const taken = new Set(s.towers.map((t) => t.pad));
      const pad = map.pads
        .map((p, i) => ({ i, c: cover(p, TOWER_DEFS[kind].range) }))
        .sort((a, b) => b.c - a.c || a.i - b.i)
        .find((p) => !taken.has(p.i))!.i;
      s = placeTower(s, pad, kind)!;
    }
    s = placeTurfTeam(s, [{ slot: 0, heroId: 'kitsune', x: spot.x, y: spot.y, stars: 2, grade: 'common' }], null);
    const buckets = { wavePower: mult, towerSpeed: 1, avatarLevel: 1, legendElement: null, avatarStars: 0, rebirthBonus: 0 };
    for (let t = 0; t < 600_000; t += 100) {
      const step = stepDefendLive(s, 100, buckets, leader);
      if (step.leak) return false;
      s = step.state;
      if (s.schedule.length === 0 && s.puffs.length === 0) return true;
    }
    return false;
  };
  const need = (wave: number) => {
    let lo = 0.05;
    let hi = 4;
    while (hi - lo > 0.02) {
      const mid = (lo + hi) / 2;
      if (clears(wave, mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  const t4 = need(4);
  const t5 = need(5);
  assert.ok(t4 <= t5 + 0.02, `Trial 4 (${t4.toFixed(2)}×) needs no more than Trial 5 (${t5.toFixed(2)}×) with the average helper`);
  ok(`balance (step 6): six wave edits + hero tower 40 scrap pinned; Trial 4 ${t4.toFixed(2)}× ≤ Trial 5 ${t5.toFixed(2)}× (fresh, average helper)`);
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
  assert.ok(!/onMove|Helper 2|TURF_HELPER_SLOTS/.test(card), 'one slot, no Move');
  assert.ok(!/movingHelperSlot|HELPER_TAP_RADIUS|snapHelperSpot\(boardMap, bx, by\)/.test(screen), 'no tap-to-place helper spots');
  assert.match(screen, /placeTurfTeam\(base, helperSpecsFor\(/, 'Call wave puts the helper on the board');
  assert.match(screen, /helperX\.value = withTiming\(after\.x \/ 100, glide\)/, 'a wave glides the helper on the UI thread');
  assert.match(screen, /easing: Easing\.linear/, 'the glide is linear over one tick');
  assert.equal((screen.match(/setInterval\(/g) ?? []).length, 8, 'no new interval (the helper rides the move loop + sim tick + clip tick)');
  assert.match(screen, /castActorFaintFrame\(now, koAt\[h\.id\]/, 'a dazed helper plays its faint clip');
  assert.match(screen, /castActorGetUpFrame\(/, 'getting up plays the faint in reverse');
  assert.match(screen, /castActorWalkFrame\(now, at, role\)/, 'a moving helper plays its walk clip');
  assert.match(screen, /is dazed`/, 'the daze notice');
  assert.match(screen, /!sim\.petPounceUsed \|\| sim\.petPounceSpare > 0/, 'the pounce button counts the rare spare');
  const skin = read('src/play/skin.ts');
  assert.match(skin, /walk: hero\.walk/, 'the helper keeps its hero walk clip');
  const store = read('src/play/playStore.ts');
  assert.match(store, /turf_helpers: parseTurfHelpers\(data\.turf_helpers\)/, 'the save field is the same additive v33 read');
  assert.match(store, /version: 33/, 'save stays v33');
  ok('screen: one-slot picker in Setup, no tap-to-place, shared-value glide, no new interval, walk / faint / get-up, v33');
}

console.log(`\ncheck:turf-team — ${passed} groups passed.`);
