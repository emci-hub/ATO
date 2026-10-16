/**
 * Hideout rails, pure (feature/hideout-rails, 2026-10-14).
 *
 * Two floating rails sit over the room's edges and replace every in-room tap spot and the
 * old Hideout / Loft / Call row:
 *   LEFT  = the room's actions (what the map's hotspots used to be: Play, Stash, Underground,
 *           Explore in the Hideout; Sleep, Light, Back in the Loft; Back, Up in the Underground room).
 *   RIGHT = the room switcher (+ Call / Away). Scrolls past 5 items; never grows the layout.
 * Actions come from each room's map.json hotspots, so a new hotspot there shows up on the rail.
 * Locked actions are dimmed, never hidden.
 *
 * `src/play/hideout-rails.tsx` draws them (this file is the pure model); `check:hideout-rails` pins the rules.
 */
import loftMap from '@/assets/art/rooms/loft/loft-td.map.json';
import rooftopMap from '@/assets/art/rooms/rooftop/rooftop-td.map.json';
import undergroundMap from '@/assets/art/rooms/underground/underground-td.map.json';
import hideoutMap from '@/assets/art/rooms/hideout/hideout-td.map.json';

import { parseIsoGeom, type IsoRoomGeom } from '@/play/hideout-iso';
import { HIDEOUT_ROOM_IDS, nextRoomId, roomStage, type HideoutRoomId, type HideoutState } from '@/play/hideout-progress';

/** One rail button: wide enough for "Underground" in the street face; well above the 44 pt floor. */
export const RAIL_BUTTON_PT = 60;
/** Gap between neighbouring rail buttons. */
export const RAIL_GAP_PT = 8;
/** Distance from the stage edge to a rail. */
export const RAIL_EDGE_PT = 8;
/** The pet and its speech bubble stay this far from the stage edge: rail width + 8 pt. */
export const RAIL_CLEAR_PT = RAIL_EDGE_PT + RAIL_BUTTON_PT + 8;
/** More items than this and the rail scrolls. */
export const RAIL_MAX_ITEMS = 5;
/** Half the pet's drawn body in art px: feet stay this much further in so the body clears a rail. */
export const RAIL_BODY_HALF_ART_PX = 24;

/** What a spot press means to the Hideout screen (the same ids the old in-room spots used). */
export type RailSpot = 'play' | 'den' | 'dive' | 'expedition';

export type RailAction =
  | { id: string; label: string; kind: 'spot'; spot: RailSpot; icon: RailIcon; dim: boolean }
  | { id: string; label: string; kind: 'lamp'; icon: RailIcon; dim: boolean }
  | { id: string; label: string; kind: 'view'; room: HideoutRoomId; icon: RailIcon; dim: boolean }
  | { id: string; label: string; kind: 'circle'; icon: RailIcon; dim: boolean };

/** Circle visits (roadmap step 6): the Hideout room's 5th action, last on the rail. */
export const CIRCLE_RAIL_LABEL = 'Circle';

/** Library icons (assets/art/icons/in-use/streetwear). `dpad` is the fallback for a map action with no icon yet. */
export type RailIcon = 'headphones' | 'backpack' | 'subwayTrain' | 'sneaker' | 'sleep' | 'lamp' | 'arrowLeft' | 'arrowUp' | 'dpad' | 'star';

const HOME = parseIsoGeom(hideoutMap);
const LOFT = parseIsoGeom(loftMap, { sleepOnBed: true });
const UNDER = parseIsoGeom(undergroundMap);
const ROOF = parseIsoGeom(rooftopMap);

/** Each room's geometry from its map.json (the rooms the rails read their actions from). */
export const RAIL_ROOM_GEOM: Record<HideoutRoomId, IsoRoomGeom | null> = { hideout: HOME, loft: LOFT, garage: UNDER, rooftop: ROOF };
const GEOM = RAIL_ROOM_GEOM;

/** Rail order per room (by the map's hotspot `action`). Anything the map adds later follows these. */
const ORDER: Record<HideoutRoomId, readonly string[]> = {
  hideout: ['Play', 'Stash', 'Underground', 'Explore'],
  loft: ['Sleep', 'Light', 'Hideout'],
  garage: ['Hideout', 'Up'],
  rooftop: ['Hideout'],
};

const ICON_BY_ACTION: Record<string, RailIcon> = {
  Play: 'headphones',
  Stash: 'backpack',
  Underground: 'subwayTrain',
  Explore: 'sneaker',
  Sleep: 'sleep',
  Light: 'lamp',
  Hideout: 'arrowLeft',
  Up: 'arrowUp',
};

