/**
 * Dive HUD (overhaul, 2026-09-29) — the top bar over the scene (back, zone,
 * depth meter, charges, shells, Info, Gear) and the find icon the haul row
 * and the reveal both draw. Pure view; numbers come from the store view.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { itemArtSource } from '@/play/art';
import { findKind } from '@/play/dive-loot';
import { GLOW_COLOR, findGlow } from '@/play/dive-fx-model';
import { getItemDef, type ItemSlot } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { ART_PT, PIXEL, crispSpan } from '@/play/pixel-theme';
import { PixelBody, PixelFrame, PixelLabel, pixelRenderStyle } from '@/play/pixel-ui';
import { cosmeticById } from '@/play/pet-cosmetics';

const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};

/** One find as an icon with its rarity glow ring. */
export function FindIcon({
  id,
  size = 34,
  dim = false,
  bare = false,
}: {
  id: string;
  size?: number;
  dim?: boolean;
  /** Skip the rarity frame — the haul slot draws its own. */
  bare?: boolean;
}) {
  const kind = findKind(id);
  const glow = GLOW_COLOR[findGlow(id)];
  const cos = kind === 'cosmetic' ? cosmeticById(id) : undefined;
  const def = kind === 'item' ? getItemDef(id) : undefined;
  const art = def
    ? itemArtSource(def.core.art)
    : cos?.itemId
      ? itemArtSource(getItemDef(cos.itemId)?.core.art ?? '')
      : undefined;
  const artBox = crispSpan(32, Math.max(ART_PT * 16, size - ART_PT * 2));
  const icon: ComponentProps<typeof MaterialCommunityIcons>['name'] =
    kind === 'food'
      ? 'fish'
      : kind === 'shells'
        ? 'circle-multiple'
        : kind === 'cosmetic'
          ? 'palette'
          : kind === 'stone'
            ? 'diamond-stone'
            : def
            ? SLOT_ICONS[def.core.slot]
            : 'help';
  const box = bare ? size : artBox;
  const glyph = art ? (
    <Image
      source={art}
      contentFit="fill"
      transition={0}
      style={{ width: box, height: box, ...pixelRenderStyle }}
    />
  ) : (
    <MaterialCommunityIcons
      name={icon}
      size={box}
      color={cos?.color ?? (cos?.element ? ELEMENT_COLOR[cos.element] : glow)}
    />
  );
  if (bare) {
    return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.45 : 1 }}>{glyph}</View>;
  }
  return (
    <PixelFrame
      fill={PIXEL.ink}
      border={glow}
      padded={false}
      glow={false}
      style={{ width: artBox + ART_PT * 2, height: artBox + ART_PT * 2, opacity: dim ? 0.45 : 1 }}>
      {glyph}
    </PixelFrame>
  );
}

/** The mockup shell mark: an ink triangle with a peach fill. */
function ShellMark() {
  const k = ART_PT;
  const ink = PIXEL.ink;
  const fill = '#FCA790';
  const cells: [number, number, string][] = [];
  for (let y = 0; y <= 8; y += 1) {
    for (let x = 0; x <= 8; x += 1) {
      const onOuter = y >= Math.abs(x - 4) * 2;
      const onInner = y >= 1 + Math.abs(x - 4) * 2 && y <= 7 && x >= 1 && x <= 7;
      if (onInner) cells.push([x, y, fill]);
      else if (onOuter) cells.push([x, y, ink]);
    }
  }
  return (
    <View style={{ width: 9 * k, height: 9 * k }}>
      {cells.map(([x, y, color]) => (
        <View key={`${x}-${y}`} style={{ position: 'absolute', left: x * k, top: y * k, width: k, height: k, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** Pips for the depth: filled up to the Deepers survived, of the run's max. */
export function DepthMeter({ depth, max }: { depth: number; max: number }) {
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Depth ${depth} of ${max}`}>
      {Array.from({ length: max + 1 }, (_, i) => (
        <View key={i} style={[styles.pip, i <= depth ? styles.pipOn : styles.pipOff]}>
          <View style={[styles.pipIn, i <= depth ? styles.pipInOn : styles.pipInOff]} />
        </View>
      ))}
    </View>
  );
}

export function DiveTopBar({
  zone,
  depth,
  maxDepth,
  charges,
  shells,
  onBack,
  onInfo,
  onGear,
}: {
  zone: string;
  depth: number;
  maxDepth: number;
  charges: string;
  shells: number;
  onBack: () => void;
  onInfo: () => void;
  onGear: () => void;
}) {
  const shortCharges = charges.split(' · ')[0] ?? charges;
  const { width } = useWindowDimensions();
  const labelPt = width < 400 ? 12 : 16;
  const labelLh = labelPt + 4;
  const label = { fontSize: labelPt, lineHeight: labelLh };
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <PixelFrame align="stretch" padded={false} enter style={styles.panel}>
        <View style={styles.stack}>
          <View style={styles.row}>
            <View style={styles.side}>
              <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to the Pet room">
                <PixelLabel color={PIXEL.cyan} numberOfLines={1} style={label}>{'< Pet'}</PixelLabel>
              </Pressable>
            </View>
            <PixelLabel numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.zone, label]}>{zone}</PixelLabel>
            <View style={[styles.side, styles.sideEnd]}>
              <View style={styles.shells} accessible accessibilityLabel={`${shells} shells`}>
                <ShellMark />
                <PixelBody size="num" color={PIXEL.amber}>{`${shells}`}</PixelBody>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.side}>
              <View style={styles.links}>
                <Pressable onPress={onGear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dive gear">
                  <PixelBody size="sm" color={PIXEL.dim}>Gear</PixelBody>
                </Pressable>
                <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel="How Dive works">
                  <PixelBody size="sm" color={PIXEL.dim}>info ›</PixelBody>
                </Pressable>
              </View>
            </View>
            <DepthMeter depth={depth} max={maxDepth} />
            <View style={[styles.side, styles.sideEnd]} accessible accessibilityLabel={`Dive charges ${charges}`}>
              <PixelBody size="sm" color={PIXEL.dim}>{shortCharges}</PixelBody>
            </View>
          </View>
        </View>
      </PixelFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'center', gap: ART_PT * 3 },
  pip: { width: ART_PT * 8, height: ART_PT * 5, padding: ART_PT },
  pipOn: { backgroundColor: PIXEL.ink },
  pipOff: { backgroundColor: PIXEL.cyanLo },
  pipIn: { flex: 1 },
  pipInOn: { backgroundColor: PIXEL.cyan },
  pipInOff: { backgroundColor: PIXEL.slot },
  bar: { paddingHorizontal: 8, paddingTop: 4 },
  panel: { alignSelf: 'stretch' },
  stack: { paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, justifyContent: 'center' },
  sideEnd: { alignItems: 'flex-end' },
  links: { flexDirection: 'row', alignItems: 'center', gap: ART_PT * 2 },
  zone: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
  shells: { flexDirection: 'row', alignItems: 'center', gap: ART_PT },
});
