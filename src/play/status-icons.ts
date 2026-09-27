/**
 * Creep status icons — which small icons sit above a creep's health bar
 * (emci, 2026-09-26: icons + stack count, not a circle drawn on the unit).
 *
 * Pure data so `check:kits` can pin it; the drawing lives in
 * `status-icon-row.tsx`. Order is fixed so icons never jump around:
 * stun, damage over time, slow, shred. At most 4 icons; a creep with no
 * active effect shows none (cheaper than the old always-drawn circle).
 */
import type { KitStatus } from '@/play/kit-combat';
import { ELEMENT_COLOR } from '@/play/kits';

export type StatusIconKind = 'stun' | 'dot' | 'slow' | 'shred';

export type StatusIcon = {
  kind: StatusIconKind;
  color: string;
  /** Stack count; drawn only when > 1 (two different DoTs). */
  count: number;
};

/** Gold star for any stun (Root snare, Pull hold, EMP) — it is about the
 * effect, not which element caused it. */
export const STUN_ICON_COLOR = '#FDE68A';

export function statusIconsFor(creep: KitStatus & { slowMs: number }): StatusIcon[] {
  const icons: StatusIcon[] = [];
  if ((creep.stunMs ?? 0) > 0) icons.push({ kind: 'stun', color: STUN_ICON_COLOR, count: 1 });
  const dots = creep.dots ?? [];
  if (dots.length > 0) {
    const strongest = dots.reduce((a, b) => (b.dps > a.dps ? b : a));
    icons.push({ kind: 'dot', color: ELEMENT_COLOR[strongest.element], count: dots.length });
  }
  if (creep.slowMs > 0) icons.push({ kind: 'slow', color: ELEMENT_COLOR.tide, count: 1 });
  if ((creep.shredMs ?? 0) > 0) icons.push({ kind: 'shred', color: ELEMENT_COLOR.void, count: 1 });
  return icons.slice(0, 4);
}
