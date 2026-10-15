/**
 * Decor slots — pure rules (roadmap step 5, plan approved by emci 2026-10-15).
 *
 * The Hideout room has 3 empty spots on open floor. You fill each from a short free shelf of props
 * (the room's own plant / beanbag / table / lamp + six street props) and swap or take them away
 * whenever you like. Nothing costs anything: no tokens, shells or stones move, and nothing is earned.
 *
 *  - Ids are forever (`dc_*` items, `d1`..`d3` slots) — the save points at them. An id the app no longer
 *    knows is dropped on load, never a crash.
 *  - A filled slot blocks the floor cells under it (the pet walks around it, like the visitor), and the
 *    sprite sorts against the pet by its footprint bottom, exactly like a baked prop.
 *  - Pure: no React, no art imports (the check imports this without Expo). The UI maps item id → art.
 *
 * The saved shape is `HideoutState.decor`: slot id → item id, riding the whole Play doc → wave96 cloud save.
 */
import type { IsoRoomGeom } from '@/play/hideout-iso';

/** Only the Hideout room has real art, so it is the one room with slots. */
export const DECOR_ROOM = 'hideout' as const;

export type DecorSlotId = 'd1' | 'd2' | 'd3';

/** `cells` = the footprint in 16 px map cells: [col, row, w, h]. 4×2 = 64×32 art px each. */
export type DecorSlot = { id: DecorSlotId; label: string; cells: readonly [number, number, number, number] };

/** Open floor, clear of the rug, bed, bowl, hatch and door (pinned by check:decor-slots). */
export const DECOR_SLOTS: readonly DecorSlot[] = [
  { id: 'd1', label: 'Spot 1', cells: [3, 25, 4, 2] },
  { id: 'd2', label: 'Spot 2', cells: [3, 16, 4, 2] },
  { id: 'd3', label: 'Spot 3', cells: [15, 29, 4, 2] },
];

export const DECOR_SLOT_IDS: readonly DecorSlotId[] = DECOR_SLOTS.map((s) => s.id);

export type DecorItemId =
  | 'dc_plant'
  | 'dc_beanbag'
  | 'dc_table'
  | 'dc_lamp'
  | 'dc_crate'
  | 'dc_boombox'
  | 'dc_traffic_cone'
  | 'dc_barrel_fire'
  | 'dc_tire_stack'
  | 'dc_trash_bags';

/**
 * `trim` = the drawn pixels inside the source file: [x, y, w, h] (the street props sit in a 64×64 cell
 * with padding; the room's own props are already trimmed). Sizes are on the room's prop ladder.
 */
export type DecorItem = {
  id: DecorItemId;
  label: string;
  src: readonly [number, number];
  trim: readonly [number, number, number, number];
};

export const DECOR_ITEMS: readonly DecorItem[] = [
  { id: 'dc_plant', label: 'Plant', src: [36, 72], trim: [0, 0, 36, 72] },
  { id: 'dc_beanbag', label: 'Beanbag', src: [52, 54], trim: [0, 0, 52, 54] },
  { id: 'dc_table', label: 'Side table', src: [69, 44], trim: [0, 0, 69, 44] },
  { id: 'dc_lamp', label: 'Floor lamp', src: [22, 110], trim: [0, 0, 22, 110] },
  { id: 'dc_crate', label: 'Crate', src: [64, 64], trim: [7, 5, 50, 54] },
  { id: 'dc_boombox', label: 'Boombox', src: [64, 64], trim: [2, 9, 60, 46] },
  { id: 'dc_traffic_cone', label: 'Cone', src: [64, 64], trim: [13, 7, 38, 51] },
  { id: 'dc_barrel_fire', label: 'Fire barrel', src: [64, 64], trim: [17, 1, 30, 61] },
  { id: 'dc_tire_stack', label: 'Tire stack', src: [64, 64], trim: [9, 5, 46, 53] },
  { id: 'dc_trash_bags', label: 'Trash bags', src: [64, 64], trim: [4, 9, 56, 46] },
];

export const DECOR_ITEM_IDS: readonly DecorItemId[] = DECOR_ITEMS.map((i) => i.id);

export const DECOR_UI = {
  title: 'Decor',
  hint: 'Pick something for this spot.',
  takeAway: 'Take away',
  done: 'Done',
  emptyA11y: (slot: string) => `Decor ${slot}, empty. Tap to choose something.`,
  filledA11y: (slot: string, item: string) => `Decor ${slot}: ${item}. Tap to change.`,
} as const;

/** Slot → item. A missing slot is empty. */
export type DecorState = Partial<Record<DecorSlotId, DecorItemId>>;

