/**
 * Turf team (pet team roadmap P5 → P5b, emci 2026-10-18): the leader (the active pet, P4) plus ONE AI
 * helper picked at Turf War setup. Pure data + math — no React, no store — so the board sim
 * (`defend.ts`), the save (`playStore.ts`), the picker and `check:turf-team` all read one copy.
 *
 * P5b balance (approved 2026-10-18, tuned in P6):
 *   - the helper follows the leader (a spot `HELPER_FOLLOW_GAP` beside it, off the road) and, inside a
 *     `HELPER_LEASH` of 15 from the leader, steps toward its own target — a boss first (it may step onto
 *     the road only while chasing a boss), else the nearest foe; it walks 40 units/s (50 running back);
 *   - attack 20 base, range 15, the hero kit's normal speed; its own hero skill (`heroCastSkill`) cast
 *     from where it stands, first at 6 s, then every 14 s, only when a foe is inside the skill's radius;
 *   - stars: +6% power per star above 1 (5★ = +24%), the leader included;
 *   - grade: rare = +1 pounce per fight, epic = +10% range for that unit, legendary = that helper's hits
 *     also deal 30% to foes within 4 units; shiny is looks only;
 *   - it NEVER dies: a boss swings every 5 s at a helper within 8; a hit dazes it (faint clip, down 4 s),
 *     it gets up (the faint reversed), runs back to the leader, and can't be dazed for 11 s after getting
 *     up. Normal creeps never daze it.
 * Lanes: unless it is chasing a boss, the helper's spot stays off the road and off tower pads.
 */
import { ATO_ROAD_HALF, type BoardMap } from '@/play/board-data';
import { heroStars, type Grade } from '@/play/pet-eggs';
import { PET_STAGES, type PetState } from '@/play/pet';

/** Helper slots next to the leader (P5b: one AI helper). */
export const TURF_HELPER_SLOTS = 1;
/** Helper auto-attack base damage (before board mults, star power and the kit's speed floor). */
export const HELPER_BASE_ATTACK = 20;
/** Helper reach, board units (the leader's `AVATAR_RANGE`). */
export const HELPER_RANGE = 15;
/** The helper's own hero skill: the first cast waits this long into the wave … */
export const HELPER_SKILL_FIRST_MS = 6_000;
/** … then this cooldown between casts (the leader's is 12 s). */
export const HELPER_SKILL_COOLDOWN_MS = 14_000;
/** The helper never strays further than this from the leader (board units). */
export const HELPER_LEASH = 15;
/** With nothing to chase it stands this far beside the leader. */
export const HELPER_FOLLOW_GAP = 6;
/** Walk speed, board units per (sim) second (the leader walks 42). */
export const HELPER_MOVE_SPEED = 40;
/** Run-back speed after a daze. */
export const HELPER_RETURN_SPEED = 50;
/** Chasing a boss it closes to this distance (inside a boss's swing — the risk); other foes it only
 * brings into 80% of its range. */
export const HELPER_BOSS_CLOSE = 6;
export const HELPER_CHASE_REACH_FRAC = 0.8;
/** A boss swings this often at a helper within `BOSS_SWING_RADIUS`. */
export const BOSS_SWING_MS = 5_000;
/** Dazed: lying down this long (the faint clip plays, then holds). */
export const HELPER_DAZE_MS = 4_000;
/** Getting up: the faint clip played in reverse, this long. */
export const HELPER_GET_UP_MS = 600;
/** After getting up: this long when a boss swing can't daze it again. */
export const HELPER_DAZE_PROOF_MS = 11_000;
/** Power per star above 1. */
export const STAR_POWER_STEP = 0.06;
/** Epic: range ×1.10 for that unit. */
export const EPIC_RANGE_MULT = 1.1;
/** Legendary helper: share of a hit splashed onto nearby foes, and the splash reach. */
export const LEGENDARY_SPLASH_PCT = 0.3;
export const LEGENDARY_SPLASH_RADIUS = 4;
/** Rare on the team: extra pounces per fight (never more than this, however many rares). */
export const RARE_POUNCE_SPARE = 1;
/** A boss whose path point comes this close (board units) swings at the helper. */
export const BOSS_SWING_RADIUS = 8;
/** Lanes: a helper's feet stay this far from the road's centre line (road half-width + a step). */
export const HELPER_ROAD_CLEARANCE = ATO_ROAD_HALF + 2;
/** Lanes: and this far from any tower pad. */
export const HELPER_PAD_CLEARANCE = 6;
/** Keep a helper this far inside the board edge. */
const EDGE_MARGIN = 4;

