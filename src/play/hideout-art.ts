/**
 * Swappable Hideout room art + maps (3/4 top-down, layout A).
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Replace the
 * files under `assets/art/rooms/` (ids in the art registry) and, if names
 * change, the `ROOM.<room>.<slot>` layers (skeleton: src/art/skeletons.ts) and `ART.*` extras
 * in `ROOM_ART` (a missing id is a type error).
 * Maps use the option A 352×576 schema (32px art tiles, 16px walk cells;
 * hideout-td.map.json): floor 14×26 cells, door gap 4, occluders as ONE
 * combined layer per time/neon state with per-prop crop + sortY.
 * Tease pieces are Hideout *wall* overlays, not floor props.
 *
 * Do not pack these into the Streetwear ui-kit until the real art ships —
 * placeholders stay loose so they can swap without a sheet rebuild.
 */
import type { ImageSourcePropType } from 'react-native';

import hideoutMap from '@/assets/art/rooms/hideout/hideout-td.map.json';
import loftMap from '@/assets/art/rooms/loft/loft-td.map.json';
import undergroundMap from '@/assets/art/rooms/underground/underground-td.map.json';
import teaseLayout from '@/assets/art/rooms/hideout/hideout-tease.json';
import { ART, ROOM, getArtSource, type ArtId } from '@/art/art';
import { HIDEOUT_ART_PLACEHOLDER, type HideoutRoomId } from '@/play/hideout-progress';

function png(id: ArtId): ImageSourcePropType {
  const src = getArtSource(id);
  if (!src) throw new Error(`art library missing ${id} — run npm run art:registry`);
  return src;
}

export const HIDEOUT_ART_SWAP = 'src/play/hideout-art.ts';

type Rect = { pos: readonly [number, number]; size: readonly [number, number] };

export type HideoutTeaseLayout = {
  boarded: Rect;
  tarp: Rect;
  scaffold: Rect;
  sign: Rect;
};

function asRect(v: { pos: number[]; size: number[] }): Rect {
  return {
    pos: [v.pos[0] ?? 0, v.pos[1] ?? 0],
    size: [v.size[0] ?? 0, v.size[1] ?? 0],
  };
}

export const HIDEOUT_TEASE: HideoutTeaseLayout = {
  boarded: asRect(teaseLayout.boarded),
  tarp: asRect(teaseLayout.tarp),
  scaffold: asRect(teaseLayout.scaffold),
  sign: asRect(teaseLayout.sign),
};

export type RoomArtKey =
  | 'back'
  | 'floor'
  | 'props'
  | 'front'
  | 'neonA'
  | 'neonB'
  | 'occludeDayA'
  | 'occludeDayB'
  | 'occludeNightA'
  | 'occludeNightB'
  | 'windowDay'
  | 'windowNight'
  | 'glow'
  | 'snapshot'
  | 'shell';

export const ROOM_ART: Record<
  HideoutRoomId,
  Partial<Record<RoomArtKey, ImageSourcePropType>> & { placeholder: boolean; map: unknown }
> = {
  hideout: {
    // Real PixelLab art since 2026-10-12 (scripts/hideout-room-art.ts); the Loft followed on 2026-10-15; Underground is still greybox.
    placeholder: false,
    map: hideoutMap,
    back: png(ROOM.hideout.back),
    floor: png(ROOM.hideout.floor),
    props: png(ROOM.hideout.props),
    neonA: png(ROOM.hideout.neonA),
    neonB: png(ROOM.hideout.neonB),
    occludeDayA: png(ROOM.hideout.occluderDayA),
    occludeDayB: png(ROOM.hideout.occluderDayB),
    occludeNightA: png(ROOM.hideout.occluderNightA),
    occludeNightB: png(ROOM.hideout.occluderNightB),
    snapshot: png(ROOM.hideout.back),
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    back: png(ROOM.loft.back),
    floor: png(ROOM.loft.floor),
    props: png(ROOM.loft.props),
    neonA: png(ROOM.loft.neonA),
    neonB: png(ROOM.loft.neonB),
    occludeDayA: png(ROOM.loft.occluderDayA),
    occludeDayB: png(ROOM.loft.occluderDayB),
    occludeNightA: png(ROOM.loft.occluderNightA),
    occludeNightB: png(ROOM.loft.occluderNightB),
    windowDay: png(ROOM.loft.windowDay),
    windowNight: png(ROOM.loft.windowNight),
    glow: png(ROOM.loft.glow),
    snapshot: png(ROOM.loft.back),
  },
  garage: {
    placeholder: true,
    map: loftMap,
    shell: png(ART.room.hideout.neighborBoardedTd),
    snapshot: png(ART.room.hideout.neighborBoardedTd),
  },
  rooftop: {
    placeholder: true,
    map: loftMap,
    shell: png(ART.room.hideout.neighborBoardedTd),
    snapshot: png(ART.room.hideout.neighborBoardedTd),
  },
};

