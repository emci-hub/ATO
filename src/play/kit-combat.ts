/**
 * Kit combat — EFFECTS_PLAN.md step 4. Pure rules that turn a kit (behavior +
 * element, `kits.ts`) into hits on creeps: targeting per behavior, the element
 * riders, weakness, status stacking and the per-tick status clock.
 *
 * Deliberately free of `defend.ts` imports (it would be a cycle): the caller
 * passes creep positions in as a function and owns kills / scrap / cooldowns.
 * Every attack returns a `KitHit` record — the screen draws effects and colours
 * damage numbers from these, so nothing on screen has to guess who hit whom.
 *
 * Numbers live in `KIT_TUNING` so the balance simulator and later tuning touch
 * one table.
 */
import { TYPE_MATCH_CYCLE, type TypeTag } from '@/play/engine/type-match';
import {
  ATTACK_COOLDOWN_FLOOR_MS,
  BEHAVIOR_BASE_RANGE,
  CHAIN_BOUNCE_RANGE,
  SPLASH_RADIUS,
  type Behavior,
  type Element,
  type Kit,
} from '@/play/kits';

/** The status fields a creep can carry. All optional so older puff literals
 * (checks, dev presets) stay valid; absent = inactive. */
export type KitStatus = {
  /** Up to 2 damage-over-time effects, oldest first. */
  dots?: DotEffect[];
  /** ms of stun (Root snare / Spark stun) — the creep does not move. */
  stunMs?: number;
  /** ms of stun immunity after a stun ends. */
  stunImmuneMs?: number;
  /** ms of Void shred (takes +15% damage). */
  shredMs?: number;
  /** ms since the last pull is still "recent" (diminishing returns). */
  pullCdMs?: number;
};

export type DotEffect = { element: Element; dps: number; ms: number };

/** The minimum creep shape these rules read/write. */
export type KitCreep = KitStatus & {
  id: number;
  dist: number;
  hp: number;
  kind: 'puff' | 'runner' | 'tank' | 'boss';
  slowMs: number;
  slowFactor: number;
  /** Weakness colour (cycle tint for bosses, optional wave-group tint). */
  tint: TypeTag | null;
};

export type Point = { x: number; y: number };

/** Burst target options (plan: First by default, Strongest / Weakest). */
export type BurstTargeting = 'first' | 'strongest' | 'weakest';

/** One resolved attack — what the screen draws. */
export type KitHit = {
  /** Who fired: a plain tower, a hero tower, or the Avatar. */
  source: 'tower' | 'hero' | 'avatar';
  sourceId: number;
  /** Firing point, board units. */
  from: Point;
  behavior: Behavior;
  element: Element | null;
  /** The creep the attack was aimed at (splash centre, chain start). */
  primaryId: number;
  /** Creeps hit, in order (chain = bounce order, splash = all in the blast). */
  puffIds: number[];
  /** Damage dealt to each id in `puffIds` (same order). */
  damage: number[];
  /** Splash / ultimate area radius, board units (0 = none). */
  radius: number;
  /** True when the area is centred on the firing pad (ultimate AoE), not the
   * primary target. */
  centredOnSource: boolean;
  /** A hero's ultimate (auto-skill) rather than its auto-attack. */
  ultimate: boolean;
  /** Ultimate only: the second element mixed in at half strength. */
  secondary: Element | null;
  /** Spark arc: the extra creep the arc jumped to, if any. */
  arcId: number | null;
};

/** Every rule number, in one place. */
export const KIT_TUNING = {
  /** Hero-tower damage share per behavior (plain towers use their own stats). */
  heroDamageShare: { burst: 1, splash: 0.6, dot: 0.4, slow: 0.55, chain: 0.75, pull: 0.55 } as Record<Behavior, number>,
  /** Hero-tower cooldown per behavior, ms (before the 600ms floor). */
  heroCooldownMs: { burst: 1300, splash: 1500, dot: 1400, slow: 1100, chain: 1400, pull: 1600 } as Record<Behavior, number>,
  splashRadiusPerLevel: 0.15,
  dotShareOfDamage: 0.3, // dps as a share of the attack's damage
  dotMs: [3000, 3500, 4000],
  dotLevelMult: [1, 1.25, 1.5],
  slowPct: [0.3, 0.4, 0.5],
  slowMs: [1000, 1250, 1500],
  chainBounces: [3, 4, 6],
  chainFalloff: 0.85,
  pullDist: [0.035, 0.045, 0.055], // path fraction
  pullHoldMs: 600, // level 3 only (a stun)
  pullRepeatMult: 0.5,
  pullBossMult: 0.25,
  pullRecentMs: 3000,
  rangeBonus: [0, 1, 2], // not for splash / pull
  // Element riders (strength 1; ultimate secondary = 0.5).
  burnDpsShare: 0.15,
  burnMs: 2000,
  chillFactor: 0.8,
  chillMs: 1000,
  arcShare: 0.3,
  snareMs: 300,
  rootVsTank: 1.25,
  shredMs: 3000,
  shredTaken: 1.15,
  // Weakness + status rules.
  weakDamage: 1.25,
  weakDuration: 1.5,
  slowFloor: 0.3, // never slower than 30% speed
  slowFloorBoss: 0.5,
  maxDots: 2,
  stunImmuneMs: 1000,
  // Ultimate (hero auto-skill).
  ultimateDamageMult: 1.75,
  ultimateSecondaryStrength: 0.5,
} as const;

