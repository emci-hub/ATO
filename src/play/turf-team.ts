/**
 * Turf team of 3 (pet team roadmap P5, emci 2026-10-18): the leader (the active pet, P4) plus up to
 * two helper pets picked at Turf War setup. Pure data + math — no React, no store — so the board sim
 * (`defend.ts`), the save (`playStore.ts`), the picker and `check:turf-team` all read one copy.
 *
 * Balance (approved 2026-10-18, tuned in P6):
 *   - helper attack 13 base (60% of a hero tower's 22), range 15 (the leader's), the hero kit's
 *     normal speed; auto-skill every 16 s only for a hero whose art has a skill clip;
 *   - stars: +6% power per star above 1 (5★ = +24%), the leader included;
 *   - grade: rare = +1 pounce per fight (one rare on the team is enough), epic = +10% range for that
 *     unit, legendary = that helper's hits also deal 30% to foes within 4 units; shiny is looks only;
 *   - a boss passing within 8 units knocks a helper out for the rest of the wave (faint clip); a new
 *     wave builds a fresh board, so it is back.
 * Lanes: a helper never stands on the road or a tower pad; a drop there snaps to the nearest free spot.
 */
import { ATO_ROAD_HALF, type BoardMap } from '@/play/board-data';
import { heroStars, type Grade } from '@/play/pet-eggs';
import { PET_STAGES, type PetState } from '@/play/pet';

/** Helper slots next to the leader. */
export const TURF_HELPER_SLOTS = 2;
/** Helper auto-attack base damage (before board mults, star power and the kit's speed floor). */
export const HELPER_BASE_ATTACK = 13;
/** Helper reach, board units (the leader's `AVATAR_RANGE`). */
export const HELPER_RANGE = 15;
/** Helper auto-skill cooldown (a hero tower's is 12 s). */
export const HELPER_SKILL_COOLDOWN_MS = 16_000;
/** Power per star above 1. */
export const STAR_POWER_STEP = 0.06;
/** Epic: range ×1.10 for that unit. */
export const EPIC_RANGE_MULT = 1.1;
/** Legendary helper: share of a hit splashed onto nearby foes, and the splash reach. */
export const LEGENDARY_SPLASH_PCT = 0.3;
export const LEGENDARY_SPLASH_RADIUS = 4;
/** Rare on the team: extra pounces per fight (never more than this, however many rares). */
export const RARE_POUNCE_SPARE = 1;
/** A boss whose path point comes this close (board units) knocks a helper out for the wave. */
export const BOSS_KO_RADIUS = 8;
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

/** A saved helper pick: the pet (Den id) and where it stands (board units 0..100). */
export type TurfHelperPick = { uid: number; x: number; y: number };

/** Tolerant read of the save field: up to 2 picks, distinct pets, finite spots inside the board. */
export function parseTurfHelpers(raw: unknown): TurfHelperPick[] {
  if (!Array.isArray(raw)) return [];
  const out: TurfHelperPick[] = [];
  for (const row of raw) {
    if (out.length >= TURF_HELPER_SLOTS) break;
    if (!row || typeof row !== 'object') continue;
    const { uid, x, y } = row as Record<string, unknown>;
    if (typeof uid !== 'number' || !Number.isInteger(uid) || uid <= 0) continue;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (out.some((p) => p.uid === uid)) continue;
    out.push({ uid, x: clamp(x, 0, 100), y: clamp(y, 0, 100) });
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

/** How far off the road's centre line a new helper stands: inside its reach (15), outside a passing
 * boss's knock-out radius (8). */
export const HELPER_DEFAULT_ROAD_GAP = 10.5;

/** A default spot for a new helper: the road beside the leader (left for slot 0, right for slot 1),
 * then `HELPER_DEFAULT_ROAD_GAP` out from it, snapped off any pad. */
export function defaultHelperSpot(map: BoardMap, leader: { x: number; y: number }, slot: number): { x: number; y: number } {
  const dx = slot === 0 ? -12 : 12;
  const road = nearestRoadPoint(map, clamp(leader.x + dx, 0, 100), clamp(leader.y, 0, 100));
  return snapHelperSpot(map, road.x + road.nx * HELPER_DEFAULT_ROAD_GAP, road.y + road.ny * HELPER_DEFAULT_ROAD_GAP);
}
