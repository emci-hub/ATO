/**
 * Apply one equipped sword to creeps the tower-defense tick already hit.
 * Status math (burn, slow, knockback, shred) reuses `kit-combat`. The sword's
 * element is mapped onto a kit element by `swords.json` so the existing
 * damage-over-time tick can run it. No per-frame particle list lives here.
 */
import { applyDot, applyPull, applySlow, type KitCreep, type Point } from '@/play/kit-combat';
import type { SwordRuntime } from '@/play/swords';

function paint<T extends KitCreep>(creeps: readonly T[], byId: Map<number, T>): T[] {
  return creeps.map((creep) => byId.get(creep.id) ?? creep);
}

function nearby<T extends KitCreep>(
  creeps: readonly T[],
  origin: Point,
  posOf: (creep: T) => Point,
  skipId: number,
): { id: number; d: number }[] {
  const found: { id: number; d: number }[] = [];
  for (const creep of creeps) {
    if (creep.id === skipId || creep.hp <= 0) continue;
    const at = posOf(creep);
    found.push({ id: creep.id, d: Math.hypot(at.x - origin.x, at.y - origin.y) });
  }
  return found;
}

/** Signature / combo riders on the hero's target, plus chain or splash. */
export function applySwordHit<T extends KitCreep>(
  creeps: readonly T[],
  targetId: number,
  damage: number,
  sword: SwordRuntime,
  posOf: (creep: T) => Point,
): { creeps: T[]; scrap: number } {
  const target = creeps.find((creep) => creep.id === targetId);
  if (!target) return { creeps: creeps as T[], scrap: 0 };
  const byId = new Map(creeps.map((creep) => [creep.id, creep]));
  let next = target;
  if (sword.burnDpsShare > 0 && sword.burnMs > 0) {
    next = applyDot(next, { element: sword.status, dps: damage * sword.burnDpsShare, ms: sword.burnMs });
  }
  if (sword.slowFactor < 1 && sword.slowMs > 0) next = applySlow(next, sword.slowFactor, sword.slowMs);
  if (sword.knockFrac > 0) next = applyPull(next, sword.knockFrac);
  if (sword.shredMs > 0) next = { ...next, shredMs: Math.max(next.shredMs ?? 0, sword.shredMs) };
  byId.set(targetId, next);

  const origin = posOf(target);
  const others = nearby(creeps, origin, posOf, targetId);
  if (sword.splashRadius > 0 && sword.splashShare > 0) {
    for (const other of others) {
      if (other.d > sword.splashRadius) continue;
      const creep = byId.get(other.id);
      if (!creep) continue;
      byId.set(other.id, { ...creep, hp: creep.hp - damage * sword.splashShare });
    }
  }
  if (sword.chain > 0 && sword.chainShare > 0) {
    others.sort((a, b) => a.d - b.d);
    let left = sword.chain;
    for (const other of others) {
      if (left <= 0) break;
      if (other.d > sword.chainRange) continue;
      const creep = byId.get(other.id);
      if (!creep || creep.hp <= 0) continue;
      byId.set(other.id, { ...creep, hp: creep.hp - damage * sword.chainShare });
      left -= 1;
    }
  }
  return { creeps: paint(creeps, byId), scrap: sword.scrapOnHit };
}

/** Divine once-per-wave pulse. The caller sets the used flag. */
export function applySwordSuper<T extends KitCreep>(
  creeps: readonly T[],
  from: Point,
  damage: number,
  sword: SwordRuntime,
  posOf: (creep: T) => Point,
): T[] {
  if (!sword.divine || sword.superRadius <= 0 || sword.superMult <= 0) return creeps as T[];
  return creeps.map((creep) => {
    if (creep.hp <= 0) return creep;
    const at = posOf(creep);
    if (Math.hypot(at.x - from.x, at.y - from.y) > sword.superRadius) return creep;
    return { ...creep, hp: creep.hp - damage * sword.superMult };
  });
}

/** Tower aura riders. One target, optional single chain, capped by the runtime. */
export function applyAuraHit<T extends KitCreep>(
  creeps: readonly T[],
  targetId: number,
  damage: number,
  sword: SwordRuntime,
  posOf: (creep: T) => Point,
): { creeps: T[]; scrap: number } {
  const target = creeps.find((creep) => creep.id === targetId);
  if (!target) return { creeps: creeps as T[], scrap: 0 };
  const byId = new Map(creeps.map((creep) => [creep.id, creep]));
  let next = target;
  if (sword.auraBurn > 0) {
    next = applyDot(next, { element: sword.status, dps: damage * sword.auraBurn, ms: 800 });
  }
  if (sword.auraSlow < 1 && sword.auraSlowMs > 0) next = applySlow(next, sword.auraSlow, sword.auraSlowMs);
  if (sword.auraKnock > 0) next = applyPull(next, sword.auraKnock);
  byId.set(targetId, next);
  if (sword.auraChain > 0 && sword.auraChainShare > 0) {
    const origin = posOf(target);
    const others = nearby(creeps, origin, posOf, targetId).sort((a, b) => a.d - b.d);
    const bounce = others.find((other) => other.d <= sword.chainRange);
    if (bounce) {
      const creep = byId.get(bounce.id);
      if (creep) byId.set(bounce.id, { ...creep, hp: creep.hp - damage * sword.auraChainShare });
    }
  }
  return { creeps: paint(creeps, byId), scrap: sword.auraScrap };
}

export function auraReaches(pad: Point, avatar: Point, radius: number): boolean {
  return Math.hypot(pad.x - avatar.x, pad.y - avatar.y) <= radius;
}