/** ×power for a hero's stars (0 or 1 star = ×1, 5★ = ×1.24). */
export function starPowerMult(stars: number): number {
  const s = Math.max(1, Math.min(5, Math.floor(Number.isFinite(stars) ? stars : 1)));
  return 1 + STAR_POWER_STEP * (s - 1);
}

/** Range ×mult for a unit of this grade. */
export function gradeRangeMult(grade: Grade | null | undefined): number {
  return grade === 'epic' ? EPIC_RANGE_MULT : 1;
}

/** True when this helper's hits splash. */
export function gradeSplashes(grade: Grade | null | undefined): boolean {
  return grade === 'legendary';
}

/** Extra pounces this fight from the team's grades (leader + helpers). */
export function teamPounceSpare(grades: readonly (Grade | null | undefined)[]): number {
  return grades.some((g) => g === 'rare') ? RARE_POUNCE_SPARE : 0;
}

/** A pet old enough to fight: revealed hero, Child stage or older (egg / baby stay home). */
export function canHelp(pet: PetState): boolean {
  return pet.hero != null && pet.grade != null && PET_STAGES.indexOf(pet.stage) >= PET_STAGES.indexOf('child');
}

/** One pet the picker can offer. */
export type TurfCandidate = {
  uid: number;
  heroId: string;
  name: string | null;
  grade: Grade;
  shiny: boolean;
  copies: number;
  stars: number;
};

/**
 * Pets that may help: Child or older, not the leader's hero, not a hero bound as a tower, one per hero
 * (P1 already merged duplicates; this only guards an odd save). Active first, then the Den order.
 */
export function turfCandidates(
  pets: readonly PetState[],
  input: { leaderHeroId: string; boundHeroIds: readonly string[]; copiesOf: (heroId: string) => number },
): TurfCandidate[] {
  const seen = new Set<string>();
  const out: TurfCandidate[] = [];
  for (const pet of pets) {
    if (pet.uid <= 0 || !canHelp(pet) || pet.hero == null || pet.grade == null) continue;
    if (pet.hero === input.leaderHeroId || input.boundHeroIds.includes(pet.hero) || seen.has(pet.hero)) continue;
    seen.add(pet.hero);
    const copies = input.copiesOf(pet.hero);
    out.push({
      uid: pet.uid,
      heroId: pet.hero,
      name: pet.name ?? null,
      grade: pet.grade,
      shiny: pet.shiny,
      copies,
      stars: heroStars(copies),
    });
  }
  return out;
}

/** A saved helper pick: the pet (Den id). `x`/`y` are the P5 standing spot, kept in the v33 save shape
 * but unused since P5b (the helper follows the leader). */
export type TurfHelperPick = { uid: number; x: number; y: number };

/** Tolerant read of the save field: one pick (an old P5 save's first valid pick), a missing or bad
 * spot reads as the board middle. */
export function parseTurfHelpers(raw: unknown): TurfHelperPick[] {
  if (!Array.isArray(raw)) return [];
  const out: TurfHelperPick[] = [];
  for (const row of raw) {
    if (out.length >= TURF_HELPER_SLOTS) break;
    if (!row || typeof row !== 'object') continue;
    const { uid, x, y } = row as Record<string, unknown>;
    if (typeof uid !== 'number' || !Number.isInteger(uid) || uid <= 0) continue;
    if (out.some((p) => p.uid === uid)) continue;
    const fx = typeof x === 'number' && Number.isFinite(x) ? clamp(x, 0, 100) : 50;
    const fy = typeof y === 'number' && Number.isFinite(y) ? clamp(y, 0, 100) : 50;
    out.push({ uid, x: fx, y: fy });
  }
  return out;
}

/** The picks that still name a pet that may help (a pet that left, became the leader or got bound drops). */
export function livePicks(picks: readonly TurfHelperPick[], candidates: readonly TurfCandidate[]): TurfHelperPick[] {
  return picks.filter((p) => candidates.some((c) => c.uid === p.uid)).slice(0, TURF_HELPER_SLOTS);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Nearest point on the road centre line (board units) to (x, y). */
function nearestRoadPoint(map: BoardMap, x: number, y: number): { x: number; y: number; d: number; nx: number; ny: number } {
  let best = { x: 0, y: 0, d: Infinity, nx: 0, ny: -1 };
  for (let i = 0; i < map.path.length - 1; i += 1) {
    const ax = map.path[i].x * 100;
    const ay = map.path[i].y * 100;
    const bx = map.path[i + 1].x * 100;
    const by = map.path[i + 1].y * 100;
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : clamp(((x - ax) * vx + (y - ay) * vy) / len2, 0, 1);
    const px = ax + vx * t;
    const py = ay + vy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d) {
      // Push-out direction: away from the line, or the segment's normal when the drop sits on it.
      const len = Math.sqrt(len2) || 1;
      const nx = d > 1e-6 ? (x - px) / d : -vy / len;
      const ny = d > 1e-6 ? (y - py) / d : vx / len;
      best = { x: px, y: py, d, nx, ny };
    }
  }
  return best;
}