/** Ultimates mix in a second element (plan: "Frosted Gravity" = Tide + Void). */
export const ULTIMATE_SECONDARY: Record<Element, Element> = {
  tide: 'void',
  void: 'ember',
  ember: 'spark',
  spark: 'root',
  root: 'tide',
};

/** The element an enemy tint is weak to: the one before it in the display
 * chart (Tide → Ember → Root → Spark → Tide: each beats the next). Void is
 * outside the cycle and never matches. */
export function weaknessOf(tint: TypeTag | null): TypeTag | null {
  if (!tint) return null;
  const i = TYPE_MATCH_CYCLE.indexOf(tint);
  if (i < 0) return null;
  return TYPE_MATCH_CYCLE[(i - 1 + TYPE_MATCH_CYCLE.length) % TYPE_MATCH_CYCLE.length];
}

export function isWeakTo(creep: KitCreep, element: Element | null): boolean {
  return element != null && element !== 'void' && weaknessOf(creep.tint) === element;
}

/** Level index 0..2 from a level 1..3 (hero stars clamp into this). */
function li(level: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, Math.round(level) - 1)) as 0 | 1 | 2;
}

/** A kit's reach at a level. */
export function kitRange(kit: Kit, level: number): number {
  const base = BEHAVIOR_BASE_RANGE[kit.behavior];
  if (kit.behavior === 'splash' || kit.behavior === 'pull') return base;
  return base + KIT_TUNING.rangeBonus[li(level)];
}

export function splashRadius(level: number): number {
  return SPLASH_RADIUS * (1 + KIT_TUNING.splashRadiusPerLevel * li(level));
}

/** Apply the 600ms attack floor: returns the cooldown to wait and the damage
 * multiplier that converts any speed past the floor into damage. */
export function floorCooldown(cooldownMs: number): { cooldownMs: number; damageMult: number } {
  if (cooldownMs >= ATTACK_COOLDOWN_FLOOR_MS) return { cooldownMs, damageMult: 1 };
  return {
    cooldownMs: ATTACK_COOLDOWN_FLOOR_MS,
    damageMult: ATTACK_COOLDOWN_FLOOR_MS / Math.max(1, cooldownMs),
  };
}

/* ------------------------------------------------------------- statuses --- */

/** Strongest slow wins; an equal-or-stronger slow refreshes to the longer
 * duration, but a WEAKER slow never extends a stronger one (otherwise a light,
 * frequent chill would hold a heavy slow forever). Never below the speed
 * floor (30%, bosses 50%). */
export function applySlow<T extends KitCreep>(creep: T, factor: number, ms: number): T {
  const floor = creep.kind === 'boss' ? KIT_TUNING.slowFloorBoss : KIT_TUNING.slowFloor;
  const next = Math.max(floor, factor);
  if (creep.slowMs <= 0) return { ...creep, slowFactor: next, slowMs: ms };
  if (next <= creep.slowFactor) {
    return { ...creep, slowFactor: next, slowMs: Math.max(creep.slowMs, ms) };
  }
  return creep; // weaker: the stronger slow runs out on its own clock
}

/** Same element refreshes (longest duration, strongest dps); different
 * elements coexist up to 2, oldest dropped. */
export function applyDot<T extends KitCreep>(creep: T, dot: DotEffect): T {
  const dots = creep.dots ?? [];
  const same = dots.find((d) => d.element === dot.element);
  if (same) {
    return {
      ...creep,
      dots: dots.map((d) =>
        d.element === dot.element ? { element: d.element, dps: Math.max(d.dps, dot.dps), ms: Math.max(d.ms, dot.ms) } : d,
      ),
    };
  }
  const merged = [...dots, dot];
  return { ...creep, dots: merged.slice(Math.max(0, merged.length - KIT_TUNING.maxDots)) };
}

