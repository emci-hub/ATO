/**
 * Dive HUD (overhaul, 2026-09-29) — the top bar over the scene (back, zone,
 * depth meter, charges, shells, Info, Gear) and the find icon the haul row
 * and the reveal both draw. Pure view; numbers come from the store view.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { itemArtSource } from '@/play/art';
import { findKind } from '@/play/dive-loot';
import { GLOW_COLOR, findGlow } from '@/play/dive-fx-model';
import { getItemDef, type ItemSlot } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { ART_PT, PIXEL, crispSpan } from '@/play/pixel-theme';
import { PixelBody, PixelButton, PixelFrame, PixelLabel, pixelRenderStyle } from '@/play/pixel-ui';
import { cosmeticById } from '@/play/pet-cosmetics';

const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};

/** One find as an icon with its rarity glow ring. */
export function FindIcon({ id, size = 34, dim = false }: { id: string; size?: number; dim?: boolean }) {
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
  return (
    <PixelFrame
      fill={PIXEL.ink}
      border={glow}
      padded={false}
      style={{ width: artBox + ART_PT * 2, height: artBox + ART_PT * 2, opacity: dim ? 0.45 : 1 }}>
      {art ? (
        <Image
          source={art}
          contentFit="fill"
          transition={0}
          style={{ width: artBox, height: artBox, ...pixelRenderStyle }}
        />
      ) : (
        <MaterialCommunityIcons
          name={icon}
          size={artBox}
          color={cos?.color ?? (cos?.element ? ELEMENT_COLOR[cos.element] : glow)}
        />
      )}
    </PixelFrame>
  );
}

/** Pips for the depth: filled up to the Deepers survived, of the run's max. */
export function DepthMeter({ depth, max }: { depth: number; max: number }) {
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Depth ${depth} of ${max}`}>
      {Array.from({ length: max + 1 }, (_, i) => (
        <View key={i} style={[styles.pip, i <= depth && styles.pipOn]} />
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
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <PixelFrame align="stretch" enter>
      <View style={styles.row}>
        <PixelButton label="‹ Pet" onPress={onBack} variant="muted" accessibilityLabel="Back to the Pet room" style={styles.back} />
        <View style={styles.zoneBox}>
          <PixelLabel numberOfLines={1}>{zone}</PixelLabel>
          <DepthMeter depth={depth} max={maxDepth} />
        </View>
      </View>
      <View style={styles.actions}>
        <PixelButton label="Gear" onPress={onGear} variant="muted" accessibilityLabel="Dive gear" style={styles.chip} />
        <PixelButton label="Info" onPress={onInfo} variant="muted" accessibilityLabel="How Dive works" style={styles.chip} />
      </View>
      <View style={styles.row}>
        <View accessible accessibilityLabel={`Dive charges ${charges}`}>
          <PixelBody color={PIXEL.text}>{charges}</PixelBody>
        </View>
        <View accessible accessibilityLabel={`${shells} shells`}>
          <PixelBody color={PIXEL.amber}>{`${shells} shells`}</PixelBody>
        </View>
      </View>
      </PixelFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', gap: ART_PT * 2, marginTop: ART_PT * 2 },
  pip: { width: ART_PT * 4, height: ART_PT * 4, backgroundColor: '#1C2433' },
  pipOn: { backgroundColor: PIXEL.cyan },
  bar: {
    position: 'absolute',
    top: ART_PT * 4,
    left: ART_PT * 4,
    right: ART_PT * 4,
    gap: ART_PT * 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ART_PT * 2 },
  back: { flexGrow: 0, flexShrink: 0 },
  zoneBox: { alignItems: 'center', flex: 1 },
  actions: { flexDirection: 'row', gap: ART_PT * 2 },
  chip: { flex: 1 },
});