/** A map action's rail label: one word. "Hideout" (the way out of a room) reads "Back". */
export function railLabel(action: string): string {
  return action === 'Hideout' ? 'Back' : action;
}

/** The room "Up" leads to: the next room in the build order (Underground → Rooftop). */
export function upRoom(room: HideoutRoomId): HideoutRoomId | null {
  return nextRoomId(room);
}

function viewDim(target: HideoutRoomId | null, hideout: HideoutState): boolean {
  return target == null || roomStage(target, hideout) !== 'done';
}

/** The left rail for the room being viewed. `circle`: add Circle visits (Hideout room only, built rooms only). */
export function leftRailActions(room: HideoutRoomId, hideout: HideoutState, opts: { circle?: boolean } = {}): RailAction[] {
  const geom = GEOM[room];
  if (!geom) return [];
  const spots = geom.hotspots as readonly { id: string; kind: string; action: string; coach: string }[];
  const rank = (a: string) => {
    const i = ORDER[room].indexOf(a);
    return i < 0 ? ORDER[room].length : i;
  };
  const sorted = [...spots].sort((a, b) => rank(a.action) - rank(b.action));
  // A room that is not built yet (seen by swipe): only the way out stays lit.
  const unbuilt = roomStage(room, hideout) !== 'done';
  const out: RailAction[] = [];
  for (const s of sorted) {
    const label = railLabel(s.action);
    const icon = ICON_BY_ACTION[s.action] ?? 'dpad';
    const id = `${room}:${s.id}`;
    if (s.kind === 'lamp') {
      out.push({ id, label, kind: 'lamp', icon, dim: unbuilt });
    } else if (s.action === 'Hideout') {
      out.push({ id, label, kind: 'view', room: 'hideout', icon, dim: room === 'hideout' });
    } else if (s.action === 'Up') {
      const up = upRoom(room);
      out.push({ id, label, kind: 'view', room: up ?? room, icon, dim: viewDim(up, hideout) });
    } else if (s.coach === 'play' || s.coach === 'den' || s.coach === 'dive' || s.coach === 'expedition') {
      out.push({ id, label, kind: 'spot', spot: s.coach, icon, dim: unbuilt });
    }
  }
  if (opts.circle && room === 'hideout' && out.length < RAIL_MAX_ITEMS) {
    out.push({ id: 'hideout:circle', label: CIRCLE_RAIL_LABEL, kind: 'circle', icon: 'star', dim: unbuilt });
  }
  return out;
}

export type RailRoom = { id: HideoutRoomId; label: string; selected: boolean; petHere: boolean; locked: boolean };

/** The right rail's rooms: every room the Hideout shows (locked / future ones dimmed with a lock). */
export function railRooms(hideout: HideoutState, viewed: HideoutRoomId, petRoom: HideoutRoomId, labelOf: (id: HideoutRoomId) => string): RailRoom[] {
  return HIDEOUT_ROOM_IDS.filter((id) => roomStage(id, hideout) !== 'hidden').map((id) => ({
    id,
    label: labelOf(id),
    selected: viewed === id,
    petHere: petRoom === id,
    locked: roomStage(id, hideout) !== 'done',
  }));
}

/** Rooms + Call: scrolls when there are more than {@link RAIL_MAX_ITEMS}. */
export function railScrolls(roomCount: number): boolean {
  return roomCount + 1 > RAIL_MAX_ITEMS;
}

/** Tallest a rail may be: the stage minus an edge at the top and the bottom. */
export function railMaxHeight(stageH: number): number {
  return Math.max(0, stageH - RAIL_EDGE_PT * 2);
}

/** Walk bounds in art px (feet) that keep the pet's body clear of both rails. Pure; pet-room blocks columns outside. */
export function railWalkBounds(input: { stageW: number; originLeft: number; pt: number }): { minX: number; maxX: number } {
  const pt = input.pt > 0 ? input.pt : 1;
  return {
    minX: (RAIL_CLEAR_PT - input.originLeft) / pt + RAIL_BODY_HALF_ART_PX,
    maxX: (input.stageW - RAIL_CLEAR_PT - input.originLeft) / pt - RAIL_BODY_HALF_ART_PX,
  };
}

/** The leftmost x (screen pt) a speech bubble may start at, and the rightmost it may end at. */
export function railSpeechRange(input: { stageW: number }): { left: number; right: number } {
  return { left: RAIL_CLEAR_PT, right: input.stageW - RAIL_CLEAR_PT };
}

/** Label size: the long ones ("Underground") step down a size so they never clip. */
export function railLabelPt(label: string): number {
  return label.length > 8 ? 8 : 10;
}