/** A stun lands unless the creep is still immune from the last one. */
export function applyStun<T extends KitCreep>(creep: T, ms: number): T {
  if ((creep.stunImmuneMs ?? 0) > 0) return creep;
  return { ...creep, stunMs: Math.max(creep.stunMs ?? 0, ms) };
}

/** Move a creep back along the path. Repeats within 3s are half as strong;
 * bosses take a quarter. */
export function applyPull<T extends KitCreep>(creep: T, frac: number): T {
  let mult = creep.kind === 'boss' ? KIT_TUNING.pullBossMult : 1;
  if ((creep.pullCdMs ?? 0) > 0) mult *= KIT_TUNING.pullRepeatMult;
  return {
    ...creep,
    dist: Math.max(0, creep.dist - frac * mult),
    pullCdMs: KIT_TUNING.pullRecentMs,
  };
}

/** Advance every status by `dtMs`: DoT damage, stun → immunity, shred and
 * pull timers. Returns the creeps and the DoT damage dealt per id (for the
 * damage numbers' colour). Does not remove the dead — the caller does. */
export function tickStatuses<T extends KitCreep>(
  creeps: readonly T[],
  dtMs: number,
): { creeps: T[]; dotDamage: Map<number, { damage: number; element: Element }> } {
  const dotDamage = new Map<number, { damage: number; element: Element }>();
  const out = creeps.map((creep) => {
    let hp = creep.hp;
    let dots = creep.dots;
    if (dots && dots.length > 0) {
      const taken = (creep.shredMs ?? 0) > 0 ? KIT_TUNING.shredTaken : 1;
      let dealt = 0;
      let top: Element = dots[0].element;
      let topDps = -1;
      for (const d of dots) {
        const ms = Math.min(dtMs, d.ms);
        dealt += (d.dps * ms * taken) / 1000;
        if (d.dps > topDps) {
          topDps = d.dps;
          top = d.element;
        }
      }
      hp -= dealt;
      if (dealt > 0) dotDamage.set(creep.id, { damage: dealt, element: top });
      dots = dots.map((d) => ({ ...d, ms: d.ms - dtMs })).filter((d) => d.ms > 0);
    }
    const stunBefore = creep.stunMs ?? 0;
    const stunMs = Math.max(0, stunBefore - dtMs);
    const stunImmuneMs =
      stunBefore > 0 && stunMs === 0
        ? KIT_TUNING.stunImmuneMs
        : Math.max(0, (creep.stunImmuneMs ?? 0) - dtMs);
    return {
      ...creep,
      hp,
      dots: dots && dots.length > 0 ? dots : undefined,
      stunMs: stunMs > 0 ? stunMs : undefined,
      stunImmuneMs: stunImmuneMs > 0 ? stunImmuneMs : undefined,
      shredMs: Math.max(0, (creep.shredMs ?? 0) - dtMs) || undefined,
      pullCdMs: Math.max(0, (creep.pullCdMs ?? 0) - dtMs) || undefined,
    };
  });
  return { creeps: out, dotDamage };
}

/* ------------------------------------------------------------ targeting --- */

const KIND_SPEED: Record<KitCreep['kind'], number> = { runner: 3, puff: 2, tank: 1, boss: 0 };

function furthest<T extends KitCreep>(list: readonly T[]): T {
  return list.reduce((a, b) => (b.dist > a.dist ? b : a));
}

/** Pick a target per behavior (plan → Targeting), from creeps already in range. */
export function pickTarget<T extends KitCreep>(
  behavior: Behavior,
  inRange: readonly T[],
  opts: { burst: BurstTargeting; element: Element | null; posOf: (c: T) => Point; splashR: number },
): T | null {
  if (inRange.length === 0) return null;
  switch (behavior) {
    case 'burst':
      if (opts.burst === 'strongest') return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
      if (opts.burst === 'weakest') return inRange.reduce((a, b) => (b.hp < a.hp ? b : a));
      return furthest(inRange);
    case 'splash': {
      let best = inRange[0];
      let bestN = -1;
      for (const c of inRange) {
        const p = opts.posOf(c);
        const n = inRange.filter((o) => {
          const q = opts.posOf(o);
          return Math.hypot(q.x - p.x, q.y - p.y) <= opts.splashR;
        }).length;
        if (n > bestN || (n === bestN && c.dist > best.dist)) {
          best = c;
          bestN = n;
        }
      }
      return best;
    }
    case 'dot': {
      const without = inRange.filter((c) => !(c.dots ?? []).some((d) => d.element === opts.element));
      if (without.length > 0) return furthest(without);
      return inRange.reduce((a, b) => {
        const am = Math.min(...(a.dots ?? []).map((d) => d.ms));
        const bm = Math.min(...(b.dots ?? []).map((d) => d.ms));
        return bm < am || (bm === am && b.dist > a.dist) ? b : a;
      });
    }
    case 'slow': {
      const unslowed = inRange.filter((c) => c.slowMs <= 0);
      const pool = unslowed.length > 0 ? unslowed : inRange;
      return pool.reduce((a, b) =>
        KIND_SPEED[b.kind] > KIND_SPEED[a.kind] || (KIND_SPEED[b.kind] === KIND_SPEED[a.kind] && b.dist > a.dist) ? b : a,
      );
    }
    case 'chain':
      return furthest(inRange);
    case 'pull': {
      const nonBoss = inRange.filter((c) => c.kind !== 'boss');
      return furthest(nonBoss.length > 0 ? nonBoss : inRange);
    }
  }
}

