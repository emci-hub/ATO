/**
 * Turf War static board layers (T7 perf pass, 2026-10-17). The sim re-renders the whole Defend screen every 100 ms tick;
 * these layers never change during a wave, so each is a `memo` component whose props are stable for a board (the sheet
 * key, the memoised decor / road data, the skin), and React skips them on every tick.
 *   TurfBoardBase  — the baked Streetwear board image (under the ambient layer, under the units `<Svg>`).
 *   BoardDecorTiles — the non-Streetwear field tiles (grass + props + pad markers).
 *   StaticRoad      — the non-Streetwear ghost mark + road underlay + stamps, a `<G>` inside the units `<Svg>`.
 * Moved here verbatim from `defend-screen.tsx`; nothing drawn changes.
 */
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { G, Image as SvgImage, Path } from 'react-native-svg';

import type { boardDecor, roadDecor } from '@/play/board-decor';
import { ATO_GHOST_D } from '@/play/board-decor';
import { ClipImage } from '@/play/sheet-sprite';
import { skinArt, skinDrawBox } from '@/play/skin';

/** The baked street board (asphalt roads, sidewalks, manhole pads, props) as ONE image. Paint only. */
export const TurfBoardBase = memo(function TurfBoardBase({ sheetKey }: { sheetKey: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <ClipImage drawable={{ kind: 'sheet', sheetKey, frameKey: 'img' }} />
    </View>
  );
});

/** Field tiles for the non-Streetwear board skins (`skin` is a key only: a skin switch redraws them). */
export const BoardDecorTiles = memo(function BoardDecorTiles({ decor }: { decor: ReturnType<typeof boardDecor>; skin: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.boardTiles]}>
      {decor.map((tile, index) => {
        const source = skinArt(tile.role);
        if (!source) return null;
        const box = skinDrawBox(tile.role, tile.x, tile.y, tile.size);
        const left = tile.anchor === 'center' ? box.x : tile.x;
        const top = tile.anchor === 'center' ? tile.y - (tile.h ?? tile.size) / 2 : tile.y;
        return (
          <Image
            key={`tile-${index}`}
            source={source}
            contentFit="fill"
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: `${tile.size}%`,
              height: `${tile.h ?? tile.size}%`,
              transform: [{ rotate: `${tile.rotate}deg` }],
            }}
          />
        );
      })}
    </View>
  );
});

/**
 * ATO ghost (the 16×16 logo mask, faint, under the road) + the road: a thin dark underlay bed stroked along the waypoint
 * polyline, then cobble stamps on the centreline. Waypoints stay the walk truth. Drawn first in the units `<Svg>`.
 */
export const StaticRoad = memo(function StaticRoad({
  roadD,
  stamps,
  tone,
  width,
  ghostColor,
}: {
  roadD: string;
  stamps: ReturnType<typeof roadDecor>;
  tone: string;
  width: number;
  ghostColor: string;
  skin: string;
}) {
  return (
    <>
      <Path d={ATO_GHOST_D} fill={ghostColor} fillOpacity={0.07} />
      <G>
        <Path d={roadD} stroke={tone} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
      {stamps.map((stamp, index) => {
        const source = skinArt(stamp.role);
        if (!source) return null;
        const box = skinDrawBox(stamp.role, stamp.x, stamp.y, stamp.size);
        return <SvgImage key={`road-${index}`} href={source} x={box.x} y={box.y} width={box.size} height={box.size} />;
      })}
    </>
  );
});

const styles = StyleSheet.create({
  /** Scribble tile dressing — bottom layer (background only). */
  boardTiles: {
    zIndex: 0,
    elevation: 0,
  },
});