export const UNDERGROUND_ART: Partial<Record<RoomArtKey, ImageSourcePropType>> & {
  placeholder: boolean;
  map: unknown;
} = {
  placeholder: true,
  map: undergroundMap,
  back: png(ROOM.underground.back),
  floor: png(ROOM.underground.floor),
  props: png(ROOM.underground.props),
  neonA: png(ROOM.underground.neonA),
  neonB: png(ROOM.underground.neonB),
  occludeDayA: png(ROOM.underground.occluderDayA),
  occludeDayB: png(ROOM.underground.occluderDayB),
  occludeNightA: png(ROOM.underground.occluderNightA),
  occludeNightB: png(ROOM.underground.occluderNightB),
  snapshot: png(ROOM.underground.back),
};

export const TEASE_ART = {
  boarded: png(ART.room.hideout.boarded),
  tarp: png(ART.room.hideout.tarp),
  scaffold: png(ART.room.hideout.scaffold),
  sign: png(ART.room.hideout.buildSign),
};

export const BAR_ART: Record<HideoutRoomId, ImageSourcePropType> = {
  hideout: png(ART.ui.markers.streetwear.barHideout),
  loft: png(ART.ui.markers.streetwear.barLoft),
  garage: png(ART.ui.markers.streetwear.barGarage),
  rooftop: png(ART.ui.markers.streetwear.barRooftop),
};

export const BAR_MARKER_ART: ImageSourcePropType = png(ART.ui.markers.streetwear.barMarker);

/** Streetwear 32 px icons on the Hideout's kit buttons (hotspots, Call, locked rooms). */
export const SPOT_ICON_ART: Partial<Record<string, ImageSourcePropType>> = {
  door: png(ART.icon.streetwear.sneaker),
  chair: png(ART.icon.streetwear.backpack),
  boombox: png(ART.icon.streetwear.headphones),
  manhole: png(ART.icon.streetwear.subwayTrain),
};
/** Rail icons by name (hideout-rails-model.ts). Sleep / Light / Back / Up are the dedicated PixelLab icons (2026-10-15); `dpad` is the fallback. */
export const RAIL_ICON_ART: Record<'headphones' | 'backpack' | 'subwayTrain' | 'sneaker' | 'sleep' | 'lamp' | 'arrowLeft' | 'arrowUp' | 'dpad' | 'star', ImageSourcePropType> = {
  star: png(ART.icon.streetwear.star),
  headphones: png(ART.icon.streetwear.headphones),
  backpack: png(ART.icon.streetwear.backpack),
  subwayTrain: png(ART.icon.streetwear.subwayTrain),
  sneaker: png(ART.icon.streetwear.sneaker),
  sleep: png(ART.icon.streetwear.sleep),
  lamp: png(ART.icon.streetwear.lamp),
  arrowLeft: png(ART.icon.streetwear.arrowLeft),
  arrowUp: png(ART.icon.streetwear.arrowUp),
  dpad: png(ART.icon.streetwear.dpad),
};
export const CALL_ICON_ART: ImageSourcePropType = png(ART.icon.streetwear.speech);
export const LOCK_ICON_ART: ImageSourcePropType = png(ART.icon.streetwear.padlock);

export const ZZZ_ART: readonly ImageSourcePropType[] = [
  png(ART.room.hideout.zzz0),
  png(ART.room.hideout.zzz1),
  png(ART.room.hideout.zzz2),
];

export const NEIGHBOR_BOARDED_ART: ImageSourcePropType = png(ART.room.hideout.neighborBoardedTd);

// From the Loft map, so the window overlay follows the room layout (352 wide since 2026-10-13).
const LOFT_WINDOW = (loftMap as { window?: { pos: number[]; size: number[] } | null }).window;
export const LOFT_WINDOW_POS: readonly [number, number] = [LOFT_WINDOW?.pos[0] ?? 112, LOFT_WINDOW?.pos[1] ?? 40];
export const LOFT_WINDOW_SIZE: readonly [number, number] = [LOFT_WINDOW?.size[0] ?? 128, LOFT_WINDOW?.size[1] ?? 72];