/* --------------------------------------------------------------- firing --- */

export type KitAttack = {
  kit: Kit;
  /** 1..3 (hero stars clamp in). Drives radius / bounces / slow / pull. */
  level: number;
  /** Primary damage before behavior share, weakness, shred. */
  damage: number;
  /** Apply the hero behavior damage share (plain towers keep their stats). */
  heroShare: boolean;
  burst: BurstTargeting;
  source: KitHit['source'];
  sourceId: number;
  from: Point;
  /** Ultimate: fire at level 3 with the damage mult + a second element. */
  ultimate?: { radius: number };
};

type Ctx<T extends KitCreep> = { posOf: (c: T) => Point };

function hitOne<T extends KitCreep>(
  creep: T,
  base: number,
  element: Element | null,
  strength: number,
  secondary: Element | null,
): { creep: T; dealt: number } {
  let dmg = base;
  if (isWeakTo(creep, element)) dmg *= KIT_TUNING.weakDamage;
  if ((creep.shredMs ?? 0) > 0) dmg *= KIT_TUNING.shredTaken;
  if (element === 'root' && creep.kind === 'tank') dmg *= KIT_TUNING.rootVsTank;
  let next: T = { ...creep, hp: creep.hp - dmg };
  next = applyRider(next, element, strength, base);
  if (secondary) next = applyRider(next, secondary, KIT_TUNING.ultimateSecondaryStrength, base);
  return { creep: next, dealt: dmg };
}

/** The element's secondary effect on the creep it hit (arc is handled by the
 * caller since it touches a second creep). */
function applyRider<T extends KitCreep>(creep: T, element: Element | null, strength: number, base: number): T {
  if (!element || strength <= 0) return creep;
  const dur = isWeakTo(creep, element) ? KIT_TUNING.weakDuration : 1;
  switch (element) {
    case 'ember':
      return applyDot(creep, { element: 'ember', dps: base * KIT_TUNING.burnDpsShare * strength, ms: KIT_TUNING.burnMs * dur });
    case 'tide':
      return applySlow(creep, 1 - (1 - KIT_TUNING.chillFactor) * strength, KIT_TUNING.chillMs * dur);
    case 'root':
      return applyStun(creep, KIT_TUNING.snareMs * strength * dur);
    case 'void':
      return { ...creep, shredMs: Math.max(creep.shredMs ?? 0, KIT_TUNING.shredMs * strength * dur) };
    case 'spark':
      return creep;
  }
}

/**
 * Fire one kit attack at the creeps within `range` of `from`. Returns the new
 * creep list (dead creeps NOT removed — the caller counts kills) and the hit
 * record, or null when nothing is in range.
 */