/** True when (x, y) is a legal helper spot: off the road, off every pad, inside the board. */
export function helperSpotOk(map: BoardMap, x: number, y: number): boolean {
  if (x < EDGE_MARGIN - 1e-6 || x > 100 - EDGE_MARGIN + 1e-6 || y < EDGE_MARGIN - 1e-6 || y > 100 - EDGE_MARGIN + 1e-6) return false;
  if (nearestRoadPoint(map, x, y).d < HELPER_ROAD_CLEARANCE - 1e-6) return false;
  return map.pads.every((pad) => Math.hypot(pad.x - x, pad.y - y) >= HELPER_PAD_CLEARANCE - 1e-6);
}

/**
 * Lanes: a drop on the road or a pad snaps to the nearest free spot (pushed straight out from the road
 * line / the pad). Deterministic. If no push lands legal (a corner boxed in by road and pads), it scans
 * outward rings and takes the closest legal point.
 */
export function snapHelperSpot(map: BoardMap, x0: number, y0: number): { x: number; y: number } {
  let x = clamp(x0, EDGE_MARGIN, 100 - EDGE_MARGIN);
  let y = clamp(y0, EDGE_MARGIN, 100 - EDGE_MARGIN);
  for (let pass = 0; pass < 4 && !helperSpotOk(map, x, y); pass += 1) {
    const road = nearestRoadPoint(map, x, y);
    if (road.d < HELPER_ROAD_CLEARANCE) {
      x = road.x + road.nx * (HELPER_ROAD_CLEARANCE + 0.01);
      y = road.y + road.ny * (HELPER_ROAD_CLEARANCE + 0.01);
    }
    for (const pad of map.pads) {
      const d = Math.hypot(x - pad.x, y - pad.y);
      if (d < HELPER_PAD_CLEARANCE) {
        const ux = d > 1e-6 ? (x - pad.x) / d : 1;
        const uy = d > 1e-6 ? (y - pad.y) / d : 0;
        x = pad.x + ux * (HELPER_PAD_CLEARANCE + 0.01);
        y = pad.y + uy * (HELPER_PAD_CLEARANCE + 0.01);
      }
    }
    x = clamp(x, EDGE_MARGIN, 100 - EDGE_MARGIN);
    y = clamp(y, EDGE_MARGIN, 100 - EDGE_MARGIN);
  }
  if (helperSpotOk(map, x, y)) return { x, y };
  for (let r = 1; r <= 60; r += 1) {
    let found: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      const cx = clamp(x0 + Math.cos(a) * r, EDGE_MARGIN, 100 - EDGE_MARGIN);
      const cy = clamp(y0 + Math.sin(a) * r, EDGE_MARGIN, 100 - EDGE_MARGIN);
      const d = Math.hypot(cx - x0, cy - y0);
      if (helperSpotOk(map, cx, cy) && d < bestD) {
        bestD = d;
        found = { x: cx, y: cy };
      }
    }
    if (found) return found;
  }
  return { x, y };
}

type Pt = { x: number; y: number };

/** Pull `p` back inside the leash around the leader. */
function leashed(leader: Pt, p: Pt): Pt {
  const d = Math.hypot(p.x - leader.x, p.y - leader.y);
  if (d <= HELPER_LEASH) return p;
  const k = HELPER_LEASH / d;
  return { x: leader.x + (p.x - leader.x) * k, y: leader.y + (p.y - leader.y) * k };
}

/** P5b — where the helper stands with nothing to chase: `HELPER_FOLLOW_GAP` to the leader's left (right
 * near the left edge), snapped off the road and pads. When that snap lands outside the leash it tries the
 * other sides, then the closest legal point inside the leash, then the closest point inside the leash that
 * is at least off the road (a leader boxed in by road and pads); a leader in a road knot with no off-road
 * point within the leash gets the nearest legal spot just past it (lanes win). Deterministic. */
