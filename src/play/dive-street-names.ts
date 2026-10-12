/**
 * Underground street names (emci 2026-10-11) — DISPLAY ONLY, for the Streetwear
 * art style. Pure: no React, no odds. Every label is keyed on a stable id
 * (button id, depth band, find id) and carries the SAME numbers the Classic
 * label shows — the % on Local / Express is exactly `run.bustPct[path]`
 * (diveButtons put it there; this only renames the words around it).
 *
 *   depth 0      Platform        (Shallows)
 *   depth 1, 2   Tunnels         (Reef — two bands)
 *   depth 3      Sewers          (Trench)
 *   depth 4      Ghost Station   (Abyss)
 *   depth 5      The Core        (Hadal, Oxygen only)
 */
import type { DiveButton } from '@/play/dive-buttons';
import { artSkin } from '@/play/art-skin';
import { findKind, findName } from '@/play/dive-loot';

export type StreetStop = { name: string; art: string };

/** One stop per depth band (6 bands; Tunnels covers both Reef bands). */
export const STREET_STOPS: readonly StreetStop[] = [
  { name: 'Platform', art: 'stop-platform' },
  { name: 'Tunnels', art: 'stop-tunnels' },
  { name: 'Tunnels', art: 'stop-tunnels' },
  { name: 'Sewers', art: 'stop-sewers' },
  { name: 'Ghost Station', art: 'stop-ghost' },
  { name: 'The Core', art: 'stop-core' },
];

export function streetStop(depth: number): StreetStop {
  return STREET_STOPS[Math.max(0, Math.min(STREET_STOPS.length - 1, depth))];
}

/** The two sea-themed foods get street names; every other find keeps its own. */
export const STREET_FIND: Readonly<Record<string, string>> = {
  food_kelp: 'Bodega chips',
  food_shrimp: 'Glow ramen',
};

/** The find's name as the street shell shows it (Classic → `findName`). */
export function streetFindName(id: string): string {
  return findKind(id) === 'food' ? (STREET_FIND[id] ?? findName(id)) : findName(id);
}

/** A dive button's street label, keyed on its id. Same % as the Classic label. */
export function streetDiveLabel(b: DiveButton): string {
  const pct = /(\d+)%/.exec(b.label)?.[1];
  switch (b.id) {
    case 'deeper_safe':
      return `LOCAL · SAFER ${pct}%`;
    case 'deeper_rich':
      return `EXPRESS · RICHER ${pct}%`;
    case 'surface':
      return 'HEAD UP';
    case 'dive':
      return 'RIDE · 1 TOKEN';
    case 'no_charges':
      return b.label.replace('NO CHARGES', 'NO TOKENS');
    case 'free':
      return 'FREE RIDE · SHELLS + MOOD';
  }
}

/** Screen-reader label for a street dive button (spells out the chance). */
export function streetDiveA11y(b: DiveButton): string {
  const pct = /(\d+)%/.exec(b.label)?.[1];
  if (b.id === 'deeper_safe') return `Local, safer, ${pct}% chance to lose the bag`;
  if (b.id === 'deeper_rich') return `Express, richer, ${pct}% chance to lose the bag`;
  if (b.id === 'surface') return 'Head up with the bag';
  return streetDiveLabel(b).toLowerCase();
}

/** A find's name wherever it is shown (toasts, Logbook): street name only in Streetwear. */
export function shownFindName(id: string): string {
  return artSkin() === 'streetwear' ? streetFindName(id) : findName(id);
}