export function fireKit<T extends KitCreep>(
  creeps: readonly T[],
  attack: KitAttack,
  range: number,
  ctx: Ctx<T>,
): { creeps: T[]; hit: KitHit | null } {
  const { kit } = attack;
  const ult = attack.ultimate != null;
  const level = ult ? 3 : attack.level;
  const L = li(level);
  const share = attack.heroShare ? KIT_TUNING.heroDamageShare[kit.behavior] : 1;
  const D = attack.damage * share * (ult ? KIT_TUNING.ultimateDamageMult : 1);
  const element = kit.element;
  const secondary = ult && element ? ULTIMATE_SECONDARY[element] : null;
  const dist = (c: T) => {
    const p = ctx.posOf(c);
    return Math.hypot(p.x - attack.from.x, p.y - attack.from.y);
  };
  const reach = ult ? Math.max(range, attack.ultimate!.radius) : range;
  const inRange = creeps.filter((c) => c.hp > 0 && dist(c) <= reach);
  if (inRange.length === 0) return { creeps: [...creeps], hit: null };

  const sR = splashRadius(level) * (ult && kit.behavior === 'splash' ? 2 : 1);
  const target = pickTarget(kit.behavior, inRange, {
    burst: attack.burst,
    element,
    posOf: ctx.posOf,
    splashR: sR,
  })!;

  const byId = new Map(creeps.map((c) => [c.id, c]));
  const puffIds: number[] = [];
  const damage: number[] = [];
  const strike = (id: number, base: number, rider = true) => {
    const c = byId.get(id);
    if (!c) return;
    const r = hitOne(c, base, rider ? element : null, 1, rider ? secondary : null);
    byId.set(id, r.creep);
    puffIds.push(id);
    damage.push(r.dealt);
  };

  let radius = 0;
  let centredOnSource = false;
  // Area ultimates for the "sustain" behaviors hit everything around the pad.
  const aoeUltimate = ult && (kit.behavior === 'dot' || kit.behavior === 'slow' || kit.behavior === 'pull');

  if (aoeUltimate) {
    radius = attack.ultimate!.radius;
    centredOnSource = true;
    for (const c of inRange) strike(c.id, D);
  } else if (kit.behavior === 'splash') {
    radius = sR;
    const center = ctx.posOf(target);
    for (const c of inRange) {
      const p = ctx.posOf(c);
      if (Math.hypot(p.x - center.x, p.y - center.y) <= sR) strike(c.id, D);
    }
  } else if (kit.behavior === 'chain') {
    const bounces = KIT_TUNING.chainBounces[L] + (element === 'spark' ? 1 : 0);
    const bounceR = element === 'tide' ? 6 : CHAIN_BOUNCE_RANGE;
    let current: T | undefined = target;
    let base = D;
    const seen = new Set<number>();
    for (let i = 0; i <= bounces && current; i += 1) {
      seen.add(current.id);
      strike(current.id, base);
      base *= KIT_TUNING.chainFalloff;
      const p = ctx.posOf(current);
      let next: T | undefined;
      let bestD = bounceR;
      for (const c of creeps) {
        if (seen.has(c.id) || c.hp <= 0) continue;
        const q = ctx.posOf(c);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d <= bestD) {
          bestD = d;
          next = c;
        }
      }
      current = next;
    }
  } else {
    strike(target.id, D);
  }

  // Behavior side effects on everything struck.
  const sDur = (c: T) => (isWeakTo(c, element) ? KIT_TUNING.weakDuration : 1);
  for (const id of puffIds) {
    let c = byId.get(id)!;
    if (kit.behavior === 'dot') {
      c = applyDot(c, {
        element: element ?? 'ember',
        dps: D * KIT_TUNING.dotShareOfDamage * KIT_TUNING.dotLevelMult[L] * (element === 'ember' ? 1.25 : 1),
        ms: KIT_TUNING.dotMs[L] * sDur(c),
      });
    } else if (kit.behavior === 'slow') {
      c = applySlow(c, 1 - KIT_TUNING.slowPct[L], KIT_TUNING.slowMs[L] * sDur(c));
      if (element === 'spark' && L === 2) c = applyStun(c, 400);
    } else if (kit.behavior === 'pull') {
      c = applyPull(c, KIT_TUNING.pullDist[L]);
      if (L === 2) c = applyStun(c, KIT_TUNING.pullHoldMs);
      if (element === 'void') {
        c = applyDot(c, { element: 'void', dps: D * KIT_TUNING.burnDpsShare, ms: 2000 });
      }
    }
    byId.set(id, c);
  }

  // Spark arc (not on chains — Spark adds a bounce there instead).
  let arcId: number | null = null;
  if (element === 'spark' && kit.behavior !== 'chain' && !aoeUltimate) {
    const p = ctx.posOf(target);
    let best: T | undefined;
    let bestD = CHAIN_BOUNCE_RANGE;
    for (const c of byId.values()) {
      if (c.id === target.id || c.hp <= 0) continue;
      const q = ctx.posOf(c);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      const arc = D * KIT_TUNING.arcShare;
      byId.set(best.id, { ...best, hp: best.hp - arc });
      arcId = best.id;
      puffIds.push(best.id);
      damage.push(arc);
    }
  }

  return {
    creeps: creeps.map((c) => byId.get(c.id) ?? c),
    hit: {
      source: attack.source,
      sourceId: attack.sourceId,
      from: attack.from,
      behavior: kit.behavior,
      element,
      primaryId: target.id,
      puffIds,
      damage,
      radius,
      centredOnSource,
      ultimate: ult,
      secondary,
      arcId,
    },
  };
}