export function emptyDecor(): DecorState {
  return {};
}

export function decorSlot(id: string): DecorSlot | null {
  return DECOR_SLOTS.find((s) => s.id === id) ?? null;
}

export function decorItem(id: string | null | undefined): DecorItem | null {
  return id ? (DECOR_ITEMS.find((i) => i.id === id) ?? null) : null;
}

/** Tolerant load: unknown slots and unknown items are dropped, anything odd gives the empty room. */
export function parseDecor(raw: unknown): DecorState {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: DecorState = {};
  for (const slot of DECOR_SLOT_IDS) {
    const v = r[slot];
    if (typeof v === 'string' && DECOR_ITEM_IDS.includes(v as DecorItemId)) out[slot] = v as DecorItemId;
  }
  return out;
}

/** Fill (or, with null, empty) one slot. Unknown slot or item → the same state back. Pure. */
export function setDecorSlot(decor: DecorState, slot: string, item: string | null): DecorState {
  if (!decorSlot(slot)) return decor;
  const next: DecorState = { ...decor };
  if (item == null) {
    delete next[slot as DecorSlotId];
  } else if (decorItem(item)) {
    next[slot as DecorSlotId] = item as DecorItemId;
  } else {
    return decor;
  }
  return next;
}

/** A stable key for "what is placed" (effect / memo dependency). */
export function decorKey(decor: DecorState): string {
  return DECOR_SLOT_IDS.map((s) => decor[s] ?? '-').join('|');
}

export type PlacedDecor = {
  slot: DecorSlotId;
  item: DecorItem;
  /** Where the sprite's trimmed box sits, art px: [left, top, w, h]. Centred on the footprint, standing on its bottom edge. */
  rect: readonly [number, number, number, number];
  /** Depth key = the footprint's bottom edge. A pet with feet above it is behind the item. */
  sortY: number;
};

/** Every filled slot, placed in the room. `tile` = the map's cell size (16). */
export function placedDecor(decor: DecorState, tile = 16): PlacedDecor[] {
  const out: PlacedDecor[] = [];
  for (const s of DECOR_SLOTS) {
    const item = decorItem(decor[s.id]);
    if (!item) continue;
    const [c, r, w, h] = s.cells;
    const w2 = item.trim[2];
    const h2 = item.trim[3];
    const bottom = (r + h) * tile;
    out.push({
      slot: s.id,
      item,
      rect: [Math.round(c * tile + (w * tile - w2) / 2), bottom - h2, w2, h2],
      sortY: bottom,
    });
  }
  return out;
}

/**
 * Which draw layer a prop belongs in, against the pet and (when one is in) the visitor, by feet-y vs footprint
 * bottom: A = behind everything, B = between the visitor and the pet (visitor behind the pet), C = between the
 * pet and the visitor (visitor in front), D = in front of everything. Draw order: A · visitor-behind · B · pet ·
 * C · visitor-front · D. Pure.
 */
export type DecorLayer = 'A' | 'B' | 'C' | 'D';
export function decorLayer(sortY: number, petY: number, visitorY: number | null): DecorLayer {
  const petBeats = sortY <= petY; // the pet stands in front of the prop
  if (visitorY == null) return petBeats ? 'A' : 'D';
  const visBeats = sortY <= visitorY;
  if (visitorY < petY) return petBeats ? (visBeats ? 'A' : 'B') : 'D';
  return petBeats ? 'A' : visBeats ? 'C' : 'D';
}

/** A slot's footprint in art px: [left, top, w, h]. */
export function slotRect(slot: DecorSlot, tile = 16): readonly [number, number, number, number] {
  const [c, r, w, h] = slot.cells;
  return [c * tile, r * tile, w * tile, h * tile];
}

/**
 * The room's walk grid with the floor cells under every filled slot blocked, so the pet walks around
 * the decor. Returns the same geom object when nothing is placed. Pure: a new grid, the base is untouched.
 */
export function decorGeom(geom: IsoRoomGeom, decor: DecorState): IsoRoomGeom {
  const filled = DECOR_SLOTS.filter((s) => decor[s.id] != null);
  if (filled.length === 0) return geom;
  const rows = geom.grid.walkable.map((row) => row.split(''));
  for (const s of filled) {
    const [c, r, w, h] = s.cells;
    for (let rr = r; rr < r + h; rr += 1) {
      for (let cc = c; cc < c + w; cc += 1) {
        const line = rows[rr];
        if (line && cc >= 0 && cc < line.length) line[cc] = '0';
      }
    }
  }
  return { ...geom, grid: { ...geom.grid, walkable: rows.map((row) => row.join('')) } };
}