export function helperFollowSpot(map: BoardMap, leader: Pt): Pt {
  const inLeash = (p: Pt) => Math.hypot(p.x - leader.x, p.y - leader.y) <= HELPER_LEASH + 1e-9;
  const side = leader.x - HELPER_FOLLOW_GAP < EDGE_MARGIN ? 1 : -1;
  const preferred = { x: leader.x + side * HELPER_FOLLOW_GAP, y: leader.y };
  for (const [dx, dy] of [[side, 0], [-side, 0], [0, 1], [0, -1]] as const) {
    const spot = snapHelperSpot(map, leader.x + dx * HELPER_FOLLOW_GAP, leader.y + dy * HELPER_FOLLOW_GAP);
    if (inLeash(spot) && helperSpotOk(map, spot.x, spot.y)) return spot;
  }
  // Closest point inside the leash that is fully legal; failing that (a leader boxed in by road and pads,
  // e.g. parts of Neon Maze), the closest one that is at least off the road.
  for (const ok of [(p: Pt) => helperSpotOk(map, p.x, p.y), (p: Pt) => helperOffRoad(map, p.x, p.y)]) {
    let best: Pt | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= HELPER_LEASH; r += 1) {
      for (let k = 0; k < 24; k += 1) {
        const a = (k / 24) * Math.PI * 2;
        const p = { x: leader.x + Math.cos(a) * r, y: leader.y + Math.sin(a) * r };
        if (!ok(p)) continue;
        const d = Math.hypot(p.x - preferred.x, p.y - preferred.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    if (best) return best;
  }
  // No off-road point within the leash at all (a leader in a road knot): lanes win over the leash —
  // the nearest legal spot, a few units further out.
  return snapHelperSpot(map, preferred.x, preferred.y);
}

/** True when (x, y) is inside the board and off the road (pads not considered). */
export function helperOffRoad(map: BoardMap, x: number, y: number): boolean {
  if (x < EDGE_MARGIN - 1e-6 || x > 100 - EDGE_MARGIN + 1e-6 || y < EDGE_MARGIN - 1e-6 || y > 100 - EDGE_MARGIN + 1e-6) return false;
  return nearestRoadPoint(map, x, y).d >= HELPER_ROAD_CLEARANCE - 1e-6;
}

/** One foe the helper may chase (board units). */
export type HelperFoe = { id: number; x: number; y: number; boss: boolean };

/**
 * P5b — the foe the helper chases: only foes it could reach without leaving the leash (within
 * `HELPER_LEASH + range` of the leader); a boss first, then the nearest to the helper. Ties → lower id.
 */
export function pickHelperChase(leader: Pt, self: Pt, foes: readonly HelperFoe[], range: number): HelperFoe | null {
  let best: HelperFoe | null = null;
  let bestD = Infinity;
  for (const f of foes) {
    if (Math.hypot(f.x - leader.x, f.y - leader.y) > HELPER_LEASH + range) continue;
    const d = Math.hypot(f.x - self.x, f.y - self.y);
    const better =
      best == null ||
      (f.boss && !best.boss) ||
      (f.boss === best.boss && (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && f.id < best.id)));
    if (better) {
      best = f;
      bestD = d;
    }
  }
  return best;
}

/**
 * P5b — the point the helper walks to this tick. No target → its follow spot. A target → close in along
 * the line to it until `HELPER_BOSS_CLOSE` (a boss) / 80% of `range` (anything else), never past the
 * leash. Off the road and pads unless chasing a boss; a goal that would need the road falls back to the
 * follow spot.
 */
export function helperGoal(map: BoardMap, leader: Pt, self: Pt, target: HelperFoe | null, range: number): Pt {
  if (!target) return helperFollowSpot(map, leader);
  const reach = target.boss ? HELPER_BOSS_CLOSE : range * HELPER_CHASE_REACH_FRAC;
  const d = Math.hypot(target.x - self.x, target.y - self.y);
  let goal: Pt = self;
  if (d > reach) {
    const t = (d - reach) / d;
    goal = { x: self.x + (target.x - self.x) * t, y: self.y + (target.y - self.y) * t };
  }
  goal = leashed(leader, goal);
  if (target.boss || helperSpotOk(map, goal.x, goal.y)) return goal;
  const snapped = snapHelperSpot(map, goal.x, goal.y);
  return Math.hypot(snapped.x - leader.x, snapped.y - leader.y) <= HELPER_LEASH ? snapped : helperFollowSpot(map, leader);
}

/** P5b — one walk step toward `goal` at `unitsPerSec` over `dtMs`; lands exactly on it when close. */
export function stepHelperToward(pos: Pt, goal: Pt, unitsPerSec: number, dtMs: number): Pt & { moved: number } {
  const dx = goal.x - pos.x;
  const dy = goal.y - pos.y;
  const d = Math.hypot(dx, dy);
  const len = (unitsPerSec * dtMs) / 1000;
  if (d <= len) return { x: goal.x, y: goal.y, moved: d };
  return { x: pos.x + (dx / d) * len, y: pos.y + (dy / d) * len, moved: len };
}
